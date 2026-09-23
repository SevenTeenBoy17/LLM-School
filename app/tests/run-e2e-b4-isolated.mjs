import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const testDir = mkdtempSync(join(tmpdir(), "eduai-b4-"));

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

async function waitForServer(url, child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited before readiness (${child.exitCode})`);
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2_000) });
      if (response.status > 0) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 350));
  }
  throw new Error("Timed out waiting for isolated Next.js server");
}

function stopTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

let server;
let output = "";
try {
  const port = await freePort();
  const nextBin = join(APP_ROOT, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: APP_ROOT,
    env: { ...process.env, EDUAI_DB_DIR: testDir, EDUAI_ENABLE_DEMO_SEED: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream?.on("data", (chunk) => { output = `${output}${chunk}`.slice(-20_000); });
  }
  const base = `http://127.0.0.1:${port}`;
  await waitForServer(`${base}/login`, server);
  const test = spawnSync(process.execPath, [join(APP_ROOT, "tests", "e2e-b4.mjs")], {
    cwd: APP_ROOT,
    env: { ...process.env, TEST_BASE_URL: base, TEST_DB_DIR: testDir },
    stdio: "inherit",
    timeout: 240_000,
    killSignal: "SIGTERM",
  });
  if (test.error) throw test.error;
  if (test.status !== 0) process.exitCode = test.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  if (output) console.error("\n--- isolated server tail ---\n" + output);
  process.exitCode = 1;
} finally {
  stopTree(server);
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  const resolved = resolve(testDir);
  const tempRoot = resolve(tmpdir()) + sep;
  if (!resolved.startsWith(tempRoot) || !basename(resolved).startsWith("eduai-b4-")) {
    throw new Error(`Refusing to remove unexpected path: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
