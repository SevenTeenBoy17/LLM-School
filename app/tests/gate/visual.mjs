#!/usr/bin/env node
/**
 * R1 · 视觉化测试：三角色 × 关键页 × 三视口
 *
 * 两件事一起做：
 *  ① 截图落盘（tests/artifacts/），供人工目检；
 *  ② **机器可判的视觉缺陷检查**——横向溢出、文本裁切、控件重叠、可交互元素过小、
 *     首屏空白率、对比度。人工目检会漏，机器检查会假绿，两者都要。
 *
 * 为什么不用内置浏览器 pane：该 pane 永久 hidden，动画/截图/Suspense 全冻结，
 * 截出来的图不代表真实渲染（既往教训）。这里用 Playwright 真实 headless Chromium。
 *
 * 用法：npm run test:visual
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "http://localhost:3000";
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(APP_ROOT, "tests", "artifacts", "visual");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const MATRIX = [
  /**
   * 门户（登录前公开页）。`public: true` 触发两处与其余角色相反的处理：
   *
   * 1. **不登录。** /portal 本就无需身份；而拿一个已登录上下文去访问 /login，
   *    测的是另一回事（登录后重访登录页），不是真实用户看到的那一屏。
   *
   * 2. **不装假时钟。** 其余角色装 clock 是为了避开夜间宵禁遮罩（会覆盖全屏、
   *    把遮罩里的元素扫进来），而宵禁属登录后的 GuardianShell，门户根本没有。
   *    反过来假时钟会**冻结 rAF**：/login 的 motion.h1 / motion.p 都是
   *    若关键内容以 `initial={{opacity:0}}` 起步，动画跑不动就会永远不可见。
   *    登录页现已改为首帧透明度 1，并由 portal.mjs 的无 JS 门专门守住；这里仍不
   *    装假时钟，以免它扭曲真实浏览器的动画节奏与截图读数。
   */
  { role: "public", public: true, pages: ["/portal", "/login"] },
  { role: "student", user: "student", pw: "Student@123", expectName: "刘子涵", pages: ["/student/home", "/chat", "/student/growth", "/explore", "/student/tools", "/student/tools/image", "/student/mindmap", "/student/activities", "/student/badges", "/student/manor", "/profile"] },
  { role: "student-primary", user: "student-p", pw: "Student@123", expectName: "周小满", pages: ["/student/home", "/student/growth"] },
  { role: "student-senior", user: "student-s", pw: "Student@123", expectName: "赵宸", pages: ["/student/home", "/student/growth"] },
  { role: "teacher", user: "teacher", pw: "Teacher@123", expectName: "王思远", pages: ["/dashboard", "/chat", "/class", "/class/manor", "/research", "/research/prep", "/research/paper", "/research/courseware", "/research/artifacts", "/prompts", "/prompts/new", "/knowledge", "/agent", "/agent/new", "/hub", "/hub/image"] },
  // /admin 本身无 page.tsx 且全站无链接指向它（首轮 3 条 P1 属测试面用错路径）。
  // 真实入口是下列子页。
  { role: "admin", user: "admin", pw: "Admin@123", expectName: "李校长", pages: ["/admin/models", "/admin/audit", "/admin/permissions", "/admin/agents", "/admin/analytics", "/admin/guardian", "/admin/manor"] },
];

/**
 * 覆盖率自审：矩阵必须覆盖仓库里**每一个**实际存在的页面路由。
 *
 * 加这一条的理由：本门此前只覆盖 14/30 个路由，却报「P1=0 / P2=0 / P3=0」——
 * 那句话真实的含义是「**我们看的那些页面里**没缺陷」，而它读起来像「全站没缺陷」。
 * 覆盖率不自审的门，会随着新页面不断加入而**悄悄退化成局部抽查**，
 * 且退化过程完全无声：没人会因为新建了一个页面就想起来去改测试矩阵。
 *
 * 排除项只有两类，且都写明理由：
 *   · `/`          —— 纯 redirect，无可视内容
 *   · 动态段路由   —— 需要真实 id，属数据依赖，不在本门射程
 */
const ROUTE_EXCLUDE = [
  { path: "/", why: "纯 redirect（→ /portal），无可视内容" },
  // 首版把 /learn 当普通页放进矩阵，结果三档全报「被重定向」。查下去是**我写错了矩阵**，
  // 不是产品缺陷：proxy.ts 里 S2 并线把学生从 /learn 平滑跳到 /student/home，页面文件
  // 按设计保留。顺带纠正一个我此前的错误结论——本项目**有** middleware，
  // 只是 Next.js 16 把它改名成了 proxy.ts（AGENTS.md 开篇警告的那类破坏性变更）。
  { path: "/learn", why: "S2 并线的旧地址，proxy.ts 对学生 307 → /student/home（页面文件按设计保留）" },
];

const findings = [];
let checks = 0;
const record = (severity, page, viewport, issue, detail) => {
  findings.push({ severity, page, viewport, issue, detail });
};

/** 页面级视觉体检——全部基于真实几何，不看字符串 */
const AUDIT = `() => {
  const out = { overflowX: 0, clipped: [], overlaps: [], stickyBlocked: [], tiny: [], firstScreenEmptyRatio: 0, lowContrast: [] };
  const vw = window.innerWidth, vh = window.innerHeight;

  // ① 横向溢出：页面本身不得横向滚动（宽表/图表须自带 overflow-x 容器）
  out.overflowX = Math.max(0, document.documentElement.scrollWidth - vw);

  // sr-only 元素靠 clip/1px 尺寸对视觉隐藏、只给读屏——它必然「被裁切」且「小于 24px」，
  // 计入就是恒定误报（首轮 42 条 P3 里 15 条都是那条跳过链接）。按语义排除，而不是调阈值。
  const srOnly = (el) => Boolean(el.closest(".sr-only")) || el.classList.contains("sr-only");

  // 「用户真的看得到」= 有盒子 + 未被样式隐藏 + **未被任何滚动祖先裁掉** + 在视口内。
  // 缺最后两项时，滚出消息容器的旧按钮（实测 top=-427）照样算「可见」，
  // 再拿它与顶栏做命中测试，必然报「被遮挡」——首轮那 3 条 P1 全部由此产生。
  // 这是检测器缺陷，不是产品缺陷：用户根本看不到那些按钮。
  const clippedByAncestor = (el, r) => {
    let n = el.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowY + cs.overflowX)) {
        const nr = n.getBoundingClientRect();
        if (nr.width > 0 && nr.height > 0 &&
            (r.bottom <= nr.top || r.top >= nr.bottom || r.right <= nr.left || r.left >= nr.right)) return true;
      }
      n = n.parentElement;
    }
    return false;
  };
  // 收起的 details 菜单内容（summary 除外）：Chromium 用 content-visibility 隐藏它，
  // 但 getBoundingClientRect 仍返回**真实几何**（实测 166x40、坐标齐全）。只查
  // display/尺寸/裁切会把这些用户根本看不见的幽灵盒子当可交互元素扫进来，与真按钮
  // 做命中测试必报遮挡——上一轮 P1「重新生成←最近会话」即此：学生页消息多、幽灵盒
  // 恰好压线就红，教师页恰好没压就绿，纯几何巧合。按语义排除，而不是调阈值。
  const inClosedDetails = (el) => {
    let n = el.parentElement;
    while (n && n !== document.body) {
      if (n.tagName === "DETAILS" && !n.open) {
        const s = n.querySelector(":scope > summary");
        if (!s || !s.contains(el)) return true;
      }
      n = n.parentElement;
    }
    return false;
  };
  const visible = (el) => {
    if (srOnly(el)) return false;
    if (inClosedDetails(el)) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!(r.width > 0 && r.height > 0)) return false;
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return false; // 视口外
    if (clippedByAncestor(el, r)) return false;                                     // 被滚动祖先裁掉
    // 子元素自身 opacity=1 也可能处在 opacity=0 的入场容器或收起浮层内。
    let ancestor = el.parentElement;
    while (ancestor) {
      const acs = getComputedStyle(ancestor);
      if (acs.visibility === "hidden" || acs.display === "none" || Number(acs.opacity) <= 0.01) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  };

  // ② 文本裁切：有 overflow 限制且内容溢出
  //
  // **口径修正（与迁移带来的下降必须分开归因）**：原判据把「所有截断」一律计为缺陷，
  // 实测下来 P2 的裁切类命中全部是 line-clamp / ellipsis——**作者故意的截断**，
  // 而且全都可恢复：/prompts 的卡片本身是链接（点进去有全文）、/chat 的会话列表同理。
  // 这类噪音把真正的问题淹掉了：同一批里 /admin/models 的描述被 clamp 成一行、
  // **不可点、无 title、全文无处可看**，管理员读不到自己正在配置的模型说明——
  // 那一条才是缺陷，却和二十条噪音混在一起。
  //
  // 新命题：**截断本身不是缺陷，「不可恢复的截断」才是。**
  // 可恢复 = 元素自身或祖先是可交互的（点进去有全文）或带 title（悬停有全文）。
  //
  // ⚠️ 注意：本函数整体是**模板字符串**（const AUDIT = 反引号包裹）。
  // 注释里不要出现反引号——它会提前终止模板串，报成一个位置莫名其妙的
  // 「Parsing error: ',' expected」。首版就是这么挂的。
  const recoverable = (el) => {
    if (el.getAttribute("title")) return true;
    let n = el;
    while (n && n !== document.body) {
      if (/^(A|BUTTON|SUMMARY)$/.test(n.tagName) || n.getAttribute("title") ||
          n.getAttribute("role") === "button" || n.getAttribute("role") === "link") return true;
      n = n.parentElement;
    }
    return false;
  };
  for (const el of document.querySelectorAll("main *")) {
    if (!visible(el) || el.children.length > 0) continue;
    const cs = getComputedStyle(el);
    if (cs.whiteSpace === "pre-wrap" || cs.whiteSpace === "pre") continue; // markdown 正文按内容自适应，非裁切
    const clipsX = cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.textOverflow === "ellipsis";
    const clipsY = cs.overflow === "hidden" || cs.overflowY === "hidden" || cs.webkitLineClamp !== "none";
    if ((clipsX && el.scrollWidth > el.clientWidth + 1) || (clipsY && el.scrollHeight > el.clientHeight + 1)) {
      if (recoverable(el)) continue;                                        // 截断可恢复，不计为缺陷
      const t = (el.textContent || "").trim();
      if (t) out.clipped.push({ text: t.slice(0, 40), cls: String(el.className).slice(0, 40) });
    }
  }

  // ③ 可交互元素两两重叠（同层遮挡会让其中一个点不到）
  const acts = [...document.querySelectorAll('button,a[href],input,select,textarea,summary,[role="button"]')].filter(visible);
  for (let i = 0; i < acts.length; i++) {
    for (let j = i + 1; j < acts.length; j++) {
      const a = acts[i], b = acts[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      if (ra.right < rb.left || rb.right < ra.left || ra.bottom < rb.top || rb.bottom < ra.top) continue;
      // 相交后确认是否真的挡住：取被挡者中心做命中测试
      const cx = rb.left + rb.width / 2, cy = rb.top + rb.height / 2;
      if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
      const hit = document.elementFromPoint(cx, cy);
      if (hit && !b.contains(hit) && hit !== b && (a.contains(hit) || hit === a)) {
        // sticky 吸顶元素会压住滚动到其下方的内容——这是滚动布局的正常表现，
        // 被压住的控件滚一下就重新可达，与「永久不可达」不同级，单独归类避免噪声掩盖真问题。
        // 判**祖先**是否 sticky/fixed：遮挡者常是吸顶块内部的普通按钮，其自身 position 为 static，
        // 只看它本身会把 sticky 的正常瞬时遮挡误报成 P1（首轮 3 条都是这样）。
        const sticky = Boolean(a.closest(".sticky")) ||
          (() => { let n2 = a; while (n2 && n2 !== document.body) { const ps = getComputedStyle(n2).position; if (ps === "sticky" || ps === "fixed") return true; n2 = n2.parentElement; } return false; })();
        const entry = {
          covered: (b.getAttribute("aria-label") || b.textContent || b.tagName).trim().slice(0, 20),
          by: (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().slice(0, 20),
        };
        if (!sticky) { out.overlaps.push(entry); continue; }
        // sticky 遮挡要再问一句：**滚动之后还够不到吗**。
        //
        // 旧判据只测「此刻是否被压住」，而 sticky 压住下方内容是滚动布局的正常表现——
        // 压住谁完全取决于当下滚到哪，于是同一份代码在两次跑之间会在 0 条和 2 条之间跳。
        // 一个会自己跳变的门，报绿和报红都不构成证据。
        //
        // 正确的命题是「这个控件是否**存在一个可达的滚动位置**」：
        // 能滚出来 = 正常，滚不出来 = 真缺陷（而且是 P1 级，不是噪声级）。
        // 用 scrollIntoView 做探针在这里是**同构**的——用户遇到被压住时做的正是这件事；
        // 而在「测某元素当下是否被遮挡」那类命题里它会破坏参照系，两者不能混用。
        // ⚠️ 对齐方式必须试多种，且 "end" 要排在前面。
        // 第一版只试 block:"center"，实测直接造出一个**假 P1**：
        // /chat 的吸顶块占据 264-430px，而 720px 视口的中心是 360px ——
        // 居中恰好把元素推到吸顶块正下方。实测同一个按钮
        // center→top 404 不可达 / start→292 不可达 / nearest→354 不可达 /
        // **end→530 可达**；手动滚到吸顶块下方 8px 也可达。
        // 也就是说控件本来就够得到，只是「居中」这个探针选错了。
        // 命题是「**存在**一个可达的滚动位置」，所以任一对齐可达即算可达。
        const before = { x: window.scrollX, y: window.scrollY };
        let reachable = false;
        for (const block of ["end", "center", "start"]) {
          b.scrollIntoView({ block: block, inline: "nearest" });
          const rb2 = b.getBoundingClientRect();
          const cx2 = rb2.left + rb2.width / 2, cy2 = rb2.top + rb2.height / 2;
          if (cx2 < 0 || cy2 < 0 || cx2 > vw || cy2 > vh) continue;
          const hit2 = document.elementFromPoint(cx2, cy2);
          if (hit2 && (b.contains(hit2) || hit2 === b)) { reachable = true; break; }
        }
        window.scrollTo(before.x, before.y);
        // 滚动后可达 = 瞬时遮挡，属正常，**不记**；仍不可达 = 永久够不到，按 P1 记。
        if (!reachable) out.stickyBlocked.push(entry);
      }
    }
  }

  // ④ 触控目标过小（K-12 手指操作，WCAG 2.5.8 最小 24×24，本项目自定 ≥40）
  for (const el of acts) {
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) {
      out.tiny.push({ w: Math.round(r.width), h: Math.round(r.height), label: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 20) });
    }
  }

  // ⑤ 正文字号下限（本轮新增）
  //
  // 补的是一个**只有这道门能看见**的洞：本项目根字号是 14px（非浏览器默认 16px），
  // Tailwind 全部 rem 标度因此 ×0.875——text-xs 实际只有 **10.5px**、h-6 只有 21px。
  // 触达面积那一档（④）能挡住 h-6 这类，但**挡不住 text-xs**：字太小是可读性问题，
  // 不是命中面积问题，两者互不覆盖。
  //
  // 为什么不去改根字号：字号早已全部收敛成绝对像素（字阶门实测值可证），改根字号
  // 动不到它们；真正会被改到的是 h-* / p-* / gap-* 这些间距，全站放大 14%——
  // 而本项目专门做过密度收敛。**收益是消除潜在陷阱，代价是只有人能判断的观感变化。**
  // 所以选择直接给「过小的字」设一道断言：成本为零、不动密度、全站生效。
  //
  // （⚠️ 本函数是模板字符串，注释里不能出现反引号——上面这段初版就是因为写了
  //   反引号提前终止模板串而挂掉的，而**同样的警示两次编辑之前刚写在本文件里**。）
  //
  // 阈值 11px：CJK 字形在 11px 以下笔画开始粘连。刻意不取 12——
  // 12 会把设计上合法的 11px 徽标/脚注一并判死，那属于把规范当缺陷报。
  for (const el of document.querySelectorAll("main *")) {
    if (!visible(el) || el.children.length > 0) continue;
    const t = (el.textContent || "").trim();
    if (!t) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 11) {
      (out.tinyText ||= []).push({ px: fs, text: t.slice(0, 20) });
    }
  }

  // ⑥ 文字对比度：对首屏可见的叶子文本计算 WCAG 2.x 对比度。
  // 渐变或图片背景无法可靠还原每个字形下方的实际像素，明确跳过，交给截图目检；
  // 纯色与透明叠加则沿祖先链合成，避免把半透明面板误当成纯白背景。
  const parseColor = (value) => {
    if (!value || value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const values = value.match(/-?\\d*\\.?\\d+/g)?.map(Number) || [];
    if (value.startsWith("rgb") && values.length >= 3) {
      return { r: values[0], g: values[1], b: values[2], a: values[3] ?? 1 };
    }
    if (value.startsWith("color(srgb") && values.length >= 3) {
      return { r: values[0] * 255, g: values[1] * 255, b: values[2] * 255, a: values[3] ?? 1 };
    }
    return null;
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
      g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
      b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
      a,
    };
  };
  const backgroundFor = (el) => {
    let acc = { r: 0, g: 0, b: 0, a: 0 };
    let node = el;
    while (node) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      const color = parseColor(cs.backgroundColor);
      if (color && color.a > 0) acc = over(acc, color);
      if (acc.a >= 0.99) return acc;
      node = node.parentElement;
    }
    return acc.a >= 0.99 ? acc : null;
  };
  const luminance = (color) => {
    const channel = (value) => {
      const s = Math.max(0, Math.min(255, value)) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };
  const contrast = (a, b) => {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  for (const el of document.querySelectorAll("main *")) {
    if (!visible(el) || el.children.length > 0 || el.matches(":disabled") || el.closest("[aria-disabled='true']")) continue;
    const text = (el.textContent || "").trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    const bg = backgroundFor(el);
    // 透明文字通常由 background-clip:text 的渐变负责上色，纯色算法无法判定。
    if (!fg || !bg || fg.a <= 0.01) continue;
    let opacity = fg.a;
    let node = el;
    while (node) {
      opacity *= Number(getComputedStyle(node).opacity) || 0;
      node = node.parentElement;
    }
    const paintedFg = opacity < 0.999 ? over({ ...fg, a: opacity }, bg) : fg;
    const ratio = contrast(paintedFg, bg);
    const size = parseFloat(cs.fontSize);
    const weight = cs.fontWeight === "bold" ? 700 : (parseInt(cs.fontWeight, 10) || 400);
    const required = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    if (ratio + 0.01 < required) {
      out.lowContrast.push({ ratio: Number(ratio.toFixed(2)), required, text: text.slice(0, 28) });
    }
  }

  // ⑦ 首屏空白率：粗估首屏内可见元素覆盖面积占比，过低说明布局塌陷/加载失败
  let covered = 0;
  for (const el of document.querySelectorAll("main *")) {
    if (!visible(el) || el.children.length > 0) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) continue;
    covered += Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) * Math.min(r.width, vw);
  }
  out.firstScreenEmptyRatio = Math.max(0, 1 - covered / (vw * vh));

  // 首屏可见文字量。与覆盖率合取判定「首屏是否真的什么都没有」——
  // 覆盖率低只说明页面稀疏，文字也没有才说明它没渲染出来。
  {
    let chars = 0;
    for (const el of document.querySelectorAll("main *")) {
      if (!visible(el) || el.children.length > 0) continue;
      chars += (el.textContent || "").trim().length;
    }
    out.firstScreenText = chars;
  }

  return out;
}`;

async function run() {
  console.log(`R1 视觉化测试 · BASE=${BASE}`);
  const browser = await chromium.launch();
  try {
    for (const entry of MATRIX) {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
        if (!entry.public) {
          // 固定系统时间到白天：夜间宵禁遮罩会覆盖全屏，把遮罩里的元素扫进来并挡住页面本身，
          // 使同一份代码「白天 3 条 P3、夜里 30 条」。setFixedTime 只固定 Date，
          // 不冻结计时器、rAF 与 CSS 动画，因此页面仍会进入真实稳定态。
          // 门户页不设置（理由见 MATRIX 顶部注释）。
          await ctx.clock.setFixedTime(new Date("2026-07-27T14:00:00"));
          const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: entry.user, password: entry.pw } });
          if (!login.ok()) { record("P1", "-", vp.name, `登录失败 ${entry.user}`, `status=${login.status()}`); await ctx.close(); continue; }
        }
        const page = await ctx.newPage();
        for (const path of entry.pages) {
          const label = `${entry.role}__${path.replace(/\//g, "_")}__${vp.name}`;
          try {
            const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 });
            if (res && res.status() >= 400) { record("P1", path, vp.name, `HTTP ${res.status()}`, entry.role); continue; }
            // **落点校验**：Playwright 默认跟随重定向，若该角色无权访问此页，
            // RBAC 会把它送去别处，而后面所有断言就**静默地在另一个页面上跑**——
            // 门照常全绿，测的却不是你以为的那一页。这是「测了个寂寞」的典型形态，
            // 且随着矩阵扩大越来越容易发生（新加的页未必每个角色都能进）。
            const landed = new URL(page.url()).pathname;
            // **会话身份断言**（每角色首页查一次）。本门走 API 登录建会话，而客户端
            // useUserStore 曾把一个硬编码真人身份当默认值、且只在登录表单成功后被覆盖
            // ——于是本门历轮截图的侧栏全是同一个人，门绿着，拍的却不是被测角色。
            // 现由 SessionIdentityProvider 在 shell 挂载时把服务端会话身份写回 store，
            // 这条断言锁住该链路：侧栏必须出现**该账号的播种姓名**。
            // 只查 aside：学生首页的监督横幅会正当地写出任课教师姓名，全文比对必然误判。
            if (entry.expectName && path === entry.pages[0]) {
              const sideText = await page.evaluate(() =>
                [...document.querySelectorAll("aside")].map((a) => a.innerText || "").join(" "));
              if (!sideText.includes(entry.expectName)) {
                record("P1", path, vp.name, "侧栏会话身份错误", `${entry.role} 期望「${entry.expectName}」，实测未出现`);
              }
            }
            if (landed !== path) {
              record("P1", path, vp.name, "被重定向，未落在目标页", `${entry.role} → ${landed}`);
              continue;
            }
            // 首次引导有自己的专项测试；普通页面视觉门必须审查引导关闭后的真实工作区。
            if (!entry.public) {
              const dismissGuide = page.getByRole("button", { name: "关闭引导，稍后再看" });
              if (await dismissGuide.count() && await dismissGuide.isVisible()) {
                await dismissGuide.click();
                await page.waitForTimeout(300);
              }
              const blockingGuide = page.locator('.onboarding-experience[role="dialog"]');
              if (await blockingGuide.count() && await blockingGuide.isVisible()) {
                record("P1", path, vp.name, "首次引导遮挡普通页面验收", entry.role);
                continue;
              }
            }
            await page.waitForTimeout(1200);
            await page.screenshot({ path: join(OUT, `${label}.png`), fullPage: false });
            const a = await page.evaluate(eval(`(${AUDIT})`));
            checks += 7;   // ①横向溢出 ②裁切 ③遮挡 ④触达 ⑤字号下限 ⑥对比度 ⑦首屏空白
            if (a.overflowX > 2) record("P2", path, vp.name, "页面横向溢出", `${a.overflowX}px`);
            if (a.clipped.length) record("P2", path, vp.name, `文本被裁切 ×${a.clipped.length}`, a.clipped.slice(0, 2).map((c) => c.text).join(" | "));
            if (a.overlaps.length) record("P1", path, vp.name, `可交互元素被遮挡 ×${a.overlaps.length}`, a.overlaps.slice(0, 2).map((o) => `${o.covered}←${o.by}`).join(" | "));
            // 「滚动后仍够不到」= 永久不可达，与非 sticky 遮挡同级（P1）。
            // 原先这里是 P3「瞬时遮挡」，而瞬时遮挡本就是滚动布局的正常表现，
            // 报出来只会在 0↔2 之间跳、掩盖真问题——判据已改成确定性的可达性。
            if (a.stickyBlocked?.length) record("P1", path, vp.name, `吸顶遮挡且滚动后仍不可达 ×${a.stickyBlocked.length}`, a.stickyBlocked.slice(0, 2).map((o) => `${o.covered}←${o.by}`).join(" | "));
            if (a.tiny.length) record("P3", path, vp.name, `触控目标 <24px ×${a.tiny.length}`, a.tiny.slice(0, 2).map((t) => `${t.label}(${t.w}×${t.h})`).join(" | "));
            if (a.tinyText?.length) record("P2", path, vp.name, `正文字号 <11px ×${a.tinyText.length}`, a.tinyText.slice(0, 3).map((t) => `${t.px}px「${t.text}」`).join(" | "));
            if (a.lowContrast?.length) record("P2", path, vp.name, `文字对比度不足 ×${a.lowContrast.length}`, a.lowContrast.slice(0, 3).map((t) => `${t.ratio}:1/${t.required}:1「${t.text}」`).join(" | "));
            // **口径修正**：原判据只看像素覆盖率，而它要证的命题其实是「页面是否渲染失败」。
            // 实测 /student/growth 空白率 94% 却有 24 个可见元素、文案完整
            // （「我的成长 / 只和昨天的自己比——这里没有排行榜 / 错题本还是空的…」）——
            // 那是**合法的空态**，内容本来就少，不是没渲染出来。用覆盖率单独判定，
            // 等于把「页面很空」和「页面坏了」当成同一件事报。
            // 改为**合取**：像素覆盖极低 **且** 首屏几乎没有文字。前者单独成立不算缺陷，
            // 两者同时成立才说明「这一屏真的什么都没有」——那才是渲染失败的样子。
            if (a.firstScreenEmptyRatio > 0.92 && a.firstScreenText < 40) {
              record("P2", path, vp.name, "首屏近乎空白", `空白率 ${(a.firstScreenEmptyRatio * 100).toFixed(0)}% · 首屏文字 ${a.firstScreenText} 字`);
            }
          } catch (e) {
            record("P2", path, vp.name, "页面加载异常", String(e.message).split("\n")[0].slice(0, 80));
          }
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }

  // ── 覆盖率自审（见 ROUTE_EXCLUDE 上方注释）─────────────────────────────
  {
    const { readdirSync, statSync } = await import("node:fs");
    const routes = [];
    const walk = (dir, url) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (!statSync(p).isDirectory()) continue;
        // (shell) 这类路由组不进 URL；[id] 这类动态段需要真实数据，不在本门射程
        if (/^\(.*\)$/.test(name)) { walk(p, url); continue; }
        if (/^\[.*\]$/.test(name)) continue;
        const next = `${url}/${name}`;
        try { statSync(join(p, "page.tsx")); routes.push(next); } catch { /* 该层无页面 */ }
        walk(p, next);
      }
    };
    const APP_DIR = join(APP_ROOT, "app");
    try { statSync(join(APP_DIR, "page.tsx")); routes.push("/"); } catch { /* 无根页 */ }
    walk(APP_DIR, "");

    const covered = new Set(MATRIX.flatMap((e) => e.pages));
    const excluded = new Set(ROUTE_EXCLUDE.map((e) => e.path));
    const missing = routes.filter((r) => !covered.has(r) && !excluded.has(r));
    checks += 1;
    if (missing.length) {
      record("P1", "-", "-", `视觉门未覆盖 ${missing.length} 个页面路由`, missing.join(" "));
    }
    // 反向自审：矩阵里若写了已不存在的路由，同样是失真（页面删了、测试还在跑一个 404）
    const stale = [...covered].filter((c) => !routes.includes(c));
    if (stale.length) record("P1", "-", "-", `矩阵含 ${stale.length} 个已不存在的路由`, stale.join(" "));
    console.log(`\n覆盖率：${covered.size}/${routes.length} 个页面路由（排除 ${excluded.size} 个：${ROUTE_EXCLUDE.map((e) => e.path + "=" + e.why).join("；")}）`);
  }

  writeFileSync(join(OUT, "findings.json"), JSON.stringify({ checks, findings }, null, 2));
  const bySev = (s) => findings.filter((f) => f.severity === s);
  console.log(`\n共执行 ${checks} 项视觉检查，截图落盘 ${OUT}`);
  for (const s of ["P1", "P2", "P3"]) {
    const list = bySev(s);
    console.log(`\n${s}：${list.length} 条`);
    for (const f of list.slice(0, 12)) console.log(`  · [${f.page} @${f.viewport}] ${f.issue} — ${f.detail}`);
    if (list.length > 12) console.log(`  … 另 ${list.length - 12} 条见 findings.json`);
  }
  process.exit(bySev("P1").length ? 1 : 0);
}

run().catch((e) => { console.error("visual runner 异常：", e.message); process.exit(1); });
