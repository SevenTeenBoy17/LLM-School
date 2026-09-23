import { NextResponse } from "next/server";
import { z } from "zod";
import { teacherManorEvidenceQueue } from "@/lib/server/manorV2";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";
const Status = z.enum(["pending_review", "revise", "accepted_mastery", "accepted_correction"]);

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "teacher" || !user.classId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "仅任课教师可查看本班学习证据。" } }, { status: 403 });
  const rawStatus = new URL(request.url).searchParams.get("status");
  const parsed = rawStatus ? Status.safeParse(rawStatus) : null;
  if (parsed && !parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "未知审核状态。" } }, { status: 400 });
  return NextResponse.json({ schemaVersion: "manor.v2", items: teacherManorEvidenceQueue(user.classId, parsed?.success ? parsed.data : undefined) }, { headers: { "cache-control": "no-store" } });
}
