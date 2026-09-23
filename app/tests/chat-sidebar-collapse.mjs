import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:4921";
const OUT = path.join(process.cwd(), "test-results", "chat-sidebar-collapse");

await fs.mkdir(OUT, { recursive: true });

async function login(context) {
  const response = await context.request.post(`${BASE}/api/auth/login`, {
    data: { username: "teacher", password: "Teacher@123" },
  });
  assert.equal(response.status(), 200, "teacher login must succeed");
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
  const main = page.locator("#main");
  const sidebar = main.getByTestId("chat-conversation-sidebar");
  const primaryPane = main.getByTestId("chat-primary-pane");
  const toggle = main.getByTestId("chat-sidebar-toggle");

  await sidebar.waitFor({ state: "visible" });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await sidebar.getAttribute("data-open"), "true");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  const openPane = await primaryPane.boundingBox();
  const openSidebar = await sidebar.boundingBox();
  assert.ok(openPane && openSidebar, "desktop chat geometry must be measurable");
  assert.ok(Math.abs(openSidebar.width - 288) <= 2, `sidebar width must remain 288px, got ${openSidebar.width}`);
  await assertNoHorizontalOverflow(page, "desktop open sidebar");
  await page.screenshot({ path: path.join(OUT, "chat-sidebar-open-1440.png") });

  await toggle.click();
  await sidebar.waitFor({ state: "hidden" });
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await toggle.getAttribute("aria-label"), "显示会话侧栏");
  const closedPane = await primaryPane.boundingBox();
  assert.ok(closedPane && closedPane.width >= openPane.width + 280, "main conversation must reclaim the hidden sidebar width");
  assert.equal(await page.evaluate(() => localStorage.getItem("eduai.chat.sidebar.v1.teacher")), "closed");
  await page.screenshot({ path: path.join(OUT, "chat-sidebar-hidden-1440.png") });

  await toggle.click();
  await sidebar.waitFor({ state: "visible" });
  const recentToggle = sidebar.getByRole("button", { name: /最近会话/ });
  await recentToggle.click();
  assert.equal(await recentToggle.getAttribute("aria-expanded"), "false");
  assert.equal(await page.locator("#chat-recent-sessions").isHidden(), true);
  await recentToggle.click();

  const agentsToggle = sidebar.getByRole("button", { name: /智能体/ });
  await agentsToggle.click();
  assert.equal(await agentsToggle.getAttribute("aria-expanded"), "false");
  assert.equal(await page.locator("#chat-agent-shortcuts").isHidden(), true);
  await agentsToggle.click();

  await page.keyboard.press("Control+Backslash");
  await sidebar.waitFor({ state: "hidden" });
  await page.reload({ waitUntil: "networkidle" });
  await sidebar.waitFor({ state: "hidden" });
  assert.equal(await main.getByTestId("chat-sidebar-toggle").getAttribute("aria-expanded"), "false", "reload must restore the saved sidebar state");
  await main.getByTestId("chat-sidebar-toggle").click();
  await sidebar.waitFor({ state: "visible" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  assert.equal(await sidebar.isHidden(), true, "desktop sidebar must stay out of the mobile flow");
  assert.equal(await main.getByTestId("chat-sidebar-toggle").isVisible(), false, "desktop sidebar control must not duplicate the mobile history control");
  assert.equal(await main.getByRole("button", { name: /最近会话/ }).isVisible(), true, "existing mobile history entry must remain available");
  await assertNoHorizontalOverflow(page, "mobile chat");
  await page.screenshot({ path: path.join(OUT, "chat-sidebar-mobile-390.png") });

  assert.deepEqual(errors, [], `chat sidebar flow must not emit console errors:\n${errors.join("\n")}`);
  console.log(`chat sidebar collapse PASS · screenshots=${OUT}`);
  await context.close();
} finally {
  await browser.close();
}
