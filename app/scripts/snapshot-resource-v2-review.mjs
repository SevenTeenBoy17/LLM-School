import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const app = path.join(root, 'app');
const checkpoint = path.join(root, '.agent-supervisor/checkpoints/resources-v2-20260908');
const out = path.join(root, '.agent-supervisor/resources-v2-20260908/code-review');
const run = new Date().toISOString().replace(/[:.]/g, '-');
const review = path.join(out, run);
const exists = p => access(p).then(() => true, () => false);
const digest = b => createHash('sha256').update(b).digest('hex');
const files = [];
async function include(relative) {
  if (!path.extname(relative)) { for (const name of await readdir(path.join(app, relative))) await include(path.join(relative, name)); }
  else files.push(relative.replaceAll('\\', '/'));
}
for (const item of ['components/school-resources', 'lib/school-resources', 'components/common/SchoolResourceIcon.tsx', 'components/shell/Sidebar.tsx', 'lib/nav.ts', 'next.config.ts', 'public/resource-runtime.html', 'app/(shell)/knowledge/resources/page.tsx', 'app/(shell)/student/resources/page.tsx', 'app/(shell)/student/home/page.tsx', 'app/(shell)/student/activities/page.tsx', 'tests/school-resources-model.mjs', 'tests/school-resources-ui.mjs', 'tests/resource-activity-model.mjs', 'tests/resource-activity-ui.mjs', 'tests/sidebar-bottom-anchor.mjs', 'tests/html-activity-security.mjs', 'tests/resource-document-preview.mjs']) await include(item);
await mkdir(review, { recursive: true });
function git(args) { const r = spawnSync('git', args, { cwd: review, windowsHide: true, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); return r.stdout.trim(); }
git(['init', '-q']);
const manifest = [];
for (const relative of files) {
  const candidates = [path.join(checkpoint, relative), path.join(checkpoint, 'extra/app', relative)];
  let base = null;
  for (const candidate of candidates) if (await exists(candidate)) { base = candidate; break; }
  const current = await readFile(path.join(app, relative));
  if (/sk-[A-Za-z0-9]{24,}/.test(current.toString())) throw new Error('Possible secret: do not submit this snapshot.');
  const destination = path.join(review, relative); await mkdir(path.dirname(destination), { recursive: true });
  if (base) await copyFile(base, destination);
  manifest.push({ file: relative, baseline: base ? digest(await readFile(base)) : null, current: digest(current) });
}
await writeFile(path.join(review, 'REVIEW-SCOPE.md'), 'Review only this bounded frontend delta against its pre-turn filesystem checkpoint. This is NOT the main repository HEAD. Backend resource storage/publication remains explicitly deferred. New HTML acceptance is intentional: only opaque sandbox preview, no host HTML injection. Old example count changes 6 to 7; old sidebar contract now bottom anchor <=20px. Preserve storage concurrency/migration and reject misleading send/grade claims. Review code and changed test integrity separately. No secrets, real user documents or database files are included.\n');
git(['add', '--', '.']);
git(['-c', 'user.name=Local Review Snapshot', '-c', 'user.email=review@localhost.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Pre-turn bounded filesystem checkpoint']);
const baseCommit = git(['rev-parse', 'HEAD']);
for (const relative of files) await copyFile(path.join(app, relative), path.join(review, relative));
git(['add', '-N', '--', '.']);
const patch = git(['diff', '--no-ext-diff', '--binary', 'HEAD']);
await writeFile(path.join(out, 'delta.patch'), patch);
await writeFile(path.join(out, 'snapshot.json'), JSON.stringify({ at: new Date().toISOString(), review, baseCommit, manifest, manifestSha256: digest(JSON.stringify(manifest)), diffSha256: digest(patch), mainRepositoryMutated: false }, null, 2));
console.log(JSON.stringify({ review, files: files.length, diffSha256: digest(patch), baseCommit }));
