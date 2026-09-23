import { NextResponse } from "next/server";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { syncPoints, pointsBalance } from "@/lib/server/db";

/**
 * F7 · 积分余额轻端点：侧栏个人卡的全局可见入口（规格 §IA「底部个人卡带积分余额」）。
 * 只返回本人余额一个数字——不带台账/徽章等重负载（那些在 /api/badges）。
 */

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await isDemoSession())) syncPoints(user.id);
  return NextResponse.json({ balance: pointsBalance(user.id) });
}
