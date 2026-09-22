"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { isGroupMember } from "@/lib/data";
import { missingSections, type EntryValues } from "@/lib/entry";
import { sanitizePostHtml } from "@/lib/sanitize";
import type { FormState } from "./auth";

/** Pulls the mould's fields out of the submitted form. */
function readEntry(formData: FormData): EntryValues {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    title: text("title"),
    pronunciation: text("pronunciation"),
    category: text("category"),
    definition: text("definition"),
    context_notes: text("context_notes"),
    examples: text("examples"),
    attempts: text("attempts"),
    why_untranslatable: text("why_untranslatable"),
  };
}

/** Only members of the owning group may write; everyone else is read-only. */
async function assertCanEdit(
  userId: string,
  postId: string,
): Promise<{ groupId: string; status: "DRAFT" | "PUBLISHED" }> {
  const post = await queryOne<{ group_id: string; status: "DRAFT" | "PUBLISHED" }>(
    "select group_id, status from app.posts where id = $1",
    [postId],
  );
  if (!post) throw new Error("NOT_FOUND");
  if (!(await isGroupMember(userId, post.group_id))) throw new Error("FORBIDDEN");
  return { groupId: post.group_id, status: post.status };
}

function refresh(groupId: string, postId?: string) {
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/my-group");
  revalidatePath("/dashboard");
  if (postId) {
    revalidatePath(`/posts/${postId}`);
    revalidatePath(`/posts/${postId}/edit`);
  }
}

export async function createPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const groupId = String(formData.get("group_id") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "New entry";

  if (!(await isGroupMember(user.id, groupId))) {
    return { error: "Only members of this group can write its blog posts." };
  }
  const created = await queryOne<{ id: string }>(
    `insert into app.posts (group_id, title, created_by, updated_by)
     values ($1, $2, $3, $3) returning id`,
    [groupId, title, user.id],
  );
  if (!created) return { error: "Could not create the post." };

  refresh(groupId, created.id);
  redirect(`/posts/${created.id}/edit`);
}

export async function savePostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const postId = String(formData.get("post_id") ?? "");
  const entry = readEntry(formData);
  const html = sanitizePostHtml(String(formData.get("content_html") ?? ""));
  const intent = String(formData.get("intent") ?? "save");

  if (!entry.title) return { error: "Start with the word or phrase the entry is about." };

  let groupId: string;
  let currentStatus: "DRAFT" | "PUBLISHED";
  try {
    ({ groupId, status: currentStatus } = await assertCanEdit(user.id, postId));
  } catch {
    return { error: "You do not have permission to edit this post." };
  }

  // A draft may be half-written; anything published may not be. That covers
  // both publishing and editing something already published.
  const mustBeComplete = intent === "publish" || (intent === "save" && currentStatus === "PUBLISHED");
  if (mustBeComplete) {
    const missing = missingSections(entry);
    if (missing.length > 0) {
      return {
        error:
          intent === "publish"
            ? `Complete the entry before publishing — still blank: ${missing.join(", ")}.`
            : `A published entry has to stay complete — still blank: ${missing.join(", ")}. ` +
              `Fill them in, or use “Unpublish” to keep working on it as a draft.`,
      };
    }
  }

  const status =
    intent === "publish" ? "PUBLISHED" : intent === "unpublish" ? "DRAFT" : null;

  await query(
    `update app.posts
        set title = $1, pronunciation = $2, category = $3, definition = $4,
            context_notes = $5, examples = $6, attempts = $7, why_untranslatable = $8,
            content_html = $9,
            status = coalesce($10, status),
            published_at = case when $10 = 'PUBLISHED'
                                then coalesce(published_at, now()) else published_at end,
            updated_by = $11, updated_at = now()
      where id = $12`,
    [
      entry.title,
      entry.pronunciation,
      entry.category,
      entry.definition,
      entry.context_notes,
      entry.examples,
      entry.attempts,
      entry.why_untranslatable,
      html,
      status,
      user.id,
      postId,
    ],
  );

  refresh(groupId, postId);
  if (intent === "publish") redirect(`/posts/${postId}`);
  return { ok: intent === "unpublish" ? "Moved back to draft." : "Draft saved." };
}

export async function deletePostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const postId = String(formData.get("post_id") ?? "");

  const post = await queryOne<{ group_id: string }>(
    "select group_id from app.posts where id = $1",
    [postId],
  );
  if (!post) return { error: "That post no longer exists." };
  const allowed = user.role === "ADMIN" || (await isGroupMember(user.id, post.group_id));
  if (!allowed) return { error: "You do not have permission to delete this post." };

  await query("delete from app.posts where id = $1", [postId]);
  refresh(post.group_id);
  redirect(`/groups/${post.group_id}`);
}
