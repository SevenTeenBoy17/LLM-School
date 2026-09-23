import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';

const temp = mkdtempSync(path.join(tmpdir(), 'eduai-setup-test-'));
assert.ok(path.resolve(temp).startsWith(path.resolve(tmpdir()) + path.sep));
let checks = 0;
try {
  for (const mode of ['demo', 'production']) {
    const root = path.join(temp, mode);
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    const script = path.join(root, 'scripts/setup-local.mjs');
    copyFileSync(new URL('../scripts/setup-local.mjs', import.meta.url), script);
    const first = spawnSync(process.execPath, [script, mode], { encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr); checks++;
    const before = readFileSync(path.join(root, '.env.local'), 'utf8');
    const env = parseEnv(before);
    assert.equal(env.EDUAI_ENABLE_DEMO_SEED, String(mode === 'demo')); checks++;
    assert.equal(env.EDUAI_DB_DIR, mode === 'demo' ? '.data-demo' : '.data-production'); checks++;
    assert.ok(env.EDUAI_SESSION_SECRET.length >= 64); checks++;
    assert.ok(!first.stdout.includes(env.EDUAI_SESSION_SECRET)); checks++;
    if (mode === 'production') {
      assert.ok(env.EDUAI_BOOTSTRAP_ADMIN_PASSWORD.length >= 24); checks++;
      assert.ok(!first.stdout.includes(env.EDUAI_BOOTSTRAP_ADMIN_PASSWORD)); checks++;
    }
    const second = spawnSync(process.execPath, [script, mode], { encoding: 'utf8' });
    assert.equal(second.status, 1); checks++;
    assert.equal(readFileSync(path.join(root, '.env.local'), 'utf8'), before); checks++;
  }
  console.log(JSON.stringify({ ok: true, checks, secretsPrinted: false }));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
