import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import {
  addActivity, listActivitiesForClass, activityStatusBoard, getSubmission, getUploadForReview, addAudit,
} from "@/lib/server/db";
import { KNOWLEDGE_POINTS } from "@/lib/knowledgePoints";

/**
 * W-B3 · 学科项目活动（规格⑥）。
 * POST：教师发布（学科受控词表、指派本班、演示身份 403）。
 * GET：教师看自己班的活动 + 按学生完成状态面板（未开始/草稿/已提交/已批——「有门没人跑」的业务层堵法）；
 *      学生看本班活动 + 自己的提交状态（别人的提交一概不可见，无任何班内比较视图）。
 */

export const runtime = "nodejs";

const SUBJECTS = Object.keys(KNOWLEDGE_POINTS);

const PostBody = z.object({
  subject: z.string().refine((s) => SUBJECTS.includes(s), { message: "unknown_subject" }),
  title: z.string().trim().min(2).max(80),
  brief: z.string().trim().min(4).max(2000),
  dueAt: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_readonly", message: "演示身份不能发布真实活动" }, { status: 403 });
  if (!user.classId) return NextResponse.json({ error: "no_class" }, { status: 400 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const row = addActivity(user.id, user.classId, parsed.data);
  addAudit({ userId: user.id, role: user.role, path: "/api/activities", action: `activity:create:${row.subject}`, result: "allow" });
  return NextResponse.json(row);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!user.classId) return NextResponse.json({ activities: [] });

  const rows = listActivitiesForClass(user.classId);
  if (user.role === "teacher") {
    const activities = rows.map((a) => {
      const board = activityStatusBoard(a.id, a.classId);
      const done = board.filter((b) => b.status === "approved").length;
      return { ...a, board, completion: board.length > 0 ? done / board.length : null };
    });
    return NextResponse.json({ view: "teacher", activities });
  }
  if (user.role === "student") {
    const activities = rows.map((a) => {
      const mine = getSubmission(a.id, user.id);
      const artifact = mine?.artifactRef ? getUploadForReview(mine.artifactRef, user.id) : null;
      return {
        id: a.id, subject: a.subject, title: a.title, brief: a.brief, dueAt: a.dueAt, status: a.status, createdAt: a.createdAt,
        pastDue: Boolean(a.dueAt && Date.now() > a.dueAt), // 截止判定服务端权威（提交路由同口径拒收）
        mine: mine ? { status: mine.status, content: mine.content, teacherFeedback: mine.teacherFeedback, updatedAt: mine.updatedAt, artifactName: artifact?.name ?? null } : null,
      };
    });
    return NextResponse.json({ view: "student", activities });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
