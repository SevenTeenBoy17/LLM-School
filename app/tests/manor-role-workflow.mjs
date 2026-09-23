import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { launchManorBrowser, startIsolatedManorDevServer } from "./manor-v5-helpers.mjs";

const APP_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempDbDir = mkdtempSync(join(tmpdir(), "eduai-manor-roles-"));
const resultsDir = join(APP_ROOT, "test-results");

async function login(page, base, username, password) {
  const response = await page.request.post(`${base}/api/auth/login`, { data: { username, password } });
  assert.equal(response.ok(), true, `${username} login failed`);
}

let serverHandle;
let browser;
try {
  serverHandle = await startIsolatedManorDevServer({ label: "manor-roles", tempDbDir });
  const { base } = serverHandle;
  browser = await launchManorBrowser();

  const studentContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const student = await studentContext.newPage();
  await login(student, base, "student", "Student@123");
  const expression = await student.request.post(`${base}/api/v2/manor/evidence`, { data: { operationId: "role-workflow-expression-0001", missionId: "math-pattern-01", evidenceType: "expression", content: "我把十二分钟分成四个三分钟，所以可以完成四块田。", hintsUsed: [], accommodationCodes: [] } });
  assert.equal(expression.ok(), true);
  const expressionBody = await expression.json();
  assert.equal(expressionBody.evidence.status, "pending_review");
  await studentContext.close();

  const teacherContext = await browser.newContext({ viewport: { width: 1366, height: 820 }, reducedMotion: "reduce" });
  const teacher = await teacherContext.newPage();
  const teacherErrors = [];
  teacher.on("console", (message) => { if (message.type() === "error") teacherErrors.push(message.text()); });
  await login(teacher, base, "teacher", "Teacher@123");
  const decisionOperationIds = [];
  let decisionAttempt = 0;
  await teacher.route(/\/api\/v2\/teacher\/manor\/evidence\/[^/]+\/decisions$/, async (route) => {
    decisionAttempt += 1;
    decisionOperationIds.push(route.request().postDataJSON().operationId);
    if (decisionAttempt === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UPSTREAM_UNCERTAIN", message: "临时网关未收到上游响应。" } }),
      });
      return;
    }
    const response = await route.fetch();
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
    await route.fulfill({ response });
  });
  await teacher.goto(`${base}/class/manor`, { waitUntil: "networkidle" });
  await teacher.getByTestId("teacher-manor-evidence").waitFor({ state: "visible" });
  await teacher.getByText("我把十二分钟分成四个三分钟").first().waitFor({ state: "visible" });
  await teacher.getByRole("textbox", { name: "审核依据" }).fill("分段过程正确，结论与任务目标一致，表达清楚。");
  await teacher.getByRole("button", { name: "确认掌握" }).click();
  await teacher.getByRole("alert").getByText(/临时网关未收到上游响应/).waitFor({ state: "visible", timeout: 8_000 });
  assert.equal(teacherErrors.some((message) => message.includes("503")), true, "injected gateway failure did not reach the browser");
  teacherErrors.length = 0;
  await teacher.getByRole("button", { name: "确认掌握" }).click();
  await teacher.getByRole("tab", { name: "已确认掌握" }).click();
  const notice = teacher.getByRole("status");
  await notice.getByText(/关联编号 corr_/).waitFor({ state: "visible", timeout: 8_000 });
  await teacher.getByText("我把十二分钟分成四个三分钟").first().waitFor({ state: "visible", timeout: 8_000 });
  assert.equal(decisionOperationIds.length, 2);
  assert.equal(decisionOperationIds[0], decisionOperationIds[1], "teacher retry did not reuse the pending operation id");
  const noticeText = await notice.innerText();
  const correlationId = noticeText.match(/corr_[0-9a-f-]{36}/i)?.[0];
  assert.ok(correlationId, "teacher result did not expose a correlation id");
  mkdirSync(resultsDir, { recursive: true });
  const teacherShot = join(resultsDir, "manor-teacher-evidence.png");
  await teacher.screenshot({ path: teacherShot, animations: "disabled" });
  assert.equal(statSync(teacherShot).size > 40_000, true);
  assert.deepEqual(teacherErrors, []);
  await teacherContext.close();

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const admin = await adminContext.newPage();
  const adminErrors = [];
  admin.on("console", (message) => { if (message.type() === "error") adminErrors.push(message.text()); });
  await login(admin, base, "admin", "Admin@123");
  await admin.goto(`${base}/admin/manor`, { waitUntil: "networkidle" });
  await admin.getByTestId("admin-manor-audit").waitFor({ state: "visible" });
  await admin.getByText(correlationId).first().click();
  await admin.getByText("evidence.teacher_decided").waitFor({ state: "visible", timeout: 8_000 });
  await admin.getByText("校验通过").waitFor({ state: "visible" });
  const adminShot = join(resultsDir, "manor-admin-audit.png");
  await admin.screenshot({ path: adminShot, animations: "disabled" });
  assert.equal(statSync(adminShot).size > 35_000, true);
  const adminStats = await sharp(adminShot).stats();
  assert.equal(adminStats.channels.some((channel) => channel.stdev > 10), true);
  assert.deepEqual(adminErrors, []);
  await adminContext.close();

  console.log(JSON.stringify({ ok: true, roles: ["student", "teacher", "admin"], evidenceId: expressionBody.evidence.id, correlationId, screenshots: ["test-results/manor-teacher-evidence.png", "test-results/manor-admin-audit.png"] }, null, 2));
} finally {
  await browser?.close();
  await serverHandle?.cleanup();
  const resolvedTemp = resolve(tempDbDir);
  if (!resolvedTemp.startsWith(resolve(tmpdir()) + sep) || !basename(resolvedTemp).startsWith("eduai-manor-roles-")) throw new Error(`refusing to remove ${resolvedTemp}`);
  rmSync(resolvedTemp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
