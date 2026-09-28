import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { OAUTH_COOKIE, finishGoogle, originOf, redirectTo, unseal } from "@/lib/google";

export const dynamic = "force-dynamic";

type IdToken = { iss: string; aud: string; exp: number; email?: string; email_verified?: boolean; name?: string };

/**
 * Google sends the student back here with a one-time code. The code is
 * exchanged directly with Google over TLS, so the identity it returns can be
 * trusted as it stands (OpenID Connect, section 3.1.3.7).
 */
export async function GET(request: NextRequest) {
  const store = await cookies();
  const fail = (why: string) => {
    store.delete(OAUTH_COOKIE);
    return redirectTo(`/login?error=${why}`);
  };
  const saved = unseal<{ state: string; verifier: string }>(request.cookies.get(OAUTH_COOKIE)?.value);
  const code = request.nextUrl.searchParams.get("code");
  if (!saved || !code || request.nextUrl.searchParams.get("state") !== saved.state) return fail("failed");

  const tokens = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${originOf(request)}/api/auth/google/callback`,
      grant_type: "authorization_code",
      code_verifier: saved.verifier,
    }),
  }).then((r) => (r.ok ? (r.json() as Promise<{ id_token?: string }>) : null)).catch(() => null);
  if (!tokens?.id_token) return fail("failed");

  const claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()) as IdToken;
  const trusted =
    ["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) &&
    claims.aud === process.env.GOOGLE_CLIENT_ID &&
    claims.exp * 1000 > Date.now() &&
    claims.email_verified === true &&
    Boolean(claims.email);
  if (!trusted) return fail("failed");

  const next = await finishGoogle(claims.email!, claims.name ?? "");
  store.delete(OAUTH_COOKIE);
  return redirectTo(next);
}
