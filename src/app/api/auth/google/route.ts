import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, cookieOptions, googleConfigured, originOf, pkce, redirectTo, seal } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Sends the student to Google's account chooser. */
export async function GET(request: NextRequest) {
  if (!googleConfigured()) return redirectTo("/login?error=unavailable");
  const { verifier, challenge, state } = pkce();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${originOf(request)}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, seal({ state, verifier }, 10), { ...cookieOptions, maxAge: 600 });
  return response;
}
