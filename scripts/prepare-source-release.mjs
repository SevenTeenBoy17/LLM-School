import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Export current source without inheriting local Git history or private data.
const root = path.resolve(import.meta.dirname, '..');
const destination = process.argv[2] && path.resolve(process.argv[2]);
if (destination && (destination === root || destination.startsWith(root + path.sep) || existsSync(destination))) {
  throw new Error('Destination must be a NEW directory outside the project.');
}
const candidates = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: root, maxBuffer: 32 * 1024 * 1024,
}).toString('utf8').split('\0').filter(Boolean))].sort();
const blockedParts = new Set(['.git', '.data', '.data-backup', '.agent-supervisor', '.codex-supervisor',
  '.claude', '.code-review-graph', '.vercel', '.publish', 'node_modules', 'test-results', 'coverage',
  'uploads', '_legacy', '_badge-raw', 'state', '参考资产隔离', 'QQNCmini-审计资产']);
const secrets = [
  ['api-key', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['aws-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/g],
  ['credential-url', /https?:\/\/[^\s/@:]+:[^\s/@]{8,}@/g],
];
const included = [], excluded = [], findings = [];
for (const file of candidates) {
  const parts = file.split('/');
  const name = parts.at(-1);
  let reason = parts.some(part => blockedParts.has(part) || part.startsWith('.next')) ? 'local-data-cache-or-reference' : '';
  if (/^\.env/.test(name) && name !== '.env.example') reason = 'environment-secret';
  if (/\.(?:sqlite(?:3)?(?:-wal|-shm)?|db|zip|7z|rar|exe|dll|swf|log|pem|key|tsbuildinfo)$/i.test(name)) reason = 'database-archive-executable-or-log';
  if (file.startsWith('app/tests/artifacts/')) reason = 'local-test-evidence';
  // Keep design documents; raw inspirations and original captures are not needed to run the app.
  if (/^(?:参考UI图|设计资产样例)\//.test(file)) reason = 'reference-media';
  if (file.startsWith('开发材料/') && !/\.(?:md|txt|json|py|js|mjs|ts|html|css)$/i.test(file)) reason = 'design-reference-media';
  const absolute = path.join(root, file);
  if (!existsSync(absolute)) reason = 'deleted-from-current-tree';
  if (reason) { excluded.push({ path: file, reason }); continue; }
  const stat = lstatSync(absolute);
  if (!stat.isFile()) { findings.push({ path: file, rule: 'not-regular-file' }); continue; }
  if (stat.size >= 100 * 1024 * 1024) findings.push({ path: file, rule: 'github-file-size-limit' });
  const bytes = readFileSync(absolute);
  if (!bytes.subarray(0, 8192).includes(0)) {
    const body = bytes.toString('utf8');
    for (const [rule, pattern] of secrets) {
      for (const match of body.matchAll(pattern)) {
        if (file === 'app/tests/paper-studio.mjs' && rule === 'credential-url' && match[0] === ['https://user:', 'password@'].join('')) continue;
        findings.push({ path: file, rule, line: body.slice(0, match.index).split('\n').length });
      }
    }
  }
  included.push({ path: file, bytes: stat.size, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const report = { createdAt: new Date().toISOString(), sourceRoot: root, destination: destination ?? null,
  files: included.length, bytes: included.reduce((n, f) => n + f.bytes, 0),
  excludedCount: excluded.length, findings, included, excluded };
mkdirSync(path.join(root, '.publish'), { recursive: true });
writeFileSync(path.join(root, '.publish', 'source-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ files: report.files, bytes: report.bytes, excludedCount: report.excludedCount, findings,
  largest: [...included].sort((a,b) => b.bytes-a.bytes).slice(0,12) }, null, 2));
if (findings.length) process.exitCode = 1;
else if (destination) {
  for (const file of included) {
    const target = path.join(destination, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(root, file.path), target);
  }
  console.log(`Exported ${included.length} files to ${destination}`);
}
