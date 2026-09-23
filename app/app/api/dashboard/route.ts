import { NextResponse } from "next/server";
import { addAudit, getDashboardSnapshot } from "@/lib/server/db";
import { getSessionUser, isDemoSession } from "@/lib/server/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (!(await isDemoSession())) addAudit({ userId: user.id, role: user.role, path: "/api/dashboard", action: "read_dashboard", result: "allow" });
  const snapshot = getDashboardSnapshot(user);
  return NextResponse.json(snapshot, { headers: { "cache-control": "no-store" } });
}
