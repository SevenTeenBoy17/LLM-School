import { NextResponse } from "next/server";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { manorSceneVisit, manorSceneSnapshot } from "@/lib/server/manorV7Scene";
import {
  manorState, manorStateReadOnly, manorEarnedBadgeCount,
  classBuildState,
  manorFarmState, manorFarmStateReadOnly,
} from "@/lib/server/db";

/**
 * W-B4 · 个人庄园（规格⑨ / 红线 R4）。
 * GET：状态（部件、积分余额；首访即赠 3 件起步部件）。
 * POST buy：明码标价确定性兑换，扣减在服务端事务内——负余额 409 拒绝（验收硬项）；
 *           地标部件另有徽章数门槛（徽章不可花，只作资格——荣誉不被消费掉）。
 * POST place：摆放/收仓，网格边界服务端校验。
 * 无互偷、无抽卡、无限时、无付费入口；F5 起支持同班只读参观+每日一赞+班级共建认捐。
 */

export const runtime = "nodejs";

function legacyFarm<T extends { plots: unknown[] }>(farm: T): T {
  return { ...farm, plots: farm.plots.slice(0, 6) };
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // F5 参观分支：只读同班同学的庄园（布局+收赞数），不含任何经济数据
  const visit = new URL(req.url).searchParams.get("visit");
  if (visit && visit !== user.id) {
    const published = manorSceneVisit(user.id, visit);
    if (!published) return NextResponse.json({ error: "not_published", message: "该庄园未向当前班级公开。" }, { status: 404, headers: { "cache-control": "no-store" } });
    return NextResponse.json({ view: "visit", name: published.name, farm: { plots: published.plots }, decorations: published.decorations }, { headers: { "cache-control": "no-store" } });
  }

  const demo = await isDemoSession();
  const state = demo ? manorStateReadOnly(user.id) : manorState(user.id);
  const badgeCount = manorEarnedBadgeCount(user.id, !demo);
  const neighbors = manorSceneSnapshot(user.id).neighbors;
  const build = user.classId ? classBuildState(user.classId) : null;
  return NextResponse.json({ ...state, badgeCount, neighbors, build, farm: legacyFarm(demo ? manorFarmStateReadOnly(user.id) : manorFarmState(user.id)) }, { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_readonly", message: "演示身份的庄园不会保存" }, { status: 403 });

  // Legacy mutations wrote the same tables without v2 evidence grants or revision CAS.
  // Keep GET for read-only compatibility, but force every new write through /api/v2/manor/*.
  return NextResponse.json(
    { error: "legacy_manor_retired", message: "旧版庄园写接口已停用，请刷新页面后使用新版学习庄园。" },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
