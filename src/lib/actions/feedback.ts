"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { FormState } from "./auth";

/**
 * Grades and comments are written by staff only. Reading them is restricted to
 * staff and the members of the target group (see `canSeeFeedback`).
 */
export async function saveFeedbackAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    return { error: "Only the teacher or an admin can leave an evaluation." };
  }

  const groupId = String(formData.get("group_id") ?? "");
  const rawPostId = String(formData.get("post_id") ?? "").trim();
  const postId = rawPostId === "" ? null : rawPostId;
  const rawGrade = String(formData.get("grade") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();

  let grade: number | null = null;
  if (rawGrade !== "") {
    grade = Number(rawGrade);
    if (!Number.isInteger(grade) || grade < 0 || grade > 100) {
      return { error: "The grade must be a whole number between 0 and 100." };
    }
  }
  if (grade === null && comment === "") {
    return { error: "Write some feedback, or enter a grade, or both." };
  }

  const group = await queryOne("select 1 as ok from app.groups where id = $1", [groupId]);
  if (!group) return { error: "That group no longer exists." };

  await query(
    `insert into app.feedback (group_id, post_id, author_id, grade, comment)
     values ($1, $2, $3, $4, $5)`,
    [groupId, postId, user.id, grade, comment],
  );

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/evaluations");
  revalidatePath("/my-group");
  revalidatePath("/dashboard");
  if (postId) revalidatePath(`/posts/${postId}`);
  return { ok: "Evaluation saved. Only this group, the teacher and admins can see it." };
}

export async function deleteFeedbackAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const feedbackId = String(formData.get("feedback_id") ?? "");

  const row = await queryOne<{ group_id: string; author_id: string }>(
    "select group_id, author_id from app.feedback where id = $1",
    [feedbackId],
  );
  if (!row) return { error: "That entry no longer exists." };
  if (user.role !== "ADMIN" && row.author_id !== user.id) {
    return { error: "You can only delete your own evaluations." };
  }

  await query("delete from app.feedback where id = $1", [feedbackId]);
  revalidatePath(`/groups/${row.group_id}`);
  revalidatePath("/evaluations");
  return { ok: "Evaluation deleted." };
}
