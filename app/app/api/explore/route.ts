import { NextResponse } from "next/server";
import { addAudit, getExploreSnapshot } from "@/lib/server/db";
import { getSessionUser, isDemoSession } from "@/lib/server/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const snapshot = getExploreSnapshot(user);
  if (!(await isDemoSession())) addAudit({ userId: user.id, role: user.role, path: "/api/explore", action: "read_explore", result: "allow" });
  return NextResponse.json(snapshot, { headers: { "cache-control": "no-store" } });
}
