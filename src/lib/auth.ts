import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { query, queryOne } from "./db";
import type { Role, User } from "./types";

const COOKIE = "classroom_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query("insert into app.sessions (token, user_id, expires_at) values ($1, $2, $3)", [
    token,
    userId,
    expiresAt,
  ]);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await query("delete from app.sessions where token = $1", [token]);
  store.delete(COOKIE);
}

/** The signed-in user, or null. Memoised for the duration of one request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return queryOne<User>(
    `select u.id, u.role, u.email, u.username, u.full_name, u.student_number, u.created_at
       from app.sessions s
       join app.users u on u.id = s.user_id
      where s.token = $1 and s.expires_at > now()`,
    [token],
  );
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export function isStaff(user: { role: Role } | null): boolean {
  return user?.role === "TEACHER" || user?.role === "ADMIN";
}

/** The group the user currently belongs to, if any. */
export async function getMyGroupId(userId: string): Promise<string | null> {
  const row = await queryOne<{ group_id: string }>(
    "select group_id from app.group_members where user_id = $1",
    [userId],
  );
  return row?.group_id ?? null;
}
