/**
 * W-B4 后端 e2e：徽章授予注入测试（伪事件不触发）+ 积分台账幂等/日上限 + 兑换负余额拒绝 + 摆放边界。
 * 运行：npm run test:e2e-b4（启动临时数据库和独立 Next.js 端口）。
 * 脚本拒绝连接默认 .data，避免测试账号、班级认捐或奖励污染真实开发数据。
 */
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const TEST_DB_DIR = process.env.TEST_DB_DIR;
if (!TEST_DB_DIR) throw new Error("TEST_DB_DIR is required; run `npm run test:e2e-b4` for an isolated database");
const DB = join(TEST_DB_DIR, "eduai.sqlite");
const UID = "u-e2e-b4";
const NEIGHBOR_UID = "u-e2e-b4-neighbor";
const CLASS_ID = "c-e2e-b4";
let operationSeq = 0;
let pass = 0, fail = 0;
const nativeFetch = globalThis.fetch;
const fetch = (input, init = {}) => nativeFetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(15_000) });
const ck = (name, ok, detail = "") => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  if (ok) pass++;
  else fail++;
};
async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  if (!r.ok) throw new Error(`login ${username} -> ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}
const j = (cookie) => ({ "content-type": "application/json", cookie });
const withOp = (body, operationId = `e2e-op-${Date.now()}-${++operationSeq}`) => ({ ...body, operationId });
const cookieFrom = (response) => response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

// ── setup：一次性零态账号 ──
await login("student", "Student@123"); // 触发临时数据库建表与 seed；cookie 不复用。
{
  const db = new DatabaseSync(DB);
  const src = db.prepare("SELECT salt, passwordHash FROM users WHERE id = 'u-student'").get();
  db.prepare("INSERT OR REPLACE INTO users (id,username,salt,passwordHash,name,role,stage,classId,avatarLetter,department) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(UID, "e2e-b4", src.salt, src.passwordHash, "测试专用生", "student", "junior", CLASS_ID, "测", "e2e");
  db.prepare("INSERT OR REPLACE INTO users (id,username,salt,passwordHash,name,role,stage,classId,avatarLetter,department) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(NEIGHBOR_UID, "e2e-b4-neighbor", src.salt, src.passwordHash, "邻园同学", "student", "junior", CLASS_ID, "邻", "e2e");
  db.prepare("INSERT INTO manor_items (id,userId,partId,x,y,acquiredAt) VALUES (?,?,?,?,?,?)")
    .run("mi_e2e_neighbor", NEIGHBOR_UID, "tree", 0, 0, Date.now());
  db.close();
}

try {
  const S = await login("e2e-b4", "Student@123");
  const T = await login("teacher", "Teacher@123");

  // 演示身份 GET 必须是零写入投影：不种地、不发徽章、不产分、不物化解锁。
  let r = await fetch(`${BASE}/api/auth/switch-role`, { method: "POST", headers: j(S), body: JSON.stringify({ role: "student" }) });
  const demoUser = await r.json();
  const DEMO = cookieFrom(r);
  const demoTables = ["manor_items", "manor_plots", "manor_crop_unlocks", "manor_harvests", "manor_growth_spend", "points_ledger", "user_badges"];
  const demoCounts = () => {
    const db = new DatabaseSync(DB);
    const counts = Object.fromEntries(demoTables.map((table) => [table, Number(db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE userId = ?`).get(demoUser.user.id).c)]));
    db.close();
    return counts;
  };
  const demoBefore = demoCounts();
  const demoGet = await fetch(`${BASE}/api/manor`, { headers: j(DEMO) });
  const demoAfter = demoCounts();
  ck("演示身份读取庄园不写任何用户状态", demoGet.ok && JSON.stringify(demoBefore) === JSON.stringify(demoAfter), `${JSON.stringify(demoBefore)} → ${JSON.stringify(demoAfter)}`);

  // ── 0. 零态基线 ──
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  let w = await r.json();
  ck("零事件基线：无任何授予、余额 0", w.badges.every((b) => !b.earned) && w.balance === 0, `earned=${w.badges.filter((b) => b.earned).length} balance=${w.balance}`);
  ck("教师访问徽章墙被拒（403）", (await fetch(`${BASE}/api/badges`, { headers: j(T) })).status === 403);

  // ── 1. 注入 A：直接塞目录外徽章 id → 不上墙（目录单一真相源） ──
  {
    const db = new DatabaseSync(DB);
    db.prepare("INSERT OR IGNORE INTO user_badges (userId,badgeId,awardedAt) VALUES (?,?,?)").run(UID, "fake-badge-999", Date.now());
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("注入 A：伪造徽章 id 不上墙", !w.badges.some((b) => b.id === "fake-badge-999"));

  // ── 2. 注入 B：伪事件（未判分小测，answeredAt=null）不触发、不产分 ──
  {
    const db = new DatabaseSync(DB);
    db.prepare("INSERT INTO quiz_attempts (id,userId,subject,knowledgePoint,question,options,answerIdx,studentIdx,correct,ruleVersion,createdAt,answeredAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run("qz_e2e_fake", UID, "数学", "测试", "伪事件：未作答", JSON.stringify(["A", "B"]), 0, null, null, "v1-exact-index", Date.now(), null);
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("注入 B：未判分小测不触发「第一问」", !w.badges.find((b) => b.id === "quiz-1")?.earned);
  ck("注入 B：未判分小测不产分", w.balance === 0, `balance=${w.balance}`);

  // ── 3. 真实事件：判分后的小测触发首档徽章 + 产分 +5 ──
  {
    const db = new DatabaseSync(DB);
    const now = Date.now();
    db.prepare("INSERT INTO quiz_attempts (id,userId,subject,knowledgePoint,question,options,answerIdx,studentIdx,correct,ruleVersion,createdAt,answeredAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run("qz_e2e_real", UID, "数学", "测试", "真实事件：已作答", JSON.stringify(["A", "B"]), 0, 0, 1, "v1-exact-index", now, now);
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  const q1 = w.badges.find((b) => b.id === "quiz-1");
  ck("真实事件触发「第一问」（凭什么获得：1/1）", q1.earned && q1.current === 1);
  ck("产分 +5 且理由可解释", w.balance === 5 && w.ledger.some((l) => l.reason.includes("+5")), `balance=${w.balance}`);
  ck("日任务「完成小测」由真实事件置真", w.tasks.find((t) => t.id === "quiz").done === true);

  // ── 4. 幂等：重复读取不重复产分 ──
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("幂等：重复同步余额不变", w.balance === 5, `balance=${w.balance}`);

  // ── 5. 日上限：再塞 12 条已判分（当日共 13），只产 10 条的分（cap=10 → 50 分） ──
  {
    const db = new DatabaseSync(DB);
    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      db.prepare("INSERT INTO quiz_attempts (id,userId,subject,knowledgePoint,question,options,answerIdx,studentIdx,correct,ruleVersion,createdAt,answeredAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(`qz_e2e_cap_${i}`, UID, "数学", "测试", `刷分 ${i}`, JSON.stringify(["A", "B"]), 0, 0, 1, "v1-exact-index", now, now);
    }
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("日上限防刷：13 题只产 10 题的分（50）", w.balance === 50, `balance=${w.balance}`);
  ck("徽章计数不受产分上限影响（quiz-10 达标、quiz-50 计 13）", w.badges.find((b) => b.id === "quiz-10")?.earned && w.badges.find((b) => b.id === "quiz-50")?.current === 13);

  // ── 6. 庄园 ──
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  let m = await r.json();
  ck("首访即赠 3 件起步部件（已摆放）", m.items.length === 3 && m.items.every((i) => i.x !== null), `items=${m.items.length}`);
  ck("庄园余额与徽章页同源（50）", m.balance === 50);
  ck("学科田圃首访：6 块田 + 一株萌芽麦穗", m.farm.plots.length === 6 && m.farm.plots[0].cropId === "wheat" && m.farm.plots[0].stage === 1);
  ck("学习雨露来自真实产分事件 + 3 滴新手额度", m.farm.growthEnergy === 13, `energy=${m.farm.growthEnergy}`);

  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "plant", plot: 1, cropId: "tomato" })) });
  ck("未满足教师认可条件的作物不能越权种植", r.status === 409);

  const nurtureOp = "e2e-nurture-idempotent-0001";
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "nurture", plot: 0 }, nurtureOp)) });
  const firstNurture = await r.json();
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "nurture", plot: 0 }, nurtureOp)) });
  const replayedNurture = await r.json();
  {
    const db = new DatabaseSync(DB);
    const spends = Number(db.prepare("SELECT COUNT(*) AS c FROM manor_growth_spend WHERE userId = ? AND plot = 0").get(UID).c);
    db.close();
    ck("重复学习雨露操作返回相同结果且只扣 1 滴", r.ok && replayedNurture.stage === firstNurture.stage && replayedNurture.growthEnergy === firstNurture.growthEnergy && spends === 1, `stage=${replayedNurture.stage} energy=${replayedNurture.growthEnergy} spends=${spends}`);
  }
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "nurture", plot: 0 })) });
  m = await r.json();
  ck("两滴雨露把首株麦穗从萌芽推进到成熟", r.ok && m.farm.plots[0].stage === 3 && m.farm.growthEnergy === 11, `stage=${m.farm.plots[0].stage} energy=${m.farm.growthEnergy}`);
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "nurture", plot: 0 })) });
  ck("成熟作物拒绝继续消耗雨露", r.status === 409);
  const energyBeforeHarvest = m.farm.growthEnergy;
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "harvest", plot: 0 })) });
  m = await r.json();
  ck("收获进入知识图鉴并清空田圃", r.ok && m.farm.harvestedTotal === 1 && m.farm.plots[0].cropId === null);
  ck("收获不返还学习雨露", m.farm.growthEnergy === energyBeforeHarvest, `${energyBeforeHarvest} → ${m.farm.growthEnergy}`);
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  m = await r.json();
  ck("收获不返还积分，避免自循环刷资源", m.balance === 50, `balance=${m.balance}`);

  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "plant", plot: 0, cropId: "wheat" })) });
  ck("已永久解锁的品种可自由复种", r.ok);
  for (let i = 0; i < 3; i++) {
    r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "nurture", plot: 0 })) });
  }
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "harvest", plot: 0 })) });
  m = await r.json();
  ck("累计 2 次收获后探索解锁攀援豆", r.ok && m.farm.cropAccess.find((c) => c.id === "bean")?.unlocked === true);

  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "unlock_crop", cropId: "bamboo" })) });
  ck("积分不足时永久品种兑换被服务端拒绝", r.status === 409);

  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "buy", partId: "house" })) });
  ck("负余额拒绝（500 分小屋/50 分余额 → 409）", r.status === 409, (await r.json()).message);

  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "buy", partId: "library" })) });
  ck("地标徽章门槛（<6 枚 → 409，徽章不被扣）", r.status === 409);

  // 清 1 道错题产分 +10 → 60 分，正好买 60 分小径
  {
    const db = new DatabaseSync(DB);
    const now = Date.now();
    db.prepare("INSERT INTO mistakes (id,userId,subject,knowledgePoint,content,reason,createdAt,reviewedAt) VALUES (?,?,?,?,?,?,?,?)")
      .run("mis_e2e_b4", UID, "数学", "测试", "e2e 造错题", "e2e", now, now);
    db.prepare("INSERT INTO mistake_reviews (id,mistakeId,userId,at) VALUES (?,?,?,?)").run("mr_e2e_b4", "mis_e2e_b4", UID, now);
    db.close();
  }
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  m = await r.json();
  ck("清错题产分 +10（余额 60）", m.balance === 60, `balance=${m.balance}`);
  ck("三枚真实徽章解锁向光葵（不消费徽章）", m.farm.cropAccess.find((c) => c.id === "sunflower")?.unlocked === true);

  const buyOperation = "e2e-buy-path-idempotent-0001";
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "buy", partId: "path" }, buyOperation)) });
  m = await r.json();
  const boughtPath = m.item;
  ck("60 分买 60 分小径：事务扣减到 0", m.balance === 0, `balance=${m.balance}`);

  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "buy", partId: "path" }, buyOperation)) });
  const replayedBuy = await r.json();
  {
    const db = new DatabaseSync(DB);
    const buyDebits = Number(db.prepare("SELECT COUNT(*) AS c FROM points_ledger WHERE userId = ? AND kind = 'manor_buy'").get(UID).c);
    const boughtItems = Number(db.prepare("SELECT COUNT(*) AS c FROM manor_items WHERE userId = ? AND id = ?").get(UID, boughtPath.id).c);
    db.close();
    ck("相同装饰购买编号重放同一物品且只扣一次", r.ok && replayedBuy.item.id === boughtPath.id && replayedBuy.balance === 0 && buyDebits === 1 && boughtItems === 1, `item=${replayedBuy.item.id} debits=${buyDebits}`);
  }
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "buy", partId: "path" })) });
  ck("余额 0 再买 → 409（事务内校验）", r.status === 409);

  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify({ action: "place", itemId: boughtPath.id, x: 9, y: 5 }) });
  ck("摆放到网格内成功", r.ok);
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify({ action: "place", itemId: boughtPath.id, x: null, y: 5 }) });
  ck("半空坐标在 API 模式校验阶段拒绝（400）", r.status === 400);
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify({ action: "place", itemId: boughtPath.id, x: 99, y: 0 }) });
  ck("越界摆放拒绝（400）", r.status === 400);
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  const placementState = await r.json();
  const concurrentItems = placementState.items.slice(0, 2);
  for (const item of concurrentItems) {
    await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify({ action: "place", itemId: item.id, x: null, y: null }) });
  }
  const placements = await Promise.all(concurrentItems.map((item) => fetch(`${BASE}/api/manor`, {
    method: "POST", headers: j(S), body: JSON.stringify({ action: "place", itemId: item.id, x: 0, y: 0 }),
  })));
  ck("并发摆入同一网格只有一个事务成功", placements.filter((response) => response.ok).length === 1 && placements.filter((response) => response.status === 400).length === 1, placements.map((response) => response.status).join(","));
  ck("教师无庄园（403）", (await fetch(`${BASE}/api/manor`, { headers: j(T) })).status === 403);

  // ── 7. F4 周协作副本 + 月度剧情副本 ──
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("F4 周副本：共享进度条形态（无个人分解字段）", w.weekly && typeof w.weekly.current === "number" && !("members" in w.weekly) && !("breakdown" in w.weekly), `${w.weekly?.current}/${w.weekly?.target}`);
  const weeklyBefore = w.weekly.current;
  ck("F4 章节：目标带真实计数（quiz 13/需, fix 1/需）", w.chapter.goals.some((g) => g.current >= 10) && w.chapter.goals.length === 3);

  // 补齐当月章节目标：8 月=修筑者之月（quiz 15 / fix 8 / 活动 1）——注入差额事件
  {
    const db = new DatabaseSync(DB);
    const now = Date.now();
    for (let i = 0; i < 2; i++) {
      db.prepare("INSERT INTO quiz_attempts (id,userId,subject,knowledgePoint,question,options,answerIdx,studentIdx,correct,ruleVersion,createdAt,answeredAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(`qz_e2e_ch_${i}`, UID, "数学", "测试", `章节补题 ${i}`, JSON.stringify(["A", "B"]), 0, 0, 1, "v1-exact-index", now, now);
    }
    for (let i = 0; i < 7; i++) {
      const mid = `mis_e2e_ch_${i}`;
      db.prepare("INSERT INTO mistakes (id,userId,subject,knowledgePoint,content,reason,createdAt,reviewedAt) VALUES (?,?,?,?,?,?,?,?)")
        .run(mid, UID, "数学", "测试", `章节错题 ${i}`, "e2e", now, now);
      db.prepare("INSERT INTO mistake_reviews (id,mistakeId,userId,at) VALUES (?,?,?,?)").run(`mr_e2e_ch_${i}`, mid, UID, now);
    }
    // 活动入册 1 个（直接落库构造 approved 提交）
    db.prepare("INSERT INTO activities (id,classId,teacherId,subject,title,brief,dueAt,status,createdAt) VALUES (?,?,?,?,?,?,?,?,?)")
      .run("act_e2e_ch", CLASS_ID, "u-teacher", "数学", "章节测试活动", "e2e", null, "open", now);
    db.prepare("INSERT INTO activity_submissions (id,activityId,studentId,content,status,teacherFeedback,submittedAt,reviewedAt,updatedAt,artifactRef) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run("sub_e2e_ch", "act_e2e_ch", UID, "章节测试提交", "approved", "好", now, now, now, null);
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  const balAfterChapter = w.balance;
  // 周副本按周轮换事件（本周可能是小测/清错题/入册任一）；章节注入后三类事件皆有，进度必然前进
  ck("F4 周副本：真实事件计入班级共享进度（轮换无关）", w.weekly.current > weeklyBefore || w.weekly.done, `${weeklyBefore} → ${w.weekly.current}/${w.weekly.target}`);
  ck("F4 章节三目标齐 → completed", w.chapter.completed === true, JSON.stringify(w.chapter.goals.map((g) => `${g.current}/${g.need}`)));
  ck("F4 章节 +50 入账（理由可解释）", w.ledger.some((l) => l.delta === 50 && l.reason.includes("月度剧情")));
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  m = await r.json();
  const gifts = m.items.filter((i) => i.x === null);
  ck("F4 章节建材已进仓库", gifts.length >= 1, `仓库 ${gifts.length} 件`);
  ck("通过教师批阅的项目任务解锁水纹稻", m.farm.cropAccess.find((c) => c.id === "rice")?.unlocked === true);
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("F4 章节发奖幂等（重读余额不变）", w.balance === balAfterChapter, `balance=${w.balance}`);

  // ── 8. F5 参观 + 点赞 + 班级共建 ──
  // 专用邻居仅存在于临时数据库与专用班级，绝不读取真实开发用户。
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  m = await r.json();
  ck("F5 邻居名单：同班有庄园者可见、不含本人", Array.isArray(m.neighbors) && m.neighbors.some((n) => n.id === NEIGHBOR_UID) && !m.neighbors.some((n) => n.id === UID), `${m.neighbors.length} 家`);
  ck("F5 共建状态：只有集体总进度（无名单字段）", m.build && typeof m.build.raised === "number" && !("contributors" in m.build));

  r = await fetch(`${BASE}/api/manor?visit=${NEIGHBOR_UID}`, { headers: j(S) });
  const vis = await r.json();
  ck("F5 参观只读视图：有布局无经济数据", r.ok && Array.isArray(vis.items) && !("balance" in vis) && !("ledger" in vis), `items=${vis.items?.length}`);
  ck("F5 参观视图不下发他人收赞计数（R1 修复），只带我的已赞态", !("likes" in vis) && typeof vis.likedToday === "boolean");
  ck("F5 访客 DTO 不下发装饰与作物时间戳", vis.items.every((item) => !("acquiredAt" in item)) && vis.farm.plots.every((plot) => !("plantedAt" in plot) && !("updatedAt" in plot)));
  ck("F5 访客农场只下发场景所需地块字段", Object.keys(vis.farm).length === 1 && Array.isArray(vis.farm.plots));
  ck("F5 参观陌生 id 拒绝（403）", (await fetch(`${BASE}/api/manor?visit=u-ghost-999`, { headers: j(S) })).status === 403);

  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify({ action: "like", ownerId: NEIGHBOR_UID }) });
  let lk = await r.json();
  ck("F5 点赞成功", r.ok && lk.added === true);
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify({ action: "like", ownerId: NEIGHBOR_UID }) });
  lk = await r.json();
  ck("F5 当日重复赞幂等（added=false）", r.ok && lk.added === false);
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify({ action: "like", ownerId: UID }) });
  ck("F5 自赞拒绝（400）", r.status === 400);

  // 认捐：当前余额 120（章节+50 与周奖励可能到账）——读实际余额后认捐 10
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  m = await r.json();
  const balBefore = m.balance;
  const raisedBefore = m.build.raised;
  const contributeOperation = "e2e-contribute-idempotent-0001";
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "contribute", amount: 10 }, contributeOperation)) });
  const cb = await r.json();
  ck("F5 认捐 10 分：个人扣减 + 公共池增加", r.ok && cb.accepted === 10 && cb.balance === balBefore - 10 && cb.build.raised === raisedBefore + 10, `${balBefore}→${cb.balance}，池 ${raisedBefore}→${cb.build.raised}`);
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "contribute", amount: 10 }, contributeOperation)) });
  const replayedContribute = await r.json();
  {
    const db = new DatabaseSync(DB);
    const contributions = Number(db.prepare("SELECT COUNT(*) AS c FROM class_build_contrib WHERE userId = ?").get(UID).c);
    db.close();
    ck("相同认捐编号重放且只扣一次积分", r.ok && replayedContribute.accepted === 10 && replayedContribute.balance === cb.balance && replayedContribute.build.raised === cb.build.raised && contributions === 1, `balance=${replayedContribute.balance} rows=${contributions}`);
  }
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "contribute", amount: 500 })) });
  ck("F5 超余额认捐拒绝（409）", r.status === 409);

  // 永久品种的积分兑换成功路径：测试专用奖励入账后，扣分与解锁必须同事务完成。
  {
    const db = new DatabaseSync(DB);
    db.prepare("INSERT INTO points_ledger (id,userId,kind,delta,reason,eventKey,createdAt) VALUES (?,?,?,?,?,?,?)")
      .run("pt_e2e_crop", UID, "test_learning_bonus", 120, "e2e 学习奖励", "e2e:crop-unlock", Date.now());
    db.close();
  }
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  const beforeBamboo = await r.json();
  const unlockOperation = "e2e-unlock-bamboo-idempotent-0001";
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "unlock_crop", cropId: "bamboo" }, unlockOperation)) });
  m = await r.json();
  ck("120 分永久解锁词语竹，余额精确扣减且同事务返回", r.ok && m.balance === beforeBamboo.balance - 120 && m.farm.cropAccess.find((c) => c.id === "bamboo")?.unlocked === true, `${beforeBamboo.balance} → ${m.balance}`);
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "unlock_crop", cropId: "bamboo" }, unlockOperation)) });
  const replayedUnlock = await r.json();
  {
    const db = new DatabaseSync(DB);
    const unlockDebits = Number(db.prepare("SELECT COUNT(*) AS c FROM points_ledger WHERE userId = ? AND eventKey = ?").get(UID, `crop-unlock:${UID}:bamboo`).c);
    db.close();
    ck("相同兑换编号重放成功且只扣一次积分", r.ok && replayedUnlock.balance === m.balance && unlockDebits === 1, `balance=${replayedUnlock.balance} debits=${unlockDebits}`);
  }
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "unlock_crop", cropId: "bamboo" })) });
  ck("新编号重复解锁被拒绝，不二次扣分", r.status === 409);

  // ── H9 · 35 徽章矩阵 + 两条新事件流（ai_question / image_created）三态注入 ──
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  {
    const evs = ["quiz_answered", "mistake_reviewed", "activity_approved", "eval_positive", "active_days", "ai_question", "image_created", "peer_like", "class_contrib"];
    ck("H11 徽章目录 45 枚（9 系列 × 5 档）", w.badges.length === 45 && evs.every((ev) => w.badges.filter((b) => b.event === ev).length === 5), `total=${w.badges.length}`);
  }
  // H11：互助/共建两条新事件流——前文 F5 已真实点赞 1 次、认捐 1 次，此处应已授予首档
  {
    const l1 = w.badges.find((b) => b.id === "like-1");
    const b1 = w.badges.find((b) => b.id === "build-1");
    ck("H11 真实点赞触发「第一个赞」（current=1）", l1.earned && l1.current === 1, `current=${l1.current}`);
    ck("H11 真实认捐触发「添第一砖」（current=1）", b1.earned && b1.current === 1, `current=${b1.current}`);
    ck("H11 点赞/认捐不产分（无对应 earn 台账行）", !w.ledger.some((x) => x.delta > 0 && (x.reason.includes("点赞") || x.reason.includes("认捐"))));
  }
  // 注入 E：assistant 消息不算提问（口径 = chat_messages.role='user'）
  {
    const db = new DatabaseSync(DB);
    db.prepare("INSERT INTO chat_sessions (id,userId,title,modelId,createdAt,updatedAt) VALUES (?,?,?,?,?,?)").run("cs_e2e_h9", UID, "e2e-h9", "chatgpt", Date.now(), Date.now());
    db.prepare("INSERT INTO chat_messages (id,sessionId,role,content,modelId,createdAt) VALUES (?,?,?,?,?,?)").run("cm_e2e_h9a", "cs_e2e_h9", "assistant", "我是回答不是提问", "chatgpt", Date.now());
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("H9 注入 E：assistant 消息不触发「第一次举手」", !w.badges.find((b) => b.id === "ask-1")?.earned);
  // 真实 user 消息 → ask-1 授予且计数正确
  {
    const db = new DatabaseSync(DB);
    db.prepare("INSERT INTO chat_messages (id,sessionId,role,content,modelId,createdAt) VALUES (?,?,?,?,?,?)").run("cm_e2e_h9b", "cs_e2e_h9", "user", "为什么月亮有圆缺？", "chatgpt", Date.now());
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  {
    const a1 = w.badges.find((b) => b.id === "ask-1");
    ck("H9 真提问触发「第一次举手」（current=1）", a1.earned && a1.current === 1, `earned=${a1.earned} current=${a1.current}`);
  }
  // 注入 F：queued 生图不算创作（口径 = image_jobs.status='done'）；置 done 后授予
  {
    const db = new DatabaseSync(DB);
    db.prepare("INSERT INTO image_jobs (id,userId,role,prompt,size,status,createdAt) VALUES (?,?,?,?,?,?,?)").run("ij_e2e_h9", UID, "student", "e2e 测试图", "1024x1024", "queued", Date.now());
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("H9 注入 F：queued 生图不触发「第一笔」", !w.badges.find((b) => b.id === "img-1")?.earned);
  {
    const db = new DatabaseSync(DB);
    db.prepare("UPDATE image_jobs SET status = 'done' WHERE id = 'ij_e2e_h9'").run();
    db.close();
  }
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  ck("H9 生图 done 触发「第一笔」", w.badges.find((b) => b.id === "img-1")?.earned === true);
  // 新事件不产分（防刷问/刷图：per=0）
  ck("H9 提问/生图不产分（余额不因它们变动）", !w.ledger.some((l) => l.reason.includes("提问") || l.reason.includes("生图")));

  // ── H10 · 庆祝时点检测：fresh 标记 + ack 落库幂等 + 角色边界 ──
  ck("H10 新解锁带 fresh 待庆祝标记", w.badges.find((b) => b.id === "ask-1")?.fresh === true && w.badges.find((b) => b.id === "img-1")?.fresh === true);
  r = await fetch(`${BASE}/api/badges`, { method: "POST", headers: j(S), body: JSON.stringify({ ids: ["ask-1", "img-1", "fake-badge-999"] }) });
  let ak = await r.json();
  ck("H10 庆祝确认：目录外 id 丢弃、本人两枚落库", r.ok && ak.acked === 2, `acked=${ak.acked}`);
  r = await fetch(`${BASE}/api/badges`, { headers: j(S) });
  w = await r.json();
  // 注意：本轮 e2e 还顺带新解锁了 quiz/fix/proj 等徽章（同样 fresh）——只断言被 ack 的两枚翻 false
  ck("H10 确认后被 ack 的两枚 fresh 翻 false（换设备不重播）", w.badges.find((b) => b.id === "ask-1")?.fresh === false && w.badges.find((b) => b.id === "img-1")?.fresh === false);
  r = await fetch(`${BASE}/api/badges`, { method: "POST", headers: j(S), body: JSON.stringify({ ids: ["ask-1"] }) });
  ak = await r.json();
  ck("H10 重复确认幂等（acked=0）", r.ok && ak.acked === 0);
  ck("H10 教师 ack 被拒（403）", (await fetch(`${BASE}/api/badges`, { method: "POST", headers: j(T), body: JSON.stringify({ ids: ["ask-1"] }) })).status === 403);

  // 共建最后不足 10 分时，服务端实际接收额必须回传，且只扣实际金额。
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  const beforeRemainder = await r.json();
  const filler = beforeRemainder.build.cost - beforeRemainder.build.raised - 4;
  {
    const db = new DatabaseSync(DB);
    db.prepare("INSERT INTO class_build_contrib (id,classId,userId,amount,createdAt) VALUES (?,?,?,?,?)")
      .run("cb_e2e_remainder", CLASS_ID, NEIGHBOR_UID, filler, Date.now());
    db.close();
  }
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  const fourRemaining = await r.json();
  r = await fetch(`${BASE}/api/manor`, { method: "POST", headers: j(S), body: JSON.stringify(withOp({ action: "contribute", amount: 10 }, "e2e-contribute-remainder-0001")) });
  const remainder = await r.json();
  ck("共建最后 4 分按实际接收额扣减并回传", r.ok && fourRemaining.build.cost - fourRemaining.build.raised === 4 && remainder.accepted === 4 && remainder.balance === fourRemaining.balance - 4, `accepted=${remainder.accepted} balance=${fourRemaining.balance}→${remainder.balance}`);

  // ── 永久解锁合同：达标事件之后即使被归档，已经获得的品种也不能重新上锁 ──
  {
    const db = new DatabaseSync(DB);
    db.prepare("DELETE FROM manor_harvests WHERE userId = ?").run(UID);
    db.close();
  }
  r = await fetch(`${BASE}/api/manor`, { headers: j(S) });
  m = await r.json();
  ck("探索品种达标后永久解锁，不因收获记录归档而回锁", m.farm.cropAccess.find((c) => c.id === "bean")?.unlocked === true);
} finally {
  const db = new DatabaseSync(DB);
  for (const t of ["quiz_attempts", "mistake_reviews", "user_badges", "points_ledger", "manor_items", "manor_plots", "manor_crop_unlocks", "manor_harvests", "manor_growth_spend", "manor_operations", "chat_usage"]) {
    db.prepare(`DELETE FROM ${t} WHERE userId = ?`).run(UID);
  }
  db.prepare("DELETE FROM manor_items WHERE userId = ?").run(NEIGHBOR_UID);
  db.prepare("DELETE FROM chat_messages WHERE sessionId IN (SELECT id FROM chat_sessions WHERE userId = ?)").run(UID);
  db.prepare("DELETE FROM chat_sessions WHERE userId = ?").run(UID);
  db.prepare("DELETE FROM image_jobs WHERE userId = ?").run(UID);
  db.prepare("DELETE FROM mistakes WHERE userId = ?").run(UID);
  db.prepare("DELETE FROM manor_likes WHERE visitorId = ? OR ownerId IN (?, ?)").run(UID, UID, NEIGHBOR_UID);
  db.prepare("DELETE FROM class_build_contrib WHERE classId = ? OR userId IN (?, ?)").run(CLASS_ID, UID, NEIGHBOR_UID);
  db.prepare("DELETE FROM activity_submissions WHERE studentId = ?").run(UID);
  db.prepare("DELETE FROM activities WHERE id = 'act_e2e_ch'").run();
  db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(UID, NEIGHBOR_UID);
  const left = db.prepare("SELECT (SELECT COUNT(*) FROM users WHERE id = ?) u, (SELECT COUNT(*) FROM points_ledger WHERE userId = ?) p").get(UID, UID);
  console.log(`  [CLEAN] user=${left.u} ledger=${left.p}（专用账号整体删除）`);
  db.close();
}
console.log(`\n${pass}/${pass + fail} PASS${fail ? ` · ${fail} FAIL` : ""}`);
process.exit(fail ? 1 : 0);
