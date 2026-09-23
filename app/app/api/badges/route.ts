import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { syncBadges, readBadgeWall, syncPoints, pointsBalance, pointsLedger, dailyTasks, classWeeklyQuest, monthChapter, ackBadges } from "@/lib/server/db";

/**
 * W-B4 · 徽章墙 + 日任务（规格⑧）。
 * 授予在读取时同步：真实事件计数过线即授予（幂等），没有任何手工发放入口——
 * 判据确定性延伸到激励层；徽章详情自带「凭什么获得」（current/threshold + 事件口径）。
 * 只返回本人数据（R1 禁排行榜：连教师视图也不做班内徽章排序）。
 */

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "forbidden", message: "徽章墙只属于学生本人" }, { status: 403 });

  const demo = await isDemoSession();
  const badges = demo ? readBadgeWall(user.id) : syncBadges(user.id);
  if (!demo) syncPoints(user.id);
  // F4：周协作副本（班级共享进度条，本响应刻意不含任何个人分解——R1）+ 月度剧情章节。
  // 演示身份只算不发（award=false）：进度照看，发奖/赠材不落真实学生账（对抗审查修复）
  const weekly = user.classId ? classWeeklyQuest(user.classId, user.id, !demo) : null;
  const chapter = monthChapter(user.id, !demo);
  return NextResponse.json({
    badges,
    tasks: dailyTasks(user.id),
    weekly,
    chapter,
    balance: pointsBalance(user.id),
    ledger: pointsLedger(user.id, 20),
  });
}

/**
 * H10 · 庆祝确认：前端播放完某枚徽章的解锁庆祝后回执，celebratedAt 落库（服务端权威，
 * 换设备不重播）。只能确认本人徽章；目录外 id 服务端丢弃；重复确认幂等（acked=0）。
 */
const AckBody = z.object({ ids: z.array(z.string().trim().min(1).max(32)).min(1).max(35) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = AckBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  return NextResponse.json({ acked: ackBadges(user.id, parsed.data.ids) });
}
