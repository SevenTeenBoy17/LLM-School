import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { basename, join, resolve, sep } from "node:path";
import { APP_ROOT } from "./manor-v5-helpers.mjs";

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer(); server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolvePort(port)); });
  });
}
export async function startResearchSnapshot({ buildOnly = false } = {}) {
  // Webpack requires the source snapshot and linked dependencies on the same drive.
  const snapshotRoot = resolve(APP_ROOT, "../.agent-supervisor/research-snapshots");
  mkdirSync(snapshotRoot, { recursive: true });
  const workspace = mkdtempSync(join(snapshotRoot, "eduai-research-snapshot-"));
  const app = join(workspace, "app");
  const modules = join(app, "node_modules");
  let child, stopped = false;
  const cleanup = async () => {
    if (stopped) return; stopped = true;
    if (child && child.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    }
    if (!resolve(workspace).startsWith(`${snapshotRoot}${sep}`) || !basename(workspace).startsWith("eduai-research-snapshot-")) throw new Error("Refusing unexpected cleanup target");
    // Remove only our junction before deleting the isolated source snapshot.
    if (existsSync(modules)) { if (!lstatSync(modules).isSymbolicLink()) throw new Error("Unexpected module directory"); unlinkSync(modules); }
    rmSync(workspace, { recursive: true, force: true, maxRetries: 30, retryDelay: 250 });
  };
  try {
    for (const name of ["app", "components", "lib", "public", "package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs", "proxy.ts"]) cpSync(join(APP_ROOT, name), join(app, name), { recursive: true });
    symlinkSync(join(APP_ROOT, "node_modules"), modules, process.platform === "win32" ? "junction" : "dir");
    const port = await freePort();
    const args = [join(APP_ROOT, "node_modules/next/dist/bin/next"), buildOnly ? "build" : "dev", "--webpack"];
    if (!buildOnly) args.push("-H", "127.0.0.1", "-p", String(port));
    let output = "";
    child = spawn(process.execPath, args, { cwd: app, env: { ...process.env, EDUAI_DB_DIR: join(workspace, "db"), EDUAI_ENABLE_DEMO_SEED: "true", NEXT_DIST_DIR: ".next" }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", data => { output = `${output}${data}`.slice(-30000); if (buildOnly) process.stdout.write(data); });
    child.stderr.on("data", data => { output = `${output}${data}`.slice(-30000); if (buildOnly) process.stderr.write(data); });
    if (buildOnly) {
      const exitCode = await new Promise((done, reject) => { child.once("error", reject); child.once("exit", done); });
      if (exitCode !== 0) throw new Error(`Snapshot build failed (${exitCode})`);
      return { cleanup, output };
    }
    const base = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Snapshot server exited\n${output}`);
      try { const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(5000) }); if (response.status < 500) return { base, cleanup, dbPath: join(workspace, "db", "eduai.sqlite") }; } catch { /* Isolated compilation is still starting. */ }
      await new Promise(done => setTimeout(done, 300));
    }
    throw new Error(`Snapshot server did not become ready\n${output}`);
  } catch (error) { await cleanup(); throw error; }
}

if (process.argv.includes("--build-only")) {
  const result = await startResearchSnapshot({ buildOnly: true });
  await result.cleanup();
}
