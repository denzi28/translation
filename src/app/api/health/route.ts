import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness probe. Confirms the server can reach Postgres and reports the
 * round-trip time, which is what shows whether the functions and the database
 * are in the same region. It reveals nothing about the data.
 */
export async function GET() {
  const started = Date.now();
  try {
    const row = await queryOne<{ ok: number }>("select 1 as ok");
    return NextResponse.json({
      status: "ok",
      database: row?.ok === 1 ? "ok" : "unexpected",
      latencyMs: Date.now() - started,
      region: process.env.VERCEL_REGION ?? "local",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json(
      { status: "error", database: message, latencyMs: Date.now() - started },
      { status: 503 },
    );
  }
}
