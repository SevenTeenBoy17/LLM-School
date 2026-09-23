import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { readManorPlantingCyclePage } from "@/lib/server/manorV2";
import { manorError } from "@/lib/manor/server-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "student") return manorError("FORBIDDEN", 403);
  const { id } = await context.params;
  if (!/^\d+$/.test(id) || Number(id) > 23) return manorError("INVALID_INPUT", 400);
  const query = new URL(request.url).searchParams;
  const page = readManorPlantingCyclePage(user.id, Number(id), { cursor: query.get("cursor") ?? undefined, limit: query.has("limit") ? Number(query.get("limit")) : undefined });
  if (!page) return manorError("INVALID_INPUT", 400);
  return NextResponse.json({ cycles: page.items, nextCursor: page.nextCursor, hasMore: page.hasMore }, { headers: { "cache-control": "no-store" } });
}
