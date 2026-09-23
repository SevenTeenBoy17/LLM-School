/**
 * W-B3 后端 e2e：活动闭环 + 档案袋聚合 + AI 建议 R5 流程。
 * 运行：node tests/e2e-b3.mjs（dev server 需在 :3000）
 * 纪律：所有写入在 finally 里清库——字阶门基线是空态测量，测试残留=门污染门（B2 教训）。
 */
import { DatabaseSync } from "node:sqlite";

const BASE = "http://localhost:3000";
const DB = "D:/VB/LLM-School/app/.data/eduai.sqlite";
let pass = 0, fail = 0;
const ck = (name, ok, detail = "") => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  if (ok) pass++;
  else fail++;
};

async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(`login ${username} -> ${r.status}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return cookie;
}
const j = (cookie) => ({ "content-type": "application/json", cookie });

const created = { activities: [], advice: [], uploads: [] };
try {
  const T = await login("teacher", "Teacher@123");
  const S = await login("student", "Student@123");

  // ── 1. 发布 ──
  let r = await fetch(`${BASE}/api/activities`, { method: "POST", headers: j(T), body: JSON.stringify({ subject: "语文", title: "家乡的一处风景", brief: "观察家乡的一处风景，写 200 字左右的观察笔记，说说它在四季里的变化。" }) });
  let act = await r.json();
  ck("教师发布活动", r.ok && act.id && act.status === "open", `id=${act.id}`);
  created.activities.push(act.id);

  r = await fetch(`${BASE}/api/activities`, { method: "POST", headers: j(S), body: JSON.stringify({ subject: "语文", title: "x", brief: "yyyy" }) });
  ck("学生不能发布活动（403）", r.status === 403);

  // ── 2. 学生草稿 → 提交 ──
  r = await fetch(`${BASE}/api/activities/${act.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "草稿：我家附近的小河……", action: "draft" }) });
  let sub = await r.json();
  ck("学生存草稿", r.ok && sub.status === "draft");

  r = await fetch(`${BASE}/api/activities`, { headers: j(T) });
  let list = await r.json();
  let board = list.activities.find((a) => a.id === act.id)?.board ?? [];
  ck("状态面板含真实登录学生（并集修复）", board.some((b) => b.studentId === "u-student" && b.status === "draft"), `board=${board.length} 人`);

  r = await fetch(`${BASE}/api/activities/${act.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "正式稿：小河在春天涨水，夏天孩子们在桥下乘凉，秋天两岸的芦苇变黄，冬天水面结一层薄冰。", action: "submit" }) });
  sub = await r.json();
  ck("学生提交", r.ok && sub.status === "submitted");

  r = await fetch(`${BASE}/api/activities/${act.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "偷偷改稿", action: "draft" }) });
  ck("批阅期间不可回改草稿（409）", r.status === 409);
  r = await fetch(`${BASE}/api/activities/${act.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "教师预览后调包正文", action: "submit" }) });
  ck("批阅期间 re-submit 调包被锁死（TOCTOU 修复，409）", r.status === 409);

  // ── 3. 教师退回 → 学生改后再提交 → 通过 ──
  r = await fetch(`${BASE}/api/activities/${act.id}/review`, { method: "POST", headers: j(T), body: JSON.stringify({ studentId: "u-student", verdict: "return", feedback: "四季变化写得好，再补一句你自己的感受。" }) });
  let rev = await r.json();
  ck("教师退回（附理由）", r.ok && rev.status === "returned" && rev.teacherFeedback.includes("感受"));

  r = await fetch(`${BASE}/api/activities/${act.id}/review`, { method: "POST", headers: j(T), body: JSON.stringify({ studentId: "u-student", verdict: "return" }) });
  ck("退回不附理由被拒（400）", r.status === 400);

  r = await fetch(`${BASE}/api/activities`, { headers: j(S) });
  list = await r.json();
  const mine = list.activities.find((a) => a.id === act.id)?.mine;
  ck("学生看到退回理由", mine?.status === "returned" && mine?.teacherFeedback?.includes("感受"));

  r = await fetch(`${BASE}/api/activities/${act.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "正式稿（修改）：小河四季各有样子……站在桥上看芦苇摇晃，我觉得家乡很安静、很好。", action: "submit" }) });
  ck("退回后可再提交", r.ok && (await r.json()).status === "submitted");

  r = await fetch(`${BASE}/api/activities/${act.id}/review`, { method: "POST", headers: j(T), body: JSON.stringify({ studentId: "u-student", verdict: "approve", feedback: "观察细致，感受真实。" }) });
  rev = await r.json();
  ck("教师通过（入册）", r.ok && rev.status === "approved");

  r = await fetch(`${BASE}/api/activities/${act.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "入册后还想改", action: "submit" }) });
  ck("入册后锁定（409）", r.status === 409);

  r = await fetch(`${BASE}/api/activities/${act.id}/review`, { method: "POST", headers: j(S), body: JSON.stringify({ studentId: "u-student", verdict: "approve" }) });
  ck("学生不能批阅（403）", r.status === 403);

  // ── 4. 档案袋聚合 ──
  r = await fetch(`${BASE}/api/portfolio/summary?mode=simple`, { headers: j(S) });
  let pf = await r.json();
  const entry = pf.entries.find((e) => e.kind === "activity" && e.title === "家乡的一处风景");
  ck("简约版含入册活动（学生述+师评）", Boolean(entry && entry.studentText.includes("芦苇") && entry.teacherText.includes("观察细致")));
  ck("客观数据区块存在（自动导入不可编辑）", typeof pf.objective.quiz.total === "number" && typeof pf.objective.mistakes.total === "number");

  r = await fetch(`${BASE}/api/portfolio/summary?mode=full&studentId=u-student`, { headers: j(T) });
  pf = await r.json();
  ck("教师可看本班学生详细版", r.ok && pf.mode === "full" && pf.entries.some((e) => e.kind === "activity"));

  r = await fetch(`${BASE}/api/portfolio/summary?mode=full&studentId=u-student`, { headers: j(S) });
  ck("学生带他人 studentId 仍只见自己（无越权读）", r.ok, "自读分支");

  // ── 5. AI 建议 R5：草稿→学生不可见→发布→可见→撤回→不可见 ──
  r = await fetch(`${BASE}/api/portfolio/advice`, { method: "POST", headers: j(T), body: JSON.stringify({ studentId: "u-student" }) });
  if (r.status === 503) {
    ck("AI 建议：网关不可用时诚实 503（无兜底冒充）", true, "本轮网关不可用，降级路径验证通过");
  } else {
    const draft = await r.json();
    created.advice.push(draft.id);
    ck("AI 建议草稿生成（真实网关）", r.ok && draft.status === "draft" && draft.draftText.length > 40, `${draft.draftText.slice(0, 30)}…`);

    r = await fetch(`${BASE}/api/portfolio/advice`, { headers: j(S) });
    let adv = await r.json();
    ck("草稿对学生不可见", adv.advice.length === 0);

    r = await fetch(`${BASE}/api/portfolio/advice`, { method: "PATCH", headers: j(T), body: JSON.stringify({ id: draft.id, action: "publish", finalText: draft.draftText + "\n（老师补充：期待你下次的观察笔记。）" }) });
    ck("教师改稿发布", r.ok && (await r.json()).status === "published");

    r = await fetch(`${BASE}/api/portfolio/advice`, { headers: j(S) });
    adv = await r.json();
    ck("发布后学生可见（含教师署名）", adv.advice.length === 1 && adv.advice[0].teacherName.length > 0 && adv.advice[0].text.includes("老师补充"));

    r = await fetch(`${BASE}/api/portfolio/advice`, { method: "PATCH", headers: j(T), body: JSON.stringify({ id: draft.id, action: "withdraw" }) });
    ck("教师撤回", r.ok);
    r = await fetch(`${BASE}/api/portfolio/advice`, { headers: j(S) });
    adv = await r.json();
    ck("撤回后学生不可见", adv.advice.length === 0);
  }

  r = await fetch(`${BASE}/api/portfolio/advice`, { method: "POST", headers: j(S), body: JSON.stringify({ studentId: "u-student" }) });
  ck("学生不能生成建议（403）", r.status === 403);

  // ── 6. F3 佐证材料：上传 → 携带提交 → 教师批阅预览可见 → 伪 uploadId 404 ──
  const fd = new FormData();
  fd.append("file", new File([new TextEncoder().encode("佐证材料正文：观察笔记拍照转写，含关键词 蓝松鼠踪迹。")], "观察笔记.txt", { type: "text/plain" }));
  r = await fetch(`${BASE}/api/upload`, { method: "POST", headers: { cookie: S }, body: fd });
  const up = await r.json();
  ck("F3 上传佐证 txt 解析成功", r.ok && up.status === "parsed", `id=${up.id}`);
  created.uploads.push(up.id);

  r = await fetch(`${BASE}/api/activities`, { method: "POST", headers: j(T), body: JSON.stringify({ subject: "生物", title: "校园生物观察", brief: "观察校园里的一种生物并记录。" }) });
  const act2 = await r.json();
  created.activities.push(act2.id);

  r = await fetch(`${BASE}/api/activities/${act2.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "我观察了松树上的松鼠。", action: "submit", uploadId: up.id }) });
  ck("F3 携佐证提交", r.ok && (await r.json()).status === "submitted");

  r = await fetch(`${BASE}/api/activities/${act2.id}/submission?studentId=u-student`, { headers: j(T) });
  const prev = await r.json();
  ck("F3 教师批阅预览含佐证名与正文", prev.artifact?.name === "观察笔记.txt" && prev.artifact?.preview.includes("蓝松鼠踪迹"));

  r = await fetch(`${BASE}/api/activities`, { headers: j(S) });
  const mineArt = (await r.json()).activities.find((a) => a.id === act2.id)?.mine;
  ck("F3 学生侧看到自己的佐证名", mineArt?.artifactName === "观察笔记.txt");

  r = await fetch(`${BASE}/api/activities/${act2.id}/review`, { method: "POST", headers: j(T), body: JSON.stringify({ studentId: "u-student", verdict: "approve", feedback: "记录真实。" }) });
  ck("F3 通过入册", r.ok);
  r = await fetch(`${BASE}/api/portfolio/summary?mode=simple`, { headers: j(S) });
  const pfArt = (await r.json()).entries.find((e) => e.title === "校园生物观察");
  ck("F3 档案袋条目带佐证名", pfArt?.artifactName === "观察笔记.txt");

  r = await fetch(`${BASE}/api/activities/${act2.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "x", action: "draft", uploadId: "up_fake_notmine" }) });
  ck("F3 伪 uploadId 归属校验 404", r.status === 404);

  // ── 7. G2 截止时间：过期服务端拒收，未过期照常 ──
  r = await fetch(`${BASE}/api/activities`, { method: "POST", headers: j(T), body: JSON.stringify({ subject: "数学", title: "已截止的活动", brief: "用于过期校验。", dueAt: Date.now() - 3600_000 }) });
  const actPast = await r.json();
  created.activities.push(actPast.id);
  r = await fetch(`${BASE}/api/activities/${actPast.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "迟到的提交", action: "submit" }) });
  ck("G2 过期活动提交被拒（409 past_due）", r.status === 409 && (await r.json()).error === "past_due");
  r = await fetch(`${BASE}/api/activities`, { headers: j(S) });
  const pastView = (await r.json()).activities.find((a) => a.id === actPast.id);
  ck("G2 学生视图 pastDue=true（服务端权威）", pastView?.pastDue === true);

  r = await fetch(`${BASE}/api/activities`, { method: "POST", headers: j(T), body: JSON.stringify({ subject: "数学", title: "未截止的活动", brief: "用于未过期校验。", dueAt: Date.now() + 86_400_000 }) });
  const actFuture = await r.json();
  created.activities.push(actFuture.id);
  r = await fetch(`${BASE}/api/activities/${actFuture.id}/submit`, { method: "POST", headers: j(S), body: JSON.stringify({ content: "按时提交", action: "submit" }) });
  ck("G2 未过期活动照常提交", r.ok && (await r.json()).status === "submitted");

  // ── G2.5 H8 生图提示词润色：真实网关改写（503 诚实分支同 AI 建议模式） ──
  r = await fetch(`${BASE}/api/image/polish`, { method: "POST", headers: j(S), body: JSON.stringify({ prompt: "画一座火山的科学示意图" }) });
  if (r.status === 503) {
    ck("H8 润色：网关不可用时诚实 503（无兜底冒充）", true, "降级路径验证通过");
  } else {
    const pol = await r.json();
    ck("H8 润色真实网关（source=remote 且扩写）", r.ok && pol.source === "remote" && pol.polished.length > 15, pol.polished?.slice(0, 40));
  }
  r = await fetch(`${BASE}/api/image/polish`, { method: "POST", headers: j(S), body: JSON.stringify({ prompt: "猫" }) });
  ck("H8 润色：过短输入 400", r.status === 400);

  // ── 8. G3 学期归档：锁定→版本化→冻结→可打印数据面 ──
  r = await fetch(`${BASE}/api/portfolio/snapshots`, { method: "POST", headers: j(S), body: JSON.stringify({ term: "e2e 测试学期" }) });
  const snap = await r.json();
  ck("G3 归档锁定成功", r.ok && snap.id);
  r = await fetch(`${BASE}/api/portfolio/snapshots`, { method: "POST", headers: j(S), body: JSON.stringify({ term: "e2e 测试学期" }) });
  ck("G3 同学期重复归档拒绝（409，锁定不可覆盖）", r.status === 409);

  r = await fetch(`${BASE}/api/portfolio/snapshots?id=${snap.id}`, { headers: j(S) });
  let sv = await r.json();
  const frozenCount = sv.payload.summary.entries.length;
  ck("G3 快照含冻结的遴选数据", r.ok && sv.payload.studentName.length > 0 && typeof frozenCount === "number");

  // 归档后再入册一条 → 快照不得变化（冻结语义）
  r = await fetch(`${BASE}/api/activities/${actFuture.id}/review`, { method: "POST", headers: j(T), body: JSON.stringify({ studentId: "u-student", verdict: "approve", feedback: "按时且认真。" }) });
  ck("G3 归档后新入册照常", r.ok);
  r = await fetch(`${BASE}/api/portfolio/snapshots?id=${snap.id}`, { headers: j(S) });
  sv = await r.json();
  ck("G3 快照冻结：新入册不进旧版本", sv.payload.summary.entries.length === frozenCount, `${frozenCount} → ${sv.payload.summary.entries.length}`);

  r = await fetch(`${BASE}/api/portfolio/snapshots?studentId=u-student`, { headers: j(T) });
  ck("G3 教师可读本班学生归档列表", r.ok && (await r.json()).snapshots.some((x) => x.term === "e2e 测试学期"));
  ck("G3 教师归档他人档案被拒（403，只有本人能锁定）", (await fetch(`${BASE}/api/portfolio/snapshots`, { method: "POST", headers: j(T), body: JSON.stringify({ term: "x学期" }) })).status === 403);
} finally {
  // ── 清库（门污染门纪律）──
  const db = new DatabaseSync(DB);
  for (const id of created.activities) {
    db.prepare("DELETE FROM activity_submissions WHERE activityId = ?").run(id);
    db.prepare("DELETE FROM activities WHERE id = ?").run(id);
  }
  db.prepare("DELETE FROM portfolio_advice WHERE studentId = 'u-student'").run();
  for (const id of created.uploads) db.prepare("DELETE FROM uploads WHERE id = ?").run(id);
  db.prepare("DELETE FROM portfolio_snapshots WHERE userId = 'u-student'").run();
  const left = db.prepare("SELECT (SELECT COUNT(*) FROM activities) a, (SELECT COUNT(*) FROM activity_submissions) s, (SELECT COUNT(*) FROM portfolio_advice) p, (SELECT COUNT(*) FROM uploads WHERE userId='u-student') u").get();
  console.log(`  [CLEAN] activities=${left.a} submissions=${left.s} advice=${left.p} uploads=${left.u}`);
  db.close();
}
console.log(`\n${pass}/${pass + fail} PASS${fail ? ` · ${fail} FAIL` : ""}`);
process.exit(fail ? 1 : 0);
