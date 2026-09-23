import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:4921";
const OUT = path.join(process.cwd(), "test-results", "chat-workspace-panels");

await fs.mkdir(OUT, { recursive: true });

async function login(context) {
  const response = await context.request.post(`${BASE}/api/auth/login`, {
    data: { username: "teacher", password: "Teacher@123" },
  });
  assert.equal(response.status(), 200, "teacher login must succeed");
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertNoHorizontalOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.ok(geometry.documentWidth <= geometry.viewportWidth + 1, `${label}: must not overflow horizontally`);
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await login(context);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.removeItem("eduai.shell.sidebar.v1.teacher");
    localStorage.removeItem("eduai.chat.sidebar.v1.teacher");
    localStorage.removeItem("eduai.chat.right-rail.v1.teacher");
  });
  await page.reload({ waitUntil: "networkidle" });

  const primarySidebar = page.getByTestId("primary-sidebar");
  const primaryToggle = page.getByTestId("primary-sidebar-toggle");
  const conversationSidebar = page.getByTestId("chat-conversation-sidebar");
  const conversationToggle = page.getByTestId("chat-sidebar-toggle");
  const contextRail = page.getByTestId("chat-context-rail");
  const contextToggle = page.getByTestId("chat-context-rail-toggle");
  const conversationPane = page.getByTestId("chat-primary-pane");

  await Promise.all([
    primarySidebar.waitFor({ state: "visible" }),
    conversationSidebar.waitFor({ state: "visible" }),
    contextRail.waitFor({ state: "visible" }),
  ]);
  await settle(page);
  assert.equal(await primarySidebar.getAttribute("data-collapsed"), "false");
  assert.equal(await conversationSidebar.getAttribute("data-open"), "true");
  assert.equal(await contextRail.getAttribute("data-collapsed"), "false");
  assert.equal(await primaryToggle.getAttribute("aria-expanded"), "true");
  assert.equal(await conversationToggle.getAttribute("aria-expanded"), "true");
  assert.equal(await contextToggle.getAttribute("aria-expanded"), "true");

  const openPrimary = await primarySidebar.boundingBox();
  const openConversation = await conversationSidebar.boundingBox();
  const openContext = await contextRail.boundingBox();
  const openPane = await conversationPane.boundingBox();
  assert.ok(openPrimary && openConversation && openContext && openPane, "all expanded panel geometry must be measurable");
  assert.ok(Math.abs(openPrimary.width - 244) <= 2, `primary sidebar must be 244px, got ${openPrimary.width}`);
  assert.ok(Math.abs(openConversation.width - 288) <= 2, `conversation sidebar must be 288px, got ${openConversation.width}`);
  assert.ok(Math.abs(openContext.width - 320) <= 2, `context rail must be 320px, got ${openContext.width}`);
  await assertNoHorizontalOverflow(page, "1440 all expanded");
  await page.screenshot({ path: path.join(OUT, "workspace-all-expanded-1440.png") });

  await primaryToggle.click();
  await conversationToggle.click();
  await contextToggle.click();
  await conversationSidebar.waitFor({ state: "hidden" });
  await settle(page);

  assert.equal(await primarySidebar.getAttribute("data-collapsed"), "true");
  assert.equal(await contextRail.getAttribute("data-collapsed"), "true");
  assert.equal(await primaryToggle.getAttribute("aria-label"), "展开主导航");
  assert.equal(await conversationToggle.getAttribute("aria-label"), "显示会话侧栏");
  assert.equal(await contextToggle.getAttribute("aria-label"), "展开模型与建议面板");
  const compactPrimary = await primarySidebar.boundingBox();
  const compactContext = await contextRail.boundingBox();
  const focusPane = await conversationPane.boundingBox();
  assert.ok(compactPrimary && compactContext && focusPane, "collapsed workspace geometry must be measurable");
  assert.ok(Math.abs(compactPrimary.width - 72) <= 2, `primary icon dock must be 72px, got ${compactPrimary.width}`);
  assert.ok(Math.abs(compactContext.width - 64) <= 2, `context icon dock must be 64px, got ${compactContext.width}`);
  assert.ok(focusPane.width >= openPane.width + 690, "conversation canvas must reclaim all three collapsed panel widths");
  assert.equal(await page.getByRole("link", { name: "AI 对话", exact: true }).getAttribute("title"), "AI 对话", "compact primary navigation must keep named links");
  assert.deepEqual(await page.evaluate(() => ({
    primary: localStorage.getItem("eduai.shell.sidebar.v1.teacher"),
    conversation: localStorage.getItem("eduai.chat.sidebar.v1.teacher"),
    context: localStorage.getItem("eduai.chat.right-rail.v1.teacher"),
  })), {
    primary: "collapsed",
    conversation: "closed",
    context: "collapsed",
  });
  await assertNoHorizontalOverflow(page, "1440 focus workspace");
  await page.screenshot({ path: path.join(OUT, "workspace-focus-1440.png") });

  await page.reload({ waitUntil: "networkidle" });
  await settle(page);
  assert.equal(await page.getByTestId("primary-sidebar").getAttribute("data-collapsed"), "true", "reload must restore primary dock state");
  assert.equal(await page.getByTestId("chat-conversation-sidebar").isHidden(), true, "reload must restore hidden conversation sidebar");
  assert.equal(await page.getByTestId("chat-context-rail").getAttribute("data-collapsed"), "true", "reload must restore context dock state");

  await page.getByTestId("primary-sidebar-toggle").click();
  await page.getByTestId("chat-sidebar-toggle").click();
  await page.getByTestId("chat-context-rail-toggle").click();
  await page.getByTestId("chat-conversation-sidebar").waitFor({ state: "visible" });

  for (const [width, height, label] of [
    [1024, 768, "tablet landscape"],
    [768, 900, "tablet portrait"],
    [390, 844, "mobile"],
  ]) {
    await page.setViewportSize({ width, height });
    await settle(page);
    await assertNoHorizontalOverflow(page, label);
    if (width < 1024) {
      assert.equal(await page.getByTestId("primary-sidebar").isHidden(), true, `${label}: desktop primary sidebar must be out of flow`);
    }
    if (width < 1280) {
      assert.equal(await page.getByTestId("chat-context-rail").isHidden(), true, `${label}: context rail must be out of flow`);
    }
    if (width === 390) {
      assert.equal(await page.getByTestId("chat-conversation-sidebar").isHidden(), true, "mobile: desktop conversation sidebar must be out of flow");
      assert.equal(await page.getByTestId("chat-sidebar-toggle").isVisible(), false, "mobile: desktop collapse button must not duplicate mobile history");
      assert.equal(await page.getByRole("button", { name: /最近会话/ }).isVisible(), true, "mobile: history remains reachable");
    }
    await page.screenshot({ path: path.join(OUT, `workspace-${width}.png`) });
  }

  assert.deepEqual(errors, [], `workspace panel flow must not emit console errors:\n${errors.join("\n")}`);
  console.log(`chat workspace panels PASS · screenshots=${OUT}`);
  await context.close();
} finally {
  await browser.close();
}
