// H9 · 35 枚数字徽章资产批量生成器（gpt-image-2）。
//
// 与 gen-portal-art.mjs 的关系：同一网关与体积纪律，但画风约束不同——
// 徽章资产经用户 2026-08-20 明示授权走「原创卡通拟人」路线（解除 §6.4-4 默认禁拟人，
// 仅限本批徽章资产；门户美术仍守纯几何）。仍然：不临摹任何在售 IP（Duolingo 猫头鹰、
// B站小电视等）、图内禁文字、禁真人相似、登记进 public/art/REGISTRY.md。
//
// 网关实测（2026-08-20 探针）：background:"transparent" 被忽略（返回 RGB 无 alpha），
// 抠图走「纯白底 + 边缘泛洪去底」：从四边 BFS 连通近白区置透明，内部白高光不受影响；
// 1024 抠图后再缩 320，重采样自然羽化边缘。
//
// 用法：node scripts/gen-badge-art.mjs            # 按 spec 批量（已存在的跳过，可断点续跑）
//       node scripts/gen-badge-art.mjs quiz-1     # 只生成指定 id（强制重生成）
//       node scripts/gen-badge-art.mjs --post-test <png>  # 只测后处理管线
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import sharp from "sharp";

const OUT_DIR = "public/art/badges";
const RAW_DIR = "_badge-raw";
const SPEC = JSON.parse(readFileSync("scripts/badge-art-spec.json", "utf8"));

// ── 后处理：泛洪抠图（连通白底→透明）→ 按 alpha 裁边 → 320px webp ≤150KB ──
async function cutoutAndCompress(rawBuf, outFile) {
  const T = 232; // 近白阈值：三通道全 ≥T 视为背景候选（星芒纯白在内部，不与边缘连通，安全）
  const { data, info } = await sharp(rawBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const isBg = (i) => data[i] >= T && data[i + 1] >= T && data[i + 2] >= T;
  const visited = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (!isBg(i)) continue;
    data[i + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  // 去白边晕圈：紧贴透明区的近白像素 alpha 减半（只碰边界近白，不动主体）
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : data[(y * W + x) * 4 + 3];
  const soft = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] === 0) continue;
      const nearWhite = data[i] >= 210 && data[i + 1] >= 210 && data[i + 2] >= 210;
      if (nearWhite && (alphaAt(x - 1, y) === 0 || alphaAt(x + 1, y) === 0 || alphaAt(x, y - 1) === 0 || alphaAt(x, y + 1) === 0)) {
        soft.push(i);
      }
    }
  }
  for (const i of soft) data[i + 3] = 96;
  const cutBuf = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const trimmed = sharp(cutBuf).trim({ threshold: 8 });
  let q = 82, size = Infinity;
  while (q >= 45) {
    await trimmed.clone().resize({ width: 320, height: 320, fit: "inside" }).webp({ quality: q }).toFile(outFile);
    size = statSync(outFile).size;
    if (size <= 150 * 1024) break;
    q -= 8;
  }
  return { size, q };
}

// ── 生成 ──
const env = readFileSync(".env.local", "utf8");
const KEY = (env.match(/^LLM_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error("未找到 LLM_API_KEY"); process.exit(1); }
const BASES = ["https://api.llm-token.cn/v1", "https://gpt-agent.cc/v1"];

async function gen(job, force) {
  const outFile = `${OUT_DIR}/${job.id}.webp`;
  if (!force && existsSync(outFile)) { console.log(`skip ${job.id} 已存在`); return { id: job.id, skipped: true }; }
  const t0 = Date.now();
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const base of BASES) {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 180_000);
        const res = await fetch(`${base}/images/generations`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
          body: JSON.stringify({ model: "gpt-image-2", prompt: job.prompt, size: "1024x1024", n: 1 }),
          signal: ctl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) { lastErr = `HTTP ${res.status} @ ${base}: ${(await res.text()).slice(0, 120)}`; continue; }
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) { lastErr = `空响应 @ ${base}`; continue; }
        const raw = Buffer.from(b64, "base64");
        mkdirSync(RAW_DIR, { recursive: true });
        writeFileSync(`${RAW_DIR}/${job.id}.png`, raw);
        mkdirSync(OUT_DIR, { recursive: true });
        const r = await cutoutAndCompress(raw, outFile);
        console.log(`ok ${job.id.padEnd(10)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s ${(r.size / 1024).toFixed(0).padStart(3)}KB q=${r.q}`);
        return { id: job.id, file: outFile, bytes: r.size, prompt: job.prompt };
      } catch (e) { lastErr = `${e.name}: ${String(e.message).slice(0, 80)} @ ${base}`; }
    }
  }
  console.log(`FAIL ${job.id}：${lastErr}`);
  return null;
}

// ── 入口 ──
if (process.argv[2] === "--post-test") {
  const raw = readFileSync(process.argv[3]);
  mkdirSync(OUT_DIR, { recursive: true });
  const r = await cutoutAndCompress(raw, `${OUT_DIR}/_post-test.webp`);
  console.log(`post-test -> ${OUT_DIR}/_post-test.webp ${(r.size / 1024).toFixed(0)}KB q=${r.q}`);
  process.exit(0);
}

const only = process.argv[2];
const jobs = only ? SPEC.jobs.filter((j) => j.id === only) : SPEC.jobs;
if (only && jobs.length === 0) { console.error(`spec 里没有 id=${only}`); process.exit(1); }
const CONC = 3;
const done = [];
let cursor = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const r = await gen(job, Boolean(only));
    if (r) done.push(r);
  }
}));
writeFileSync("_badge-gen-result.json", JSON.stringify(done, null, 2));
const fresh = done.filter((d) => !d.skipped);
console.log(`\n完成 ${fresh.length} 新生成 + ${done.length - fresh.length} 跳过 / 共 ${jobs.length}`);
