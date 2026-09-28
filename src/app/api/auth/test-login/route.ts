import { NextResponse, type NextRequest } from "next/server";
import { finishGoogle, redirectTo, testLoginEnabled } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * Stands in for Google in local tests: /api/auth/test-login?email=…&name=…
 * goes through exactly what a real Google sign-in does next. It exists only
 * when ENABLE_TEST_LOGIN=1 and never on Vercel.
 */
export async function GET(request: NextRequest) {
  if (!testLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  const email = request.nextUrl.searchParams.get("email") ?? "";
  const name = request.nextUrl.searchParams.get("name") ?? "";
  return redirectTo(await finishGoogle(email, name));
}
