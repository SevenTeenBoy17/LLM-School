import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:4921";
const OUT = path.join(process.cwd(), "test-results", "chat-workspace-resize");

const WIDTH_KEYS = {
  primary: "eduai.shell.sidebar-width.v1.teacher",
  conversation: "eduai.chat.sidebar-width.v1.teacher",
  context: "eduai.chat.right-rail.v1.teacher.width",
};

await fs.mkdir(OUT, { recursive: true });

async function login(context) {
  const response = await context.request.post(`${BASE}/api/auth/login`, {
    data: { username: "teacher", password: "Teacher@123" },
  });
  assert.equal(response.status(), 200, "teacher login must succeed");
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));
}

async function assertNoHorizontalOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.ok(geometry.documentWidth <= geometry.viewportWidth + 1, `${label}: horizontal overflow`);
}

async function dragBy(page, locator, deltaX) {
  const box = await locator.boundingBox();
  assert.ok(box, "resize handle must have geometry");
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 320);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, { steps: 8 });
  await page.mouse.up();
  await settle(page);
}

async function widthOf(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, "panel must have geometry");
  return Math.round(box.width);
}

async function chatAdaptiveMetrics(page) {
  return page.evaluate(() => {
    const pane = document.querySelector('[data-testid="chat-primary-pane"]');
    const topbar = document.querySelector('[data-testid="chat-topbar"]');
    const scroll = document.querySelector('[data-testid="chat-scroll-region"]');
    const thread = document.querySelector('[data-testid="chat-thread"]');
    const composer = document.querySelector('[data-testid="chat-composer"]');
    if (!(pane instanceof HTMLElement)
      || !(topbar instanceof HTMLElement)
      || !(scroll instanceof HTMLElement)
      || !(thread instanceof HTMLElement)
      || !(composer instanceof HTMLElement)) return null;

    const paneRect = pane.getBoundingClientRect();
    const threadRect = thread.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    const messageRects = [...pane.querySelectorAll(".edu-chat-message-card")]
      .filter((node) => node instanceof HTMLElement)
      .map((node) => node.getBoundingClientRect());
    const featureLabels = [...pane.querySelectorAll(".edu-chat-control-label")]
      .filter((node) => node instanceof HTMLElement);
    const modelSubtitle = pane.querySelector(".edu-chat-model-subtitle");
    const insidePane = (rect) => rect.left >= paneRect.left - 1 && rect.right <= paneRect.right + 1;

    return {
      paneWidth: Math.round(paneRect.width),
      topbarHeight: Math.round(topbar.getBoundingClientRect().height),
      threadWidth: Math.round(threadRect.width),
      composerWidth: Math.round(composerRect.width),
      scrollClientWidth: scroll.clientWidth,
      scrollWidth: scroll.scrollWidth,
      featureLabelsHidden: featureLabels.length > 0
        && featureLabels.every((node) => getComputedStyle(node).display === "none"),
      modelSubtitleHidden: modelSubtitle instanceof HTMLElement
        && getComputedStyle(modelSubtitle).display === "none",
      threadInsidePane: insidePane(threadRect),
      composerInsidePane: insidePane(composerRect),
      messagesInsidePane: messageRects.length > 0 && messageRects.every(insidePane),
    };
  });
}

async function assertCompactIconAlignment(page) {
  const metrics = await page.locator(".primary-sidebar-icon-slot").evaluateAll((slots) =>
    slots.map((slot) => {
      const icon = slot.querySelector("[data-teacher-nav-icon]");
      if (!icon) return null;
      const name = icon.getAttribute("data-teacher-nav-icon");
      const slotRect = slot.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        name,
        slotCenterX: slotRect.left + slotRect.width / 2,
        slotCenterY: slotRect.top + slotRect.height / 2,
        iconCenterX: iconRect.left + iconRect.width / 2,
        iconCenterY: iconRect.top + iconRect.height / 2,
      };
    }).filter(Boolean));

  assert.equal(metrics.length, 13, "all teacher icons must use aligned slots");
  const slotCenterSpread = Math.max(...metrics.map((item) => item.slotCenterX))
    - Math.min(...metrics.map((item) => item.slotCenterX));
  assert.ok(slotCenterSpread <= 0.5, `icon slot centerline drifted by ${slotCenterSpread}px`);
  for (const metric of metrics) {
    assert.ok(Math.abs(metric.slotCenterX - metric.iconCenterX) <= 0.5, `${metric.name} icon box is not horizontally centered`);
    assert.ok(Math.abs(metric.slotCenterY - metric.iconCenterY) <= 0.5, `${metric.name} icon box is not vertically centered`);
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await login(context);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await page.evaluate((keys) => {
    localStorage.removeItem("eduai.shell.sidebar.v1.teacher");
    localStorage.removeItem("eduai.chat.sidebar.v1.teacher");
    localStorage.removeItem("eduai.chat.right-rail.v1.teacher");
    Object.values(keys).forEach((key) => localStorage.removeItem(key));
  }, WIDTH_KEYS);
  await page.reload({ waitUntil: "networkidle" });
  await settle(page);

  const primary = page.getByTestId("primary-sidebar");
  const conversation = page.getByTestId("chat-conversation-sidebar");
  const contextRail = page.getByTestId("chat-context-rail");
  const primaryHandle = page.getByTestId("primary-sidebar-resize-handle");
  const conversationHandle = page.getByTestId("chat-sidebar-resize-handle");
  const contextHandle = page.getByTestId("chat-context-rail-resize-handle");

  await Promise.all([
    primaryHandle.waitFor({ state: "visible" }),
    conversationHandle.waitFor({ state: "visible" }),
    contextHandle.waitFor({ state: "visible" }),
  ]);
  assert.equal(await widthOf(primary), 244);
  assert.equal(await widthOf(conversation), 288);
  assert.equal(await widthOf(contextRail), 320);
  assert.equal(await primaryHandle.getAttribute("role"), "separator");
  assert.equal(await primaryHandle.getAttribute("aria-orientation"), "vertical");

  await page.evaluate((keys) => {
    localStorage.setItem(keys.primary, "9999");
    localStorage.setItem(keys.conversation, "0");
    localStorage.setItem(keys.context, "not-a-width");
  }, WIDTH_KEYS);
  await page.reload({ waitUntil: "networkidle" });
  await settle(page);
  assert.equal(await widthOf(page.getByTestId("primary-sidebar")), 320, "oversized stored width must be clamped");
  assert.equal(await widthOf(page.getByTestId("chat-conversation-sidebar")), 240, "undersized stored width must be clamped");
  assert.equal(await widthOf(page.getByTestId("chat-context-rail")), 320, "malformed stored width must use the default");
  await page.evaluate((keys) => Object.values(keys).forEach((key) => localStorage.removeItem(key)), WIDTH_KEYS);
  await page.reload({ waitUntil: "networkidle" });
  await settle(page);

  await dragBy(page, primaryHandle, 56);
  await dragBy(page, conversationHandle, 72);
  await dragBy(page, contextHandle, -64);
  assert.equal(await widthOf(primary), 300, "primary panel drag must resize continuously");
  assert.equal(await widthOf(conversation), 360, "conversation panel drag must resize continuously");
  assert.equal(await widthOf(contextRail), 384, "right panel drag direction must be mirrored");
  assert.deepEqual(await page.evaluate((keys) => Object.fromEntries(
    Object.entries(keys).map(([name, key]) => [name, localStorage.getItem(key)])
  ), WIDTH_KEYS), { primary: "300", conversation: "360", context: "384" });
  const narrowChat = await chatAdaptiveMetrics(page);
  assert.ok(narrowChat, "narrow chat metrics must be measurable");
  assert.ok(narrowChat.paneWidth <= 420, `resized panels should create a narrow chat pane, got ${narrowChat.paneWidth}px`);
  assert.equal(narrowChat.featureLabelsHidden, true, "narrow chat must switch feature controls to compact labels");
  assert.equal(narrowChat.modelSubtitleHidden, true, "narrow chat must hide secondary model metadata");
  assert.equal(narrowChat.threadInsidePane, true, "narrow message thread must remain inside the central pane");
  assert.equal(narrowChat.composerInsidePane, true, "narrow composer must remain inside the central pane");
  assert.equal(narrowChat.messagesInsidePane, true, "narrow message cards must remain inside the central pane");
  assert.ok(narrowChat.scrollWidth <= narrowChat.scrollClientWidth + 1, "narrow chat scroll region must not overflow horizontally");
  assert.ok(narrowChat.threadWidth >= narrowChat.paneWidth - 32, "narrow thread must use the available central width");
  assert.ok(narrowChat.composerWidth >= narrowChat.paneWidth - 24, "narrow composer must use the available central width");
  assert.ok(narrowChat.topbarHeight <= 190, `compact toolbar should avoid excessive stacking, got ${narrowChat.topbarHeight}px`);
  await assertNoHorizontalOverflow(page, "1440 resized workspace");
  await page.screenshot({ path: path.join(OUT, "workspace-resized-1440.png"), animations: "disabled" });

  await page.reload({ waitUntil: "networkidle" });
  await settle(page);
  assert.equal(await widthOf(page.getByTestId("primary-sidebar")), 300, "primary width must persist after reload");
  assert.equal(await widthOf(page.getByTestId("chat-conversation-sidebar")), 360, "conversation width must persist after reload");
  assert.equal(await widthOf(page.getByTestId("chat-context-rail")), 384, "context width must persist after reload");

  const persistedPrimaryHandle = page.getByTestId("primary-sidebar-resize-handle");
  await persistedPrimaryHandle.focus();
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  assert.equal(await widthOf(page.getByTestId("primary-sidebar")), 292, "ArrowLeft must move the left separator left");
  await page.keyboard.press("Shift+ArrowRight");
  await settle(page);
  assert.equal(await widthOf(page.getByTestId("primary-sidebar")), 316, "Shift+ArrowRight must use the large step");
  await page.keyboard.press("Home");
  await settle(page);
  assert.equal(await widthOf(page.getByTestId("primary-sidebar")), 208, "Home must select the minimum width");
  await page.keyboard.press("End");
  await settle(page);
  assert.equal(await widthOf(page.getByTestId("primary-sidebar")), 320, "End must select the maximum width");

  await page.getByTestId("primary-sidebar-resize-handle").dblclick();
  await page.getByTestId("chat-sidebar-resize-handle").dblclick();
  await page.getByTestId("chat-context-rail-resize-handle").dblclick();
  await settle(page);
  assert.equal(await widthOf(page.getByTestId("primary-sidebar")), 244, "double click must reset primary width");
  assert.equal(await widthOf(page.getByTestId("chat-conversation-sidebar")), 288, "double click must reset conversation width");
  assert.equal(await widthOf(page.getByTestId("chat-context-rail")), 320, "double click must reset context width");

  await page.getByTestId("primary-sidebar-toggle").click();
  await settle(page);
  assert.equal(await page.getByTestId("primary-sidebar-resize-handle").count(), 0, "compact icon dock must not expose a dead resize handle");
  await assertCompactIconAlignment(page);
  await page.screenshot({ path: path.join(OUT, "workspace-compact-icons-aligned-1440.png"), animations: "disabled" });

  await page.getByTestId("chat-context-rail-toggle").click();
  await settle(page);
  assert.equal(await page.getByTestId("chat-context-rail-resize-handle").count(), 0, "compact right dock must not expose a resize handle");
  await page.getByTestId("chat-sidebar-toggle").click();
  await page.getByTestId("chat-conversation-sidebar").waitFor({ state: "hidden" });
  assert.equal(await page.getByTestId("chat-sidebar-resize-handle").count(), 0, "hidden conversation panel must not expose a resize handle");

  const wideChat = await chatAdaptiveMetrics(page);
  assert.ok(wideChat, "wide chat metrics must be measurable");
  assert.ok(wideChat.paneWidth >= narrowChat.paneWidth + 700, "collapsed side panels must return their space to the central pane");
  assert.equal(wideChat.featureLabelsHidden, false, "wide chat must restore feature labels");
  assert.equal(wideChat.modelSubtitleHidden, false, "wide chat must restore model metadata");
  assert.ok(wideChat.threadWidth >= narrowChat.threadWidth + 500, "message thread must expand with the central pane");
  assert.ok(wideChat.composerWidth >= narrowChat.composerWidth + 500, "composer must expand with the central pane");
  assert.equal(wideChat.threadInsidePane, true, "wide message thread must remain inside the central pane");
  assert.equal(wideChat.composerInsidePane, true, "wide composer must remain inside the central pane");
  assert.equal(wideChat.messagesInsidePane, true, "wide message cards must remain inside the central pane");
  assert.ok(wideChat.topbarHeight < narrowChat.topbarHeight, "toolbar must reclaim vertical space when the central pane grows");
  await assertNoHorizontalOverflow(page, "1440 wide adaptive workspace");
  await page.screenshot({ path: path.join(OUT, "workspace-wide-adaptive-1440.png"), animations: "disabled" });

  await page.getByTestId("primary-sidebar-toggle").click();
  await page.getByTestId("chat-context-rail-toggle").click();
  await page.getByTestId("chat-sidebar-toggle").click();
  await page.getByTestId("chat-conversation-sidebar").waitFor({ state: "visible" });

  for (const [width, height, label] of [
    [1024, 768, "tablet landscape"],
    [768, 900, "tablet portrait"],
    [390, 844, "mobile"],
  ]) {
    await page.setViewportSize({ width, height });
    await settle(page);
    await assertNoHorizontalOverflow(page, label);
    if (width < 1024) assert.equal(await page.getByTestId("primary-sidebar-resize-handle").isHidden(), true, `${label}: primary handle must be hidden`);
    if (width < 768) assert.equal(await page.getByTestId("chat-sidebar-resize-handle").isHidden(), true, `${label}: conversation handle must be hidden`);
    if (width < 1280) assert.equal(await page.getByTestId("chat-context-rail-resize-handle").isHidden(), true, `${label}: context handle must be hidden`);
  }

  assert.deepEqual(errors, [], `resize flow emitted console errors:\n${errors.join("\n")}`);
  console.log(`chat workspace resize PASS · screenshots=${OUT}`);
  await context.close();
} finally {
  await browser.close();
}
