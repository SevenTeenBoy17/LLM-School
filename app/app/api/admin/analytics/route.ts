import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { getAdminAnalyticsSnapshot } from "@/lib/server/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "college-admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(getAdminAnalyticsSnapshot(), {
    headers: { "cache-control": "no-store" },
  });
}
