import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const { createActivityPackage, readActivityPackage, validateBrief } = await import('../lib/school-resources/activityPackage.ts');
const { ACTIVITY_EXAMPLES } = await import('../lib/school-resources/activityExamples.ts');
const { hasRuntimePolicy, readActivityHtml } = await import('../lib/school-resources/htmlRuntime.ts');
const checks = [];
const run = async (id, f) => { try { await f(); checks.push({ id, status: 'passed' }); } catch (e) { checks.push({ id, status: 'failed', error: e.stack }); } console.log(checks.at(-1)); };
const brief = { audience: '四年级', instructions: '比较同一整体的 1/2 与 2/4。', question: '你观察到什么？' };
let pack;
await run('P01-package-byte-integrity-and-task-roundtrip', async () => {
  pack = await createActivityPackage(ACTIVITY_EXAMPLES[0], brief);
  const read = await readActivityPackage(new Blob([JSON.stringify(pack)]));
  assert.equal(await read.resource.blob.text(), ACTIVITY_EXAMPLES[0].body);
  assert.deepEqual(read.brief, brief); assert.equal(read.resource.sha256, pack.sha256);
  assert.equal(pack.schema, 'eduai-activity-package/v1');
  assert.equal(pack.schoolId, undefined); assert.equal(pack.studentId, undefined);
});
await run('P02-tamper-and-malformed-pack-rejected', async () => {
  await assert.rejects(readActivityPackage(new Blob([JSON.stringify({ ...pack, sha256: '0'.repeat(64) })])), /校验/);
  for (const patch of [{ schema: 'other' }, { base64: '*bad' }, { title: '<x>'.repeat(100) }, { brief: null }, { fileName: 'x.svg' }, { subject: 'fake' }])
    await assert.rejects(readActivityPackage(new Blob([JSON.stringify({ ...pack, ...patch })])));
  await assert.rejects(readActivityPackage(new Blob(['{bad'])));
});
await run('P03-brief-real-input-no-synthetic-success', () => {
  assert.throws(() => validateBrief({ ...brief, instructions: '' }));
  assert.throws(() => validateBrief({ ...brief, question: 'x'.repeat(501) }));
  validateBrief(brief);
});
await run('P04-runtime-header-is-mandatory', () => {
  const policy = "default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';img-src data: blob:;media-src data: blob:;font-src data:;sandbox allow-scripts;frame-src blob:;connect-src 'none';form-action 'none';object-src 'none';worker-src 'none';base-uri 'none'";
  assert.equal(hasRuntimePolicy(policy), true);
  assert.equal(hasRuntimePolicy(null), false);
  assert.equal(hasRuntimePolicy(policy.replace('sandbox allow-scripts', 'sandbox allow-scripts allow-same-origin')), false);
  assert.equal(hasRuntimePolicy(policy.replace('frame-src blob:', 'frame-src *')), false);
  assert.equal(hasRuntimePolicy(`frame-src *;${policy}`), false);
  assert.equal(hasRuntimePolicy(`${policy};FRAME-SRC blob:`), false);
  assert.equal(hasRuntimePolicy(policy.replace('default-src', 'DEFAULT-SRC')), true);
  for (const space of ['\u00a0', '\u2003', '\u2028', '\ufeff', '\r', '\n']) assert.equal(hasRuntimePolicy(policy.replace('frame-src ', `frame-src${space}`)), false);
  for (const directive of ['script-src-elem', 'script-src-attr', 'style-src-elem', 'style-src-attr']) assert.equal(hasRuntimePolicy(`${policy};${directive} * 'unsafe-inline'`), false);
  for (const directive of ['script-src', 'style-src', 'img-src', 'media-src', 'font-src']) {
    assert.equal(hasRuntimePolicy(policy.split(';').filter(part => !part.startsWith(directive)).join(';')), false);
  }
});
await run('P05-bounded-UTF8-runtime-source', async () => {
  await assert.rejects(readActivityHtml(new Blob([new Uint8Array([255, 254, 0, 0])])));
  await assert.rejects(readActivityHtml(new Blob([''])));
  assert.equal(await readActivityHtml(new Blob(['<h1>中文</h1>'])), '<h1>中文</h1>');
});
const out = fileURLToPath(new URL('../../.agent-supervisor/resources-v2-20260908/tester/', import.meta.url));
mkdirSync(out, { recursive: true });
writeFileSync(`${out}activity-model.json`, JSON.stringify({ at: new Date().toISOString(), checks, passed: checks.filter(c => c.status === 'passed').length }, null, 2));
process.exitCode = checks.some(c => c.status === 'failed') ? 1 : 0;
