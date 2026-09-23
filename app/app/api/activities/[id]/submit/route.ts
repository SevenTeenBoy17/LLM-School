import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { getActivity, upsertSubmission, getUploadsForUser, addAudit } from "@/lib/server/db";

/**
 * W-B3 · 学生作答（规格⑥-3 数据诚实性约束的入口端）：
 * 只能写**自己**的提交；活动必须属于自己班且 open；
 * 状态机由 db.upsertSubmission 把关——approved 终态锁定、submitted 期间不可回改草稿。
 */

export const runtime = "nodejs";

const Body = z.object({
  content: z.string().trim().min(1).max(4000),
  action: z.enum(["draft", "submit"]),
  // F3 佐证材料：已上传文档的 id（复用 /api/upload 地基）；null=显式移除
  uploadId: z.string().max(40).nullable().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_readonly", message: "演示身份的作答不会保存" }, { status: 403 });

  const { id } = await ctx.params;
  const activity = getActivity(id);
  if (!activity) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (activity.classId !== user.classId) return NextResponse.json({ error: "not_in_class" }, { status: 403 });
  if (activity.status !== "open") return NextResponse.json({ error: "closed", message: "这个活动已经截止" }, { status: 409 });
  // G2：过了截止时间服务端拒收（UI 隐藏按钮不是权威）
  if (activity.dueAt && Date.now() > activity.dueAt) {
    return NextResponse.json({ error: "past_due", message: "已过截止时间，不能再提交了" }, { status: 409 });
  }

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const artifactRef: string | null | undefined = parsed.data.uploadId;
  if (typeof artifactRef === "string") {
    // 归属校验：uploadId 是可伪造请求体字段，必须证明属于当前学生本人
    if (getUploadsForUser(user.id, [artifactRef]).length === 0) {
      return NextResponse.json({ error: "upload_not_found", message: "佐证材料不存在或不属于你" }, { status: 404 });
    }
  }
  const row = upsertSubmission(id, user.id, parsed.data.content, parsed.data.action, artifactRef);
  if (!row) return NextResponse.json({ error: "state_locked", message: "已通过入册或正在批阅中，暂不能修改" }, { status: 409 });
  addAudit({ userId: user.id, role: user.role, path: `/api/activities/${id}/submit`, action: `submission:${parsed.data.action}`, result: "allow" });
  return NextResponse.json({ id: row.id, status: row.status, updatedAt: row.updatedAt });
}
