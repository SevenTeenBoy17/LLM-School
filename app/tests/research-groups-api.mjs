import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { apiClient, groupFixture } from "./research-groups-fixture.mjs";
import { RESULTS_DIR } from "./manor-v5-helpers.mjs";
const report = { checks: [], startedAt: new Date().toISOString() };
const pass = s => { console.log(`PASS ${s}`); report.checks.push(s); };
const root = "/api/research-groups";
const expect = (r, status, code) => { assert.equal(r.status, status, JSON.stringify(r.body)); if (code) assert.equal(r.body.error.code, code); return r.body; };
let f;
try {
  f = await groupFixture();
  const { owner, members, base } = f;
  const anon = apiClient(base), student = apiClient(base), demo = apiClient(base);
  expect(await anon(root), 401, "AUTH_REQUIRED");
  expect(await student("/api/auth/login", "POST", { username: "student", password: "Student@123" }), 200);
  expect(await student(root), 403, "FORBIDDEN");
  expect(await demo("/api/auth/login", "POST", { username: "teacher", password: "Teacher@123" }), 200);
  expect(await demo("/api/auth/switch-role", "POST", { role: "teacher" }), 200);
  expect(await demo(root, "POST", { name: "fake", subject: "fake" }), 403, "DEMO_READONLY");
  expect(await owner(root, "POST", { name: "外部", subject: "科学" }, { origin: "https://evil.invalid" }), 403, "CROSS_ORIGIN_REQUEST");
  expect(await owner(root, "POST", "name=x", { "content-type": "text/plain" }), 415, "UNSUPPORTED_MEDIA_TYPE");
  expect(await owner(root, "POST", { name: "", subject: "科学" }), 400, "INVALID_INPUT");
  expect(await owner(root, "POST", "{"), 400, "INVALID_INPUT");
  expect(await owner(root, "POST", { name: "x".repeat(17000) }), 413, "BODY_TOO_LARGE");
  pass("Anonymous/student/demo and cross-origin/media/invalid/oversized bodies rejected");

  const created = expect(await owner(root, "POST", { name: "科学教研组 · 圆桌验收", subject: "科学" }), 200);
  const gid = created.group.id, path = `${root}/${gid}`, invite = created.inviteCode;
  assert.equal(created.members[0].name, "王思远"); assert.equal(created.members.length, 1); assert.match(invite, /^[a-f0-9]{48}$/);
  assert.deepEqual((await members[0](root)).body.groups, []);
  expect(await members[0](path), 404, "NOT_FOUND");
  expect(await members[0](`${root}/join`, "POST", { inviteCode: "0".repeat(48) }), 404, "INVITE_INVALID");
  for (const client of members.slice(0, 8)) expect(await client(`${root}/join`, "POST", { inviteCode: invite }), 200);
  let snapshot = expect(await owner(path), 200);
  assert.equal(snapshot.members.length, 9); assert.equal(new Set(snapshot.members.map(m => m.bot)).size, 9);
  assert.deepEqual(snapshot.members.slice(1).map(m => m.name), f.names.slice(0, 8));
  const avatar = snapshot.members.find(m => m.userId === "rg-test-0").bot;
  assert.equal((await members[0](path)).body.inviteCode, null);
  assert.equal((await demo(path)).body.inviteCode, null);
  assert.equal((await demo(path)).body.viewer.readOnly, true);
  assert.doesNotMatch(JSON.stringify(snapshot), /passwordHash|salt|sessionVersion|username/);
  assert.match((await owner(path)).headers.get("cache-control"), /no-store/);
  pass("Private membership, full names, unused random avatars, owner-only invite and no credential leakage");

  const task = { action: "create-task", title: "校园节水 · 观察记录与数据核验", assigneeId: "rg-test-0", dueDate: "2026-09-30", items: ["整理观测记录", "核对单位与异常数据"] };
  expect(await members[1](path, "POST", task), 403, "OWNER_REQUIRED");
  expect(await owner(path, "POST", { ...task, assigneeId: "rg-test-9" }), 400, "ASSIGNEE_INVALID");
  expect(await owner(path, "POST", { ...task, dueDate: "2026-02-30" }), 400, "INVALID_INPUT");
  snapshot = expect(await owner(path, "POST", task), 200);
  const t = snapshot.tasks[0]; assert.equal(t.completed, 0); assert.equal(t.total, 2);
  const change = { action: "update-task", taskId: t.id, revision: 1, doneIds: [t.items[0].id] };
  expect(await members[1](path, "POST", change), 403, "TASK_FORBIDDEN");
  expect(await members[0](path, "POST", { ...change, doneIds: ["11111111-1111-4111-8111-111111111111"] }), 400, "INVALID_ITEMS");
  snapshot = expect(await members[0](path, "POST", change), 200);
  assert.equal(snapshot.tasks[0].completed, 1); assert.equal(snapshot.tasks[0].revision, 2);
  expect(await owner(path, "POST", change), 409, "REVISION_CONFLICT");
  assert.equal((await owner(path)).body.tasks[0].completed, 1);
  snapshot = expect(await owner(path, "POST", { ...change, revision: 2, doneIds: t.items.map(i => i.id) }), 200);
  assert.equal(snapshot.tasks[0].completed, 2);
  const attempts = await Promise.all([members[0](path, "POST", { ...change, revision: 3 }), owner(path, "POST", { ...change, revision: 3 })]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [200, 409]);
  const other = expect(await members[9](root, "POST", { name: "另一教研组", subject: "数学" }), 200);
  expect(await members[9](`${root}/${other.group.id}`, "POST", change), 404, "TASK_NOT_FOUND");
  pass("Assignment authorization, dates, real 0/2-1/2-2/2 progress, concurrent revision conflict and cross-group task IDOR");

  expect(await owner(path, "POST", { action: "leave" }), 409, "OWNER_CANNOT_LEAVE");
  expect(await members[0](path, "POST", { action: "leave" }), 200);
  expect(await members[0](path), 404, "NOT_FOUND");
  expect(await members[0](path, "POST", { ...change, revision: 4 }), 404, "NOT_FOUND");
  const joined = expect(await members[0](`${root}/join`, "POST", { inviteCode: invite }), 200);
  assert.equal(joined.members.find(m => m.userId === "rg-test-0").bot, avatar);
  assert.equal(joined.tasks.length, 1);
  expect(await members[1](path, "POST", { action: "rotate-invite" }), 403, "OWNER_REQUIRED");
  const rotated = expect(await owner(path, "POST", { action: "rotate-invite" }), 200);
  assert.notEqual(rotated.inviteCode, invite);
  expect(await members[8](`${root}/join`, "POST", { inviteCode: invite }), 404, "INVITE_INVALID");
  expect(await members[8](`${root}/join`, "POST", { inviteCode: rotated.inviteCode }), 200);
  pass("Leave revokes access, rejoin preserves avatar/tasks, owner safeguard and invite rotation invalidates old token");

  const db = new DatabaseSync(f.dbPath);
  assert.equal(db.prepare("SELECT bot FROM rg_members WHERE groupId=? AND userId=?").get(gid, "rg-test-0").bot, avatar);
  assert.equal(db.prepare("SELECT revision FROM rg_tasks WHERE id=?").get(t.id).revision, 4);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  db.exec("BEGIN IMMEDIATE");
  try {
    expect(await owner(path), 200);
    expect(await owner(root), 200);
  } finally { db.exec("ROLLBACK"); }
  pass("Deferred WAL snapshots remain readable while another database connection holds a write lock");
  const groupCount = db.prepare("SELECT COUNT(*) AS n FROM rg_groups").get().n;
  const memberCount = db.prepare("SELECT COUNT(*) AS n FROM rg_members").get().n;
  db.exec("ALTER TABLE rg_tasks RENAME TO rg_tasks_temporarily_unavailable");
  try {
    expect(await owner(path), 503, "GROUP_UNAVAILABLE");
    expect(await owner(root, "POST", { name: "必须回滚的组", subject: "故障测试" }), 503, "GROUP_UNAVAILABLE");
    expect(await members[9](`${root}/join`, "POST", { inviteCode: rotated.inviteCode }), 503, "GROUP_UNAVAILABLE");
    expect(await owner(path, "POST", { action: "rotate-invite" }), 503, "GROUP_UNAVAILABLE");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rg_groups").get().n, groupCount);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rg_members").get().n, memberCount);
    assert.equal(db.prepare("SELECT inviteCode FROM rg_groups WHERE id=?").get(gid).inviteCode, rotated.inviteCode);
  }
  finally { db.exec("ALTER TABLE rg_tasks_temporarily_unavailable RENAME TO rg_tasks"); }
  expect(await owner(path), 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE id='u-student'").get().n, 1);
  db.prepare("UPDATE users SET role='student' WHERE id='rg-test-1'").run();
  expect(await members[1](path), 403, "FORBIDDEN");
  db.prepare("UPDATE users SET role='teacher' WHERE id='rg-test-1'").run();
  expect(await members[1](path), 200);
  db.prepare("UPDATE users SET sessionVersion=sessionVersion+1 WHERE id='rg-test-1'").run();
  expect(await members[1](path), 401, "AUTH_REQUIRED");
  pass("Role changes and session revocation are enforced against fresh database identity on every request");

  const active = db.prepare("SELECT COUNT(*) AS n FROM rg_members WHERE groupId=? AND active=1").get(gid).n;
  for (let i = active; i < 64; i++) {
    const uid = `limit-member-${i}`;
    db.prepare("INSERT INTO users SELECT ?,?,salt,passwordHash,?,'teacher',stage,classId,avatarLetter,department,sessionVersion FROM users WHERE id='u-teacher'").run(uid, uid, `容量测试${i}`);
    db.prepare("INSERT INTO rg_members VALUES (?,?,'circle',?,1)").run(gid, uid, Date.now());
  }
  expect(await members[9](`${root}/join`, "POST", { inviteCode: rotated.inviteCode }), 409, "MEMBER_LIMIT");
  for (let i = 1; i < 20; i++) {
    const g = randomUUID();
    db.prepare("INSERT INTO rg_groups VALUES (?,?,?,?,?,?)").run(g, `容量组${i}`, "测试", "u-teacher", randomBytes(24).toString("hex"), Date.now());
    db.prepare("INSERT INTO rg_members VALUES (?,?,'circle',?,1)").run(g, "u-teacher", Date.now());
  }
  expect(await owner(root, "POST", { name: "超过组数", subject: "测试" }), 409, "GROUP_LIMIT");
  for (let i = 1; i < 200; i++) db.prepare("INSERT INTO rg_tasks VALUES (?,?,?,?,?,?,1,?,?)").run(randomUUID(), gid, "rg-test-0", `容量任务${i}`, "", JSON.stringify([{ id: randomUUID(), text: "检查项", done: false }]), Date.now(), "u-teacher");
  expect(await owner(path, "POST", task), 409, "TASK_LIMIT");
  assert.equal((await owner(path)).body.tasks.length, 200);
  pass("64-member, 20-group and 200-task capacity boundaries reject only excess writes and preserve reads");
  db.close();
  pass("SQLite persistence and integrity; failed POST snapshot rolls back create/join/invite mutation without duplicate records");
  report.status = "passed";
} catch (error) { report.status = "failed"; report.error = String(error.stack ?? error); throw error; }
finally {
  if (f) await f.cleanup();
  report.finishedAt = new Date().toISOString();
  const dir = join(RESULTS_DIR, "research-groups"); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "api-report.json"), JSON.stringify(report, null, 2));
}
