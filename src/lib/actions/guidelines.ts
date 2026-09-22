"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { FormState } from "./auth";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Stores (or replaces) the single course-guidelines PDF. Only staff may upload;
 * every signed-in user can read it back from /api/guidelines/file.
 */
export async function uploadGuidelinesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    return { error: "Only the teacher or an admin can replace the guidelines PDF." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF file first." };
  if (file.size > MAX_BYTES) return { error: "The file must be 8 MB or smaller." };

  const bytes = Buffer.from(await file.arrayBuffer());
  // A real PDF always starts with the %PDF- signature.
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { error: "That file is not a PDF." };
  }

  await query(
    `insert into app.guidelines (id, filename, mime_type, byte_size, data, uploaded_by, uploaded_at)
     values (1, $1, 'application/pdf', $2, $3, $4, now())
     on conflict (id) do update
        set filename = excluded.filename,
            mime_type = excluded.mime_type,
            byte_size = excluded.byte_size,
            data = excluded.data,
            uploaded_by = excluded.uploaded_by,
            uploaded_at = now()`,
    [file.name || "project-guidelines.pdf", bytes.length, bytes, user.id],
  );

  revalidatePath("/guidelines");
  return { ok: `Uploaded “${file.name}” (${Math.round(bytes.length / 1024)} KB).` };
}

export async function deleteGuidelinesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  void formData;
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    return { error: "Only the teacher or an admin can remove the guidelines PDF." };
  }
  await query("delete from app.guidelines where id = 1");
  revalidatePath("/guidelines");
  return { ok: "Guidelines PDF removed." };
}
