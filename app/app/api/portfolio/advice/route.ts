import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import {
  createAdviceDraft, listAdvice, publishAdvice, withdrawAdvice,
  portfolioSummary, isStudentInClass, findUserById, addAudit,
} from "@/lib/server/db";
import { generateReply } from "@/lib/server/llm";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

/**
 * W-B3 · AI 成长建议（规格红线 R5 / 教育部 2025 指南：教师不得直接用 AI 生成内容评价学生）。
 * 流程 = AI 草稿（仅教师可见，标「待老师确认」）→ 教师审改 → 发布后才对学生可见 → 可撤回。
 * POST（教师）：真实调网关按该生档案数据生成草稿；网关不可用 → 503 诚实报错，绝不用兜底文案冒充建议。
 * PATCH（教师）：publish（finalText=教师改定稿）/ withdraw。
 * GET：学生只看 published（署名双归因由前端渲染）；教师看本班学生的全部未撤回条目。
 */

export const runtime = "nodejs";

const PostBody = z.object({ studentId: z.string().min(1).max(60) });
const PatchBody = z.object({
  id: z.string().min(1).max(40),
  action: z.enum(["publish", "withdraw"]),
  finalText: z.string().trim().max(2000).optional(),
}).refine((v) => v.action === "withdraw" || Boolean(v.finalText?.trim()), { message: "publish_needs_text" });

function assertTeacherOwnsStudent(user: { role: string; classId?: string }, studentId: string): boolean {
  if (user.role !== "teacher" || !user.classId) return false;
  return isStudentInClass(user.classId, studentId);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_readonly", message: "演示身份不能生成真实学生的建议" }, { status: 403 });
  const rl = rateLimit(`advice:${user.id}`, 6, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!assertTeacherOwnsStudent(user, parsed.data.studentId)) return NextResponse.json({ error: "not_in_class" }, { status: 403 });

  // 建议只基于真实档案数据（quiz/错题/点评/入册活动），不允许模型自由发挥「想象中的学生」
  const s = portfolioSummary(parsed.data.studentId, "full");
  const facts = [
    `近30天小测：${s.objective.quiz.total} 题、答对 ${s.objective.quiz.correct} 题`,
    `错题本：共 ${s.objective.mistakes.total} 道、已清理 ${s.objective.mistakes.reviewed} 道`,
    `近7天活跃：${s.objective.activeDays7} 天`,
    s.evaluations.length > 0 ? `教师点评标签：${s.evaluations.map((e) => e.tag).join("、")}` : "教师点评：暂无",
    s.entries.filter((e) => e.kind === "activity").length > 0
      ? `已入册活动：${s.entries.filter((e) => e.kind === "activity").map((e) => `《${e.title}》(${e.subject})`).join("、")}`
      : "已入册活动：暂无",
  ].join("\n");

  const prompt = `你是一名 K-12 教师的助手。请根据下面这位学生的真实学习数据，为老师起草一段成长建议（120-200 字）。
硬性要求：
1. 语气必须是建议式而非判定式——写「可以多尝试……」，绝不写「××能力差」这类结论；
2. 只依据给出的数据，数据里没有的事不要编；某项数据为「暂无」就不要评价该项；
3. 面向学生本人的第二人称口吻；给出 1-2 个具体可执行的下一步；
4. 只输出建议正文，不要标题、不要客套开场。
学生数据：
${facts}`;

  const reply = await generateReply({ message: prompt, history: [], user });
  if (reply.source !== "remote") {
    // 本地兜底不是教育判断力，冒充建议比没有建议更糟（R5/R6）
    return NextResponse.json({ error: "llm_unavailable", message: "暂时无法生成建议草稿，请稍后再试" }, { status: 503 });
  }
  const row = createAdviceDraft(parsed.data.studentId, user.id, reply.text.trim(), reply.source);
  addAudit({ userId: user.id, role: user.role, path: "/api/portfolio/advice", action: "advice:draft", result: "allow" });
  return NextResponse.json({ id: row.id, status: row.status, draftText: row.draftText, createdAt: row.createdAt });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_readonly" }, { status: 403 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  if (parsed.data.action === "publish") {
    const row = publishAdvice(parsed.data.id, user.id, parsed.data.finalText ?? "");
    if (!row) return NextResponse.json({ error: "state_invalid", message: "只有草稿可以发布" }, { status: 409 });
    addAudit({ userId: user.id, role: user.role, path: "/api/portfolio/advice", action: "advice:publish", result: "allow" });
    return NextResponse.json({ id: row.id, status: row.status, publishedAt: row.publishedAt });
  }
  const ok = withdrawAdvice(parsed.data.id, user.id);
  if (!ok) return NextResponse.json({ error: "state_invalid", message: "只有已发布的建议可以撤回" }, { status: 409 });
  addAudit({ userId: user.id, role: user.role, path: "/api/portfolio/advice", action: "advice:withdraw", result: "allow" });
  return NextResponse.json({ id: parsed.data.id, status: "withdrawn" });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");

  if (user.role === "student") {
    // 学生只见已发布定稿；署名双归因需要教师姓名
    const rows = listAdvice(user.id, false).map((r) => ({
      id: r.id, text: r.finalText ?? "", publishedAt: r.publishedAt,
      teacherName: findUserById(r.teacherId)?.name ?? "老师",
    }));
    return NextResponse.json({ view: "student", advice: rows });
  }
  if (user.role === "teacher") {
    const target = studentId ?? "";
    if (!target || !assertTeacherOwnsStudent(user, target)) return NextResponse.json({ error: "not_in_class" }, { status: 403 });
    return NextResponse.json({ view: "teacher", advice: listAdvice(target, true) });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
