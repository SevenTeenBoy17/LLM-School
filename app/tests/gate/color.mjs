#!/usr/bin/env node
/**
 * 色彩迁移棘轮门（方案 §3.1 R1③ / §4.4）
 *
 * 为什么是**棘轮**而不是「命中数 = 0」：
 * 全站还有 80 处裸渐变与 300+ 处裸 hex，一次改完不现实。若直接把门写成 =0，
 * 它会长期红着——门长期红等于没有门，最终会被 --skip 掉；若为了让它绿而加大片豁免，
 * 那就是我在本项目已经犯过三次的「结构上无法失败的门」。
 *
 * 棘轮的语义是诚实的：**不宣称已归零，但保证每一批迁移都不回流**。
 *   · 已迁移区（mustBeZero）必须严格为 0——回填一处就 FAIL
 *   · 全局计数只许降不许升——新增一处裸色就 FAIL
 *   · 计数下降时提示更新基线，把进度锁进仓库
 *
 * 口径与 §4.4 一致：**全文件扫描**，不限定 className/style 上下文——
 * 否则把内联渐变搬进常量表就能让门变绿，而运行时颜色分毫未变。
 *
 * 用法：npm run gate:color
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE = join(APP_ROOT, "tests", "gate", "color-baseline.json");
const base = JSON.parse(readFileSync(BASELINE, "utf8"));

const SKIP = new Set(["node_modules", ".next", "tests", ".data"]);
const CANVAS = new Set(base.canvasExcluded.files);
const MUST_ZERO = new Set(base.mustBeZero);

const counts = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.tsx?$/.test(p)) continue;
    const rel = p.slice(APP_ROOT.length + 1).split(sep).join("/");
    if (rel.endsWith("gradientKeys.ts")) continue;
    const src = readFileSync(p, "utf8");
    // **裸**渐变 = 色标里含 hex 字面量的那种。`linear-gradient(135deg,var(--info),var(--ok))`
    // 已经走令牌，是合规实现，不该被计为违规——否则门会把正确写法也一起逼着改
    // （admin/analytics 的 6 条全是令牌渐变，却被上一版算成裸渐变）。
    // 这是**口径修正**，与迁移带来的下降必须分开报告，否则等于用改口径粉饰进度。
    const g = (src.match(/linear-gradient\([^)]*#[0-9A-Fa-f]{3,8}[^)]*\)/g) || []).length;
    const h = (src.match(/#[0-9A-Fa-f]{3,8}\b/g) || []).length;
    if (g || h) counts[rel] = { gradients: g, hex: h };
  }
};
for (const root of ["app", "components", "lib"]) walk(join(APP_ROOT, root));

const sum = (pick) => Object.entries(counts).reduce((n, [k, v]) => (CANVAS.has(k) ? n : n + v[pick]), 0);
const nowG = sum("gradients"), nowH = sum("hex");

const results = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  if (!ok) failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
};

console.log("色彩迁移棘轮 · 口径 = 全文件扫描（不限 className/style）");
console.log(`\nC1 · 已迁移区必须严格为 0`);
for (const f of MUST_ZERO) {
  const v = counts[f] || { gradients: 0, hex: 0 };
  check(`${f} 无裸色`, v.gradients === 0 && v.hex === 0, `渐变 ${v.gradients} / hex ${v.hex}`);
}

console.log(`\nC2 · 全局棘轮（只许降不许升）`);
check(`裸渐变 ≤ 基线 ${base.counted.gradients}`, nowG <= base.counted.gradients, `实测 ${nowG}`);
check(`裸 hex ≤ 基线 ${base.counted.hex}`, nowH <= base.counted.hex, `实测 ${nowH}`);

if (nowG < base.counted.gradients || nowH < base.counted.hex) {
  console.log(`\n  ↓ 计数已下降（渐变 ${base.counted.gradients}→${nowG} / hex ${base.counted.hex}→${nowH}）。`);
  if (process.env.UPDATE_COLOR_BASELINE === "1") {
    base.counted = { gradients: nowG, hex: nowH };
    base.recordedAt = new Date().toISOString().slice(0, 10);
    writeFileSync(BASELINE, JSON.stringify(base, null, 2) + "\n");
    console.log("  已写回基线（UPDATE_COLOR_BASELINE=1）。");
  } else {
    console.log("  用 UPDATE_COLOR_BASELINE=1 npm run gate:color 把进度锁进基线。");
  }
}

console.log(`\nC3 · 色板定义文件不得成为倾倒后门`);
// gradientKeys.ts 被排除在扫描外（它是色板唯一定义处，与 globals.css 令牌区同性质）。
// 若不设上限，「把颜色搬进 gradientKeys.ts」就成了绕过棘轮最省力的路径——
// 与「把内联渐变搬进常量表」是同一种规避，必须一并堵死。
{
  const raw = readFileSync(join(APP_ROOT, "lib", "data", "gradientKeys.ts"), "utf8");
  // 排除 MIGRATION-ONLY 区：那是「历史值 → 枚举键」的映射正则，迁移完成即整块删除，不属色板。
  // 用标记精确排除，而不是把上限抬到 18 蒙混——后者会让这道门失去约束力。
  const src = raw.replace(/MIGRATION-ONLY:START[\s\S]*?MIGRATION-ONLY:END/g, "");
  const hex = (src.match(/#[0-9A-Fa-f]{3,8}\b/g) || []).length;
  const CAP = 14; // GRADIENT_CSS 4 键 × 2 色标 + CHART_PALETTE 6
  check(`色板文件 hex 数 ≤ ${CAP}`, hex <= CAP, `实测 ${hex}`);
}

console.log(`\nC5 · 禁止 var(--令牌, 字面量) 兜底写法`);
// 为什么单列一条：这种写法**两头不落好**。
//   · 令牌若未定义（本项目实测有过 --danger-ink / --warn-border 两个），真正生效的是那个
//     字面量，而代码读起来像是走了令牌治理；
//   · grep `var(--` 会把它算成「已迁移」，于是治理进度被系统性高估；
//   · **没有任何东西会报错**——令牌拼错、被删、换名，页面都照常显示兜底色。
// 换句话说它是一条**能骗过自己的**写法，与本门要防的「搬家式假降」同类。
// 正确做法：令牌存在就直接用；不存在就先在 globals.css 里定义出来，而不是就地塞个字面量。
{
  const offenders = [];
  const scanFallback = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || name.startsWith(".")) continue;
      const fp = join(dir, name);
      if (statSync(fp).isDirectory()) { scanFallback(fp); continue; }
      if (!/\.tsx?$/.test(fp)) continue;
      const rel = fp.slice(APP_ROOT.length + 1).split(sep).join("/");
      const src = readFileSync(fp, "utf8");
      for (const m of src.matchAll(/var\(\s*--[A-Za-z0-9-]+\s*,\s*(?:#[0-9A-Fa-f]{3,8}|rgba?\()/g)) {
        offenders.push(`${rel} :: ${m[0].slice(0, 48)}`);
      }
    }
  };
  for (const root of ["app", "components", "lib"]) scanFallback(join(APP_ROOT, root));
  check("无 var(--令牌, 字面量) 兜底", offenders.length === 0, offenders.length ? offenders.slice(0, 4).join(" | ") : "0 处");
}


console.log(`\nC6 · 令牌层不得留存已废弃的厂牌色`);
// 为什么需要这一条：本门只扫 `.tsx?`，**不扫 CSS**。
// 第六批把 models.ts 的厂牌色迁到 MODEL_PALETTE 之后，globals.css 里仍原样躺着 8 个
// `--m-chatgpt / --m-claude / --m-gemini-*` 令牌（全部零引用）。
// 也就是说「厂牌色已清零」这句话在源码层成立、在令牌层不成立——**清的是指标不是问题**。
// 这条断言把扫描盲区补上：厂牌色值一旦回到令牌层就 FAIL。
// 判据用**具体色值**而非变量名：改个名字（--brand-a）就绕过的断言等于没有断言。
{
  const BRAND_HEX = ["10A37F", "D97757", "4285F4", "2DD4BF"]; // OpenAI 绿 / Anthropic 陶土 / Google 蓝 / OpenAI 副色
  const css = readFileSync(join(APP_ROOT, "app", "globals.css"), "utf8");
  // 用 includes 而不是正则。首版写的是 new RegExp(`#${h}\b`, "i")——但在**模板字面量**里
  // `\b` 会被解析成**退格控制符 U+0008**，不是正则的单词边界（那需要写 `\\b`）。
  // 于是正则实际是 `#D97757␈`，永远匹配不上：注入了厂牌色它照样 PASS，
  // 是一道**结构上无法失败的门**。首次注入验证给出的 PASS 就是这么来的。
  //
  // 稳妥的修法不是把转义写对，而是让它**不需要转义**。
  const lower = css.toLowerCase();
  const hits = BRAND_HEX.filter((h) => lower.includes("#" + h.toLowerCase()));
  check("globals.css 无厂牌色残留", hits.length === 0, hits.length ? `残留 ${hits.join(",")}` : "0 处");
}


console.log(`\nC4 · 剩余分布（前 5，供下一批迁移取靶）`);
const top = Object.entries(counts).filter(([k]) => !CANVAS.has(k))
  .sort((a, b) => (b[1].gradients * 10 + b[1].hex) - (a[1].gradients * 10 + a[1].hex)).slice(0, 5);
for (const [k, v] of top) console.log(`    ${k} — 渐变 ${v.gradients} / hex ${v.hex}`);

console.log(`\n────────────────────────────────\n${results.length - failed}/${results.length} PASS${failed ? ` · ${failed} FAIL` : ""}`);
process.exit(failed ? 1 : 0);
