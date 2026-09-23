import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { generateReply } from "@/lib/server/llm";
import { addQuizQuestion, gradeQuizAnswer, addMistake } from "@/lib/server/db";
import { pointsForSubject } from "@/lib/knowledgePoints";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

/**
 * W-B2 · AI 随堂小测（规格红线 R2：雷达「正确率」的唯一供数源）。
 *
 * 判据确定性三件套：
 * ① 出题时标准答案只落库不下发（客户端拿不到 answerIdx，无从作弊）；
 * ② 判分是服务端 index 精确比对（ruleVersion=v1-exact-index），不是模型自由评价；
 * ③ 原始题面/选项/标准答案/学生作答全量落盘——任何一条正确率都可复算审计。
 * 出题失败诚实报错（R6：没有兜底题库，不给假题）。答错自动回流错题本（⑤联动）。
 */

export const runtime = "nodejs";

const GenBody = z.object({
  subject: z.string().min(1).max(24),
  knowledgePoint: z.string().max(40).optional(),
});
const AnswerBody = z.object({
  id: z.string().max(40),
  answerIdx: z.number().int().min(0).max(3),
});

interface GenQuestion { question: string; options: string[]; answerIdx: number; point: string }

function parseQuestion(raw: string): GenQuestion | null {
  // 模型输出受约束 JSON；剥掉可能的代码围栏后解析并逐字段校验——不合格就是不合格，不修补猜测
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(cleaned.slice(start, end + 1)) as Partial<GenQuestion>;
    if (typeof j.question !== "string" || j.question.length < 8 || j.question.length > 500) return null;
    if (!Array.isArray(j.options) || j.options.length !== 4 || j.options.some((o) => typeof o !== "string" || !o.trim())) return null;
    if (typeof j.answerIdx !== "number" || j.answerIdx < 0 || j.answerIdx > 3) return null;
    return { question: j.question.trim(), options: j.options.map((o) => String(o).trim()), answerIdx: j.answerIdx, point: typeof j.point === "string" ? j.point : "" };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }

  // 判分分支（带 id 即判分）
  const ans = AnswerBody.safeParse(json);
  if (ans.success) {
    const demo = await isDemoSession();
    const graded = gradeQuizAnswer(user.id, ans.data.id, ans.data.answerIdx);
    if (!graded) return NextResponse.json({ error: "not_found_or_answered" }, { status: 404 });
    // 答错回流错题本（演示身份不写真实账号数据——与 chat 同一条 !demo 纪律）
    if (!graded.correct && !demo) {
      addMistake(user.id, {
        subject: graded.attempt.subject,
        knowledgePoint: graded.attempt.knowledgePoint || undefined,
        content: `【随堂小测】${graded.attempt.question}\n正确答案：${graded.attempt.options[graded.answerIdx]}`,
        reason: "随堂小测答错，自动收录",
      });
    }
    return NextResponse.json({
      correct: graded.correct,
      answerIdx: graded.answerIdx,
      mistakeAdded: !graded.correct && !demo,
    });
  }

  // 出题分支
  const gen = GenBody.safeParse(json);
  if (!gen.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const rl = rateLimit(`quiz:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  const { subject } = gen.data;
  const validPoints = pointsForSubject(subject);
  const point = gen.data.knowledgePoint && validPoints.includes(gen.data.knowledgePoint) ? gen.data.knowledgePoint : validPoints[0];

  const prompt = `请出 1 道${subject}学科「${point}」知识点的单项选择题（${user.stage || "初中"}学段，客观题，有唯一正确答案）。
只输出 JSON，不要任何其他文字：
{"question":"题干","options":["A 选项内容","B 选项内容","C 选项内容","D 选项内容"],"answerIdx":正确选项下标数字(0-3),"point":"${point}"}`;

  // 最多两次尝试（生成受约束 JSON 偶发跑偏）；仍失败则诚实 503——没有假题库兜底（R6）
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await generateReply({ message: prompt, history: [], user });
    if (reply.source !== "remote") break; // 网关不可用时本地兜底不是题库，不能拿来出题
    const q = parseQuestion(reply.text);
    if (q) {
      const row = addQuizQuestion(user.id, { subject, knowledgePoint: point, question: q.question, options: q.options, answerIdx: q.answerIdx });
      // answerIdx 不下发——判分权在服务端
      return NextResponse.json({ id: row.id, subject, knowledgePoint: point, question: row.question, options: row.options });
    }
  }
  return NextResponse.json({ error: "generation_unavailable", message: "暂时无法出题，请稍后再试" }, { status: 503 });
}
