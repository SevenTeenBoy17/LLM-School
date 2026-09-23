import { NextResponse } from "next/server";
import { addAudit, getLearningSnapshot } from "@/lib/server/db";
import { getSessionUser, isDemoSession } from "@/lib/server/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const snapshot = getLearningSnapshot(user);
  if (!(await isDemoSession())) addAudit({ userId: user.id, role: user.role, path: "/api/learning", action: "read_learning", result: "allow" });
  return NextResponse.json(snapshot, { headers: { "cache-control": "no-store" } });
}
