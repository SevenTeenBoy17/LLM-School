// H13 · 荣誉展示板底图生成器（gpt-image-2，与 gen-badge-art 同管线纪律）。
// 板子是纯物件（无拟人形象，不动用徽章批的拟人授权例外）；图内禁文字禁徽章，
// 空板由 UI 层往上挂已获得徽章。白底泛洪抠图保圆角透明，1400px webp ≤150KB，
// 登记进 public/art/REGISTRY.md。用法：node scripts/gen-board-art.mjs
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import sharp from "sharp";

const env = readFileSync(".env.local", "utf8");
const KEY = (env.match(/^LLM_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error("未找到 LLM_API_KEY"); process.exit(1); }
const BASES = ["https://api.llm-token.cn/v1", "https://gpt-agent.cc/v1"];

const PROMPT = [
  "An empty wooden display board for a children's achievement badge collection, viewed perfectly straight-on (flat frontal view, no perspective).",
  "Warm honey-yellow polished wood with a soft matte finish, rounded-rectangle plaque shape, landscape orientation filling most of the canvas.",
  "A gently carved decorative border frame around the edge with tiny star and planet motifs carved into the four corners, one small rounded wooden crest at the top center.",
  "The inner panel is completely FLAT and EMPTY with a subtle darker vignette toward the edges and very soft wood grain — nothing hangs on it, no shelves, no hooks, no badges, no objects.",
  "Cute soft-clay 3D render style matching a kids app, soft studio key light from the upper-left, at most 3 levels of detail, high-quality and premium but playful.",
  "STRICT: no text, no letters, no numbers, no logos anywhere. Pure white #FFFFFF background around the plaque, no cast shadow or drop shadow on the background.",
].join(" ");

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
  const buf = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const trimmed = sharp(buf).trim({ threshold: 8 });
  let q = 82, size = Infinity;
  while (q >= 45) {
    await trimmed.clone().resize({ width: 1400 }).webp({ quality: q }).toFile(outFile);
    size = statSync(outFile).size;
    if (size <= 150 * 1024) break;
    q -= 8;
  }
  return { size, q };
}

const t0 = Date.now();
let lastErr = null;
for (const base of BASES) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 180_000);
    const res = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: "gpt-image-2", prompt: PROMPT, size: "1536x1024", n: 1 }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) { lastErr = `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`; continue; }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) { lastErr = "空响应"; continue; }
    const raw = Buffer.from(b64, "base64");
    mkdirSync("_badge-raw", { recursive: true });
    writeFileSync("_badge-raw/badge-board.png", raw);
    const r = await cutout(raw, "public/art/badge-board.webp");
    console.log(`ok badge-board ${((Date.now() - t0) / 1000).toFixed(0)}s ${(r.size / 1024).toFixed(0)}KB q=${r.q}`);
    process.exit(0);
  } catch (e) { lastErr = `${e.name}: ${String(e.message).slice(0, 80)}`; }
}
console.log(`FAIL badge-board：${lastErr}`);
process.exit(1);
