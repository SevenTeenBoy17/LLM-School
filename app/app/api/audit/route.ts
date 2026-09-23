import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { verifySession } from "@/lib/server/authToken";
import { listAudit, addAudit, findUserById, toSessionUser } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rateLimit";
import { BEACON_HEADER, beaconSecret, beaconEqual } from "@/lib/server/beacon";

const Beacon = z.object({
  token: z.string().min(20),
  path: z.string().max(256).refine((p) => p.startsWith("/") && !p.startsWith("//")),
  action: z.literal("unauthorized_access"),
});

/** proxy 越权 beacon：以 body 内 token 解析用户（proxy 已验过）后写一条 deny 审计。
 *  M2/B4：要求内部密钥头（仅 proxy 持有）——浏览器直调一律 401，根治伪造/灌水；限流作纵深保留。 */
export async function POST(req: Request) {
  // 生产未配置密钥 → beaconSecret()=null → 一律 401（fail-closed）；比较用常时实现防时序侧信道
  if (!beaconEqual(req.headers.get(BEACON_HEADER), beaconSecret())) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const parsed = Beacon.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const tokenUser = await verifySession(parsed.data.token);
  if (!tokenUser) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const current = findUserById(tokenUser.id);
  if (!current) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const u = toSessionUser(current);
  // 终审 P2：beacon 限流（防持有效会话者灌水淹没真实越权记录——listAudit 仅取最近 100 条）
  const rl = rateLimit(`audit-beacon:${u.id}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });
  addAudit({ userId: u.id, role: u.role, path: parsed.data.path, action: parsed.data.action, result: "deny" });
  return NextResponse.json({ ok: true });
}

/** 审计日志查询：仅管理角色。 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "college-admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ audit: listAudit(100) });
}
