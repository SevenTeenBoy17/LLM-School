import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { countSessions, subjectDistribution, recentQuestionTimes, listMistakes } from "@/lib/server/db";

/**
 * GET /api/student/stats —— M4/B5 成长页统计（本人真实数据聚合，服务端权威）。
 * 铁律：全部来自 SQL 聚合，无估算；学科未识别如实归「未分类」；无排行榜/跨用户对比。
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const mistakes = listMistakes(user.id);
  const since = Date.now() - 7 * 86_400_000;
  return NextResponse.json({
    stats: {
      sessionTotal: countSessions(user.id),                  // 真实累计（非列表长度）
      mistakeTotal: mistakes.length,
      reviewedTotal: mistakes.filter((m) => m.reviewedAt).length,
      subjects: subjectDistribution(user.id),                // [{subject,count}]，含「未分类」桶
      questionTimes: recentQuestionTimes(user.id, since),    // epoch ms，前端按本地时区分桶
    },
  });
}
