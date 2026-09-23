import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { buildFallbackCoursewarePlan } from "../lib/courseware/core.ts";
import { startManorServer, launchManorBrowser, assertNoHorizontalOverflow } from "./manor-v5-helpers.mjs";

const output = resolve("test-results/generation-progress");
mkdirSync(output, { recursive: true });
const report = [];
const previousKey = process.env.LLM_API_KEY;
const originalNextEnv = readFileSync("next-env.d.ts", "utf8");
process.env.LLM_API_KEY = "";
let server, browser, currentPage, uploadServer;
const held = new Set();
async function eventually(check, name) {
  const end = Date.now() + 30_000;
  while (Date.now() < end) { if (await check()) return; await delay(80); }
  throw new Error(`Timed out: ${name}`);
}
function hold(route) {
  let release;
  const wait = new Promise((resolveWait) => { release = resolveWait; });
  const entry = { route, release: () => { held.delete(entry); release(); } };
  held.add(entry);
  return { entry, wait };
}
const brief = { operationId: "progress-test-plan", subject: "信息科技", grade: "八年级", topic: "物联网传感器", slideCount: 4, objectives: [], style: "clear", sourceSummary: "", uploadIds: [] };
const plan = buildFallbackCoursewarePlan(brief, []);
const deck = { id: "progress-deck", ownerId: "teacher", title: plan.title, subject: brief.subject, grade: brief.grade, status: "draft", generationSource: "local-fallback", sourceUploadIds: [], sourceFiles: [], plan, quality: { issues: [] }, stateVersion: 1, createdAt: Date.now(), updatedAt: Date.now() };

try {
  server = await startManorServer("generation-progress");
  browser = await launchManorBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  assert.equal((await context.request.post(`${server.base}/api/auth/login`, { data: { username: "teacher", password: "Teacher@123" } })).status(), 200);
  const page = await context.newPage();
  currentPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let items = [];
  await page.route("**/api/courseware", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/courseware/progress-deck/visuals", (route) => route.fulfill({ json: { items } }));
  const plans = [];
  await page.route("**/api/courseware/plan", async (route) => {
    const gate = hold(route); plans.push(gate.entry); await gate.wait;
  });
  const visuals = [];
  await page.route("**/api/courseware/progress-deck/visuals/*", async (route) => {
    const gate = hold(route);
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    items = [...items.filter((item) => item.slideId !== id), { slideId: id, state: "generating" }];
    visuals.push({ ...gate.entry, id });
    await gate.wait;
  });
  await page.goto(`${server.base}/research/courseware`);
  await page.getByLabel("课件主题 *").fill(brief.topic);
  await page.getByRole("button", { name: "生成逐页方案", exact: true }).click();
  await eventually(() => plans.length === 1, "plan request");
  const planBar = page.getByRole("progressbar", { name: "正在生成逐页教学方案" });
  await planBar.waitFor({ state: "visible" });
  assert.equal(await planBar.getAttribute("aria-valuenow"), null);
  await delay(1250);
  assert.doesNotMatch(await page.locator("[data-generation-progress]").innerText(), /已等待 0 秒/);
  await page.screenshot({ path: resolve(output, "courseware-planning-desktop.png") });
  await plans[0].route.fulfill({ status: 503, json: { error: { code: "TEST_FAILURE", message: "测试：规划服务暂不可用" } } }); plans[0].release();
  await planBar.waitFor({ state: "detached" });
  await page.getByRole("alert").getByText("测试：规划服务暂不可用").waitFor();
  await page.getByRole("button", { name: "生成逐页方案", exact: true }).click();
  await eventually(() => plans.length === 2, "plan retry");
  await plans[1].route.fulfill({ json: { operationId: brief.operationId, stateVersion: 1, status: "succeeded", authoritativeEntity: deck, nextActions: [] } }); plans[1].release();
  await page.getByRole("button", { name: "生成整套成品图" }).click();
  await eventually(() => visuals.length === 1, "first visual");
  const bar = page.getByRole("progressbar", { name: "正在制作课件成品" });
  await bar.waitFor({ state: "visible" });
  assert.equal(await bar.getAttribute("aria-valuenow"), "0");
  await delay(1300);
  assert.equal(await bar.getAttribute("aria-valuenow"), "0", "time must not fabricate completion");
  const barBox = await bar.boundingBox();
  const previewBox = await page.getByRole("navigation", { name: "课件页面" }).boundingBox();
  assert.ok(barBox.y < previewBox.y, "progress must precede filmstrip/preview");
  await page.screenshot({ path: resolve(output, "courseware-generating-desktop.png") });
  items = [{ slideId: visuals[0].id, state: "ready", imageUrl: "/float/logo.png" }];
  await visuals[0].route.fulfill({ json: { items } }); visuals[0].release();
  await eventually(() => visuals.length === 2, "second visual");
  assert.equal(await bar.getAttribute("aria-valuenow"), "25");
  await page.setViewportSize({ width: 390, height: 844 });
  await bar.scrollIntoViewIfNeeded();
  await assertNoHorizontalOverflow(page, "courseware progress mobile");
  await page.screenshot({ path: resolve(output, "courseware-generating-mobile.png") });
  await page.getByRole("button", { name: "停止后续", exact: true }).click();
  const stopping = page.getByRole("progressbar", { name: "等待当前页完成后停止" });
  assert.equal(await stopping.getAttribute("aria-valuenow"), "25");
  items = [...items.filter((item) => item.slideId !== visuals[1].id), { slideId: visuals[1].id, state: "ready", imageUrl: "/float/logo.png" }];
  await visuals[1].route.fulfill({ json: { items } }); visuals[1].release();
  await stopping.waitFor({ state: "detached" });
  assert.equal(visuals.length, 2, "stop must not start another page");
  await page.getByRole("button", { name: "继续生成未完成页" }).click();
  await eventually(() => visuals.length === 3, "resume remaining pages");
  assert.equal(await bar.getAttribute("aria-valuenow"), "0");
  assert.match(await page.locator("[data-generation-progress]").innerText(), /0 \/ 2 页/);
  items = [...items.filter((item) => item.slideId !== visuals[2].id), { slideId: visuals[2].id, state: "failed", error: "测试生成失败" }];
  await visuals[2].route.fulfill({ status: 503, json: { error: { code: "TEST_FAILURE", message: "测试生成失败" } } }); visuals[2].release();
  await bar.waitFor({ state: "detached" });
  await page.getByRole("alert").getByText("测试生成失败").waitFor();
  await page.getByRole("navigation", { name: "课件页面" }).getByRole("button").nth(2).click();
  await page.getByRole("button", { name: "重试本页" }).click();
  await eventually(() => visuals.length === 4, "single-page retry");
  assert.match(await page.locator("[data-generation-progress]").innerText(), /0 \/ 1 页/);
  items = [...items.filter((item) => item.slideId !== visuals[3].id), { slideId: visuals[3].id, state: "ready", imageUrl: "/float/logo.png" }];
  await visuals[3].route.fulfill({ json: { items } }); visuals[3].release();
  await bar.waitFor({ state: "detached" });
  report.push("courseware: planning/error/retry, no timer-based percentage, confirmed pages, stop/resume/single-page, desktop/mobile");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${server.base}/prompts/new`);
  const chats = [];
  await page.route("**/api/chat", async (route) => { const gate = hold(route); chats.push(gate.entry); await gate.wait; });
  await page.getByRole("button", { name: "运行测试", exact: true }).click();
  await eventually(() => chats.length === 1, "prompt test request");
  const promptBar = page.getByRole("progressbar", { name: "正在生成测试输出" });
  await promptBar.waitFor({ state: "visible" });
  assert.equal(await promptBar.getAttribute("aria-valuenow"), null);
  assert.equal(await promptBar.locator("span").evaluate((e) => getComputedStyle(e).animationName), "none");
  await page.screenshot({ path: resolve(output, "prompt-test-progress.png") });
  await chats[0].route.fulfill({ status: 503, json: { message: "test failure" } }); chats[0].release();
  await promptBar.waitFor({ state: "detached" });
  report.push("prompt: indeterminate wait, failure cleanup, reduced motion");

  let imageJobs = [{ id: "image-progress", prompt: "课堂植物插图", status: "pending", createdAt: Date.now() - 10_000, size: "1536x1024" }];
  await page.route("**/api/image/jobs", (route) => route.fulfill({ json: { jobs: imageJobs, usedToday: 1 } }));
  await page.goto(`${server.base}/hub/image`);
  const imageBar = page.getByRole("progressbar", { name: "正在等待图片生成结果" });
  await imageBar.waitFor({ state: "visible" });
  assert.equal(await imageBar.getAttribute("aria-valuenow"), null);
  await page.screenshot({ path: resolve(output, "image-job-progress.png") });
  imageJobs = [{ ...imageJobs[0], status: "failed", error: "test" }];
  await imageBar.waitFor({ state: "detached", timeout: 10_000 });
  report.push("image: background pending polling and failed cleanup");

  await page.goto(`${server.base}/agent/new`);
  await page.getByRole("textbox", { name: "测试问题", exact: true }).fill("测试生成进度");
  // The pre-existing safety FAB covers the send button at this viewport; use the supported keyboard path.
  await page.getByRole("textbox", { name: "测试问题", exact: true }).press("Enter");
  await eventually(() => chats.length === 2, "agent test request");
  const agentBar = page.getByRole("progressbar", { name: "正在生成测试回复" });
  await agentBar.first().waitFor({ state: "visible" });
  await chats[1].route.fulfill({ json: { reply: "测试已返回", source: "remote", kind: "normal" } }); chats[1].release();
  await agentBar.first().waitFor({ state: "detached" });
  report.push("agent: live test progress and completion");

  await page.goto(`${server.base}/chat`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "输入消息" }).fill("生成进度回归测试");
  await page.getByRole("textbox", { name: "输入消息" }).press("Enter");
  await eventually(() => chats.length === 3, "chat request");
  const replyBar = page.getByRole("progressbar", { name: "正在等待回复" });
  await replyBar.waitFor({ state: "visible" });
  assert.equal(await replyBar.getAttribute("aria-valuenow"), null);
  await page.screenshot({ path: resolve(output, "chat-waiting-desktop.png") });
  await chats[2].route.fulfill({ json: { reply: "这是一段用于检查进度显示与清理的测试回复。", source: "remote", kind: "normal" } }); chats[2].release();
  await page.locator('[data-chat-streaming="true"]').waitFor({ state: "detached" });
  assert.equal(await page.locator("[data-generation-progress]").count(), 0);
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出整段对话", exact: true }).click();
  const download = await downloadReady;
  assert.match(download.suggestedFilename(), /\.md$/);
  await eventually(async () => await page.locator("[data-generation-progress]").count() === 0, "export cleanup");
  await page.getByRole("textbox", { name: "输入消息" }).fill("取消等待测试");
  await page.getByRole("textbox", { name: "输入消息" }).press("Enter");
  await eventually(() => chats.length === 4, "chat cancellation request");
  await replyBar.waitFor({ state: "visible" });
  await page.goto(`${server.base}/prompts/new`);
  await chats[3].route.abort().catch(() => {}); chats[3].release();
  assert.equal(await page.locator("[data-generation-progress]").count(), 0);
  report.push("chat: waiting/completion, real local markdown download, navigation cancellation cleanup");

  await page.goto(`${server.base}/chat`);
  await page.waitForLoadState("networkidle");
  let upload;
  // A real local HTTP receiver lets XHR finish transmitting while parsing remains pending.
  uploadServer = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", server.base);
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    request.resume();
    request.on("end", () => { upload = response; });
  });
  await new Promise((resolveListen) => uploadServer.listen(0, "127.0.0.1", resolveListen));
  await page.route("**/api/upload", (route) => route.continue({ url: `http://127.0.0.1:${uploadServer.address().port}/upload` }));
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.txt", mimeType: "text/plain", buffer: Buffer.from("课堂参考资料\n".repeat(1000)) });
  const parsingBar = page.getByRole("progressbar", { name: "等待附件解析结果" });
  await parsingBar.waitFor({ state: "visible" });
  assert.equal(await parsingBar.getAttribute("aria-valuenow"), null, "uploaded bytes must not imply parsing completion");
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page, "attachment progress mobile");
  await page.screenshot({ path: resolve(output, "attachment-progress-mobile.png") });
  await eventually(() => Boolean(upload), "attachment request");
  upload.setHeader("Content-Type", "application/json");
  upload.end(JSON.stringify({ id: "qa-upload", name: "progress.txt", status: "parsed", chars: 8000 }));
  await parsingBar.waitFor({ state: "detached" });
  report.push("attachment: real XHR upload completion switches to unknown parsing progress; mobile and settlement");

  await page.setViewportSize({ width: 1440, height: 1000 });
  const kbUploads = [];
  await page.route("**/api/knowledge", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const gate = hold(route); kbUploads.push(gate.entry); await gate.wait;
  });
  await page.goto(`${server.base}/knowledge`);
  await page.getByRole("button", { name: "上传文件", exact: true }).click();
  const uploadDialog = page.getByRole("dialog");
  await uploadDialog.locator('input[type="file"]').setInputFiles([
    { name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("第一份") },
    { name: "second.txt", mimeType: "text/plain", buffer: Buffer.from("第二份") },
  ]);
  await uploadDialog.getByRole("button", { name: "下一步", exact: true }).click();
  await uploadDialog.getByRole("button", { name: "下一步", exact: true }).click();
  await uploadDialog.getByRole("button", { name: "开始上传", exact: true }).click();
  await eventually(() => kbUploads.length === 1, "first knowledge upload");
  const kbBar = page.getByRole("progressbar", { name: "文件处理进度" });
  assert.equal(await kbBar.getAttribute("aria-valuenow"), "0");
  await kbUploads[0].route.fulfill({ status: 503, json: {} }); kbUploads[0].release();
  await eventually(() => kbUploads.length === 2, "second knowledge upload");
  assert.equal(await kbBar.getAttribute("aria-valuenow"), "50");
  assert.match(await uploadDialog.innerText(), /成功 0 个，失败 1 个/);
  await page.screenshot({ path: resolve(output, "knowledge-progress.png") });
  await kbUploads[1].route.fulfill({ json: { file: { id: "qa-kb", name: "second.txt" } } }); kbUploads[1].release();
  await kbBar.waitFor({ state: "detached" });
  await uploadDialog.getByText("文件处理结束，存在未成功的上传").waitFor();
  report.push("knowledge: confirmed processed counts, failure is not labelled success, final summary cleanup");

  let advice;
  await page.route("**/api/portfolio/advice", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const gate = hold(route); advice = gate.entry; await gate.wait;
  });
  await page.goto(`${server.base}/class`);
  const adviceButton = page.getByRole("button", { name: "生成建议草稿", exact: true });
  await adviceButton.waitFor({ state: "visible" });
  const adviceArea = adviceButton.locator("../..");
  await adviceArea.getByRole("combobox", { name: "选择学生", exact: true }).selectOption({ index: 1 });
  await adviceButton.click();
  const adviceBar = page.getByRole("progressbar", { name: "正在生成成长建议草稿" });
  await adviceBar.waitFor({ state: "visible" });
  await adviceBar.scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, "class-advice-progress.png") });
  await eventually(() => Boolean(advice), "advice request");
  await advice.route.fulfill({ status: 503, json: { message: "测试建议失败" } }); advice.release();
  await adviceBar.waitFor({ state: "detached" });
  await adviceArea.getByText("测试建议失败", { exact: true }).waitFor();
  report.push("class advice: generation wait, teacher-review notice preserved, failure cleanup");

  const student = await browser.newContext({ viewport: { width: 390, height: 844 } });
  assert.equal((await student.request.post(`${server.base}/api/auth/login`, { data: { username: "student", password: "Student@123" } })).status(), 200);
  const studentPage = await student.newPage();
  currentPage = studentPage;
  let mindmap;
  await studentPage.route("**/api/mindmap", async (route) => { const gate = hold(route); mindmap = gate.entry; await gate.wait; });
  await studentPage.goto(`${server.base}/student/mindmap`);
  await studentPage.getByLabel("导图主题").fill("光合作用");
  await studentPage.getByRole("button", { name: "生成导图", exact: true }).click();
  const mindmapBar = studentPage.getByRole("progressbar", { name: "正在生成思维导图" });
  await mindmapBar.waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(studentPage, "mindmap progress mobile");
  await studentPage.screenshot({ path: resolve(output, "mindmap-progress-mobile.png") });
  await eventually(() => Boolean(mindmap), "mindmap request");
  await mindmap.route.fulfill({ status: 503, json: { message: "测试导图失败" } }); mindmap.release();
  await mindmapBar.waitFor({ state: "detached" });
  report.push("mindmap: mobile generation and error cleanup");

  const quizzes = [];
  await studentPage.route("**/api/quiz", async (route) => { const gate = hold(route); quizzes.push(gate.entry); await gate.wait; });
  await studentPage.goto(`${server.base}/student/growth`);
  await studentPage.getByRole("tab", { name: "随堂小测", exact: true }).click();
  await studentPage.getByRole("button", { name: "开始小测", exact: true }).click();
  const quizBar = studentPage.getByRole("progressbar", { name: "正在生成随堂小测" });
  await quizBar.waitFor({ state: "visible" });
  await quizBar.scrollIntoViewIfNeeded();
  await assertNoHorizontalOverflow(studentPage, "quiz progress mobile");
  await studentPage.screenshot({ path: resolve(output, "quiz-progress-mobile.png") });
  await eventually(() => quizzes.length === 1, "quiz request");
  await quizzes[0].route.fulfill({ json: { id: "qa-quiz", subject: "数学", knowledgePoint: "加法", question: "1 + 1 = ?", options: ["2", "3"] } }); quizzes[0].release();
  await quizBar.waitFor({ state: "detached" });
  await studentPage.getByRole("button", { name: "A. 2", exact: true }).click();
  const answerBar = studentPage.getByRole("progressbar", { name: "正在核对作答结果" });
  await answerBar.waitFor({ state: "visible" });
  await eventually(() => quizzes.length === 2, "quiz answer request");
  await quizzes[1].route.fulfill({ json: { correct: true, answerIdx: 0, mistakeAdded: false } }); quizzes[1].release();
  await answerBar.waitFor({ state: "detached" });
  report.push("quiz: mobile generation, answer validation, completion cleanup");
  await studentPage.route("**/api/chat", (route) => route.fulfill({ json: { reply: "导出测试回复", source: "remote", kind: "normal" } }));
  await studentPage.goto(`${server.base}/chat`);
  await studentPage.waitForLoadState("networkidle");
  await studentPage.getByRole("textbox", { name: "输入消息" }).fill("导出进度测试");
  await studentPage.getByRole("textbox", { name: "输入消息" }).press("Enter");
  await studentPage.getByText("导出测试回复", { exact: true }).first().waitFor();
  await eventually(async () => await studentPage.locator('[data-chat-streaming="true"]').count() === 0, "student reply completion");
  await studentPage.getByRole("button", { name: "对话设置与更多操作" }).click();
  const studentDownloadReady = studentPage.waitForEvent("download");
  await studentPage.getByRole("menuitem", { name: "导出 Markdown" }).click();
  assert.match((await studentDownloadReady).suggestedFilename(), /\.md$/);
  await eventually(async () => await studentPage.locator("[data-generation-progress]").count() === 0, "student export cleanup");
  report.push("student export: download remains functional, transient progress settles without widening composer");
  assert.deepEqual(errors, [], "page runtime errors");
  writeFileSync(resolve(output, "report.json"), JSON.stringify({ passed: report, providerRequests: 0, note: "Controlled browser responses exercise waiting UX without real model charges; isolated database." }, null, 2));
  console.log(JSON.stringify({ status: "passed", checks: report, output }, null, 2));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: resolve(output, "failure.png") }).catch(() => {});
    writeFileSync(resolve(output, "failure.txt"), `${error.stack}\n${await currentPage.locator("body").innerText()}`);
  }
  throw error;
} finally {
  for (const entry of held) { await entry.route.abort().catch(() => {}); entry.release(); }
  await browser?.close();
  if (uploadServer) {
    uploadServer.closeAllConnections();
    await new Promise((resolveClose) => uploadServer.close(resolveClose));
  }
  await server?.cleanup();
  if (server) {
    const prefix = `.next-generation-progress-${new URL(server.base).port}/`;
    const config = JSON.parse(readFileSync("tsconfig.json", "utf8"));
    config.include = config.include.filter((path) => !path.startsWith(prefix));
    writeFileSync("tsconfig.json", `${JSON.stringify(config, null, 2)}\n`);
    if (readFileSync("next-env.d.ts", "utf8").includes(prefix)) writeFileSync("next-env.d.ts", originalNextEnv);
  }
  if (previousKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = previousKey;
}
