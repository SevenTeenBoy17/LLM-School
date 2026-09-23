// 门户媒体素材生成器（gpt-image-2）。
//
// 纪律（本项目既有约束，非本次新增）：
//  · §6.4-4 默认路径：**不生成任何拟人化形象**——无人、无脸、无吉祥物。纯几何/抽象。
//  · 不复刻任何在售产品的具体美术资产；同类型同画风指的是**体裁**（扁平矢量/几何），不是临摹。
//  · 生成图不得承载唯一信息，必须有文字等价物与 alt。
//  · 压 WebP ≤150KB，并登记进 public/art/REGISTRY.md 七项。
//
// 用法：node scripts/gen-portal-art.mjs <key>   （key ∈ hero/roles/safety/og；不传则生成全部）
//
// 为什么保留这个脚本而不是用完即删：它是**唯一**能按同一套画风约束重新生成
// 门户美术的可执行路径——STYLE 常量里的禁人形/锁色板/禁文字约束，和「逐档降质
// 收敛到 ≤150KB」的体积纪律都固化在这里。改 prompt 重生成时从这里改，
// 并同步更新 public/art/REGISTRY.md 的完整 prompt 留存（G10 门会查登记）。
// 密钥从 .env.local 运行时读取，不落在本文件。
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import sharp from "sharp";

// 读 .env.local 取密钥（脚本不经 Next 运行时）
const env = readFileSync(".env.local", "utf8");
const KEY = (env.match(/^LLM_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error("未找到 LLM_API_KEY"); process.exit(1); }

const BASES = ["https://api.llm-token.cn/v1", "https://gpt-agent.cc/v1"];

/** 共用画风约束——写在每条 prompt 前，保证四张出图属于同一套视觉语言。 */
const STYLE = [
  "Flat vector editorial illustration, geometric abstraction, clean crisp edges, no gradients banding.",
  "STRICTLY NO people, NO faces, NO human figures, NO mascots, NO characters, NO hands, NO body parts.",
  "NO text, NO letters, NO numbers, NO logos, NO watermarks anywhere in the image.",
  "Palette locked to: deep indigo #1E1B4B, indigo #312E81, cobalt blue #2563EB, cyan #06B6D4, warm cream #FFFDF6.",
  "Composition is calm and spacious with generous negative space, suitable as a background behind text.",
  "Style reference genre: modern SaaS product marketing illustration, minimal, precise, non-decorative.",
].join(" ");

const JOBS = {
  hero: {
    size: "1536x1024",
    out: "portal-hero",
    prompt: `${STYLE} Subject: a single beam of light entering a translucent prism and separating into four parallel bands of graduated blue, arranged diagonally across a deep indigo field. Thin concentric orbital arcs in the background at very low opacity. The four bands must NOT be rainbow colored — only shades within the locked blue palette.`,
    alt: "抽象几何：一束光穿过棱镜分成四道蓝色光带",
    why: "首屏背景美术（替代原 CSS 棱镜）",
  },
  roles: {
    size: "1536x1024",
    out: "portal-roles",
    prompt: `${STYLE} Subject: three tall rounded archways of different heights standing side by side on a warm cream background, each archway outlined in a different shade from the locked palette, with soft geometric floor shadows. Empty archways — nothing inside them. Flat, front-facing, symmetrical.`,
    alt: "抽象几何：三道并排的拱门，代表三种角色入口",
    why: "三角色入口区背景",
  },
  safety: {
    size: "1536x1024",
    out: "portal-safety",
    prompt: `${STYLE} Subject: a rounded shield shape formed by an interlocking lattice of thin lines, centered on a warm cream field, with a soft protective halo. Inside the shield only geometric lattice — no emblem, no symbol, no icon. Calm and reassuring, not military.`,
    alt: "抽象几何：由细线网格构成的盾形轮廓",
    why: "安全与隐私区背景",
  },
  og: {
    size: "1536x1024",
    out: "portal-og",
    prompt: `${STYLE} Subject: a wide horizontal composition — deep indigo left two-thirds fading into warm cream right third, with the prism-and-light-bands motif small in the lower right and thin orbital arcs sweeping across. Mostly empty space in the upper left where a title would sit.`,
    alt: "抽象几何：深靛到暖奶油的横向构图，右下角有棱镜分光母题",
    why: "社交分享预览图（og:image）",
  },

  // ── 第二批（能力卡点缀插图 ×6 + 页脚 CTA 带）─────────────────────────────
  // 每张一个**独立的几何母题**对应一项真实能力；仍然禁人形/禁文字/锁色板。
  // 方形出图、显示时装进 --bg 底的圆角框——生成图的底色总有漂移，
  // 框出来读作「刻意的画框」，贴白卡上读作「底色没对齐」。
  "spot-chat": {
    size: "1024x1024", out: "spot-chat", w: 640,
    prompt: `${STYLE} Subject: two overlapping rounded speech-bubble outlines, one cobalt one cyan, with three small orbit dots arcing between them, centered on a warm cream field. Pure geometry, generous margin.`,
    alt: "", why: "能力卡点缀：AI 对话（双气泡与轨道点）",
  },
  "spot-prompts": {
    size: "1024x1024", out: "spot-prompts", w: 640,
    prompt: `${STYLE} Subject: a fanned stack of three rounded rectangle cards in graduated blues with a single four-point geometric sparkle above the top card, centered on a warm cream field.`,
    alt: "", why: "能力卡点缀：提示词库（扇形卡叠与星芒）",
  },
  "spot-knowledge": {
    size: "1024x1024", out: "spot-knowledge", w: 640,
    prompt: `${STYLE} Subject: an open book built from flat folded geometric planes, with three thin light rays rising from its spine, centered on a warm cream field. No letters on the pages — blank planes only.`,
    alt: "", why: "能力卡点缀：知识库（几何折面书与光线）",
  },
  "spot-agents": {
    size: "1024x1024", out: "spot-agents", w: 640,
    prompt: `${STYLE} Subject: three hexagonal modules in different blues connected by thin lines into a small triangular network, one node glowing softly, centered on a warm cream field.`,
    alt: "", why: "能力卡点缀：智能体（六边形模块网络）",
  },
  "spot-imagegen": {
    size: "1024x1024", out: "spot-imagegen", w: 640,
    prompt: `${STYLE} Subject: two overlapping translucent rounded rectangles like picture frames, with a small prism triangle at their corner emitting two short bands of blue, centered on a warm cream field.`,
    alt: "", why: "能力卡点缀：AI 生图（画框与小棱镜）",
  },
  "spot-growth": {
    size: "1024x1024", out: "spot-growth", w: 640,
    prompt: `${STYLE} Subject: three ascending rounded step blocks in graduated blues with a single thin arc curving upward past them, centered on a warm cream field. Abstract, no chart axes, no numbers.`,
    alt: "", why: "能力卡点缀：成长记录（上升台阶与弧线）",
  },
  cta: {
    size: "1536x1024", out: "portal-cta", w: 1400,
    prompt: `${STYLE} Subject: a wide deep-indigo band where four thin light bands in graduated blues converge gently from both edges toward the empty center, echoing a prism motif; very subtle orbital arcs in the background. The center third must stay dark and empty — a button will sit there.`,
    alt: "", why: "页脚 CTA 带背景（光带向中心汇聚，中央留暗区放按钮）",
  },
};

async function gen(key) {
  const j = JOBS[key];
  const t0 = Date.now();
  let lastErr = null;
  for (const base of BASES) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 180_000);
      const res = await fetch(`${base}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: "gpt-image-2", prompt: j.prompt, size: j.size, n: 1 }),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { lastErr = `HTTP ${res.status} @ ${base}: ${(await res.text()).slice(0, 160)}`; continue; }
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) { lastErr = `空响应 @ ${base}: ${JSON.stringify(data).slice(0, 200)}`; continue; }
      mkdirSync("public/art", { recursive: true });
      const raw = Buffer.from(b64, "base64");
      const to = `public/art/${j.out}.webp`;
      let q = 82, size = Infinity;
      while (q >= 45) {
        await sharp(raw).resize({ width: j.w ?? 1400 }).webp({ quality: q }).toFile(to);
        size = statSync(to).size;
        if (size <= 150 * 1024) break;
        q -= 8;
      }
      console.log(`✓ ${key.padEnd(7)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s  ${(size / 1024).toFixed(0).padStart(3)}KB (q=${q})  ${base.includes("llm-token") ? "国内" : "备用"}`);
      return { key, file: to, ...j, bytes: size };
    } catch (e) { lastErr = `${e.name}: ${e.message} @ ${base}`; }
  }
  console.log(`✗ ${key} 失败：${lastErr}`);
  return null;
}

const only = process.argv[2];
const keys = only ? [only] : Object.keys(JOBS);
const done = [];
for (const k of keys) { const r = await gen(k); if (r) done.push(r); }
writeFileSync("_gen-result.json", JSON.stringify(done, null, 2));
console.log(`\n完成 ${done.length}/${keys.length}`);
