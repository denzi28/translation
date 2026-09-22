"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { isGroupMember } from "@/lib/data";
import { sanitizePostHtml } from "@/lib/sanitize";
import type { FormState } from "./auth";

/** Only members of the owning group may write; everyone else is read-only. */
async function assertCanEdit(userId: string, postId: string): Promise<string> {
  const post = await queryOne<{ group_id: string }>(
    "select group_id from app.posts where id = $1",
    [postId],
  );
  if (!post) throw new Error("NOT_FOUND");
  if (!(await isGroupMember(userId, post.group_id))) throw new Error("FORBIDDEN");
  return post.group_id;
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
  const title = String(formData.get("title") ?? "").trim() || "Untitled post";

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
  const title = String(formData.get("title") ?? "").trim();
  const html = sanitizePostHtml(String(formData.get("content_html") ?? ""));
  const intent = String(formData.get("intent") ?? "save");

  if (!title) return { error: "Give the post a title before saving." };

  let groupId: string;
  try {
    groupId = await assertCanEdit(user.id, postId);
  } catch {
    return { error: "You do not have permission to edit this post." };
  }

  if (intent === "publish") {
    await query(
      `update app.posts
          set title = $1, content_html = $2, status = 'PUBLISHED', updated_by = $3,
              updated_at = now(), published_at = coalesce(published_at, now())
        where id = $4`,
      [title, html, user.id, postId],
    );
  } else if (intent === "unpublish") {
    await query(
      `update app.posts
          set title = $1, content_html = $2, status = 'DRAFT', updated_by = $3, updated_at = now()
        where id = $4`,
      [title, html, user.id, postId],
    );
  } else {
    await query(
      `update app.posts set title = $1, content_html = $2, updated_by = $3, updated_at = now()
        where id = $4`,
      [title, html, user.id, postId],
    );
  }

  refresh(groupId, postId);
  if (intent === "publish") redirect(`/posts/${postId}`);
  return {
    ok: intent === "unpublish" ? "Moved back to draft." : "Draft saved.",
  };
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
