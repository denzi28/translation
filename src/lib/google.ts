import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSession } from "./auth";
import { isUniversityEmail } from "./constants";
import { queryOne } from "./db";

/**
 * Students sign in only with Google, and only with a university address.
 * The first time, Google tells us who they are and they add their name and
 * student number on the register page; after that Google alone signs them in.
 *
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (an OAuth client of type
 * "Web application" whose redirect URIs are <site>/api/auth/google/callback).
 */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Local tests sign students in without Google; production never sets this. */
export function testLoginEnabled(): boolean {
  return process.env.ENABLE_TEST_LOGIN === "1" && process.env.VERCEL !== "1";
}

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (s) return s;
  if (testLoginEnabled()) return "local-test-secret";
  throw new Error("AUTH_SECRET is not set");
}

/** A small tamper-proof cookie value: JSON, base64url, and an HMAC. */
export function seal(payload: Record<string, unknown>, minutes: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + minutes * 60_000 })).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}

export function unseal<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
  return data.exp > Date.now() ? data : null;
}

export const OAUTH_COOKIE = "iuc_google_oauth";
export const PENDING_COOKIE = "iuc_google_pending";
export type Pending = { email: string; name: string };

export function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(16).toString("base64url") };
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * What happens once Google (or a local test) has vouched for an address:
 * a known student is signed in; a new one is sent to add their details.
 * Returns where to go next.
 */
export async function finishGoogle(emailRaw: string, name: string): Promise<string> {
  const email = emailRaw.trim().toLowerCase();
  if (!isUniversityEmail(email)) return "/login?error=domain";
  const existing = await queryOne<{ id: string }>(
    "select id from app.users where lower(email) = $1 and role = 'STUDENT'",
    [email],
  );
  const store = await cookies();
  if (existing) {
    await createSession(existing.id);
    store.delete(PENDING_COOKIE);
    return "/dashboard";
  }
  store.set(PENDING_COOKIE, seal({ email, name }, 30), { ...cookieOptions, maxAge: 30 * 60 });
  return "/register";
}

export async function readPending(): Promise<Pending | null> {
  return unseal<Pending>((await cookies()).get(PENDING_COOKIE)?.value);
}

export { cookieOptions };

/**
 * The address the visitor actually used (the site has two domains, and
 * behind Vercel the server's own URL is not it), for Google's return address.
 */
export function originOf(request: Request): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/** A redirect by path, so it stays on whichever domain the visitor is on. */
export function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}
