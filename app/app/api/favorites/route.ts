import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { addFavorite, getSession, messageBelongsToUser, removeFavorite, listFavorites, type FavoriteKind } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

const KIND = z.enum(["session", "prompt", "message", "agent"]);

// GET /api/favorites?kind=prompt —— 当前用户的收藏（可按 kind 过滤）。
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  const kindRaw = url.searchParams.get("kind");
  const kind = kindRaw ? KIND.safeParse(kindRaw) : null;
  const favorites = listFavorites(user.id, kind?.success ? (kind.data as FavoriteKind) : undefined);
  return NextResponse.json({ favorites });
}

const PostBody = z.object({
  kind: KIND,
  refId: z.string().min(1).max(120),
  meta: z.string().max(400).optional(),
});

// POST —— 收藏（幂等；UNIQUE(userId,kind,refId)）。
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`fav:${user.id}`, 60, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!canTouchFavoriteTarget(user.id, parsed.data.kind, parsed.data.refId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const favorite = addFavorite(user.id, parsed.data.kind, parsed.data.refId, parsed.data.meta);
  return NextResponse.json({ favorite }, { status: 201 });
}

const DeleteBody = z.object({ kind: KIND, refId: z.string().min(1).max(120) });

// DELETE —— 取消收藏（请求体携带 kind+refId）。
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = DeleteBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!canTouchFavoriteTarget(user.id, parsed.data.kind, parsed.data.refId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const removed = removeFavorite(user.id, parsed.data.kind, parsed.data.refId);
  return NextResponse.json({ ok: removed });
}

function canTouchFavoriteTarget(userId: string, kind: FavoriteKind, refId: string): boolean {
  if (kind === "message") return messageBelongsToUser(userId, refId);
  if (kind === "session") return !!getSession(userId, refId);
  return true;
}
