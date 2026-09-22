import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness probe. Confirms the server can reach Postgres without revealing
 * anything about the data.
 */
export async function GET() {
  try {
    const row = await queryOne<{ ok: number }>("select 1 as ok");
    return NextResponse.json({ status: "ok", database: row?.ok === 1 ? "ok" : "unexpected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ status: "error", database: message }, { status: 503 });
  }
}
