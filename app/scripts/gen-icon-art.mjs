// H14 · 学生端 3D 卡通图标批量生成器（gpt-image-2，与 gen-badge-art 同管线纪律）。
//
// 与徽章批的关键差别：**这批是无面孔的物件图标**。用户参考图里有带脸的图标，
// 但「带表情 或 动态元素」二者取其一即可，选后者（星芒/流动/漂浮）——
// 这样拟人授权例外继续锁在徽章吉祥物那 45 枚里，不因为换个图标就扩大范围。
// 仍然：图内禁文字、纯白底后抠图、≤150KB、登记进 REGISTRY.md。
//
// 用法：node scripts/gen-icon-art.mjs           # 全量（已存在跳过，可断点续跑）
//       node scripts/gen-icon-art.mjs nav-home  # 单个强制重生成
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import sharp from "sharp";

const OUT_DIR = "public/art/icons";
const RAW_DIR = "_badge-raw";

// 全批共用的画风锁。逐字不变，只换 SUBJECT——35 枚徽章的一致性就是这么来的。
const STYLE = [
  "A single 3D cartoon app icon, glossy soft-plastic (jelly/clay hybrid) material, chunky rounded forms with thick soft edges, high-saturation kid-friendly colors.",
  "Soft studio key light from the upper-left with a crisp specular highlight on the top surface, gentle ambient occlusion underneath, no harsh reflections.",
  "Centered composition, the icon occupying about 78% of the frame, straight-on three-quarter-front view, at most 3 levels of detail so it stays readable at 32px.",
  "STRICTLY an object icon: NO faces, NO eyes, NO mouths, NO characters, NO mascots, NO human figures, NO hands.",
  "NO text, NO letters, NO numbers, NO logos, NO watermarks anywhere in the image.",
  "SMALL-SIZE FIRST (this icon must stay readable at 26px): bold simple silhouette, large color blocks, strong value contrast against a white page, no hairline details, no tick marks, no thin connector strokes, at most ONE small sparkle (prefer none).",
  "Pure white #FFFFFF background, no background scenery, no cast shadow or drop shadow on the background.",
].join(" ");

const JOBS = [
  { id: "nav-home", subject: "a cozy rounded little house with a warm coral-red roof and a soft cream body, and ONE plain amber rectangular window with NO mullions and NO cross-shaped dividers, no chimney details" },
  { id: "nav-chat", subject: "two overlapping rounded speech bubbles, the front one violet #8B5CF6 and the back one sky blue #3B82F6, with three small four-pointed sparkles drifting off the top-right corner" },
  { id: "nav-tools", subject: "a chunky open toolbox with a warm amber-orange body and a teal handle, with one blue wrench and one grey gear resting inside, no magic wand, no star" },
  { id: "nav-growth", subject: "a chubby green sprout with two rounded leaves growing out of a soft terracotta pot, with a tiny golden star hovering over the topmost leaf" },
  { id: "nav-badge", subject: "a glossy golden medal disc with a scalloped edge and a short violet ribbon folded beneath it, one small star embossed in the center, sparkles at the upper-left" },
  { id: "nav-manor", subject: "a small floating island of grass on a rounded soil base with ONE stylized round tree in a distinctly darker green than the grass, and one bright teal pond; no shrubs, no scattered rocks, no orbiting light band" },
  { id: "nav-project", subject: "a rounded clipboard with a warm amber-orange board, a cream sheet of blank paper (no writing) and a chunky teal clip at the top, one star sparkle at the corner" },
  { id: "codex-book", subject: "an open book with thick rounded violet #7C3AED covers and cream pages that are completely blank, with a golden four-pointed star and two smaller sparkles rising from the center gutter" },
  { id: "action-ask", subject: "a plump rounded question-mark glyph rendered as a glossy violet-to-pink gradient 3D object standing on a small round base, with two tiny sparkles beside it" },
  { id: "nav-mindmap", subject: "a simple mind-map diagram: one large cobalt-blue rounded node on the left connected by THREE thick short deep-teal branches to three smaller rounded nodes on the right (amber, coral, green), branches as thick as the small nodes are wide" },
  { id: "nav-image", subject: "a rounded artist palette in cream with three thick unmixed blobs of paint (cobalt blue, coral, lemon) and a short stubby brush with a blue-tipped bristle resting across it" },
  { id: "nav-summary", subject: "a neat stack of three thick cream paper sheets with the top sheet's corner folded, the page lines shortening line by line to suggest condensing, one small violet sparkle at the upper-right" },
  { id: "nav-knowledge", subject: "a small stack of two closed hardcover books lying flat, the lower one teal and the upper one warm amber with a cream page block and a coral fabric bookmark ribbon hanging out, one tiny sparkle above" },
  { id: "nav-explore", subject: "a chubby round compass with a warm AMBER-ORANGE body and a cream face, ONE single thick solid cobalt-blue needle pointing to the upper-right (single colour only, NOT red-and-white), absolutely no tick marks, no secondary needle, no hanging ring" },
  { id: "progress-gem", subject: "a faceted teardrop gem in a violet-to-pink gradient with a bright specular highlight, resting at a slight tilt, ringed by three small four-pointed sparkles" },
];

const env = readFileSync(".env.local", "utf8");
const KEY = (env.match(/^LLM_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error("未找到 LLM_API_KEY"); process.exit(1); }
const BASES = ["https://api.llm-token.cn/v1", "https://gpt-agent.cc/v1"];

async function cutout(rawBuf, outFile) {
  const T = 232;
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
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : data[(y * W + x) * 4 + 3];
  const soft = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] === 0) continue;
      if (data[i] >= 210 && data[i + 1] >= 210 && data[i + 2] >= 210 &&
          (alphaAt(x - 1, y) === 0 || alphaAt(x + 1, y) === 0 || alphaAt(x, y - 1) === 0 || alphaAt(x, y + 1) === 0)) soft.push(i);
    }
  }
  for (const i of soft) data[i + 3] = 96;
  const buf = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const trimmed = sharp(buf).trim({ threshold: 8 });
  let q = 84, size = Infinity;
  while (q >= 45) {
    await trimmed.clone().resize({ width: 256, height: 256, fit: "inside" }).webp({ quality: q }).toFile(outFile);
    size = statSync(outFile).size;
    if (size <= 150 * 1024) break;
    q -= 8;
  }
  return { size, q };
}

async function gen(job, force) {
  const outFile = `${OUT_DIR}/${job.id}.webp`;
  if (!force && existsSync(outFile)) { console.log(`skip ${job.id} 已存在`); return { id: job.id, skipped: true }; }
  const prompt = `${STYLE} Subject: ${job.subject}.`;
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
          body: JSON.stringify({ model: "gpt-image-2", prompt, size: "1024x1024", n: 1 }),
          signal: ctl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) { lastErr = `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`; continue; }
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) { lastErr = "空响应"; continue; }
        const raw = Buffer.from(b64, "base64");
        mkdirSync(RAW_DIR, { recursive: true });
        writeFileSync(`${RAW_DIR}/icon-${job.id}.png`, raw);
        mkdirSync(OUT_DIR, { recursive: true });
        const r = await cutout(raw, outFile);
        console.log(`ok ${job.id.padEnd(13)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s ${(r.size / 1024).toFixed(0).padStart(3)}KB q=${r.q}`);
        return { id: job.id, file: outFile, bytes: r.size, prompt };
      } catch (e) { lastErr = `${e.name}: ${String(e.message).slice(0, 80)}`; }
    }
  }
  console.log(`FAIL ${job.id}：${lastErr}`);
  return null;
}

const only = process.argv[2];
const jobs = only ? JOBS.filter((j) => j.id === only) : JOBS;
if (only && jobs.length === 0) { console.error(`没有 id=${only}`); process.exit(1); }
const CONC = 3;
const done = [];
let cursor = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (cursor < jobs.length) {
    const r = await gen(jobs[cursor++], Boolean(only));
    if (r) done.push(r);
  }
}));
const fresh = done.filter((d) => !d.skipped);
console.log(`\n完成 ${fresh.length} 新生成 + ${done.length - fresh.length} 跳过 / 共 ${jobs.length}`);
