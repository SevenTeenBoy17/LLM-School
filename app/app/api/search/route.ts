import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { searchAll } from "@/lib/server/db";

// GET /api/search?q= —— 聚合搜索（当前用户会话 + 提示词 + 智能体；关键词匹配，非向量语义）。
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 80);
  return NextResponse.json({ results: searchAll(user.id, q) });
}
