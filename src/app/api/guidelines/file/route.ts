import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Serves the course guidelines PDF to any signed-in user. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in to read the guidelines.", { status: 401 });

  const row = await queryOne<{ filename: string; mime_type: string; data: Buffer }>(
    "select filename, mime_type, data from app.guidelines where id = 1",
  );
  if (!row) return new NextResponse("No guidelines PDF has been uploaded yet.", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const safeName = row.filename.replace(/[^\w.\-() ]+/g, "_");

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime_type || "application/pdf",
      "Content-Length": String(row.data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
