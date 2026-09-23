import { NextResponse } from "next/server";
import { manorAuditChain } from "@/lib/server/manorV2";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ correlationId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "admin" && user.role !== "college-admin") return NextResponse.json({ error: { code: "FORBIDDEN", message: "仅管理角色可查看因果审计链。" } }, { status: 403 });
  const correlationId = (await params).correlationId;
  if (!/^corr_[0-9a-f-]{36}$/i.test(correlationId)) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "审计编号格式不正确。" } }, { status: 400 });
  const result = manorAuditChain(correlationId);
  if (!result) return NextResponse.json({ error: { code: "AUDIT_NOT_FOUND", message: "没有找到这条因果链。" } }, { status: 404 });
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
