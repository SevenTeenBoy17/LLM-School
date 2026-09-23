import { NextResponse } from "next/server";
import { recentManorAuditChains } from "@/lib/server/manorV2";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "admin" && user.role !== "college-admin") return NextResponse.json({ error: { code: "FORBIDDEN", message: "仅管理角色可查看因果审计链。" } }, { status: 403 });
  return NextResponse.json({ schemaVersion: "manor.v2", items: recentManorAuditChains() }, { headers: { "cache-control": "no-store" } });
}
