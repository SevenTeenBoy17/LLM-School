// /portal 三档视口实测：横向溢出 / tab 交互 / 锚点跳转 / 控制台错误 + 出图
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * 服务端地址。**必须走 BASE 环境变量**——此前这里硬编码 http://localhost:3000，
 * 而项目的 dev-server 端口被占用时会自动改端口，于是 `BASE=... npm run check` 跑到这一道
 * 就连不上、整条链断在此处，后面的 visual.mjs 根本没机会执行。
 * 这个缺陷潜伏了很久——因为平时都是单独跑各道门，从没真正跑过默认命令。
 */
const BASE = process.env.BASE || "http://localhost:3000";

const OUT = "tests/artifacts/portal";
mkdirSync(OUT, { recursive: true });
const VPS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
];

const browser = await chromium.launch();
let fail = 0;
const ck = (ok, msg) => { if (!ok) fail++; console.log(`  [${ok ? "PASS" : "FAIL"}] ${msg}`); };

/**
 * 实心主动作按钮的对比度审计（/portal 与 /login 共用）。
 *
 * **这类回归是完全静默的**：换一个底色令牌不会报错、不会掉类、截图上字也还在，
 * 只是对比度悄悄掉到 AA 线下。本项目就出过一次——登录按钮白字压青绿长期只有
 * **2.49:1**，而它是全产品最重要的一个控件；靠肉眼和截图都没发现，是量出来的。
 *
 * 判据两条，缺一不可：
 *   · 文字 vs 按钮底 ≥ 4.5（WCAG 1.4.3 正文）
 *   · 按钮底 vs 页面底 ≥ 3.0（WCAG 1.4.11 非文字控件）
 * 后者**独立于**前者：字看得清、但按钮本身在背景里浮不出来，是另一种失败——
 * 页脚 CTA 当时正是这样（文字 5.08 过、控件 2.21 不过），只查文字对比度发现不了。
 */
const contrastOf = (page) => page.evaluate(() => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // parse 必须兼容两种 computed 形态：
  //   · rgb(255, 253, 246) / rgba(…)      → 0–255 整数
  //   · color(srgb 0.941 0.930 0.951)     → 0–1 浮点（color-mix 的输出形态）
  // 原实现只取前三个数字序列，于是把 srgb 的 0–1 浮点当成 0–255 读——
  // #4338CA 这类深色在浅紫底上被算成 2.64:1（真值约 7:1），是**假失败**。
  // 判据用 color( 前缀而不是「值是否 ≤1」：rgb(1, 0, 0) 也是合法的近黑色，
  // 按数值猜会把它错放大成红色。
  const parse = (s) => {
    const m = s.match(/[\d.]+/g);
    if (!m) return null;
    const v = m.slice(0, 3).map(Number);
    return /^color\(/.test(s) ? v.map((x) => Math.round(x * 255)) : v;
  };
  const ratio = (a, b) => { const [x, y] = [L(a) + 0.05, L(b) + 0.05].sort((p, q) => q - p); return x / y; };
  const opaqueBg = (el) => {
    let n = el.parentElement;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && !/,\s*0\)$/.test(c)) return parse(c);
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const bad = [];
  let n = 0;
  for (const el of document.querySelectorAll("a, button")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cs = getComputedStyle(el);
    if (cs.backgroundColor === "rgba(0, 0, 0, 0)") continue;   // 只审实心按钮
    const own = parse(cs.backgroundColor);
    const fg = parse(cs.color);
    if (!own || !fg) continue;
    const label = (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 10);
    if (!label) continue;
    n++;
    const t = ratio(fg, own), u = ratio(own, opaqueBg(el));
    if (t < 4.5) bad.push(`${label} 文字 ${t.toFixed(2)}:1`);
    if (u < 3.0) bad.push(`${label} 控件 ${u.toFixed(2)}:1`);
  }
  return { n, bad };
});

for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(e.message));

  await page.goto(`${BASE}/portal`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(900);

  console.log(`\n── ${vp.name} ──`);

  // 横向溢出
  const ov = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  ck(ov.sw <= ov.cw, `无横向滚动 (scrollWidth ${ov.sw} ≤ clientWidth ${ov.cw})`);

  // 门户令牌真的生效（不是静默退回应用内令牌）
  const bg = await page.evaluate(() => {
    const el = document.querySelector('[data-register="portal"]');
    return el ? getComputedStyle(el).backgroundColor : "";
  });
  ck(/255,\s*253,\s*246/.test(bg), `门户暖底令牌生效 (${bg})`);

  // 安全信息常驻（铁律⑤）：12356 必须在初始 DOM 里可见，无需任何交互。
  //
  // ⚠️ 这条断言的第一版写成 `可见处数 > 0`，**注入验证没能让它变红**：
  // 把安全区块的整条危机求助条 hidden 掉之后，页脚那两处 12356 还在，
  // 断言照样成立。命题弱到「藏掉整个安全区块也测不出来」，等于没有门。
  // 现在改为对**具体元素**断言——安全区块的求助条本身必须可见，
  // 页脚那份只作为冗余，不能替它顶班。
  const hot = await page.evaluate(() => {
    const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const aside = document.querySelector('#safety aside[aria-label="心理援助热线"]');
    const all = [...document.querySelectorAll("a,p,li")]
      .filter((e) => e.textContent?.includes("12356")).filter(vis).length;
    return { asideVisible: vis(aside), asideHasNumber: !!aside && aside.textContent.includes("12356"), all };
  });
  ck(hot.asideVisible && hot.asideHasNumber, `安全区块的求助条可见且含 12356`);
  ck(hot.all >= 2, `12356 无需交互即可见于 ≥2 处 (实测 ${hot.all})`);

  const cta = await contrastOf(page);
  ck(cta.bad.length === 0, `实心按钮对比度达标（${cta.n} 个｜文字≥4.5 控件≥3.0）${cta.bad.length ? " — " + cta.bad.join("; ") : ""}`);

  // 全页触达目标 ≥24px —— **不做视口过滤**，这正是本断言存在的理由。
  //
  // 视觉门（visual.mjs）的 tiny 检查在 visible() 里排除了视口外元素，于是**页脚
  // 永远不被审计**：它在首屏折叠线以下，六个 21px 高的链接（含「心理援助热线
  // 12356」）在门全绿的同时一直低于触达下限——是范围外的人工审查量出来的，
  // 不是门。getBoundingClientRect 本来就不需要元素在视口内，这里直接全页量。
  // 零尺寸元素照旧跳过（那是 display:none 的响应式分支，不是真实控件）。
  const tiny = await page.evaluate(() => {
    const bad = [];
    let n = 0;
    for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;          // 未渲染的响应式分支
      if (el.closest(".sr-only")) continue;
      n++;
      if (r.width < 24 || r.height < 24) {
        bad.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 12)}(${Math.round(r.width)}×${Math.round(r.height)})`);
      }
    }
    return { n, bad };
  });
  ck(tiny.bad.length === 0, `全页触达目标 ≥24px（${tiny.n} 个）${tiny.bad.length ? " — " + tiny.bad.slice(0, 4).join(" | ") : ""}`);

  await page.screenshot({ path: `${OUT}/portal-${vp.name}.png`, fullPage: true });

  // tab 交互（仅桌面档测一次即可，但三档都跑更稳）
  const tabs = page.locator('[role="tab"]');
  const n = await tabs.count();
  ck(n === 3, `角色 tab 数 = 3 (实测 ${n})`);
  if (n === 3) {
    await tabs.nth(1).click();
    await page.waitForTimeout(500);
    const sel = await tabs.nth(1).getAttribute("aria-selected");
    const panelText = await page.locator('[role="tabpanel"]').innerText();
    ck(sel === "true", `点击第二个 tab 后 aria-selected=true`);
    ck(panelText.length > 20, `面板内容已切换 (${panelText.slice(0, 18).replace(/\n/g, " ")}…)`);
    // aria-controls 不得指向不存在的 id
    const dangling = await page.evaluate(() => {
      return [...document.querySelectorAll("[aria-controls]")]
        .filter((el) => !document.getElementById(el.getAttribute("aria-controls"))).length;
    });
    ck(dangling === 0, `aria-controls 无悬空引用 (${dangling})`);
    await tabs.nth(0).click();
    await page.waitForTimeout(300);
  }

  // 锚点跳转
  if (vp.width >= 768) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('nav a[href="#safety"]').first().click();
    await page.waitForTimeout(1200);
    const top = await page.evaluate(() => document.getElementById("safety").getBoundingClientRect().top);
    ck(top >= 0 && top < 140, `#safety 锚点落点未被吸顶导航遮挡 (top=${Math.round(top)})`);
  }

  ck(errs.length === 0, `控制台无错误${errs.length ? " — " + errs[0].slice(0, 80) : ""}`);
  await ctx.close();
}

// ── /login 的主动作也归本门管 ────────────────────────────────────────────
// 「进入平台 → 登录」是同一条动线，主动作现在也是同一个令牌（--portal-cta）。
// 若只审 /portal，改动令牌时 /login 的回归会漏网——而那恰好是历史上出事的那一处。
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(900);
  // 暗夜穹顶版：hero 视图先行，点主 CTA 才出现登录卡（旧版是点 3D 地球解锁）。
  // 不进入表单视图则提交按钮不在屏上，等于没测。
  await page.getByRole("button", { name: "进入 i-learning" }).click();
  await page.waitForTimeout(1500);
  console.log(`\n── /login @desktop-1440 ──`);
  ck(await page.getByText("登录 i-learning", { exact: true }).isVisible(),
    "主登录入口已挂载且能打开表单");
  const cta = await contrastOf(page);
  ck(cta.bad.length === 0, `实心按钮对比度达标（${cta.n} 个｜文字≥4.5 控件≥3.0）${cta.bad.length ? " — " + cta.bad.join("; ") : ""}`);
  await ctx.close();
}

// /login 必须把 SSR HTML 当作可用首屏，而不是把关键内容先设 opacity:0，
// 再赌 hydration / Motion / rAF 一定会成功。真实内置浏览器出现过脚本未挂载但
// HTML 已返回的情况：DOM、按钮、标题全在，用户却只能看到穹顶背景。
// 禁用页面 JavaScript 复现这个边界；Playwright 的 evaluate 仍可读取计算样式。
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });

  const ssrVisibility = await page.evaluate(() => {
    const findButton = (label) => [...document.querySelectorAll("button")]
      .find((el) => el.textContent?.trim() === label);
    const blockers = (el) => {
      const out = [];
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (Number(style.opacity) <= 0.01 || style.display === "none" || style.visibility === "hidden") {
          out.push(`${node.tagName.toLowerCase()} opacity=${style.opacity} display=${style.display} visibility=${style.visibility}`);
        }
        if (node.tagName === "MAIN") break;
      }
      return out;
    };
    const targets = {
      heading: document.querySelector("h1"),
      navLogin: findButton("登录"),
      primaryLogin: findButton("进入 i-learning"),
    };
    return Object.fromEntries(Object.entries(targets).map(([key, el]) => [
      key,
      { exists: Boolean(el), blockers: el ? blockers(el) : ["missing"] },
    ]));
  });

  for (const [name, result] of Object.entries(ssrVisibility)) {
    ck(result.exists && result.blockers.length === 0,
      `登录页 SSR 首屏 ${name} 无 JS 仍可见${result.blockers.length ? ` — ${result.blockers.join("; ")}` : ""}`);
  }
  await ctx.close();
}


// ══════════════════════════════════════════════════════════════════════════
// P-A · 焦点环（本轮 P1 的守门人）
//
// 根因：globals.css 末尾有一条**无层**的 `*:focus-visible`。级联层的比较先于
// 特异度，所以它赢过 `@layer utilities` 里的每一个 `focus-visible:outline-*`
// 工具类——门户里 11 处焦点声明**从未渲染过**，深底上本该是奶油白的环实测是钴蓝，
// 对比度从设计的 15.9:1 掉到 3.09:1。修法是在 globals.css 里加一组同为无层、
// 但特异度更高的作用域规则（`[data-portal-root] :focus-visible` + `[data-ink]` 分档）。
//
// 这道门守的是「声明与渲染一致」，不是「有没有写工具类」——**只有实测计算样式
// 才能发现声明被吞掉**，静态扫源码永远看不出来。
//
// ⚠️ 参照系：`outline-offset: 2px` 让环画在元素边框盒**之外**，落在父级底色上。
// 因此底色必须从 `el.parentElement` 起算。从元素自身起算会拿奶油白按钮的底色
// 去比奶油白的环，得出 1.00:1 的假失守——这个坑真的踩过，还据此做了一次
// 「修复」，反而给跳过导航链接制造了一个真正的 1.00:1。
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/portal`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  // 关掉过渡：Tailwind v4 的 transition-colors 组包含 outline-color，
  // 聚焦后立刻读会读到过渡中间值。
  await page.addStyleTag({ content: "*{transition:none!important;animation:none!important}" });
  const r = await page.evaluate(() => {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = (v) => 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
    // 必须认 color(srgb r g b / a)：门户导航底色就是这个形态，用 /\d+/g 抓会得到垃圾。
    const parse = (t) => {
      const m = t.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255];
      return (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    };
    const ratio = (a, b) => { const v = [L(a), L(b)].sort((x, y) => y - x); return (v[0] + 0.05) / (v[1] + 0.05); };
    const out = [];
    for (const el of document.querySelectorAll("a[href],button,[tabindex]:not([tabindex='-1']),input,select,textarea")) {
      const bb = el.getBoundingClientRect();
      if (bb.width < 1 || bb.height < 1) continue;
      el.focus();
      if (!el.matches(":focus-visible")) continue;
      const cs = getComputedStyle(el);
      let n = el.parentElement, bg = "rgb(255,255,255)";
      while (n) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") { bg = c; break; }
        n = n.parentElement;
      }
      out.push({
        t: (el.innerText || el.getAttribute("aria-label") || el.tagName).slice(0, 10).replace(/\s+/g, " "),
        color: cs.outlineColor,
        style: cs.outlineStyle,
        ratio: +ratio(parse(cs.outlineColor), parse(bg)).toFixed(2),
      });
    }
    return out;
  });
  console.log(`\n── P-A 焦点环 @1440（${r.length} 个可聚焦元素）──`);
  const cobalt = r.filter((x) => x.color.includes("37, 99, 235"));
  ck(r.length >= 10, `枚举到足够的可聚焦元素（防真空）— ${r.length} 个`);
  ck(cobalt.length === 0, `无元素退回全局钴蓝兜底色 — 实测 ${cobalt.length}/${r.length}`);
  ck(r.every((x) => x.style === "solid"), `outline-style 全为 solid（outline-none 不再吞掉）— ${r.filter((x) => x.style === "solid").length}/${r.length}`);
  const bad = r.filter((x) => x.ratio < 3.0);
  ck(bad.length === 0, `焦点环对落点底色 ≥3.0:1（WCAG 1.4.11）— 最低 ${Math.min(...r.map((x) => x.ratio))}:1${bad.length ? " — " + bad.map((x) => `${x.t}=${x.ratio}`).join("; ") : ""}`);
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// P-B · 字阶多视口
//
// 为什么放这里而不是 typography.mjs：那道门的 newContext 写死 1440×900，
// 于是 `@media (max-width:900px)` 里的令牌**永远不进统计**。它曾把 --fs-d1
// 换成 36px、--fs-d3 换成 22px，两个都不在七档内，门却一直是绿的——
// 「门是绿的」在那里不等于「没有越界」，只等于「没有测」。
// 给 typography.mjs 加视口会连带要求重录六个登录后页面的基线，越出门户范围，
// 因此多视口断言落在门户专项门里。
{
  const OKSET = new Set([12, 14, 16, 18, 28, 40, 56]);
  const over = [], hier = [];
  for (const w of [1440, 1280, 1024, 901, 900, 768, 600, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/portal`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(700);
    const o = await page.evaluate(() => {
      const fs = new Set();
      for (const el of document.querySelectorAll("main *")) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (!el.textContent || !el.textContent.trim()) continue;
        fs.add(Math.round(parseFloat(getComputedStyle(el).fontSize)));
      }
      const H = [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => ({ n: h.tagName, s: Math.round(parseFloat(getComputedStyle(h).fontSize)) }));
      return { fs: [...fs], H };
    });
    const bad = o.fs.filter((x) => !OKSET.has(x));
    if (bad.length) over.push(`${w}px:[${bad}]`);
    const h2 = o.H.filter((x) => x.n === "H2").map((x) => x.s);
    const h3 = o.H.filter((x) => x.n === "H3").map((x) => x.s);
    if (h2.length && h3.length && Math.max(...h3) >= Math.min(...h2)) hier.push(`${w}px h3max=${Math.max(...h3)}>=h2min=${Math.min(...h2)}`);
    await ctx.close();
  }
  console.log(`\n── P-B 字阶（九档视口）──`);
  ck(over.length === 0, `字号全部落在七档内 — 越界 ${over.length} 档${over.length ? " — " + over.join(" ") : ""}`);
  ck(hier.length === 0, `h3 最大值 < h2 最小值（标题层级单调）${hier.length ? " — " + hier.join(" ") : ""}`);
}

// ══════════════════════════════════════════════════════════════════════════
// P-C · 承诺一致性（断行 · 滚动 · 地标）
//
// 这一节守的是同一类缺陷：**页面对用户说的话与它实际做的事不一致**。
// · 求助信息把「每一页」从中间劈开、h1 断出单字孤行 → 说的话读不顺；
// · 截图框恒定挂 tabIndex 且 aria-label 以「可横向滚动」结尾，但 ≥768px 时
//   四个框全都不可滚 → **对读屏用户宣称了一个不存在的操作**；
// · 结尾 CTA 整块（含全页最后一个主行动）在 </main> 之后、<footer> 之前，
//   `<section>` 没有可访问名称就不是地标，按地标导航的人会整块跳过。
{
  let orphan = 0, widow = 0, liar = 0;
  for (const w of [1440, 1152, 1024, 900, 768, 390, 360]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/portal`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    const o = await page.evaluate(() => {
      // 逐字建 Range 再按 y 聚行。量 <p> 盒子是没用的——盒子只会给出一个等宽结果，
      // 断行发生在盒子内部（这个坑踩过：三列 left 等距曾被当成「无缺陷」的证据）。
      const lines = (el) => {
        const cs = [];
        const walk = (n) => {
          if (n.nodeType === 3) {
            for (let i = 0; i < n.data.length; i++) {
              const r = document.createRange();
              r.setStart(n, i); r.setEnd(n, i + 1);
              const b = r.getBoundingClientRect();
              if (b.width > 0) cs.push({ y: Math.round(b.top), ch: n.data[i] });
            }
          } else n.childNodes.forEach(walk);
        };
        walk(el);
        const rows = [];
        cs.forEach((c) => {
          const hit = rows.find((r) => Math.abs(r.y - c.y) <= 4);
          if (hit) hit.s += c.ch; else rows.push({ y: c.y, s: c.ch });
        });
        return rows.map((r) => r.s.trim()).filter(Boolean);
      };
      const h1 = document.querySelector("h1");
      const safety = [...document.querySelectorAll("p")].find((e) => e.textContent.includes("遇到困难随时可以求助"));
      const shots = [...document.querySelectorAll("img[src*='/shots/ev-']")].map((im) => {
        const c = im.parentElement;
        return {
          canScroll: c.scrollWidth > c.clientWidth + 1,
          tab: c.getAttribute("tabindex"),
          label: c.getAttribute("aria-label") || "",
        };
      });
      return { h1: h1 ? lines(h1) : [], safety: safety ? lines(safety) : [], shots };
    });
    orphan += o.h1.filter((l) => l.length === 1).length;
    widow += o.safety.filter((l) => l.length > 0 && l.length <= 3).length;
    liar += o.shots.filter((s) => !s.canScroll && (s.tab === "0" || s.label.includes("可横向滚动"))).length;
    await ctx.close();
  }
  console.log(`\n── P-C 承诺一致性（七档视口）──`);
  ck(orphan === 0, `h1 无单字孤行 — ${orphan} 处`);
  ck(widow === 0, `求助信息无 ≤3 字寡行（「每一页」不被劈开）— ${widow} 处`);
  ck(liar === 0, `不可滚的框不占 Tab 位、不宣称可滚 — ${liar} 处`);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/portal`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(900);
  const o = await page.evaluate(() => {
    const cta = [...document.querySelectorAll("section")].find((s) => s.querySelector("#portal-cta-heading"));
    const main = document.querySelector("main");
    return {
      ctaNamed: !!(cta && cta.getAttribute("aria-labelledby")),
      skipOk: !!document.querySelector('a[href="#portal-main"]') && !!document.getElementById("portal-main") && main.getAttribute("tabindex") === "-1",
      // 只查有 h2 的内容区块：英雄区用 h1、结构不同，把它算进来会得到一条
      // 永远为假的断言——「不可能通过的门」和「不可能失败的门」一样有害。
      eyebrows: [...document.querySelectorAll("main > section")].filter((s) => s.querySelector("h2")).map((s) => {
        const prev = s.querySelector("h2").previousElementSibling;
        return !!(prev && prev.tagName === "P");
      }),
    };
  });
  ck(o.ctaNamed, "结尾 CTA 区块有可访问名称（才是 region 地标，不会被整块跳过）");
  ck(o.skipOk, "跳过导航链接存在，且 #portal-main 可接收焦点（tabindex=-1）");
  ck(o.eyebrows.length >= 4 && o.eyebrows.every(Boolean), `有 h2 的内容区块均带眉标 — ${o.eyebrows.filter(Boolean).length}/${o.eyebrows.length}`);
  await ctx.close();
}

await browser.close();
console.log(`\n════════════════\n${fail ? `${fail} FAIL` : "全部通过"}`);
process.exit(fail ? 1 : 0);
