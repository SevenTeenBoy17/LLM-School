import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { startIsolatedManorDevServer } from "./manor-v5-helpers.mjs";

const label = "agent-workbench-migration";
const directory = mkdtempSync(join(tmpdir(), `eduai-${label}-`));
const configPath = new URL("../tsconfig.json", import.meta.url);
const envPath = new URL("../next-env.d.ts", import.meta.url);
const initialConfig = JSON.parse(readFileSync(configPath, "utf8"));
const initialEnv = readFileSync(envPath, "utf8");
let server;
try {
  server = await startIsolatedManorDevServer({ label, tempDbDir: directory });
  const login = await fetch(`${server.base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "teacher", password: "Teacher@123" }) });
  assert.equal(login.status, 200);
  await server.cleanup();
  const legacy = new DatabaseSync(join(directory, "eduai.sqlite"));
  // Only the disposable fixture is downgraded; no production schema is touched.
  legacy.exec("ALTER TABLE agents DROP COLUMN systemPrompt");
  legacy.exec("CREATE TABLE migration_sentinel (value TEXT); INSERT INTO migration_sentinel VALUES ('preserve')");
  const rows = legacy.prepare("SELECT * FROM agents ORDER BY id").all();
  assert.ok(rows.length > 0);
  legacy.close();
  server = await startIsolatedManorDevServer({ label, tempDbDir: directory });
  const migratedLogin = await fetch(`${server.base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "teacher", password: "Teacher@123" }) });
  assert.equal(migratedLogin.status, 200);
  await server.cleanup();
  const migrated = new DatabaseSync(join(directory, "eduai.sqlite"));
  const column = migrated.prepare("PRAGMA table_info(agents)").all().find(item => item.name === "systemPrompt");
  assert.equal(column.type, "TEXT");
  assert.equal(column.notnull, 0);
  const after = migrated.prepare("SELECT * FROM agents ORDER BY id").all().map(row => {
    assert.equal(row.systemPrompt, null);
    const { systemPrompt: _prompt, ...rest } = row;
    return { ...rest };
  });
  assert.deepEqual(after, rows.map(row => ({ ...row })));
  assert.equal(migrated.prepare("SELECT value FROM migration_sentinel").get().value, "preserve");
  migrated.close();
  console.log("PASS additive legacy migration: nullable instructions, every existing agent field and unrelated table preserved");
} finally {
  await server?.cleanup();
  const target = resolve(directory);
  assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith(`eduai-${label}-`));
  rmSync(target, { recursive: true, force: true });
  const current = JSON.parse(readFileSync(configPath, "utf8"));
  current.include = current.include.filter(path => !path.startsWith(`.next-${label}-`) || initialConfig.include.includes(path));
  writeFileSync(configPath, JSON.stringify(current, null, 2) + "\n");
  if (readFileSync(envPath, "utf8").includes(`.next-${label}-`)) writeFileSync(envPath, initialEnv);
}
