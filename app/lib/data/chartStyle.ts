/**
 * 图表 tooltip 的**唯一**样式来源。
 *
 * 由来（一条需要更正的旧记录）：上一批圆角收敛后 `/dashboard` 实测仍是 3 档，
 * 我当时把第三档归因为「recharts 图表库默认 10px」，并在 globals.css 加了
 * `.recharts-default-tooltip { border-radius: … !important }` 去覆写。
 * **这个归因是错的**——10px 根本不是库默认值，是我们自己在 6 处
 * `contentStyle={{ borderRadius: 10 }}` 里手写的；而那条 CSS 覆写在运行时
 * 压根没进样式表（浏览器里查不到该规则），所以它既没生效、也没被发现没生效。
 *
 * 两个教训：
 *   ① **先定位再修**。「第三方默认值」是个听起来合理的解释，合理到我没去验证它；
 *      真去浏览器里读一眼 inline style 就知道值来自哪里。
 *   ② 加了覆写却不验证覆写是否生效，等于把「已修复」写进了记录而实际未修。
 *
 * 6 处 contentStyle 此前是 3 种写法（10px + 令牌边框 / 10px + 裸灰边框 / 12px + 裸灰边框 + 阴影），
 * 同一个视觉元素三份定义——与 db.ts 里「同一套色板抄两份」是同一类问题。
 */

/** recharts `<Tooltip contentStyle>` 统一值。走令牌，因此明暗自适应、圆角随 --r-ctl。 */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: "var(--r-ctl)",
  border: "1px solid var(--border-2)",
  background: "var(--card)",
  color: "var(--text)",
  fontSize: 12,
  boxShadow: "var(--shadow-md, 0 8px 20px rgba(0,0,0,0.08))",
} as const;
