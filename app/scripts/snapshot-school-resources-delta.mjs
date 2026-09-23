import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.dirname(app);
const out = path.join(root, ".agent-supervisor/resources-20260908/delta");
const baseline = path.join(root, ".agent-supervisor/checkpoints/resources-20260908");
const hash = value => createHash("sha256").update(value).digest("hex");
const files = [], patches = [];
await mkdir(out, { recursive: true });
for (const file of ["components/shell/Sidebar.tsx", "components/shell/MobileNav.tsx", "lib/nav.ts", "app/(shell)/knowledge/page.tsx"]) {
  const before = await readFile(path.join(baseline, file));
  const after = await readFile(path.join(app, file));
  const diff = spawnSync("git", ["diff", "--no-index", "--", path.join(baseline, file), path.join(app, file)], { cwd: root, encoding: "utf8", windowsHide: true });
  if (![0, 1].includes(diff.status)) throw new Error(diff.stderr);
  files.push({ file: `app/${file}`, kind: "modified", before: hash(before), after: hash(after) });
  patches.push(diff.stdout);
}
async function add(relative) {
  const absolute = path.join(app, relative);
  if (!path.extname(relative)) { for (const name of await readdir(absolute)) await add(path.join(relative, name)); return; }
  files.push({ file: `app/${relative.replaceAll("\\", "/")}`, kind: "new", after: hash(await readFile(absolute)) });
}
for (const file of ["app/(shell)/knowledge/resources", "components/school-resources", "lib/school-resources", "components/common/SchoolResourceIcon.tsx", "public/art/school-resources", "scripts/build-school-resource-assets.mjs", "scripts/verify-school-resources.mjs", "scripts/snapshot-school-resources-delta.mjs", "tests/school-resources-ui.mjs", "tests/school-resources-model.mjs"]) await add(file);
await writeFile(path.join(out, "checkpoint-delta.patch"), patches.join("\n"));
await writeFile(path.join(out, "files.json"), JSON.stringify({ capturedAt: new Date().toISOString(), baseline: "Targeted pre-task filesystem checkpoints, NOT Git HEAD; unrelated dirty changes excluded", files, manifestSha256: hash(JSON.stringify(files)), trackedPatchSha256: hash(patches.join("\n")), formalSupervisorEvidence: false }, null, 2) + "\n");
console.log(JSON.stringify({ out, files: files.length, manifestSha256: hash(JSON.stringify(files)) }));
