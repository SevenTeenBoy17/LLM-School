import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:4921";
const OUT = path.join(process.cwd(), "test-results", "edu-glass");
const DB_FILE = path.join(process.cwd(), ".data", "eduai.sqlite");

await fs.mkdir(OUT, { recursive: true });

const db = new DatabaseSync(DB_FILE);
const student = db.prepare("SELECT id FROM users WHERE username = ?").get("student-s");
assert.ok(student?.id, "student-s fixture must exist");
const previousPrefs = db.prepare("SELECT * FROM user_prefs WHERE userId = ?").get(student.id) || null;

function resetOnboarding() {
  db.prepare(
    "INSERT INTO user_prefs (userId,onboardingVersion,onboardingStep,onboardingCompletedAt) VALUES (?,0,0,NULL) " +
    "ON CONFLICT(userId) DO UPDATE SET onboardingVersion=0,onboardingStep=0,onboardingCompletedAt=NULL"
  ).run(student.id);
}

function restoreOnboarding() {
  if (!previousPrefs) {
    db.prepare("DELETE FROM user_prefs WHERE userId = ?").run(student.id);
    return;
  }
  db.prepare(
    "UPDATE user_prefs SET onboardingVersion=?,onboardingStep=?,onboardingCompletedAt=? WHERE userId=?"
  ).run(previousPrefs.onboardingVersion ?? 0, previousPrefs.onboardingStep ?? 0, previousPrefs.onboardingCompletedAt ?? null, student.id);
}

async function login(context, username, password) {
  const response = await context.request.post(`${BASE}/api/auth/login`, { data: { username, password } });
  assert.equal(response.status(), 200, `${username} login must succeed`);
}

async function assertNoOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  assert.ok(geometry.documentWidth <= geometry.viewportWidth + 1, `${label}: no horizontal overflow`);
  return geometry;
}

async function assertReadableLeafText(page, rootSelector, label) {
  const tinyText = await page.locator(rootSelector).evaluate((root) => (
    Array.from(root.querySelectorAll("*"))
      .filter((element) => element.children.length === 0 && (element.textContent || "").trim())
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
      })
      .map((element) => ({ text: (element.textContent || "").trim().slice(0, 24), px: Number.parseFloat(getComputedStyle(element).fontSize) }))
      .filter((entry) => entry.px < 11)
  ));
  assert.deepEqual(tinyText, [], `${label}: visible leaf text must be at least 11px`);
}

function boxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const browser = await chromium.launch({ headless: true });
try {
  resetOnboarding();
  const onboardingContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await login(onboardingContext, "student-s", "Student@123");
  const onboardingPage = await onboardingContext.newPage();
  await onboardingPage.goto(`${BASE}/student/home`, { waitUntil: "networkidle" });
  const dialog = onboardingPage.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await assertNoOverflow(onboardingPage, "onboarding desktop");
  await assertReadableLeafText(onboardingPage, ".onboarding-experience", "onboarding desktop");
  for (let index = 0; index < 5; index += 1) {
    await onboardingPage.keyboard.press(index % 2 === 0 ? "Tab" : "Shift+Tab");
    const focusInsideDialog = await onboardingPage.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    assert.equal(focusInsideDialog, true, "onboarding keyboard focus must remain inside the modal");
  }
  await onboardingPage.screenshot({ path: path.join(OUT, "onboarding-1440-step-1.png") });

  await onboardingPage.getByRole("button", { name: "保存并继续" }).click();
  await onboardingPage.getByText("把 AI 当作思考搭档，而不是答案机器").waitFor();
  let prefsResponse = await onboardingContext.request.get(`${BASE}/api/user/prefs`);
  let prefs = (await prefsResponse.json()).prefs;
  assert.equal(prefs.onboardingStep, 1, "step 2 must be confirmed by the server before rendering");

  await onboardingPage.getByRole("button", { name: "保存并继续" }).click();
  await onboardingPage.getByText("你的学习过程有保护，也有清楚边界").waitFor();
  await onboardingPage.screenshot({ path: path.join(OUT, "onboarding-1440-step-3.png") });
  await onboardingPage.getByRole("button", { name: "进入学生首页" }).click();
  await dialog.waitFor({ state: "hidden" });
  prefsResponse = await onboardingContext.request.get(`${BASE}/api/user/prefs`);
  prefs = (await prefsResponse.json()).prefs;
  assert.equal(prefs.onboardingVersion, 2);
  assert.equal(prefs.onboardingStep, 2);
  assert.ok(Number.isFinite(prefs.onboardingCompletedAt));
  await onboardingContext.close();

  resetOnboarding();
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await login(mobileContext, "student-s", "Student@123");
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE}/student/home`, { waitUntil: "networkidle" });
  await mobilePage.getByRole("dialog").waitFor({ state: "visible" });
  await assertNoOverflow(mobilePage, "onboarding mobile");
  const mobilePrimary = await mobilePage.getByRole("button", { name: "保存并继续" }).boundingBox();
  assert.ok(mobilePrimary && mobilePrimary.height >= 44, "mobile onboarding primary action must be at least 44px high");
  const safetyButton = mobilePage.getByRole("button", { name: "内容安全与求助" });
  const safetyHelp = await safetyButton.count() ? await safetyButton.boundingBox() : null;
  assert.equal(boxesOverlap(mobilePrimary, safetyHelp), false, "safety help must not cover the onboarding primary action");
  await mobilePage.screenshot({ path: path.join(OUT, "onboarding-390-step-1.png") });
  await mobilePage.getByRole("button", { name: "稍后再看", exact: true }).click();
  await mobilePage.getByRole("dialog").waitFor({ state: "hidden" });
  prefsResponse = await mobileContext.request.get(`${BASE}/api/user/prefs`);
  prefs = (await prefsResponse.json()).prefs;
  assert.equal(prefs.onboardingVersion, 0, "temporary dismissal must not forge onboarding completion");
  await mobilePage.reload({ waitUntil: "networkidle" });
  await mobilePage.getByRole("dialog").waitFor({ state: "visible" });
  await mobilePage.setViewportSize({ width: 390, height: 600 });
  const mobileShell = mobilePage.locator(".edu-onboarding-shell");
  const mobileShellState = await mobileShell.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  assert.ok(mobileShellState.clientHeight <= 576, "short mobile onboarding must stay inside the viewport");
  assert.ok(["auto", "scroll"].includes(mobileShellState.overflowY), "short mobile onboarding must allow vertical scrolling");
  const shortViewportAction = mobilePage.getByRole("button", { name: "保存并继续" });
  await shortViewportAction.scrollIntoViewIfNeeded();
  assert.equal(await shortViewportAction.isVisible(), true, "short mobile onboarding action must remain reachable");
  await mobileContext.close();

  resetOnboarding();
  const offlineContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
  await login(offlineContext, "student-s", "Student@123");
  const offlinePage = await offlineContext.newPage();
  await offlinePage.route("**/api/user/prefs", (route) => route.abort("failed"));
  await offlinePage.goto(`${BASE}/student/home`, { waitUntil: "networkidle" });
  await offlinePage.getByRole("dialog").waitFor({ state: "visible" });
  await offlinePage.getByRole("alert").filter({ hasText: "暂时无法连接校内偏好服务" }).waitFor();
  await offlinePage.getByText("同步待恢复").waitFor();
  await offlinePage.unroute("**/api/user/prefs");
  await offlinePage.getByRole("button", { name: "保存并继续" }).click();
  await offlinePage.getByText("把 AI 当作思考搭档，而不是答案机器").waitFor();
  await offlinePage.getByText("校内状态已同步").waitFor();
  prefsResponse = await offlineContext.request.get(`${BASE}/api/user/prefs`);
  prefs = (await prefsResponse.json()).prefs;
  assert.equal(prefs.onboardingStep, 1, "onboarding must recover after the preference service returns");
  await offlineContext.close();

  resetOnboarding();
  const focusContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
  await login(focusContext, "student-s", "Student@123");
  const focusPage = await focusContext.newPage();
  let releasePrefs;
  const prefsGate = new Promise((resolve) => { releasePrefs = resolve; });
  await focusPage.route("**/api/user/prefs", async (route) => {
    await prefsGate;
    await route.continue();
  });
  await focusPage.goto(`${BASE}/student/home`, { waitUntil: "domcontentloaded" });
  const focusOrigin = focusPage.locator('button:not([disabled]), a[href]').first();
  await focusOrigin.waitFor({ state: "visible" });
  await focusOrigin.evaluate((element) => element.setAttribute("data-focus-origin", "true"));
  await focusOrigin.focus();
  releasePrefs();
  const focusDialog = focusPage.getByRole("dialog");
  await focusDialog.waitFor({ state: "visible" });
  await focusPage.getByRole("button", { name: "保存并继续" }).click();
  await focusPage.getByText("把 AI 当作思考搭档，而不是答案机器").waitFor();
  await focusPage.getByRole("button", { name: "关闭引导，稍后再看" }).click();
  await focusDialog.waitFor({ state: "hidden" });
  const restoredToOrigin = await focusPage.evaluate(() => document.activeElement?.getAttribute("data-focus-origin") === "true");
  assert.equal(restoredToOrigin, true, "dismissal after a step change must restore the pre-dialog focus target");
  await focusContext.close();

  db.prepare(
    "UPDATE user_prefs SET onboardingVersion=?,onboardingStep=?,onboardingCompletedAt=NULL WHERE userId=?"
  ).run(2, 2, student.id);
  const partialContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
  await login(partialContext, "student-s", "Student@123");
  const partialPage = await partialContext.newPage();
  await partialPage.goto(`${BASE}/student/home`, { waitUntil: "networkidle" });
  await partialPage.getByRole("dialog").waitFor({ state: "visible" });
  await partialPage.getByRole("button", { name: "进入学生首页" }).click();
  await partialPage.getByRole("dialog").waitFor({ state: "hidden" });
  prefsResponse = await partialContext.request.get(`${BASE}/api/user/prefs`);
  prefs = (await prefsResponse.json()).prefs;
  assert.ok(Number.isFinite(prefs.onboardingCompletedAt), "a partial legacy completion must remain visible and self-heal through the server");
  await partialContext.close();

  const chatContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await login(chatContext, "student", "Student@123");
  const chatPage = await chatContext.newPage();
  await chatPage.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  const resume = chatPage.getByRole("button", { name: "我休息好了，继续" });
  if (await resume.count()) await resume.click();
  await chatPage.getByRole("button", { name: "发起新对话" }).first().click();
  await chatPage.locator(".edu-chat-empty").waitFor({ state: "visible" });
  const imageReady = await chatPage.locator(".edu-chat-empty img").evaluate((image) => image.complete && image.naturalWidth > 0);
  assert.equal(imageReady, true, "chat illustration must render");
  await assertNoOverflow(chatPage, "chat desktop");
  await assertReadableLeafText(chatPage, ".chat-experience", "chat desktop");
  await chatPage.screenshot({ path: path.join(OUT, "chat-empty-1440.png") });

  const sessionMenuTrigger = chatPage.getByTitle("会话操作").first();
  await sessionMenuTrigger.click();
  const sessionMenu = chatPage.getByRole("menu");
  await sessionMenu.waitFor({ state: "visible" });
  const sessionMenuHandle = await sessionMenu.elementHandle();
  assert.ok(sessionMenuHandle, "portal menu must have a mounted element");
  await chatPage.waitForFunction((element) => Number(getComputedStyle(element).opacity) >= 0.99, sessionMenuHandle);
  const menuSurface = await sessionMenu.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundImage: style.backgroundImage, opacity: Number(style.opacity) };
  });
  assert.notEqual(menuSurface.backgroundImage, "none", "portal menu must retain its opaque glass surface");
  assert.equal(menuSurface.opacity, 1, "portal menu content must remain fully opaque");
  await chatPage.keyboard.press("Escape");

  await chatPage.setViewportSize({ width: 390, height: 844 });
  await chatPage.waitForTimeout(250);
  const chatMobile = await assertNoOverflow(chatPage, "chat mobile");
  assert.ok(chatMobile.documentHeight <= chatMobile.viewportHeight + 2, "mobile chat must stay within the viewport");
  await chatPage.screenshot({ path: path.join(OUT, "chat-empty-390.png") });
  await chatContext.close();

  console.log(`glass UI visual flow PASS · screenshots=${OUT}`);
} finally {
  restoreOnboarding();
  db.close();
  await browser.close();
}
