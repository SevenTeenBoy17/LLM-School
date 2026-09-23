import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const APP = fileURLToPath(new URL("../", import.meta.url));
const BASE = process.env.BASE || "http://127.0.0.1:4921";
const RUN = process.argv[2] || "verification";
assert.match(RUN, /^[a-z0-9-]+$/, "run label must be a simple directory name");
const OUT = path.resolve(APP, "../.agent-supervisor/resources-v2-20260908/sidebar", RUN);
const source = path.join(APP, "components/shell/Sidebar.tsx");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  criterion: "A1", goal: "goal-b440fbc8125718c0", version: 2,
  base: BASE, startedAt: new Date().toISOString(),
  sourceSha256: hash(await fs.readFile(source)),
  testSha256: hash(await fs.readFile(fileURLToPath(import.meta.url))),
  checks: [], samples: [], screenshots: [], consoleErrors: [], pageErrors: [],
};
await fs.mkdir(OUT, { recursive: true });

function check(condition, label) {
  report.checks.push({ label, pass: Boolean(condition) });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, reducedMotion: "reduce",
  });
  const login = await context.request.post(`${BASE}/api/auth/login`, {
    data: { username: "teacher", password: "Teacher@123" },
  });
  assert.equal(login.status(), 200, "local teacher fixture login");
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  // Profile has no active nav group, so every disclosure can genuinely close.
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  const sidebar = page.getByTestId("primary-sidebar");
  const nav = sidebar.locator("nav");
  const account = sidebar.locator('button[aria-haspopup="menu"]');
  const groups = nav.locator(':scope > div > button[aria-expanded]');
  await sidebar.waitFor({ state: "visible" });
  await account.filter({ hasText: "\u738b\u601d\u8fdc" }).waitFor({ state: "visible" });
  report.page = { url: page.url(), title: await page.title() };
  check(new URL(page.url()).pathname === "/profile", "profile identity");
  check((await page.locator("#main").innerText()).trim().length > 20, "nonblank main");
  check(await groups.count() >= 3, "teacher navigation disclosures are present");

  async function settle() {
    await page.evaluate(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }

  async function setGroups(mode) {
    const count = await groups.count();
    for (let index = 0; index < count; index += 1) {
      const wanted = mode === "open" || (mode === "mixed" && index === 0);
      const button = groups.nth(index);
      if ((await button.getAttribute("aria-expanded") === "true") !== wanted) await button.click();
      assert.equal(await button.getAttribute("aria-expanded"), String(wanted), `${mode} group ${index}`);
    }
    await settle();
  }

  async function sample(label, reference, screenshot = false) {
    await settle();
    const geometry = await sidebar.evaluate((aside) => {
      const navigation = aside.querySelector("nav");
      const trigger = aside.querySelector('button[aria-haspopup="menu"]');
      const footer = navigation.nextElementSibling;
      const rect = (el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom };
      };
      return {
        sidebar: rect(aside), nav: rect(navigation), account: rect(trigger), footer: rect(footer),
        viewport: { width: innerWidth, height: innerHeight }, windowScrollY: scrollY,
        documentWidth: document.documentElement.scrollWidth,
        navScrollTop: navigation.scrollTop, navScrollHeight: navigation.scrollHeight,
        navClientHeight: navigation.clientHeight,
        navOverflow: getComputedStyle(navigation).overflowY,
        footerShrink: getComputedStyle(footer).flexShrink,
      };
    });
    geometry.bottomInset = geometry.viewport.height - geometry.account.bottom;
    report.samples.push({ label, ...geometry });
    check(geometry.bottomInset >= -1 && geometry.bottomInset <= 20, `${label}: bottom inset <=20px (${geometry.bottomInset})`);
    check(geometry.account.height >= 44, `${label}: account remains full-height`);
    check(geometry.nav.bottom <= geometry.footer.y + 1, `${label}: nav never overlaps footer`);
    check(geometry.navOverflow === "auto" && geometry.footerShrink === "0", `${label}: independent nav overflow and nonshrinking footer`);
    check(geometry.documentWidth <= geometry.viewport.width + 1, `${label}: no horizontal overflow`);
    if (reference) check(Math.abs(geometry.account.y - reference.account.y) <= 1, `${label}: account position is invariant`);
    if (screenshot) {
      const screenshotPath = path.join(OUT, `${label}.png`);
      const bytes = await page.screenshot({ path: screenshotPath, fullPage: false });
      report.screenshots.push({ path: screenshotPath, sha256: hash(bytes) });
    }
    return geometry;
  }

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1440, height: 600 }, { width: 1024, height: 600 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    const prefix = `${viewport.width}x${viewport.height}`;
    await setGroups("closed");
    const closed = await sample(`${prefix}-closed`, null, true);
    await setGroups("open");
    const open = await sample(`${prefix}-open`, closed, true);
    check(open.navScrollHeight > open.navClientHeight, `${prefix}: open groups require real nav scrolling`);
    await nav.hover();
    const beforeScroll = await nav.evaluate((element) => element.scrollTop);
    await page.mouse.wheel(0, 1500);
    await page.waitForFunction(({ before }) =>
      document.querySelector("#primary-app-sidebar-navigation").scrollTop !== before,
    { before: beforeScroll });
    const scrolled = await sample(`${prefix}-nav-scroll`, closed);
    check(scrolled.windowScrollY === open.windowScrollY, `${prefix}: nav wheel does not scroll document`);
    await setGroups("mixed");
    await sample(`${prefix}-mixed`, closed, true);

    const resize = sidebar.getByTestId("primary-sidebar-resize-handle");
    for (const [key, width] of [["Home", 208], ["End", 320]]) {
      await resize.press(key);
      assert.equal(Number(await resize.getAttribute("aria-valuenow")), width);
      const resized = await sample(`${prefix}-width-${width}`, closed);
      check(Math.abs(resized.sidebar.width - width) <= 1, `${prefix}: width ${width} applied`);
    }
    const handle = await resize.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 60, handle.y + handle.height / 2, { steps: 6 });
    await page.mouse.up();
    const dragged = await sample(`${prefix}-width-drag`, closed);
    check(Math.abs(dragged.sidebar.width - 260) <= 1, `${prefix}: pointer resizing applied`);

    await sidebar.getByTestId("primary-sidebar-toggle").click();
    assert.equal(await sidebar.getAttribute("data-collapsed"), "true");
    const dock = await sample(`${prefix}-dock`, null, true);
    check(Math.abs(dock.sidebar.width - 72) <= 1, `${prefix}: icon dock width`);
    await nav.hover();
    await page.mouse.wheel(0, 1500);
    await page.waitForFunction(() => document.querySelector("#primary-app-sidebar-navigation").scrollTop > 0);
    await sample(`${prefix}-dock-scroll`, dock);
    await account.click();
    await page.getByRole("menu").waitFor({ state: "visible" });
    check(await page.getByRole("menuitem", { name: "\u4e2a\u4eba\u4e2d\u5fc3" }).isVisible(), `${prefix}: dock account menu works`);
    await page.keyboard.press("Escape");
    await sidebar.getByTestId("primary-sidebar-toggle").click();
    assert.equal(await sidebar.getAttribute("data-collapsed"), "false");
    await sample(`${prefix}-restored`, closed);
  }

  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /\u601d\u8fdc/ }).waitFor({ state: "visible" });
  const beforeDocumentScroll = await sample("dashboard-top");
  await page.mouse.move(900, 300);
  await page.mouse.wheel(0, 700);
  await page.waitForFunction(() => window.scrollY > 0);
  await sample("dashboard-document-scroll", beforeDocumentScroll, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await sidebar.waitFor({ state: "hidden" });
  check(await sidebar.isHidden(), "existing mobile sidebar visibility preserved");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile has no horizontal overflow");
  check(await page.locator('nextjs-portal [data-nextjs-dialog-overlay]').count() === 0, "no Next.js error overlay");
  check(report.consoleErrors.length === 0 && report.pageErrors.length === 0, "no browser runtime errors");
  await context.close();
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  report.sourceSha256After = hash(await fs.readFile(source));
  check(report.sourceSha256 === report.sourceSha256After, "Sidebar source did not change during test");
  report.finishedAt = new Date().toISOString();
  report.failedChecks = report.checks.filter((item) => !item.pass);
  report.pass = !report.error && report.failedChecks.length === 0;
  if (!report.pass) process.exitCode = 1;
  await fs.writeFile(path.join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, failed: report.failedChecks, error: report.error, output: OUT }, null, 2));
}
