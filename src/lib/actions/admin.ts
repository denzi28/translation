"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/types";
import type { FormState } from "./auth";

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  void admin;

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "TEACHER") as Role;
  const password = String(formData.get("password") ?? "");

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return { error: "Username must be 3 to 40 lowercase letters, digits, dots, dashes or underscores." };
  }
  if (!fullName) return { error: "Enter a full name." };
  if (role !== "TEACHER" && role !== "ADMIN") return { error: "Pick a valid staff role." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const clash = await queryOne("select 1 as ok from app.users where lower(username) = $1", [username]);
  if (clash) return { error: "That username is taken." };

  await query(
    "insert into app.users (role, username, full_name, password_hash) values ($1, $2, $3, $4)",
    [role, username, fullName, hashPassword(password)],
  );
  revalidatePath("/admin");
  return { ok: `${role === "ADMIN" ? "Admin" : "Teacher"} account created.` };
}

export async function setUserRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!["STUDENT", "TEACHER", "ADMIN"].includes(role)) return { error: "Unknown role." };
  if (userId === admin.id) return { error: "You cannot change your own role." };

  const target = await queryOne<{ student_number: string | null; username: string | null }>(
    "select student_number, username from app.users where id = $1",
    [userId],
  );
  if (!target) return { error: "That account no longer exists." };
  if (role === "STUDENT" && !target.student_number) {
    return { error: "A staff account has no student number, so it cannot become a student." };
  }
  if (role !== "STUDENT" && !target.username) {
    return { error: "Give the account a username before promoting it to staff." };
  }

  await query("update app.users set role = $1 where id = $2", [role, userId]);
  revalidatePath("/admin");
  return { ok: "Role updated." };
}

export async function setUsernameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");
  const userId = String(formData.get("user_id") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { error: "Invalid username." };

  const clash = await queryOne("select 1 as ok from app.users where lower(username) = $1 and id <> $2", [
    username,
    userId,
  ]);
  if (clash) return { error: "That username is taken." };

  await query("update app.users set username = $1 where id = $2", [username, userId]);
  revalidatePath("/admin");
  return { ok: "Username set." };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");
  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  await query("update app.users set password_hash = $1 where id = $2", [
    hashPassword(password),
    userId,
  ]);
  // Force the account to sign in again everywhere.
  await query("delete from app.sessions where user_id = $1", [userId]);
  revalidatePath("/admin");
  return { ok: "Password reset." };
}

export async function deleteUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const userId = String(formData.get("user_id") ?? "");
  if (userId === admin.id) return { error: "You cannot delete your own account." };

  const authored = await queryOne<{ n: number }>(
    "select count(*)::int as n from app.posts where created_by = $1",
    [userId],
  );
  if ((authored?.n ?? 0) > 0) {
    return { error: "That account authored blog posts. Delete or reassign those posts first." };
  }

  await query("delete from app.users where id = $1", [userId]);
  revalidatePath("/admin");
  revalidatePath("/groups");
  return { ok: "Account deleted." };
}
