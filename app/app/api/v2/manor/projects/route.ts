import { NextResponse } from "next/server";
import { manorError } from "@/lib/manor/server-http";
import { getSessionUser } from "@/lib/server/session";
import { MANOR_SCHEMA_VERSION, readManorProjects } from "@/lib/server/manorV2";

export const runtime = "nodejs";
export async function GET() {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "student") return manorError("FORBIDDEN", 403);
  return NextResponse.json({ schemaVersion: MANOR_SCHEMA_VERSION, projects: readManorProjects(user.id) }, { headers: { "cache-control": "no-store" } });
}
