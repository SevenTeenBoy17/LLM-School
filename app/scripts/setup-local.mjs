import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const mode = process.argv[2];
if (!['demo', 'production'].includes(mode)) {
  console.error('Usage: node scripts/setup-local.mjs demo|production');
  process.exit(1);
}
if (Number(process.versions.node.split('.')[0]) !== 24) {
  console.error('Node.js 24.x is required. No configuration was written.');
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, '.env.local');
if (existsSync(target)) {
  console.error('.env.local already exists. Review and back it up yourself; it was NOT overwritten.');
  process.exit(1);
}
const production = mode === 'production';
const dataDirectory = production ? '.data-production' : '.data-demo';
const lines = [
  '# Local-only configuration. Never commit or share this file.',
  `EDUAI_SESSION_SECRET=${randomBytes(48).toString('base64url')}`,
  `EDUAI_ENABLE_DEMO_SEED=${!production}`,
  `EDUAI_DB_DIR=${dataDirectory}`,
  `EDUAI_ASSET_DIR=${dataDirectory}`,
  ...(production ? ['EDUAI_BOOTSTRAP_ADMIN_USERNAME=school-admin',
    `EDUAI_BOOTSTRAP_ADMIN_PASSWORD=${randomBytes(24).toString('base64url')}`,
    'EDUAI_BOOTSTRAP_ADMIN_NAME=School Administrator'] : []),
  '# Remote production access requires HTTPS and your public origin.',
  '# EDUAI_PUBLIC_ORIGIN=https://edu.example.edu.cn',
  'LLM_API_KEY=',
  'LLM_BASE_URL=https://api.llm-token.cn/v1',
  'LLM_IMAGE_API_KEY=',
  'LLM_IMAGE_BASE_URL=https://api.llm-token.cn/v1',
  'EDUAI_LLM_ALLOWED_ORIGINS=https://api.llm-token.cn,https://gpt-agent.cc',
  'EDUAI_IMAGE_MODEL=gpt-image-2',
];
writeFileSync(target, lines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Created ${mode} configuration in app/.env.local. Data directory: ${dataDirectory}.`);
if (production) console.log('Read the generated administrator credentials in your local .env.local. They are not printed to logs.');
else console.log('Local demo only. Run npm run dev -- --hostname 127.0.0.1 --port 4921.');
