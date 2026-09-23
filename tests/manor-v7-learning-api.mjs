import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, parse, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

// Real Next handlers and SQLite in a source snapshot: no workspace tsconfig, .env or .data writes.
const source = fileURLToPath(new URL("../app/", import.meta.url));
// Webpack's Windows relative entry resolution needs dependencies on the same drive.
const tempRoot = process.platform === "win32" && parse(tmpdir()).root !== parse(source).root ? join(parse(source).root, "Temp") : tmpdir();
mkdirSync(tempRoot, { recursive: true });
const temp = mkdtempSync(join(tempRoot, "eduai-v7-learning-"));
const app = join(temp, "app");
const data = join(temp, "data");
const checks = [];
const beganAt = Date.now();
let requests = 0;
let server;
let probe;
let base;
let cookie;
let tail = "";
let head = "";
let sequence = 0;
const op = () => `v7-learning-${String(++sequence).padStart(8, "0")}`;
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
async function request(path, body, status = 200, session = cookie, method = body === undefined ? "GET" : "POST", headers = {}) {
  requests++;
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(session ? { cookie: session } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers,
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(90_000) });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 1200)}`);
  return JSON.parse(text);
}
async function login(username, password) {
  const response = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  assert.equal(response.status, 200, await response.clone().text());
  const value = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(value);
  return value;
}
async function start() {
  const socket = createServer();
  await new Promise((done) => socket.listen(0, "127.0.0.1", done));
  const port = socket.address().port;
  await new Promise((done) => socket.close(done));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [join(source, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: app, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, EDUAI_DB_DIR: data, EDUAI_ENABLE_DEMO_SEED: "true", EDUAI_SESSION_SECRET: `isolated-${randomUUID()}`, NEXT_DIST_DIR: ".next", NEXT_TELEMETRY_DISABLED: "1" },
  });
  head = "";
  tail = "";
  for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { tail = `${tail}${chunk}`.slice(-16000); if (head.length < 8000) head = `${head}${chunk}`.slice(0, 8000); });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited ${server.exitCode}: ${tail}`);
    let ready;
    try { ready = await fetch(`${base}/api/v2/manor/assignments`, { signal: AbortSignal.timeout(10_000) }); }
    catch { /* wait for the real API compiler */ }
    if (ready?.status === 401) return;
    if (ready && ready.status >= 500) throw new Error(`API compile failed: ${(await ready.text()).slice(0, 1000)}\n${head}`);
    await pause(300);
  }
  throw new Error(`Server readiness failed: ${tail}`);
}
async function stop() {
  if (server && server.exitCode === null) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else { server.kill("SIGTERM"); await new Promise((done) => server.once("exit", done)); }
  }
  await pause(500);
}

const assignmentsPath = "/api/v2/teacher/manor/assignments";
const taskPath = "/api/v2/manor/task-runs";
const evidencePath = "/api/v2/manor/evidence";
const artifactsPath = "/api/v2/manor/artifacts";
const bootstrap = () => request("/api/v2/manor/bootstrap");
try {
  mkdirSync(join(app, "app"), { recursive: true });
  mkdirSync(data);
  for (const path of ["lib", "app/api", "package.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "proxy.ts"]) cpSync(join(source, path), join(app, path), { recursive: true });
  symlinkSync(join(source, "node_modules"), join(app, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  probe = new DatabaseSync(join(data, "eduai.sqlite"));
  probe.exec(`CREATE TABLE learning_artifacts (id TEXT PRIMARY KEY,studentId TEXT NOT NULL,evidenceId TEXT,artifactType TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',contentHash TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL);
    INSERT INTO learning_artifacts VALUES ('legacy-draft','u-student',NULL,'observation','Legacy draft','Preserve this authored draft','private','legacy-hash',7,1000,1001);`);
  await start();
  cookie = await login("student", "Student@123");
  const other = await login("student-p", "Student@123");
  const teacher = await login("teacher", "Teacher@123");
  probe.exec("PRAGMA busy_timeout=5000");
  const initial = await bootstrap();
  assert.deepEqual(initial.missions, []);
  assert.deepEqual(initial.assignments, []);
  assert.equal(initial.subject.gradeBand, "middle_school");
  assert.equal(initial.sampleMissions.length, 9);
  for (const path of ["/api/v2/manor/projects", "/api/v2/manor/assignments"]) await request(path, undefined, 401, "");
  for (const path of [taskPath, evidencePath, artifactsPath, "/api/v2/manor/projects/project-missing"]) await request(path, { operationId: op() }, 401, "");
  assert.ok(initial.sampleMissions.every((mission) => mission.reward === 0 && mission.source.kind === "sample" && !mission.source.teacherPublished && !("answer" in mission)));
  const legacy = initial.artifacts.find((artifact) => artifact.id === "legacy-draft");
  assert.equal(legacy.content, "Preserve this authored draft");
  assert.equal(legacy.revision, 7);
  checks.push("additive legacy draft migration; no automatic publication; explicit free samples");

  const publication = { operationId: op(), title: "Water evidence inquiry", missionIds: ["water-math-middle", "water-science-middle", "water-reading-middle"],
    gradeBand: "middle_school", resourceVersion: "teacher-water-v1", datasetVersion: "water-simulated-v1", rewardUnits: 12, studentIds: [initial.subject.id] };
  await request(assignmentsPath, undefined, 401, "");
  await request(assignmentsPath, publication, 401, "");
  await request(assignmentsPath, publication, 403);
  await request(assignmentsPath, publication, 403, teacher, "POST", { origin: "https://invalid.example" });
  await request(assignmentsPath, publication, 415, teacher, "POST", { "content-type": "text/plain" });
  await request(assignmentsPath, { ...publication, classId: "forged" }, 400, teacher);
  await request(assignmentsPath, { ...publication, gradeBand: "upper_primary" }, 400, teacher);
  const beforeGrades = await request(assignmentsPath, undefined, 200, teacher);
  assert.equal(beforeGrades.ownerId, "u-teacher");
  assert.equal(beforeGrades.classes[0].students.find((item) => item.id === "u-student-p").gradeBand, null);
  const gradeInput = { operationId: op(), students: [{ studentId: "u-student-p", gradeBand: "upper_primary" }] };
  await request(`${assignmentsPath}/grades`, gradeInput, 403, cookie, "PATCH");
  await request(`${assignmentsPath}/grades`, gradeInput, 200, teacher, "PATCH");
  await request(`${assignmentsPath}/grades`, { operationId: op(), students: [{ studentId: "u-student", gradeBand: "lower_primary" }] }, 400, teacher, "PATCH");
  const published = await request(assignmentsPath, publication, 200, teacher);
  assert.deepEqual(await request(assignmentsPath, publication, 200, teacher), published);
  await request(assignmentsPath, { ...publication, rewardUnits: 24 }, 409, teacher);
  assert.equal(published.assignment.assignmentVersion, 1);
  assert.equal(published.assignment.classId, "c1");
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_assignments").get().n, 1);
  assert.ok(published.missions.every((mission) => mission.id !== mission.templateId && mission.source.teacherPublished && !("answer" in mission)));
  assert.equal((await request("/api/v2/manor/assignments", undefined, 200, other)).missions.length, 0);
  const b = await bootstrap();
  assert.equal(b.missions.length, 3);
  const [math, science, language] = published.missions;
  const sample = await request(evidencePath, { operationId: op(), missionId: "reading-clue-01", answer: "B" });
  assert.equal(sample.evidence.status, "accepted_mastery");
  assert.equal(sample.grant, null);
  await request(evidencePath, { operationId: op(), missionId: "reading-clue-01", evidenceType: "expression", content: "This is not a teacher assignment." }, 409);
  const admin = await login("admin", "Admin@123");
  const switched = await fetch(`${base}/api/auth/switch-role`, { method: "POST", headers: { cookie: admin, "content-type": "application/json" }, body: JSON.stringify({ role: "teacher" }) });
  assert.equal(switched.status, 200);
  const demo = switched.headers.get("set-cookie").split(";", 1)[0];
  await request(assignmentsPath, publication, 403, demo);
  checks.push("real auth/demo/CSRF/strict input rejects, canonical grade confirmation, scoped immutable publication and replay");

  const runs = [];
  const objectiveGrants = [];
  const contributions = [];
  let firstAccepted;
  for (const [index, mission] of [math, science, language].entries()) {
    const runInput = { operationId: op(), missionId: mission.id, assignmentId: published.assignment.id, phase: "evidence", expectedRevision: 0 };
    await request(taskPath, runInput, 404, other);
    const run = (await request(taskPath, runInput)).taskRun;
    assert.equal(run.assignmentId, published.assignment.id);
    runs.push(run);
    const answer = ["B", "C", "A"][index];
    const input = { operationId: op(), missionId: mission.id, taskRunId: run.id, answer };
    if (index === 0) await request(evidencePath, { ...input, operationId: op(), answer: "A" });
    const objective = await request(evidencePath, input);
    assert.equal(objective.evidence.taskRunId, run.id);
    assert.equal(objective.evidence.status, index === 0 ? "accepted_correction" : "accepted_mastery");
    assert.equal(objective.grant.units, index === 0 ? 8 : 12);
    assert.deepEqual(await request(evidencePath, input), objective);
    assert.equal((await request(evidencePath, { ...input, operationId: op() })).grant.id, objective.grant.id);
    objectiveGrants.push(objective.grant);
    const expressionInput = { operationId: op(), missionId: mission.id, taskRunId: run.id, evidenceType: "expression", content: [
      "100 L minus 75 L = 25 L; 25 / 100 = 25%. The baseline is the regular 100 L group.",
      "Both groups have 9/10 upright leaves. Control area, species, light and weather; one observation is not long-term proof. Repeat weekly.",
      "Recommend continued trials: 25 L less water, both groups 9/10 upright leaves. One week does not prove annual savings; repeat and review health.",
    ][index] };
    let expression = await request(evidencePath, expressionInput);
    await request(evidencePath, { ...expressionInput, operationId: op() }, 409);
    if (index === 0) {
      const revise = await request(`/api/v2/teacher/manor/evidence/${expression.evidence.id}/decisions`, { operationId: op(), expectedRevision: expression.evidence.revision, status: "revise", reason: "Please make the comparison baseline explicit." }, 200, teacher);
      expression = await request(evidencePath, { ...expressionInput, operationId: op(), evidenceId: expression.evidence.id, expectedRevision: revise.evidence.revision, content: `${expressionInput.content} The comparison uses 100 L, not 75 L.` });
      assert.equal(expression.evidence.attemptCount, 2);
    }
    const decisionInput = { operationId: op(), expectedRevision: expression.evidence.revision, status: "accepted_mastery", reason: "Verified the submitted data, units, evidence limits and reasoning." };
    await request(`/api/v2/teacher/manor/evidence/${expression.evidence.id}/decisions`, decisionInput, 403, cookie);
    const accepted = await request(`/api/v2/teacher/manor/evidence/${expression.evidence.id}/decisions`, decisionInput, 200, teacher);
    assert.deepEqual(await request(`/api/v2/teacher/manor/evidence/${expression.evidence.id}/decisions`, decisionInput, 200, teacher), accepted);
    const artifact = (await bootstrap()).artifacts.find((item) => item.evidenceId === accepted.evidence.id && item.artifactType === "expression");
    assert.equal(artifact.status, "archived");
    assert.equal(artifact.taskRunId, run.id);
    assert.equal(artifact.acceptedRevision, artifact.revision);
    contributions.push({ subject: mission.subject, evidenceId: accepted.evidence.id, artifactId: artifact.id });
    if (index === 0) firstAccepted = { artifact, evidence: accepted.evidence };
  }
  checks.push("rule correction and reward separation; exact teacher expression revise/accept versions; same-operation replay");

  const draftInput = { operationId: op(), artifactType: "observation", title: "Editable draft", content: "Original first draft observation.", visibility: "private" };
  const created = await request(artifactsPath, draftInput);
  const edit = { ...draftInput, operationId: op(), artifactId: created.artifact.id, expectedRevision: 1, content: "Revised draft, same artifact identity." };
  await request(artifactsPath, edit, 404, other);
  const edited = await request(artifactsPath, edit);
  assert.equal(edited.artifact.id, created.artifact.id);
  assert.equal(edited.artifact.revision, 2);
  assert.deepEqual(await request(artifactsPath, edit), edited);
  const stale = await request(artifactsPath, { ...edit, operationId: op() }, 409);
  assert.equal(stale.error.authoritative.artifact.content, edit.content);
  const patched = await request(`${artifactsPath}/${created.artifact.id}`, { ...draftInput, operationId: op(), expectedRevision: 2, content: "Saved via the explicit draft PATCH route." }, 200, cookie, "PATCH");
  assert.equal(patched.artifact.revision, 3);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM learning_artifacts WHERE id=?").get(created.artifact.id).n, 1);
  const frozen = firstAccepted.artifact;
  await request(artifactsPath, { ...draftInput, operationId: op(), artifactId: frozen.id, expectedRevision: frozen.revision, artifactType: "expression", content: "Cannot replace reviewed content." }, 409);
  assert.throws(() => probe.prepare("UPDATE learning_artifacts SET content='tampered' WHERE id=?").run(frozen.id), /immutable/);
  assert.throws(() => probe.prepare("UPDATE evidence_attempts SET answerJson='{}' WHERE evidenceId=?").run(firstAccepted.evidence.id), /immutable/);
  const restart = { operationId: op(), missionId: math.id, phase: "evidence", restart: true, expectedRevision: runs[0].revision };
  const next = await request(taskPath, restart);
  assert.notEqual(next.taskRun.id, runs[0].id);
  assert.equal(next.archivedTaskRun.id, runs[0].id);
  const newEvidence = await request(evidencePath, { operationId: op(), missionId: math.id, taskRunId: next.taskRun.id, answer: "B" });
  assert.equal(newEvidence.grant, null);
  assert.equal(newEvidence.evidence.status, "accepted_mastery");
  const freshExpression = await request(evidencePath, { operationId: op(), missionId: math.id, taskRunId: next.taskRun.id, evidenceType: "expression", content: "A fresh run: 25 L difference, 25% relative to the 100 L baseline." });
  assert.notEqual(freshExpression.evidence.id, firstAccepted.evidence.id);
  const acceptedAgain = await request(`/api/v2/teacher/manor/evidence/${freshExpression.evidence.id}/decisions`, { operationId: op(), expectedRevision: freshExpression.evidence.revision, status: "accepted_mastery", reason: "The calculation uses the correct original baseline." }, 200, teacher);
  assert.equal(acceptedAgain.grant, null);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM growth_grants WHERE milestoneKey LIKE ?").get(`${published.assignment.id}:${math.id}:%`).n, 2);
  assert.equal((await bootstrap()).artifacts.find((item) => item.id === frozen.id).content, frozen.content);
  probe.prepare("UPDATE manor_task_runs SET phase='summary',completedAt=? WHERE id=?").run(Date.now() - 172800000, next.taskRun.id);
  const tomorrow = await request(taskPath, { operationId: op(), missionId: math.id, phase: "evidence", expectedRevision: next.taskRun.revision });
  assert.notEqual(tomorrow.taskRun.id, next.taskRun.id);
  const tomorrowEvidence = await request(evidencePath, { operationId: op(), missionId: math.id, taskRunId: tomorrow.taskRun.id, answer: "B" });
  assert.equal(tomorrowEvidence.grant, null);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM growth_grants WHERE milestoneKey LIKE ?").get(`${published.assignment.id}:${math.id}:%`).n, 2);
  checks.push("same-id draft POST/PATCH, stale conflict and private ownership; immutable reviewed SQL rows; fresh run without duplicate milestones");

  const project = (await request("/api/v2/manor/projects")).projects[0];
  const beforeProjectEnergy = (await bootstrap()).resources.growthEnergy;
  assert.equal(project.revision, 0);
  const projectInput = { operationId: op(), expectedRevision: 0, datasetVersion: project.datasetVersion, intent: "draft", contributions: contributions.slice(0, 1), content: "Draft integrated water-saving recommendation with recorded evidence limits." };
  await request(`/api/v2/manor/projects/${project.id}`, projectInput, 404, other);
  const partial = await request(`/api/v2/manor/projects/${project.id}`, projectInput);
  assert.equal(partial.project.status, "incomplete");
  assert.equal(partial.project.result, null);
  assert.equal(partial.project.draft.content, projectInput.content);
  await request(`/api/v2/manor/projects/${project.id}`, { ...projectInput, operationId: op(), expectedRevision: 1, intent: "complete" }, 409);
  await request(`/api/v2/manor/projects/${project.id}`, { ...projectInput, operationId: op(), expectedRevision: 1, datasetVersion: "different-data" }, 409);
  await request(`/api/v2/manor/projects/${project.id}`, { ...projectInput, operationId: op(), expectedRevision: 1, contributions: [{ ...contributions[0], subject: "科学" }] }, 409);
  const finalInput = { ...projectInput, operationId: op(), expectedRevision: 1, intent: "complete", contributions,
    content: "Recommend controlled repeat trials: save 25 L (25% of 100 L), both groups 9/10 upright. One observation is insufficient; preserve plant health and repeat." };
  const result = await request(`/api/v2/manor/projects/${project.id}`, finalInput);
  assert.equal(result.project.status, "complete");
  assert.equal(result.project.evaluationStatus, "not_reviewed");
  assert.equal(result.project.completionScope, "required_contributions");
  assert.equal(result.artifact.status, "saved");
  assert.equal(result.artifact.acceptedRevision, null);
  assert.equal((await bootstrap()).resources.growthEnergy, beforeProjectEnergy);
  assert.throws(() => probe.prepare("UPDATE learning_artifacts SET content='tampered' WHERE id=?").run(result.artifact.id), /immutable/);
  assert.equal(result.project.result.artifactId, partial.project.draft.artifactId);
  assert.deepEqual(await request(`/api/v2/manor/projects/${project.id}`, finalInput), result);
  await request(`/api/v2/manor/projects/${project.id}`, { ...finalInput, operationId: op(), expectedRevision: 2 }, 409);
  assert.equal((await bootstrap()).projects[0].result.content, finalInput.content);
  checks.push("project partial draft and complete result with all three exact teacher-accepted sources; dataset/source/ownership/stale guards");

  const plotId = 1;
  let plot = (await bootstrap()).plots.find((item) => item.id === plotId);
  const plant = await request(`/api/v2/manor/plots/${plotId}/actions`, { operationId: op(), action: "plant", cropId: "wheat", expectedRevision: plot.revision, grantAllocations: [] });
  plot = plant.plot;
  const allocations = [
    [{ grantId: objectiveGrants[0].id, amount: 4 }, { grantId: objectiveGrants[1].id, amount: 4 }],
    [{ grantId: objectiveGrants[0].id, amount: 4 }, { grantId: objectiveGrants[1].id, amount: 4 }],
    [{ grantId: objectiveGrants[1].id, amount: 4 }, { grantId: objectiveGrants[2].id, amount: 4 }],
  ];
  const failing = { operationId: op(), action: "nurture", expectedRevision: plot.revision, grantAllocations: allocations[0] };
  const beforeUnits = (await bootstrap()).resources.growthEnergy;
  probe.exec("CREATE TRIGGER v7_fail_action BEFORE INSERT ON manor_plot_actions BEGIN SELECT RAISE(ABORT,'isolated rollback test'); END;");
  const failed = await fetch(`${base}/api/v2/manor/plots/${plotId}/actions`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(failing) });
  assert.equal(failed.status, 500);
  await failed.text();
  probe.exec("DROP TRIGGER v7_fail_action");
  assert.equal((await bootstrap()).resources.growthEnergy, beforeUnits);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM grant_consumptions WHERE operationId=?").get(failing.operationId).n, 0);
  await request(`/api/v2/manor/operations/${failing.operationId}`, undefined, 404);
  for (const [index, grantAllocations] of allocations.entries()) {
    const input = index === 0 ? failing : { operationId: op(), action: "nurture", expectedRevision: plot.revision, grantAllocations };
    const nurtured = await request(`/api/v2/manor/plots/${plotId}/actions`, input);
    assert.deepEqual(await request(`/api/v2/manor/plots/${plotId}/actions`, input), nurtured);
    plot = nurtured.plot;
  }
  const harvest = await request(`/api/v2/manor/plots/${plotId}/actions`, { operationId: op(), action: "harvest", expectedRevision: plot.revision, grantAllocations: [] });
  const cycle = harvest.plantingCycle;
  assert.equal(cycle.status, "harvested");
  assert.equal(cycle.historyComplete, true);
  assert.equal(cycle.actions.length, 5);
  assert.equal(cycle.actions.flatMap((action) => action.allocations).reduce((n, allocation) => n + allocation.amount, 0), 24);
  assert.equal(harvest.harvest.plantingCycleId, cycle.id);
  assert.ok(cycle.actions.flatMap((action) => action.allocations).every((allocation) => allocation.assignmentId === published.assignment.id && allocation.taskRunId));
  const replant = await request(`/api/v2/manor/plots/${plotId}/actions`, { operationId: op(), action: "plant", cropId: "wheat", expectedRevision: harvest.plot.revision, grantAllocations: [] });
  await request(`/api/v2/manor/plots/${plotId}/actions`, { operationId: op(), action: "clear", expectedRevision: replant.plot.revision, grantAllocations: [] });
  assert.equal((await bootstrap()).plantingCycles.filter((item) => item.plotId === plotId).length, 2);
  const ledger = probe.prepare(`SELECT g.id,g.units,g.remainingUnits,COALESCE(SUM(c.amount),0) AS spent FROM growth_grants g LEFT JOIN grant_consumptions c ON c.grantId=g.id GROUP BY g.id`).all();
  assert.ok(ledger.every((grant) => grant.units === grant.remainingUnits + grant.spent));
  await request("/api/manor", { action: "plant", plot: 1, cropId: "wheat", operationId: op() }, 410);
  checks.push("multi-grant full allocation ledger; injected SQL rollback; nurture/harvest/clear cycle persistence; legacy writes remain 410");

  const historyPath = "/api/v2/manor/plots/3/history";
  for (let index = 0; index < 27; index++) probe.prepare(`INSERT INTO manor_planting_cycles
    (id,studentId,plotId,cropId,startedAt,endedAt,status,historyComplete) VALUES (?,? ,3,'wheat',2000,2001,'cleared',0)`)
    .run(`cycle_page-${String(index).padStart(3, "0")}`, initial.subject.id);
  await request(historyPath, undefined, 401, "");
  await request(historyPath, undefined, 403, teacher);
  await request(`${historyPath}?limit=51`, undefined, 400);
  await request(`${historyPath}?cursor=not-a-valid-cursor`, undefined, 400);
  const firstPage = await request(`${historyPath}?limit=7`);
  assert.equal(firstPage.cycles.length, 7);
  assert.equal(firstPage.hasMore, true);
  assert.ok(firstPage.nextCursor);
  await request(`/api/v2/manor/plots/4/history?cursor=${encodeURIComponent(firstPage.nextCursor)}`, undefined, 400);
  await request(`${historyPath}?cursor=${encodeURIComponent(firstPage.nextCursor)}`, undefined, 400, other);
  probe.prepare(`INSERT INTO manor_planting_cycles (id,studentId,plotId,cropId,startedAt,endedAt,status,historyComplete)
    VALUES ('cycle_page-new',?,3,'wheat',3000,3001,'cleared',0)`).run(initial.subject.id);
  const seen = firstPage.cycles.map((item) => item.id);
  let cursor = firstPage.nextCursor;
  while (cursor) {
    const page = await request(`${historyPath}?limit=7&cursor=${encodeURIComponent(cursor)}`);
    assert.ok(page.cycles.length <= 7);
    seen.push(...page.cycles.map((item) => item.id));
    assert.equal(page.hasMore, page.nextCursor !== null);
    cursor = page.nextCursor;
  }
  assert.equal(seen.length, 27);
  assert.equal(new Set(seen).size, 27);
  assert.equal(seen.includes("cycle_page-new"), false);
  assert.deepEqual(seen, Array.from({ length: 27 }, (_, index) => `cycle_page-${String(26 - index).padStart(3, "0")}`));
  const bounded = await bootstrap();
  assert.equal(bounded.plantingCycles.length, 10);
  assert.equal(bounded.plantingCyclePagination.hasMore, true);
  assert.ok(bounded.plantingCyclePagination.nextCursor);
  checks.push("bounded cursor HTTP envelope; tied timestamps/new inserts without duplicates; cursor owner/plot binding; capped bootstrap history");

  probe.prepare("UPDATE users SET classId='transferred' WHERE id='u-teacher'").run();
  assert.deepEqual((await bootstrap()).missions, []);
  await request(evidencePath, { operationId: op(), missionId: science.id, taskRunId: runs[1].id, answer: "C" }, 404);
  const foreign = await request(assignmentsPath, undefined, 200, teacher);
  assert.equal(foreign.assignments.length, 0);
  await request(assignmentsPath, publication, 409, teacher);
  await request(assignmentsPath, { ...publication, operationId: op() }, 400, teacher);
  probe.prepare("UPDATE users SET classId='c1' WHERE id='u-teacher'").run();
  const beforeSupersede = await bootstrap();
  const persisted = beforeSupersede.projects.find((item) => item.id === project.id);
  assert.ok(persisted?.result, "the historical project must exist before supersession");
  const historicalProject = probe.prepare("SELECT * FROM manor_project_runs WHERE id=?").get(project.id);
  const historicalArtifact = beforeSupersede.artifacts.find((item) => item.id === persisted.result.artifactId);
  const oldAssignment = probe.prepare("SELECT * FROM manor_assignments WHERE id=?").get(published.assignment.id);
  const oldSnapshots = probe.prepare("SELECT * FROM manor_assignment_missions WHERE assignmentId=? ORDER BY id").all(published.assignment.id);
  const assignmentCount = probe.prepare("SELECT COUNT(*) AS n FROM manor_assignments").get().n;
  const snapshotCount = probe.prepare("SELECT COUNT(*) AS n FROM manor_assignment_missions").get().n;
  const supersedeInput = { ...publication, operationId: op(), supersedesId: published.assignment.id, title: "Water inquiry version two", resourceVersion: "teacher-water-v2", rewardUnits: 0 };
  // Fail after both the withdrawal and all new snapshots, immediately before the receipt.
  probe.exec(`CREATE TRIGGER v7_fail_supersede BEFORE INSERT ON manor_operations
    WHEN NEW.operationId='${supersedeInput.operationId}'
      AND EXISTS (SELECT 1 FROM manor_assignments WHERE id='${published.assignment.id}' AND status='withdrawn')
      AND EXISTS (SELECT 1 FROM manor_assignment_missions m JOIN manor_assignments a ON a.id=m.assignmentId WHERE a.supersedesId='${published.assignment.id}')
    BEGIN SELECT RAISE(ABORT,'isolated supersede rollback test'); END;`);
  try {
    const failedSupersede = await fetch(`${base}${assignmentsPath}`, { method: "POST", headers: { cookie: teacher, "content-type": "application/json" }, body: JSON.stringify(supersedeInput) });
    assert.equal(failedSupersede.status, 500, await failedSupersede.text());
  } finally { probe.exec("DROP TRIGGER v7_fail_supersede"); }
  assert.deepEqual(probe.prepare("SELECT * FROM manor_assignments WHERE id=?").get(published.assignment.id), oldAssignment);
  assert.deepEqual(probe.prepare("SELECT * FROM manor_assignment_missions WHERE assignmentId=? ORDER BY id").all(published.assignment.id), oldSnapshots);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_assignments").get().n, assignmentCount);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_assignment_missions").get().n, snapshotCount);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_operations WHERE userId='u-teacher' AND operationId=?").get(supersedeInput.operationId).n, 0);
  assert.deepEqual((await bootstrap()).missions, beforeSupersede.missions);
  const upgraded = await request(assignmentsPath, supersedeInput, 200, teacher);
  assert.equal(upgraded.assignment.assignmentVersion, 2);
  const withdrawn = probe.prepare("SELECT * FROM manor_assignments WHERE id=?").get(published.assignment.id);
  assert.deepEqual({ ...withdrawn }, { ...oldAssignment, status: "withdrawn", revision: oldAssignment.revision + 1 });
  assert.deepEqual(probe.prepare("SELECT * FROM manor_assignment_missions WHERE assignmentId=? ORDER BY id").all(published.assignment.id), oldSnapshots);
  assert.deepEqual(await request(assignmentsPath, supersedeInput, 200, teacher), upgraded, "the committed operation must replay without withdrawing twice");
  const staleSupersede = { ...supersedeInput, operationId: op() };
  const staleResult = await request(assignmentsPath, staleSupersede, 409, teacher);
  assert.equal(staleResult.error.code, "ASSIGNMENT_NOT_PUBLISHED");
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_operations WHERE userId='u-teacher' AND operationId=?").get(staleSupersede.operationId).n, 0);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_assignments WHERE supersedesId=?").get(published.assignment.id).n, 1);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_assignments").get().n, assignmentCount + 1);
  assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_assignment_missions").get().n, snapshotCount + 3);
  // Older deployments could leave a superseded row published; do not branch it again.
  probe.prepare("UPDATE manor_assignments SET status='published' WHERE id=?").run(published.assignment.id);
  try {
    const legacyRepeat = await request(assignmentsPath, { ...supersedeInput, operationId: op() }, 409, teacher);
    assert.equal(legacyRepeat.error.code, "ASSIGNMENT_NOT_PUBLISHED");
    assert.equal(probe.prepare("SELECT COUNT(*) AS n FROM manor_assignments WHERE supersedesId=?").get(published.assignment.id).n, 1);
  } finally { probe.prepare("UPDATE manor_assignments SET status='withdrawn' WHERE id=?").run(published.assignment.id); }
  const afterSupersede = await bootstrap();
  assert.deepEqual(afterSupersede.assignments.map((item) => item.id), [upgraded.assignment.id]);
  assert.deepEqual(afterSupersede.missions.map((item) => item.id), upgraded.missions.map((item) => item.id));
  assert.equal(afterSupersede.projects.some((item) => item.id === persisted.id), false, "withdrawn assignments leave the active project list, not the private archive");
  assert.deepEqual(probe.prepare("SELECT * FROM manor_project_runs WHERE id=?").get(project.id), historicalProject);
  assert.deepEqual(afterSupersede.artifacts.find((item) => item.id === persisted.result.artifactId), historicalArtifact);
  assert.deepEqual(afterSupersede.evidence, beforeSupersede.evidence);
  assert.deepEqual(afterSupersede.taskRuns, beforeSupersede.taskRuns);
  assert.deepEqual(afterSupersede.taskRunHistory, beforeSupersede.taskRunHistory);
  assert.deepEqual(afterSupersede.grants, beforeSupersede.grants);
  await request(taskPath, { operationId: op(), missionId: science.id, phase: "evidence", expectedRevision: runs[1].revision }, 404);
  await request(evidencePath, { operationId: op(), missionId: science.id, taskRunId: runs[1].id, answer: "C" }, 404);
  const teacherHistory = await request(assignmentsPath, undefined, 200, teacher);
  assert.equal(teacherHistory.assignments.find((item) => item.id === published.assignment.id).status, "withdrawn");
  assert.equal(teacherHistory.assignments.find((item) => item.id === upgraded.assignment.id).status, "published");
  assert.equal(probe.prepare("SELECT resourceVersion FROM manor_assignments WHERE id=?").get(published.assignment.id).resourceVersion, publication.resourceVersion);
  assert.throws(() => probe.prepare("UPDATE manor_assignment_missions SET snapshotJson='{}' WHERE assignmentId=?").run(published.assignment.id), /immutable/);
  checks.push("superseding publication withdraws old version atomically; injected late failure rolls back both; stale repeats reject and accepted history stays immutable");
  await stop();
  await start();
  cookie = await login("student", "Student@123");
  const reopened = await bootstrap();
  assert.deepEqual(probe.prepare("SELECT * FROM manor_project_runs WHERE id=?").get(project.id), historicalProject);
  assert.deepEqual(reopened.artifacts.find((item) => item.id === persisted.result.artifactId), historicalArtifact);
  assert.equal(reopened.assignments.some((item) => item.id === published.assignment.id), false);
  assert.equal(reopened.assignments[0].id, upgraded.assignment.id);
  assert.equal(reopened.artifacts.find((item) => item.id === frozen.id).content, frozen.content);
  assert.equal(reopened.artifacts.find((item) => item.id === created.artifact.id).content, patched.artifact.content);
  assert.equal(reopened.plantingCycles.find((item) => item.id === cycle.id).actions.length, 5);
  assert.equal(probe.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  checks.push("current class reauthorization after transfer; immutable publication versions; real restart/readback and SQLite integrity");
  console.log(JSON.stringify({ ok: true, checks, count: checks.length, requests, elapsedMs: Date.now() - beganAt }, null, 2));
} catch (error) {
  console.error(tail);
  throw error;
} finally {
  await stop();
  probe?.close();
  const target = resolve(temp);
  if (!target.startsWith(`${resolve(tempRoot)}${sep}`) || !basename(target).startsWith("eduai-v7-learning-")) throw new Error(`Unsafe cleanup path: ${target}`);
  // Remove only the junction itself before the bounded recursive temp cleanup.
  try { unlinkSync(join(app, "node_modules")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  rmSync(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
