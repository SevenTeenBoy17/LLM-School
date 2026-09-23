import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { searchKb } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

// GET /api/knowledge/search?q= —— 校内关键词检索（非向量语义），命中返回文本片段。
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`kb-search:${user.id}`, 30, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 80);
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  return jsonNoStore({ hits: searchKb(user.id, isAdmin, user.classId, user.stage, q) });
}
