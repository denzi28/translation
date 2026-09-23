"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { classicFor, rememberClassicPreview } from "@/lib/classic";
import { queryOne } from "@/lib/db";
import { isUniversityEmail, UNIVERSITY_EMAIL_DOMAIN } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/password";
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const studentNumber = String(formData.get("student_number") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  // Everything except the passwords is handed back with any error, so a
  // rejected attempt only clears the two password boxes.
  const values = { full_name: fullName, email, student_number: studentNumber };
  const reject = (error: string): FormState => ({ error, values });

  if (!fullName || !email || !studentNumber || !password) {
    return reject("All fields are required.");
  }
  if (!EMAIL_RE.test(email)) return reject("Enter a valid email address.");
  if (!isUniversityEmail(email)) {
    return reject(
      `Register with your university email address. It has to end in ` +
        `${UNIVERSITY_EMAIL_DOMAIN} (for example ada.lovelace@ogr.${UNIVERSITY_EMAIL_DOMAIN}). ` +
        `A personal address such as Gmail or Outlook cannot be used.`,
    );
  }
  if (!/^[A-Za-z0-9-]{3,20}$/.test(studentNumber)) {
    return reject("Student number must be 3 to 20 letters, digits or dashes.");
  }
  if (password.length < 8) return reject("Password must be at least 8 characters.");
  if (password !== confirm) {
    return reject("The two passwords do not match. Type them again.");
  }

  const clash = await queryOne<{ email: string | null; student_number: string | null }>(
    "select email, student_number from app.users where lower(email) = $1 or student_number = $2",
    [email, studentNumber],
  );
  if (clash) {
    return reject(
      clash.email?.toLowerCase() === email
        ? "An account with that email already exists."
        : "That student number is already registered.",
    );
  }

  const created = await queryOne<{ id: string }>(
    `insert into app.users (role, email, full_name, student_number, password_hash)
     values ('STUDENT', $1, $2, $3, $4) returning id`,
    [email, fullName, studentNumber, hashPassword(password)],
  );
  if (!created) return reject("Could not create the account. Please try again.");

  await createSession(created.id);
  redirect("/dashboard");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { identifier };
  if (!identifier || !password) return { error: "Enter your credentials.", values };

  // Students sign in with their email, staff with their username.
  const user = await queryOne<{ id: string; password_hash: string; role: Role }>(
    `select id, password_hash, role from app.users
      where lower(email) = $1 or lower(username) = $1`,
    [identifier],
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "Incorrect credentials.", values };
  }

  await createSession(user.id);
  if (classicFor(user.role)) await rememberClassicPreview();
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user && classicFor(user.role)) await rememberClassicPreview();
  await destroySession();
  redirect("/login");
}
