import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { AnyMap, originalPositionFor, sourceContentFor } from "@jridgewell/trace-mapping";
import { APP_ROOT, RESULTS_DIR, assertNoHorizontalOverflow, startIsolatedManorDevServer } from "./manor-v5-helpers.mjs";

// Real Next + disposable seeded DB only. No route interception, injected UI, or business API writes outside browser actions.
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const dbDirectory = mkdtempSync(join(tmpdir(), "eduai-manor-v7-integration-"));
const results = join(RESULTS_DIR, "manor-v7-integration", new Date().toISOString().replaceAll(/[:.]/g, "-"));
mkdirSync(results, { recursive: true });
const startedAt = new Date().toISOString();
const checks = [], screenshots = [], responses = [], pageErrors = [], consoleErrors = [], consoleWarnings = [], consoleStacks = [], diagnosticErrors = [], pendingDiagnostics = [], failedRequests = [], assetFailures = [], failures = [];
const evidence = {};
let phase = "setup";
const sourceFiles = [
  "app/(shell)/class/manor/page.tsx", "components/class/ManorAssignmentsPanel.tsx", "components/class/ManorScenePolicyPanel.tsx",
  "components/student/ManorAssignedTasks.tsx", "app/(shell)/student/manor/components/LearningHub.tsx", "app/(shell)/student/manor/model/manor-learning.ts",
  "app/(shell)/student/manor/components/V7TaskProvenance.tsx", "app/(shell)/student/manor/components/learning-hub.module.css",
  "lib/server/manorV2.ts", "lib/manor/missions.ts",
];
const sourceHashes = Object.fromEntries(sourceFiles.map((path) => [path, createHash("sha256").update(readFileSync(join(APP_ROOT, path))).digest("hex")]));
let server, browser, teacherPage, studentPage;
let timedOut = false;
const deadline = setTimeout(() => { timedOut = true; void browser?.close(); }, 300_000);
deadline.unref();
async function recordPage(page, role) {
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);
  page.on("pageerror", (error) => pageErrors.push({ role, message: error.message }));
  page.on("console", (message) => {
    const target = message.type() === "error" ? consoleErrors : message.type() === "warning" ? consoleWarnings : null;
    if (target) target.push({ role, phase, url: page.url(), message: message.text(), location: message.location() });
  });
  page.on("requestfailed", (request) => failedRequests.push({ role, path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/api/v2/manor") || path.startsWith("/api/v2/teacher/manor")) responses.push({ role, path, method: response.request().method(), status: response.status() });
    if (path.startsWith("/art/") && response.status() >= 400) assetFailures.push({ role, path, status: response.status() });
  });
  // Observe the native console without replacing it or changing React scheduling.
  const client = await page.context().newCDPSession(page);
  const scripts = new Map(), maps = new Map();
  client.on("Debugger.scriptParsed", (script) => scripts.set(script.scriptId, script));
  await client.send("Debugger.enable");
  await client.send("Debugger.setAsyncCallStackDepth", { maxDepth: 16 });
  await client.send("Runtime.enable");
  async function mapFrame(frame) {
    const script = scripts.get(frame.scriptId);
    if (!script?.sourceMapURL) return frame;
    const url = new URL(script.sourceMapURL, script.url).href;
    if (!maps.has(url)) maps.set(url, (async () => {
      const response = await page.request.get(url, { timeout: 10000 });
      assert.equal(response.ok(), true, `Diagnostic source map: ${url}`);
      return AnyMap(await response.json(), url);
    })());
    const map = await maps.get(url);
    const original = originalPositionFor(map, { line: frame.lineNumber + 1, column: frame.columnNumber });
    const source = original.source && sourceContentFor(map, original.source, true);
    return { ...frame, original, excerpt: source && original.line ? source.split("\n").slice(Math.max(0, original.line - 3), original.line + 2).join("\n") : null };
  }
  async function mapStack(stack) {
    if (!stack) return null;
    const frames = [];
    for (const frame of stack.callFrames) frames.push(await mapFrame(frame));
    return { ...stack, callFrames: frames, parent: await mapStack(stack.parent) };
  }
  client.on("Runtime.consoleAPICalled", (event) => {
    if (event.type !== "error" && event.type !== "warning") return;
    const entry = { role, phase, url: page.url(), type: event.type, timestamp: event.timestamp, args: event.args, stackTrace: event.stackTrace };
    consoleStacks.push(entry);
    pendingDiagnostics.push(mapStack(event.stackTrace).then((stack) => { entry.mappedStack = stack; }).catch((error) => diagnosticErrors.push(String(error))));
  });
}
async function json(response, label) {
  const text = await response.text();
  assert.equal(response.status(), 200, `${label}: HTTP ${response.status()} ${text.slice(0, 1200)}`);
  const body = JSON.parse(text);
  assert.ok(body && typeof body === "object", `${label}: missing JSON response`);
  return body;
}
async function get(context, path) {
  return json(await context.request.get(`${server.base}${path}`, { timeout: 60000 }), path);
}
async function clickReceipt(page, locator, path) {
  const response = page.waitForResponse((item) => new URL(item.url()).pathname === path && item.request().method() === "POST", { timeout: 60000 });
  await locator.click();
  const receipt = await response;
  return { body: await json(receipt, path), request: receipt.request().postDataJSON(), status: receipt.status() };
}
async function shot(page, name, locator) {
  await page.evaluate(() => document.fonts.ready);
  const path = join(results, `${name}.png`);
  if (locator) await locator.screenshot({ path, animations: "disabled" });
  else await page.screenshot({ path, animations: "disabled" });
  screenshots.push({ name, path });
  return path;
}
function passed(message) { checks.push(message); console.log(`PASS ${message}`); }
async function learningSettled() {
  await studentPage.getByTestId("learning-panel").locator('[aria-busy="true"]').waitFor({ state: "hidden" });
}

try {
  assert.ok(existsSync(chrome), "Required native Chrome executable is unavailable");
  assert.ok(resolve(dbDirectory).startsWith(resolve(tmpdir()) + sep), "DB must be in disposable temp directory");
  const previousSecret = process.env.EDUAI_SESSION_SECRET;
  process.env.EDUAI_SESSION_SECRET = randomBytes(32).toString("hex");
  try { server = await startIsolatedManorDevServer({ label: "manor-v7-integration", tempDbDir: dbDirectory, maxAttempts: 2 }); }
  finally { if (previousSecret === undefined) delete process.env.EDUAI_SESSION_SECRET; else process.env.EDUAI_SESSION_SECRET = previousSecret; }
  evidence.baseUrl = server.base;
  evidence.databaseDirectory = dbDirectory;
  evidence.databaseIsolation = "EDUAI_DB_DIR points at a newly created temporary directory; EDUAI_ENABLE_DEMO_SEED=true; no user DB opened";
  browser = await chromium.launch({ executablePath: chrome, headless: true });
  const teacher = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
  const student = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
  await json(await teacher.request.post(`${server.base}/api/auth/login`, { data: { username: "teacher", password: "Teacher@123" }, timeout: 60000 }), "isolated teacher login");
  await json(await student.request.post(`${server.base}/api/auth/login`, { data: { username: "student", password: "Student@123" }, timeout: 60000 }), "isolated student login");
  const teacherIdentity = (await get(teacher, "/api/auth/me")).user;
  const studentIdentity = (await get(student, "/api/auth/me")).user;
  assert.equal(teacherIdentity.role, "teacher"); assert.equal(studentIdentity.role, "student");
  assert.equal(teacherIdentity.classId, studentIdentity.classId);
  assert.ok(existsSync(join(dbDirectory, "eduai.sqlite")), "Seeded DB must exist only in disposable directory");
  evidence.owners = { teacherId: teacherIdentity.id, studentId: studentIdentity.id, classId: teacherIdentity.classId };
  passed("isolated Next server, native Chrome, separate authenticated teacher/student contexts");

  const catalog = await get(teacher, "/api/v2/teacher/manor/assignments");
  const template = catalog.templates.find((item) => item.id === "water-math-middle");
  assert.ok(template && template.gradeBand === "middle_school");
  assert.equal(template.reward, 0); assert.equal(template.source.teacherPublished, false);
  assert.equal(catalog.ownerId, teacherIdentity.id);
  assert.equal(catalog.assignments.length, 0, "Fresh DB must not contain invented assignments");
  const before = await get(student, "/api/v2/manor/bootstrap");
  assert.equal(before.subject.gradeBand, "middle_school"); assert.equal(before.missions.length, 0);
  phase = "teacher publication";
  teacherPage = await teacher.newPage(); await recordPage(teacherPage, "teacher");
  await teacherPage.goto(`${server.base}/class/manor`, { waitUntil: "domcontentloaded" });
  const assignmentPanel = teacherPage.getByTestId("manor-assignments-panel");
  await assignmentPanel.getByLabel("任务标题", { exact: true }).fill("V7隔离浏览器核验：节水比例");
  await assignmentPanel.getByLabel("任务学段", { exact: true }).selectOption("middle_school");
  await assignmentPanel.getByRole("checkbox", { name: new RegExp(template.title) }).check();
  assert.equal(await assignmentPanel.getByLabel("资源版本", { exact: true }).inputValue(), template.resourceVersion);
  assert.equal(await assignmentPanel.getByLabel("数据版本", { exact: true }).inputValue(), template.datasetVersion);
  await assignmentPanel.getByLabel("成长奖励", { exact: true }).fill("0");
  const published = await clickReceipt(teacherPage, assignmentPanel.getByRole("button", { name: "发布正式任务", exact: true }), "/api/v2/teacher/manor/assignments");
  const assignment = published.body.assignment;
  const mission = published.body.missions.find((item) => item.templateId === template.id);
  assert.ok(mission); assert.notEqual(mission.id, template.id);
  assert.equal(assignment.teacherId, teacherIdentity.id); assert.equal(assignment.gradeBand, "middle_school");
  assert.equal(mission.assignmentId, assignment.id); assert.deepEqual(assignment.missionIds, [mission.id]);
  assert.deepEqual(published.request.missionIds, [template.id]); assert.equal(published.request.classId, undefined);
  await assignmentPanel.getByRole("region", { name: "已发布任务" }).getByText(assignment.title, { exact: true }).waitFor();
  evidence.publication = { httpStatus: published.status, request: published.request, assignment, mission };
  await shot(teacherPage, "01-teacher-published", assignmentPanel);
  passed("teacher publishes middle-school formal task through mounted UI; real POST returns new stable mission and assignment IDs");

  studentPage = await student.newPage(); await recordPage(studentPage, "student");
  for (const [path, name] of [["/student/home", "02-student-home"], ["/student/activities", "03-student-activities"]]) {
    phase = path;
    await studentPage.goto(`${server.base}${path}`, { waitUntil: "domcontentloaded" });
    const tasks = studentPage.getByRole("region", { name: "老师分派的庄园任务", exact: true });
    await tasks.getByRole("heading", { name: assignment.title, exact: true }).waitFor();
    const link = tasks.getByRole("link", { name: mission.title, exact: true });
    const href = await link.getAttribute("href");
    const url = new URL(href, server.base);
    assert.equal(url.pathname, "/student/manor"); assert.equal(url.searchParams.get("missionId"), mission.id); assert.equal(url.searchParams.get("assignmentId"), assignment.id);
    evidence[path] = { href, missionId: mission.id, assignmentId: assignment.id };
    await shot(studentPage, name, tasks);
  }
  passed("student home and activities show server assignment and links with exact published missionId/assignmentId");
  phase = "formal task navigation and answer";
  await studentPage.getByRole("region", { name: "老师分派的庄园任务", exact: true }).getByRole("link", { name: mission.title, exact: true }).click();
  await studentPage.waitForURL((url) => url.pathname === "/student/manor" && url.searchParams.get("missionId") === mission.id);
  await studentPage.locator('[data-testid="manor-stage"][data-scenario="normal"]').waitFor();
  const learning = studentPage.getByTestId("learning-panel");
  await learning.getByRole("heading", { name: mission.title, exact: true }).waitFor();
  assert.equal(await learning.getByLabel("学习任务", { exact: true }).inputValue(), mission.id);
  assert.equal(await learning.getByRole("button", { name: "正式任务 1", exact: true }).getAttribute("aria-pressed"), "true");
  await shot(studentPage, "04-formal-task");
  await learning.getByTestId("answer-b").check();
  const answerDraft = await clickReceipt(studentPage, learning.getByRole("button", { name: "保存待继续", exact: true }), "/api/v2/manor/task-runs");
  await learningSettled();
  assert.equal(answerDraft.body.taskRun.answer, "B"); assert.equal(answerDraft.body.taskRun.missionId, mission.id);
  await studentPage.reload({ waitUntil: "domcontentloaded" });
  await learning.getByTestId("answer-b").waitFor(); assert.equal(await learning.getByTestId("answer-b").isChecked(), true);
  const answer = await clickReceipt(studentPage, learning.getByTestId("evidence-submit"), "/api/v2/manor/evidence");
  await learningSettled();
  assert.equal(answer.body.feedback.correct, true); assert.equal(answer.body.evidence.missionId, mission.id);
  assert.equal(answer.body.evidence.taskRunId, answerDraft.body.taskRun.id); assert.equal(answer.body.evidence.assignmentId, assignment.id);
  await learning.getByRole("button", { name: "写下反思", exact: true }).waitFor();
  const afterAnswer = await get(student, "/api/v2/manor/bootstrap");
  const run = afterAnswer.taskRuns.find((item) => item.missionId === mission.id);
  assert.equal(run.phase, "outcome"); assert.equal(run.evidenceId, answer.body.evidence.id);
  assert.equal(afterAnswer.resources.growthEnergy, before.resources.growthEnergy, "Zero reward must not be invented by the UI or server");
  evidence.answer = { taskRunId: run.id, taskRunRevision: run.revision, evidenceId: answer.body.evidence.id, evidenceStatus: answer.body.evidence.status, feedback: answer.body.feedback, savedAnswer: run.answer };
  await shot(studentPage, "05-answer-feedback");
  passed("actual answer draft persists after reload; correct submission records matching run/assignment evidence and outcome with zero configured reward");

  phase = "reflection save and reload";
  await clickReceipt(studentPage, learning.getByRole("button", { name: "写下反思", exact: true }), "/api/v2/manor/task-runs");
  await learningSettled();
  const reflection = "以常规100升为基准，少用25升即25%；这是模拟数据，还需要重复观察验证。";
  await learning.getByRole("textbox", { name: "哪种方法帮助了你？下次准备怎样验证？", exact: true }).fill(reflection);
  const savedReflection = await clickReceipt(studentPage, learning.getByRole("button", { name: "保存反思", exact: true }), "/api/v2/manor/task-runs");
  await learningSettled(); assert.equal(savedReflection.body.taskRun.reflection, reflection);
  await studentPage.reload({ waitUntil: "domcontentloaded" });
  const reflectionField = learning.getByRole("textbox", { name: "哪种方法帮助了你？下次准备怎样验证？", exact: true });
  await reflectionField.waitFor(); assert.equal(await reflectionField.inputValue(), reflection);
  const afterReload = await get(student, "/api/v2/manor/bootstrap");
  const restored = afterReload.taskRuns.find((item) => item.id === run.id);
  assert.equal(restored.reflection, reflection); assert.equal(restored.phase, "reflection"); assert.equal(restored.revision, savedReflection.body.taskRun.revision);
  evidence.reflection = { text: reflection, taskRunId: restored.id, revision: restored.revision, phase: restored.phase };
  const provenance = learning.locator("details").filter({ has: studentPage.locator("summary", { hasText: "任务来源与版本" }) });
  assert.equal(await provenance.getAttribute("open"), null);
  for (const id of [assignment.id, restored.id]) assert.equal(await provenance.getByText(id, { exact: true }).isVisible(), false);
  assert.equal(await learning.getByText("模拟数据", { exact: true }).isVisible(), true);
  assert.equal(await learning.getByText("初中", { exact: true }).isVisible(), true);
  await learning.getByText(`正式分派 · 发布版本 ${assignment.assignmentVersion}`, { exact: true }).waitFor();
  await learning.getByText(`已保存 · 已存版本 ${restored.revision}`, { exact: true }).waitFor();
  await provenance.locator("summary").click();
  for (const value of [assignment.id, restored.id, mission.resourceVersion, mission.datasetVersion]) assert.equal(await provenance.getByText(value, { exact: true }).isVisible(), true);
  await provenance.locator("summary").click();
  await shot(studentPage, "06-reflection-reloaded");
  passed("reflection UI save returns success; full page reload and independent real bootstrap agree on exact content and revision");

  phase = "teacher scene policy";
  const policyRegion = teacherPage.getByRole("region", { name: "班级农田开放区域", exact: true });
  const originalPolicy = (await get(teacher, "/api/v2/teacher/manor/scene-policy")).policy;
  assert.equal(originalPolicy.ownerId, teacherIdentity.id);
  const openedCount = Math.min(24, originalPolicy.unlockedCount + 2);
  assert.ok(openedCount > originalPolicy.unlockedCount);
  await policyRegion.getByRole("spinbutton", { name: "开放地块", exact: true }).fill(String(openedCount));
  const policyReceipt = await clickReceipt(teacherPage, policyRegion.getByRole("button", { name: "确认开放", exact: true }), "/api/v2/teacher/manor/scene-policy");
  assert.equal(policyReceipt.body.policy.unlockedCount, openedCount); assert.equal(policyReceipt.body.policy.classId, teacherIdentity.classId);
  await policyRegion.getByText(`已为本班开放 ${openedCount} 块农田。`, { exact: true }).waitFor();
  evidence.policy = { before: originalPolicy, after: policyReceipt.body.policy, httpStatus: policyReceipt.status };
  await shot(teacherPage, "07-teacher-policy", policyRegion);
  phase = "student plots after policy";
  await studentPage.goto(`${server.base}/student/manor`, { waitUntil: "domcontentloaded" });
  await studentPage.locator('[data-testid="manor-stage"][data-scenario="normal"]').waitFor();
  const afterPolicy = await get(student, "/api/v2/manor/bootstrap");
  assert.equal(afterPolicy.plots.filter((item) => item.unlocked).length, openedCount);
  assert.equal(await studentPage.getByTestId("plot-grid").locator("button[data-plot]").count(), 24);
  assert.equal(await studentPage.getByTestId("plot-grid").locator('[data-unlocked="true"]').count(), openedCount);
  const sceneImage = await shot(studentPage, "08-student-plots");
  const pixels = await sharp(sceneImage).stats();
  assert.ok(pixels.channels.some((channel) => channel.stdev > 20), "Rendered scene must not be blank");
  await assertNoHorizontalOverflow(studentPage, "v7 real integration desktop manor");
  evidence.plots = { total: afterPolicy.plots.length, unlocked: openedCount, pixelStandardDeviations: pixels.channels.map((channel) => channel.stdev) };
  passed("real teacher policy UI updates isolated class; student bootstrap and 24 rendered plots agree on new unlocked count, nonblank scene and desktop bounds");
  for (let round = 1; round <= 6; round += 1) {
    phase = `read-only navigation probe ${round}`;
    await studentPage.goto(`${server.base}/student/activities`, { waitUntil: "domcontentloaded" });
    await studentPage.getByRole("region", { name: "老师分派的庄园任务", exact: true }).getByRole("link", { name: mission.title, exact: true }).click();
    await reflectionField.waitFor();
    assert.equal(await reflectionField.inputValue(), reflection);
  }
  passed("six additional real Link navigations preserve the saved reflection and capture all console diagnostics");
  assert.equal(timedOut, false, "Integration exceeded its five-minute bound");
  assert.deepEqual(pageErrors, []); assert.deepEqual(assetFailures, []);
  assert.deepEqual(failedRequests.filter((item) => item.error !== "net::ERR_ABORTED"), [], "Unexpected transport failures");
  assert.ok(responses.every((item) => item.status < 400), JSON.stringify(responses.filter((item) => item.status >= 400)));
  assert.deepEqual(consoleErrors, [], "Browser console errors must not be suppressed");
  assert.deepEqual(consoleWarnings, [], "Browser console warnings must not be suppressed");
  passed("clean browser console; no page exceptions, failed manor HTTP responses, or missing art assets");
} catch (failure) {
  failures.push(String(failure.stack ?? failure)); process.exitCode = 1;
  console.error(failure);
  for (const [role, page] of [["teacher", teacherPage], ["student", studentPage]]) {
    if (!page || page.isClosed()) continue;
    await shot(page, `failure-${role}`).catch(() => {});
    console.error(`${role}: ${(await page.locator("body").innerText().catch(() => "")).slice(-5000)}`);
  }
} finally {
  clearTimeout(deadline);
  for (const pending of pendingDiagnostics) await pending;
  await browser?.close();
  try { await server?.cleanup(); } catch (failure) { failures.push(`Server cleanup: ${failure}`); process.exitCode = 1; }
  const target = resolve(dbDirectory);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("eduai-manor-v7-integration-")) throw new Error("Unsafe isolated DB cleanup path");
  try { rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (failure) { failures.push(`DB cleanup: ${failure}`); process.exitCode = 1; }
  const report = { ok: failures.length === 0, startedAt, completedAt: new Date().toISOString(), browser: chrome, scope: "Real Next + isolated seeded DB + browser business writes, no mocked responses", checks, evidence, screenshots, responses, pageErrors, consoleErrors, consoleWarnings, consoleStacks, diagnosticErrors, failedRequests, assetFailures, failures, sourceHashes, isolatedDbRemoved: !existsSync(dbDirectory) };
  writeFileSync(join(results, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, checks: checks.length, consoleErrors: consoleErrors.length, report: join(results, "report.json"), screenshots: screenshots.length, isolatedDbRemoved: report.isolatedDbRemoved }, null, 2));
}
