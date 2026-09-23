import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { startIsolatedManorDevServer } from "./manor-v5-helpers.mjs";

const APP_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const RESULTS_DIR = join(APP_ROOT, "test-results");
const tempDbDir = mkdtempSync(join(tmpdir(), "eduai-manor-learning-"));

async function getBaseUrl() {
  if (process.env.MANOR_BASE_URL) return { base: process.env.MANOR_BASE_URL.replace(/\/$/, ""), serverHandle: null };
  const serverHandle = await startIsolatedManorDevServer({ label: "manor-learning", tempDbDir });
  return { base: serverHandle.base, serverHandle };
}

async function openStudentManor(browser, base, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();
  const diagnostics = { external: [], manorApi: [], manorResponses: [], consoleErrors: [], pageErrors: [] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v2/manor") || url.pathname.startsWith("/api/manor")) diagnostics.manorApi.push({ method: request.method(), path: url.pathname });
    if (!(url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.protocol === "data:" || url.protocol === "blob:")) {
      diagnostics.external.push(request.url());
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/v2/manor") || url.pathname.startsWith("/api/manor")) {
      const item = { path: url.pathname, status: response.status() };
      diagnostics.manorResponses.push(item);
      if (response.status() >= 400) void response.text().then((body) => { item.body = body.slice(0, 500); }).catch(() => undefined);
    }
  });
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  const login = await page.request.post(`${base}/api/auth/login`, { data: { username: "student", password: "Student@123" } });
  assert.equal(login.ok(), true, `demo student login failed: ${login.status()}`);
  await page.goto(`${base}/student/manor?qa=1`, { waitUntil: "networkidle" });
  await page.getByTestId("manor-stage").waitFor({ state: "visible", timeout: 30_000 });
  return { context, page, diagnostics };
}

async function assertNoHorizontalOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.equal(geometry.scrollWidth <= geometry.clientWidth + 1, true, `${label} horizontal overflow: ${JSON.stringify(geometry)}`);
}

async function assertVisibleHitTargets(locator, label) {
  const targets = await locator.evaluateAll((elements) => elements.filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  }).map((element) => {
    const rect = element.getBoundingClientRect();
    return { name: element.getAttribute("aria-label") || element.textContent?.trim(), width: rect.width, height: rect.height };
  }));
  assert.equal(targets.length > 0, true, `${label}: no visible controls`);
  assert.equal(targets.every((target) => target.width >= 44 && target.height >= 44), true, `${label}: ${JSON.stringify(targets)}`);
}

let browser;
let serverHandle;
let lastDiagnostics;
try {
  const resolved = await getBaseUrl();
  serverHandle = resolved.serverHandle;
  const base = resolved.base;
  browser = await chromium.launch({ headless: true });

  const desktop = await openStudentManor(browser, base, { width: 1440, height: 900 });
  lastDiagnostics = desktop.diagnostics;
  const { page } = desktop;
  await assertNoHorizontalOverflow(page, "desktop");
  await page.getByTestId("learning-mission-board").waitFor({ state: "visible" });
  assert.match(await page.getByTestId("growth-energy").innerText(), /0/);
  assert.match(await page.getByTestId("mission-progress").innerText(), /0\s*\/\s*1/);

  await page.getByTestId("state-preview-trigger").click();
  await page.getByRole("menuitemradio", { name: "故障状态" }).click();
  await page.getByTestId("failure-state").waitFor({ state: "visible" });
  await page.getByTestId("mission-entry").dispatchEvent("click");
  await page.getByTestId("learning-panel").waitFor({ state: "visible" });
  await page.getByTestId("answer-a").click();
  const failureSubmit = page.getByTestId("evidence-submit");
  await failureSubmit.click();
  await page.getByTestId("learning-panel").getByRole("alert").getByText(/暂时没有核验成功/).waitFor({ state: "visible", timeout: 3_000 });
  assert.equal(await failureSubmit.isEnabled(), true, "failed async operation must leave the form retryable");
  assert.match(await page.getByTestId("growth-energy").innerText(), /0/);
  await page.getByRole("button", { name: "关闭学习面板" }).click();
  await page.getByTestId("failure-state").getByRole("button", { name: /重新请求/ }).click();

  await page.getByRole("button", { name: /开始 8 分钟任务/ }).click();
  await page.getByTestId("learning-panel").waitFor({ state: "visible" });
  assert.equal(await page.getByTestId("mission-switcher").getByRole("tab").count(), 3, "all subject missions should be reachable");
  const chineseTab = page.getByRole("tab", { name: /语文/ });
  const mathTab = page.getByRole("tab", { name: /数学/ });
  const scienceTab = page.getByRole("tab", { name: /科学/ });
  await chineseTab.focus();
  await chineseTab.press("ArrowRight");
  assert.equal(await mathTab.getAttribute("aria-selected"), "true", "mission tabs should support arrow navigation");
  await page.getByRole("heading", { name: "规划灌溉节奏" }).waitFor({ state: "visible" });
  await mathTab.press("ArrowRight");
  assert.equal(await scienceTab.getAttribute("aria-selected"), "true");
  await page.getByRole("heading", { name: "观察叶片蒸腾" }).waitFor({ state: "visible" });
  await scienceTab.press("ArrowRight");
  assert.equal(await chineseTab.getAttribute("aria-selected"), "true");
  await page.getByRole("heading", { name: "寻找春雨的线索" }).waitFor({ state: "visible" });

  const answerA = page.getByTestId("answer-a");
  const answerB = page.getByTestId("answer-b");
  await answerA.click();
  await answerA.press("ArrowRight");
  assert.equal(await answerB.getAttribute("aria-checked"), "true", "answer radios should support arrow navigation");
  await answerA.click();
  const submit = page.getByTestId("evidence-submit");
  await submit.click();
  await page.getByTestId("evidence-feedback").getByText(/再想一步/).waitFor({ state: "visible", timeout: 3_000 });
  await page.getByRole("heading", { name: "寻找春雨的线索" }).waitFor({ state: "visible" });
  assert.match(await page.getByTestId("evidence-feedback").innerText(), /关键词/);
  assert.match(await page.getByTestId("growth-energy").innerText(), /0/);

  await answerB.click();
  await submit.click();
  await page.getByTestId("evidence-feedback").getByText(/订正完成/).waitFor({ state: "visible", timeout: 5_000 });
  assert.match(await page.getByTestId("growth-energy").innerText(), /8/);
  await page.getByRole("button", { name: "继续使用能量" }).click();
  assert.equal(await page.getByTestId("learning-plot-10").count(), 0, "locked plot must not be offered for learning energy");
  await page.getByTestId("learning-plot-3").click();
  await page.getByRole("button", { name: /投入 8 点能量/ }).click();
  await page.locator('button[data-plot="3"][data-stage="1"][data-health="pest"]').waitFor({ state: "visible", timeout: 8_000 });
  assert.match(await page.getByTestId("growth-energy").innerText(), /0/);

  const firstReflection = page.getByRole("radio", { name: "我会先找关键词" });
  const secondReflection = page.getByRole("radio", { name: "我会画出关系" });
  await firstReflection.focus();
  await firstReflection.press("ArrowRight");
  assert.equal(await secondReflection.getAttribute("aria-checked"), "true", "reflection radios should support arrow navigation");
  await page.getByRole("button", { name: "保存反思" }).click();
  await page.getByTestId("review-scheduled").getByText(/明天/).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "完成今日任务" }).click();
  await page.getByTestId("learning-summary").getByText(/今天到这里也很好/).waitFor({ state: "visible" });
  assert.match(await page.getByTestId("mission-progress").innerText(), /1\s*\/\s*1/);
  await page.getByRole("button", { name: "关闭学习面板" }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "mission-entry");

  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-testid="manor-stage"][data-scenario="normal"]').waitFor({ state: "visible", timeout: 15_000 });
  assert.match(await page.getByTestId("mission-progress").innerText(), /1\s*\/\s*1/);
  await page.getByRole("button", { name: /记忆温室/ }).click();
  await page.getByTestId("learning-panel").getByRole("heading", { name: "记忆温室" }).waitFor({ state: "visible" });
  assert.match(await page.getByTestId("review-card").innerText(), /明天/);
  await page.getByRole("button", { name: "关闭学习面板" }).click();

  await page.getByTestId("mission-entry").click();
  await page.getByRole("tab", { name: /科学/ }).click();
  await page.getByRole("heading", { name: "观察叶片蒸腾" }).waitFor({ state: "visible" });
  await page.getByTestId("answer-a").click();
  await page.getByTestId("evidence-submit").click();
  await page.getByTestId("evidence-feedback").getByText(/证据成立/).waitFor({ state: "visible", timeout: 5_000 });
  assert.match(await page.getByTestId("growth-energy").innerText(), /12/);
  await page.getByRole("button", { name: "继续使用能量" }).click();
  await page.getByRole("button", { name: "班级共建" }).click();
  const classProgress = page.getByTestId("class-build-progress");
  const classBefore = await classProgress.getAttribute("aria-valuenow");
  const contributeButton = page.getByRole("button", { name: /贡献 2 点/ });
  await contributeButton.click();
  await page.getByTestId("growth-energy").getByText(/10 能量/).waitFor({ state: "visible", timeout: 5_000 });
  await contributeButton.click();
  await page.getByTestId("growth-energy").getByText(/8 能量/).waitFor({ state: "visible", timeout: 5_000 });
  assert.notEqual(await classProgress.getAttribute("aria-valuenow"), classBefore);
  await page.getByRole("button", { name: "关闭学习面板" }).click();

  await page.getByRole("button", { name: /创作工坊/ }).click();
  await page.getByRole("button", { name: /一分钟讲解卡/ }).click();
  await page.getByTestId("workshop-editor").waitFor({ state: "visible" });
  await page.getByRole("textbox", { name: "作品内容" }).fill("叶尖轻轻点头，是春雨很轻的直接证据。");
  await page.getByRole("button", { name: "保存到学习成果" }).click();
  await page.getByTestId("workshop-result").getByText(/学校服务器保存/).waitFor({ state: "visible", timeout: 5_000 });
  assert.match(await page.getByTestId("growth-energy").innerText(), /4/);
  await page.getByRole("button", { name: /观察记录页/ }).click();
  await page.getByTestId("workshop-editor").getByText("观察记录页").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "关闭学习面板" }).click();

  await page.getByRole("button", { name: /学习成果/ }).click();
  await page.getByTestId("portfolio-list").getByText("一分钟讲解卡").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "关闭学习面板" }).click();

  await page.getByRole("button", { name: /健康节奏/ }).click();
  await page.getByRole("button", { name: "今天到这里" }).click();
  await page.getByTestId("wellbeing-result").getByText(/舒缓模式/).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "关闭学习面板" }).click();

  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-testid="manor-stage"][data-scenario="normal"]').waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await page.locator('button[data-plot="3"]').getAttribute("data-stage"), "1", "plot stage must persist after refresh");
  await page.getByRole("button", { name: /学习成果/ }).click();
  await page.getByTestId("portfolio-list").getByText("一分钟讲解卡").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "关闭学习面板" }).click();
  await page.getByRole("button", { name: /健康节奏/ }).click();
  await page.getByTestId("wellbeing-result").getByText(/舒缓模式/).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "关闭学习面板" }).click();

  mkdirSync(RESULTS_DIR, { recursive: true });
  const desktopShot = join(RESULTS_DIR, "manor-learning-1440.png");
  await page.screenshot({ path: desktopShot, animations: "disabled" });
  assert.equal(statSync(desktopShot).size > 600_000, true, "desktop screenshot is unexpectedly small");
  const desktopStats = await sharp(desktopShot).stats();
  assert.equal(desktopStats.channels.some((channel) => channel.stdev > 20), true, "desktop screenshot appears visually blank");

  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 800 }, { width: 390, height: 844 }]) {
    const session = await openStudentManor(browser, base, viewport);
    const label = `${viewport.width}x${viewport.height}`;
    await assertNoHorizontalOverflow(session.page, label);
    await session.page.getByTestId("learning-mission-board").waitFor({ state: "visible" });
    const coreLayout = await session.page.evaluate((mobile) => {
      const ids = mobile
        ? ["learning-mission-board", "player-status", "plot-grid", "tool-dock", "mobile-manor-nav"]
        : ["learning-mission-board", "mode-dock", "plot-grid", "tool-dock"];
      return ids.map((id) => {
        const rect = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
        return rect ? { id, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : { id, missing: true };
      });
    }, viewport.width < 768);
    assert.equal(coreLayout.every((rect) => !rect.missing && rect.left >= -1 && rect.top >= -1 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1), true, `${label} core layout clipped: ${JSON.stringify(coreLayout)}`);
    for (let first = 0; first < coreLayout.length; first += 1) {
      for (let second = first + 1; second < coreLayout.length; second += 1) {
        const a = coreLayout[first];
        const b = coreLayout[second];
        const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        assert.equal(overlapWidth * overlapHeight <= 1, true, `${label} core layout overlap: ${a.id} with ${b.id} (${overlapWidth}x${overlapHeight})`);
      }
    }
    if (viewport.width < 768) {
      await session.page.getByTestId("mobile-manor-nav").waitFor({ state: "visible" });
      assert.equal(await session.page.getByTestId("mobile-manor-nav").getByRole("button").count(), 5);
      await assertVisibleHitTargets(session.page.getByTestId("mobile-manor-nav").getByRole("button"), "mobile navigation");
      await assertVisibleHitTargets(session.page.getByTestId("tool-dock").getByRole("button"), "mobile tools");
      const unobstructed = await session.page.getByTestId("mobile-manor-nav").getByRole("button").evaluateAll((buttons) => buttons.every((button) => {
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === button || button.contains(hit);
      }));
      assert.equal(unobstructed, true, "mobile navigation is covered by another layer");
      const mobileShot = join(RESULTS_DIR, "manor-learning-390.png");
      await session.page.screenshot({ path: mobileShot, animations: "disabled" });
      assert.equal(statSync(mobileShot).size > 150_000, true, "mobile screenshot is unexpectedly small");
    } else {
      await session.page.getByTestId("mode-dock").waitFor({ state: "visible" });
      await session.page.getByTestId("tool-dock").waitFor({ state: "visible" });
    }
    assert.deepEqual(session.diagnostics.external, [], `${label} external requests: ${session.diagnostics.external.join(", ")}`);
    assert.equal(session.diagnostics.manorApi.some((request) => request.path === "/api/v2/manor/bootstrap"), true, `${label} did not request authoritative bootstrap`);
    assert.equal(session.diagnostics.manorResponses.every((response) => response.status < 400), true, `${label} manor API failures: ${JSON.stringify(session.diagnostics.manorResponses)}`);
    assert.deepEqual(session.diagnostics.consoleErrors, [], `${label} console errors: ${session.diagnostics.consoleErrors.join(" | ")}`);
    assert.deepEqual(session.diagnostics.pageErrors, [], `${label} page errors: ${session.diagnostics.pageErrors.join(" | ")}`);
    await session.context.close();
  }

  assert.deepEqual(desktop.diagnostics.external, [], `external requests: ${desktop.diagnostics.external.join(", ")}`);
  assert.equal(desktop.diagnostics.manorApi.some((request) => request.method === "POST" && request.path === "/api/v2/manor/evidence"), true, "evidence submission did not reach the v2 API");
  assert.equal(desktop.diagnostics.manorApi.some((request) => request.method === "POST" && request.path.includes("/plots/3/actions")), true, "plot action did not reach the v2 API");
  assert.equal(desktop.diagnostics.manorApi.some((request) => request.method === "POST" && request.path === "/api/v2/manor/session/end"), true, "wellbeing state did not reach the v2 API");
  assert.equal(desktop.diagnostics.manorResponses.every((response) => response.status < 400), true, `manor API failures: ${JSON.stringify(desktop.diagnostics.manorResponses)}`);
  assert.deepEqual(desktop.diagnostics.consoleErrors, [], `console errors: ${desktop.diagnostics.consoleErrors.join(" | ")}`);
  assert.deepEqual(desktop.diagnostics.pageErrors, [], `page errors: ${desktop.diagnostics.pageErrors.join(" | ")}`);
  await desktop.context.close();

  console.log(JSON.stringify({
    ok: true,
    flow: ["repository-failure", "mission-keyboard-switching", "pending-race-lock", "formative-retry", "energy-reserve", "class-build", "plot-lock", "plot-nurture", "reflection", "review", "workshop", "portfolio", "wellbeing"],
    viewports: ["1440x900", "1024x768", "768x800", "390x844"],
    network: { external: 0, manorApi: desktop.diagnostics.manorApi.length, allResponsesSuccessful: true },
    screenshots: ["test-results/manor-learning-1440.png", "test-results/manor-learning-390.png"],
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  if (lastDiagnostics) console.error(`\n--- manor diagnostics ---\n${JSON.stringify(lastDiagnostics, null, 2)}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await serverHandle?.cleanup();
  const resolvedTemp = resolve(tempDbDir);
  const tempRoot = resolve(tmpdir()) + sep;
  if (!resolvedTemp.startsWith(tempRoot) || !basename(resolvedTemp).startsWith("eduai-manor-learning-")) {
    throw new Error(`Refusing to remove unexpected path: ${resolvedTemp}`);
  }
  rmSync(resolvedTemp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
