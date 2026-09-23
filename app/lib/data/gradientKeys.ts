// 提示词 / 智能体卡片配色：由**自由 CSS 字符串**收敛为**枚举键**（方案 §4.2.1）。
//
// 为什么必须做：
//  ① 色彩治理：`prompts.gradient` / `agents.gradient` 是数据库 TEXT 列，源码守卫扫不到。
//     只改源码不改数据层，`/prompts`、`/agents`、`/chat` 的渐变仍由 DB 供给，色族数一点没降，
//     而「裸渐变 0 命中」的门却是绿的——一个能骗过自己的指标（正是 §1.1 批评初稿色数口径的同一句话）。
//  ② 安全：旧实现是 `z.string().max(120)` → 直接进 `style={{ backgroundImage: x }}`，
//     教师可写入任意 CSS 值。收成 z.enum 顺带关掉这个样式注入面。
//
// 键的语义按「功能角色」而非「学科归属」（§3.1 R1）：
//   accent 主行动 · info 信息/中性 · warm 提醒/活力 · calm 沉静/深度

export const GRADIENT_KEYS = ["accent", "info", "warm", "calm"] as const;
export type GradientKey = (typeof GRADIENT_KEYS)[number];

export const DEFAULT_GRADIENT_KEY: GradientKey = "accent";

/** 键 → CSS。四条，取代此前 14 个去重字面量。 */
const GRADIENT_CSS: Record<GradientKey, string> = {
  accent: "linear-gradient(135deg,#2563EB,#06B6D4)",
  info: "linear-gradient(135deg,#06B6D4,#10B981)",
  warm: "linear-gradient(135deg,#F59E0B,#EF4444)",
  calm: "linear-gradient(135deg,#7C3AED,#312E81)",
};

export function isGradientKey(v: unknown): v is GradientKey {
  return typeof v === "string" && (GRADIENT_KEYS as readonly string[]).includes(v);
}

/** 渲染层唯一入口：组件不再接收颜色字符串，只接收键。 */
export function gradientCss(key: unknown): string {
  return GRADIENT_CSS[isGradientKey(key) ? key : DEFAULT_GRADIENT_KEY];
}

/**
 * 迁移用：把历史自由字符串按**首色标色相**归入枚举键。
 *
 * 注意这是有语义后果的取舍，不是机械取整：错误红（err 语义色）不得单独成为装饰键，
 * 它只在 warm 组合里作为第二色标出现；无法归类的一律落 accent（中性主色），
 * 宁可少一点表现力，也不要把一张中性卡片染成警示色。
 */
/* MIGRATION-ONLY:START —— 以下正则是**历史值映射表**，不是色板。
   它们在迁移完成、旧 gradient 列 DROP 之后即可整块删除（方案 §4.2.1）。
   色板上限断言按标记跳过本区，避免把迁移数据算成色板颜色而抬高上限蒙混过关。 */
const HUE_TO_KEY: Array<[RegExp, GradientKey]> = [
  [/#(2563EB|312E81|6366F1|1D4ED8|3B82F6)/i, "accent"],
  [/#(06B6D4|10B981|0EA5E9|14B8A6|22D3EE)/i, "info"],
  [/#(F59E0B|EC4899|EF4444|FCD34D|E11D48)/i, "warm"],
  [/#(7C3AED|A855F7|8B5CF6|6D28D9)/i, "calm"],
];

/* MIGRATION-ONLY:END */

export function legacyGradientToKey(legacy: string | null | undefined): GradientKey {
  if (!legacy) return DEFAULT_GRADIENT_KEY;
  if (isGradientKey(legacy)) return legacy; // 已迁移过
  const first = legacy.match(/#[0-9A-Fa-f]{6}/);
  const probe = first ? first[0] : legacy;
  for (const [re, key] of HUE_TO_KEY) if (re.test(probe)) return key;
  return DEFAULT_GRADIENT_KEY;
}

/**
 * 数据可视化色板（§3.1 R1 第四类，单列预算 ≤6，必须来自这一处）。
 *
 * 与「颜色不表达归属」不冲突：图表里**颜色就是数据编码**，是它唯一的功能角色。
 * 但必须满足两条：①来自统一色板而非各处自造；②总数 ≤6，超出即改用图案/标签区分。
 *
 * 注意：这里用的是**设计系统色**，不是各模型厂牌色（曾用 OpenAI 绿 / Anthropic 砖红 / Google 蓝等厂牌色）。
 * 厂牌色确实是用户的认知锚点，但它们各自独立、不受本项目色板约束，五个模型就是五个外来色相；
 * 模型身份已由 ModelGlyph 图标 + 名称文字承载，图表里再用厂牌色是第三次编码同一信息。
 *
 * 本文件被色彩棘轮门排除在扫描外（它是色板的**唯一定义处**，与 globals.css 的令牌区同性质），
 * 因此门里另有一条上限断言：本文件的 hex 总数不得超过 GRADIENT_CSS(4×2) + CHART_PALETTE(6) = 14，
 * 防止把它当成「倾倒颜色即可绕过棘轮」的后门。
 *
 * 下方 MODEL_PALETTE 不进这笔账——它的 5 个值全是对本数组的**引用**，没有新增字面量。
 * 换句话说「新增一档色板」并没有让上限松一格，这一点是刻意保持的。
 */
export const CHART_PALETTE = [
  "#2563EB", // accent 系
  "#06B6D4", // info 系
  "#7C3AED", // calm 系
  "#F59E0B", // warm 系
  "#10B981",
  "#64748B", // 中性兜底
] as const;

export function chartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

/**
 * 模型身份色板（§3.1 R1 的**第五类**，5 槽，仅用于模型这一个封闭集合）。
 *
 * 为什么模型可以有专用色板，而学科/角色/推荐卡不行：
 * 前三者的颜色是**冗余编码**——名称、图标、选中态已经把身份说清楚了，颜色是第三遍。
 * 模型不同：`/hub` 这一页的**核心任务就是「比较并选择模型」**，同屏并列 5 个候选，
 * 颜色在这里是主要的区分手段而非装饰。抹平成单一强调色会直接损害页面的本职功能。
 *
 * 但「可以有色」不等于「可以用厂牌色」。原实现直接写死了 OpenAI 绿、Anthropic 陶土、
 * Google 蓝——五个不受本项目色板约束的外来色相。
 * （其中 Google 蓝那一槽尤其荒谬：它早已改路由到 GLM·智谱，卡片名都换了，
 *   却还穿着 Google 的品牌蓝。**厂牌色一旦硬编码，模型换了它也不会跟着换。**）
 *
 * 注：本段刻意不写出那三个 hex 字面量。色门是**全文件扫描**（故意的——否则把颜色搬进
 * 常量表就能骗过它），注释里的字面量同样计数。正确回应是把话说清楚而不依赖字面量，
 * 不是去放宽扫描口径。
 *
 * 因此 5 槽的值**全部取自 CHART_PALETTE**——不引入任何新色相，本文件 hex 计数不变
 * （色门的 C3 上限断言因此仍然诚实，没有为了塞新色板而抬上限）。
 * 单独命名而不直接复用 chartColor()，是为了让「图表序列色」与「模型身份色」
 * 日后可以各自演进而不互相牵动；今天两者取值相同，是巧合被记录下来，不是耦合。
 */
export const MODEL_PALETTE = [
  CHART_PALETTE[0], // accent 系
  CHART_PALETTE[1], // info 系
  CHART_PALETTE[2], // calm 系
  CHART_PALETTE[3], // warm 系
  CHART_PALETTE[4], // green
  CHART_PALETTE[5], // slate（F2 第 6 槽：仍是引用，hex 计数不变，C3 断言不动）
] as const;

/**
 * 由单一底色生成同色系渐变对。
 *
 * 用**同色系明度渐变**而不是「两个不同色相拼一条」：后者每张卡都要再挑一个第二色，
 * 等于把「5 个色相」的问题变成「10 个色相」。同色系 ramp 让五张卡读起来像**一套**，
 * 而不是五张各自为政的卡片——这正是从厂牌色迁到系统色板要换来的东西。
 */
export function tonalPair(base: string): [string, string] {
  return [base, `color-mix(in srgb, ${base} 58%, white)`];
}
