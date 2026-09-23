import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { addMistake, listMistakes, deleteMistake, markMistakeReviewed, clusterMistakes, updateMistakeReason, addAudit } from "@/lib/server/db";
import { classifyMistakeReason } from "@/lib/server/llm";
import { normalizeKnowledgePoint } from "@/lib/knowledgePoints";

/**
 * /api/mistakes —— S4 错题本。
 * GET：学生=本人错题列表；教师/科研 ?cluster=1=去标识聚类计数（学科×知识点，无原文无 userId）。
 * POST：学生手录错题；PATCH：标记已复习；DELETE：删本人错题。
 */

const REASONS = ["概念混淆", "计算失误", "审题偏差", "记忆不牢", "未归因"] as const;
const PostBody = z.object({
  subject: z.string().trim().min(1).max(20),
  // BL1：知识点改「受控词表」——命中即取标准词，未命中一律降级「其他」。
  // 这样教师端去标识聚类维度里不可能出现学生自由文本（杜绝题干原文/人名等 PII 借道注入），
  // 同时天然消除大小写/空格变体导致的聚类桶分裂。
  knowledgePoint: z.string().trim().max(40).optional(),
  content: z.string().trim().min(4).max(1200),
  reason: z.enum(REASONS).optional(),
});

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get("cluster")) {
    if (!["teacher", "researcher", "admin", "college-admin"].includes(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // M2/B4：教师/科研只见本班聚合（classId 取自会话）；管理员为全库治理视图
    const isAdmin = user.role === "admin" || user.role === "college-admin";
    return NextResponse.json({ clusters: clusterMistakes(isAdmin ? undefined : user.classId) });
  }
  return NextResponse.json({ mistakes: listMistakes(user.id) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 终审 P2：错题手录仅学生（防其他角色向聚类视图注入任意字符串）
  if (user.role !== "student") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rl = rateLimit(`mistakes:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  const mistake = addMistake(user.id, {
    ...parsed.data,
    knowledgePoint: normalizeKnowledgePoint(parsed.data.subject, parsed.data.knowledgePoint),
  });
  // M2/B4：未归因的错题异步做 AI 错因归因（fail-open：失败保持「未归因」，不阻塞响应、不编造）。
  // 审查修订：付费模型调用加日级上限 + 每次留审计（与 integrity-recheck 同口径，防刷调用且可追溯）。
  if (!parsed.data.reason || parsed.data.reason === "未归因") {
    const cap = rateLimit(`mistake-attrib-daily:${user.id}`, 50, 86_400_000);
    if (cap.ok) {
      addAudit({ userId: user.id, role: user.role, path: "/api/mistakes", action: `mistake_attribution:${mistake.id}`, result: "allow" });
      void classifyMistakeReason(parsed.data.subject, parsed.data.content)
        .then((r) => { if (r) updateMistakeReason(user.id, mistake.id, r); })
        .catch(() => {});
    }
  }
  return NextResponse.json({ mistake });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const j = await req.json().catch(() => null) as { id?: string } | null;
  if (!j?.id) return NextResponse.json({ error: "invalid" }, { status: 400 });
  // celebrate 由服务端算（§5 P3）：前端只消费布尔值，**不得自行推断**——
  // 否则最省力的近似「点一次已复习就庆祝」会把奖励对象从「掌握」变成「刷按钮」。
  const { celebrate, reason } = markMistakeReviewed(user.id, j.id);
  return NextResponse.json({ ok: true, celebrate, celebrateReason: reason });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const j = await req.json().catch(() => null) as { id?: string } | null;
  if (!j?.id) return NextResponse.json({ error: "invalid" }, { status: 400 });
  // 删除路径**永不庆祝**：否则「清零」最省力的路径就是点垃圾桶，
  // 既污染学生对自身掌握程度的判断，也让教师端聚类出现「班级问题越来越少」的假象。
  return NextResponse.json({ ok: deleteMistake(user.id, j.id), celebrate: false });
}
