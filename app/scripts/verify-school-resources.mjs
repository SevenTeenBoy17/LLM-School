import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.dirname(app);
const v2 = process.argv.includes("--v2");
const out = path.join(root, v2 ? ".agent-supervisor/resources-v2-20260908/commands" : ".agent-supervisor/resources-20260908/commands");
const focused = ["components/school-resources", "components/common/SchoolResourceIcon.tsx", "lib/school-resources", "app/(shell)/knowledge/resources/page.tsx", "app/(shell)/knowledge/page.tsx", "components/shell/Sidebar.tsx", "components/shell/MobileNav.tsx", "lib/nav.ts"];
if (v2) focused.push("app/(shell)/student/resources/page.tsx", "app/(shell)/student/home/page.tsx", "app/(shell)/student/activities/page.tsx", "next.config.ts");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
await mkdir(out, { recursive: true });
const results = [];
async function hashes() {
  const records = {};
  async function visit(relative) {
    if (!path.extname(relative)) {
      for (const item of await readdir(path.join(app, relative))) await visit(path.join(relative, item));
    } else records[relative.replaceAll("\\", "/")] = digest(await readFile(path.join(app, relative)));
  }
  for (const file of focused) await visit(file);
  if (v2) for (const file of ["public/resource-runtime.html", "public/art/school-resources/activity.webp", "public/art/school-resources/media.webp"]) await visit(file);
  return records;
}
async function run(id, args) {
  const startedAt = new Date().toISOString();
  const sourceBefore = await hashes();
  const child = spawn(process.execPath, args, { cwd: app, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", data => { output += data.toString(); });
  child.stderr.on("data", data => { output += data.toString(); });
  const exitCode = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  const file = `${id}.log`;
  await writeFile(path.join(out, file), output);
  const sourceAfter = await hashes();
  const record = { id, command: [process.execPath, ...args], cwd: app, startedAt, endedAt: new Date().toISOString(), exitCode, outputFile: file, outputSha256: digest(output), sourceBefore, sourceAfter, sourcesStable: JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter), collector: "local-native-command-audit; not a signed Supervisor gate" };
  results.push(record);
  await writeFile(path.join(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({ id, exitCode, sourcesStable: record.sourcesStable, log: path.join(out, file), tail: output.slice(-2500) }));
}
await run("typecheck", ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"]);
await run("focused-lint", ["node_modules/eslint/bin/eslint.js", ...focused]);
await run("app-lint", ["node_modules/eslint/bin/eslint.js", "."]);
if (!process.argv.includes("--skip-build")) await run("app-build", ["node_modules/next/dist/bin/next", "build"]);
process.exitCode = results.some(r => r.exitCode !== 0 || !r.sourcesStable) ? 1 : 0;
