"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { PENDING_COOKIE, readPending } from "@/lib/google";
import { verifyPassword } from "@/lib/password";
import type { Role } from "@/lib/types";

export type FormState = {
  error?: string;
  ok?: string;
  /**
   * What the person had typed, echoed back so a rejected form can be redrawn
   * with their work intact. Passwords are deliberately never included, so they
   * are the only thing cleared.
   */
  values?: Record<string, string>;
};

/**
 * A student's first visit: Google has vouched for their university address
 * (see src/lib/google.ts); they add their name and student number here. The
 * account has no password, since Google signs them in from now on.
 */
export async function completeProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pending = await readPending();
  if (!pending) return { error: "Your Google sign-in has expired. Sign in with Google again." };
  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const studentNumber = String(formData.get("student_number") ?? "").trim();
  const values = { full_name: fullName, student_number: studentNumber };
  const reject = (error: string): FormState => ({ error, values });

  if (!fullName || !studentNumber) return reject("Enter your full name and your student number.");
  if (fullName.length > 80) return reject("That name is too long.");
  if (!/^[A-Za-z0-9-]{3,20}$/.test(studentNumber)) {
    return reject("Student number must be 3 to 20 letters, digits or dashes.");
  }
  const clash = await queryOne<{ email: string | null }>(
    "select email from app.users where lower(email) = $1 or student_number = $2",
    [pending.email, studentNumber],
  );
  if (clash) {
    return reject(
      clash.email?.toLowerCase() === pending.email
        ? "An account with this Google address already exists. Sign in with Google."
        : "That student number is already registered.",
    );
  }
  const created = await queryOne<{ id: string }>(
    `insert into app.users (role, email, full_name, student_number, password_hash)
     values ('STUDENT', $1, $2, $3, 'google') returning id`,
    [pending.email, fullName, studentNumber],
  );
  if (!created) return reject("Could not create the account. Please try again.");
  (await cookies()).delete(PENDING_COOKIE);
  await createSession(created.id);
  redirect("/dashboard");
}

/**
 * Staff sign in from the two buttons on the sign-in page: the button says
 * which role, the password says which account. A wrong password is answered
 * slowly, to make guessing expensive.
 */
export async function staffLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const role = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");
  if (role !== "TEACHER" && role !== "ADMIN") return { error: "Choose teacher or admin." };
  if (!password) return { error: "Enter the password." };
  const accounts = await query<{ id: string; password_hash: string }>(
    "select id, password_hash from app.users where role = $1 order by created_at",
    [role],
  );
  const match = accounts.find((a) => verifyPassword(password, a.password_hash));
  if (!match) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Incorrect password." };
  }
  await createSession(match.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
