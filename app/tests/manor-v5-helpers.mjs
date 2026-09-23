import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

export const APP_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const RESULTS_DIR = join(APP_ROOT, "test-results");

export async function launchManorBrowser() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    chromium.executablePath(),
    process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe") : undefined,
    process.env["PROGRAMFILES(X86)"] ? join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe") : undefined,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : undefined,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executablePath = [...new Set(candidates)].find((candidate) => existsSync(candidate));
  assert.ok(executablePath, "No Playwright Chromium or compatible local Chrome executable was found.");
  return chromium.launch({ executablePath, headless: true });
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForServer(url, child, tail) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited before readiness (${child.exitCode})\n${tail()}`);
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2_000) });
      if (response.status > 0) return;
    } catch {
      // The isolated app is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 350));
  }
  throw new Error(`Timed out waiting for isolated manor server\n${tail()}`);
}

function stopTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

function removeIsolatedDist(distDir, safeLabel) {
  const resolvedDist = resolve(APP_ROOT, distDir);
  const appRootPrefix = `${resolve(APP_ROOT)}${sep}`;
  if (!resolvedDist.startsWith(appRootPrefix) || !basename(resolvedDist).startsWith(`.next-${safeLabel}-`)) {
    throw new Error(`Refusing to remove unexpected dist path: ${resolvedDist}`);
  }
  rmSync(resolvedDist, { recursive: true, force: true, maxRetries: 30, retryDelay: 250 });
}

export async function startIsolatedManorDevServer({ label, tempDbDir, maxAttempts = 3 }) {
  const safeLabel = label.replaceAll(/[^a-z0-9-]/gi, "-").toLowerCase();
  const nextBin = join(APP_ROOT, "node_modules", "next", "dist", "bin", "next");
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = await freePort();
    const distDir = `.next-${safeLabel}-${port}`;
    let serverTail = "";
    const server = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: APP_ROOT,
      env: { ...process.env, EDUAI_DB_DIR: tempDbDir, EDUAI_ENABLE_DEMO_SEED: "true", NEXT_DIST_DIR: distDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [server.stdout, server.stderr]) {
      stream?.on("data", (chunk) => { serverTail = `${serverTail}${chunk}`.slice(-20_000); });
    }
    const base = `http://127.0.0.1:${port}`;

    try {
      await waitForServer(`${base}/login`, server, () => serverTail);
    } catch (error) {
      lastError = error;
      stopTree(server);
      await new Promise((resolveWait) => setTimeout(resolveWait, 750));
      removeIsolatedDist(distDir, safeLabel);
      const portRace = /EADDRINUSE|address already in use/i.test(serverTail);
      if (portRace && attempt + 1 < maxAttempts) continue;
      throw error;
    }

    let cleaned = false;
    return {
      base,
      async cleanup() {
        if (cleaned) return;
        cleaned = true;
        stopTree(server);
        await new Promise((resolveWait) => setTimeout(resolveWait, 750));
        removeIsolatedDist(distDir, safeLabel);
      },
    };
  }

  throw lastError ?? new Error(`Unable to start isolated manor server for ${safeLabel}`);
}

export async function startManorServer(label) {
  if (process.env.MANOR_BASE_URL) {
    return { base: process.env.MANOR_BASE_URL.replace(/\/$/, ""), cleanup: async () => undefined };
  }
  const safeLabel = label.replaceAll(/[^a-z0-9-]/gi, "-").toLowerCase();
  const tempDbDir = mkdtempSync(join(tmpdir(), `eduai-${safeLabel}-`));
  let isolated;
  try {
    isolated = await startIsolatedManorDevServer({ label: safeLabel, tempDbDir });
  } catch (error) {
    rmSync(tempDbDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    throw error;
  }
  async function cleanup() {
    await isolated.cleanup();
    const resolvedTemp = resolve(tempDbDir);
    const tempPrefix = `${resolve(tmpdir())}${sep}`;
    if (!resolvedTemp.startsWith(tempPrefix) || !basename(resolvedTemp).startsWith(`eduai-${safeLabel}-`)) throw new Error(`Refusing to remove unexpected temp path: ${resolvedTemp}`);
    rmSync(resolvedTemp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }

  return { base: isolated.base, cleanup };
}

export async function openStudentManor(browser, base, viewport, options = {}) {
  const diagnostics = { external: [], manorApi: [], api: [], consoleErrors: [], pageErrors: [] };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: options.reducedMotion ?? "reduce" });
  const page = await context.newPage();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v2/manor") || url.pathname.startsWith("/api/manor")) diagnostics.manorApi.push({ method: request.method(), path: url.pathname });
    if (url.pathname.startsWith("/api/")) diagnostics.api.push({ method: request.method(), path: url.pathname });
    if (!(url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.protocol === "data:" || url.protocol === "blob:")) diagnostics.external.push(request.url());
  });
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  const login = await page.request.post(`${base}/api/auth/login`, { data: { username: "student", password: "Student@123" } });
  assert.equal(login.ok(), true, `demo student login failed: ${login.status()}`);
  await page.goto(`${base}/student/manor?qa=1`, { waitUntil: "networkidle" });
  await page.locator('[data-testid="manor-stage"][data-scenario="normal"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("manor-scene").waitFor({ state: "visible", timeout: 30_000 });
  return { context, page, diagnostics };
}

export async function assertNoHorizontalOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  assert.equal(geometry.scrollWidth <= geometry.clientWidth + 1, true, `${label} document overflow: ${JSON.stringify(geometry)}`);
  assert.equal(geometry.bodyScrollWidth <= geometry.clientWidth + 1, true, `${label} body overflow: ${JSON.stringify(geometry)}`);
}

export async function assertMinimumHitTargets(locator, label) {
  const targets = await locator.evaluateAll((elements) => elements.filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }).map((element) => {
    const rect = element.getBoundingClientRect();
    return { label: element.getAttribute("aria-label") || element.textContent?.trim(), width: Math.round(rect.width), height: Math.round(rect.height) };
  }));
  assert.equal(targets.length > 0, true, `${label}: no visible controls`);
  assert.equal(targets.every((target) => target.width >= 44 && target.height >= 44), true, `${label}: ${JSON.stringify(targets)}`);
}

export function assertCleanDiagnostics(diagnostics, label) {
  assert.deepEqual(diagnostics.external, [], `${label} external requests: ${diagnostics.external.join(", ")}`);
  assert.deepEqual(diagnostics.manorApi, [], `${label} must not call legacy or v2 manor APIs: ${JSON.stringify(diagnostics.manorApi)}`);
  assert.deepEqual(diagnostics.consoleErrors, [], `${label} console errors: ${diagnostics.consoleErrors.join(" | ")}`);
  assert.deepEqual(diagnostics.pageErrors, [], `${label} page errors: ${diagnostics.pageErrors.join(" | ")}`);
}
