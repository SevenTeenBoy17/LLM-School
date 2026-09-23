/**
 * 学科标记 —— **纯几何、无人形**（方案 §6.4-4 的默认路径）。
 *
 * 取代原先 8 张拟人插画（`/illustrations/subject-*.webp`）。三条理由，按分量排序：
 *
 * ① **方案已经裁定过了。** §6.4-4 写的是「在拿到确认前**不生成任何拟人化形象资产**，
 *    L0 插画只用纯几何/无人形图案」。独立盲审与校方确认都没有，那就是默认路径当值。
 *    我此前建议过「保留角色、只去掉学位帽」的限缩读法，但那需要**新生成**一批拟人资产——
 *    恰是这条默认路径要拦的动作。**方案是经三轮评审定下来的，不该在执行阶段被我重新讨论一遍。**
 *
 * ② **来源不明。** 那 8 张的生成模型、prompt、日期、许可证条款**四项全部未记录**
 *    （见 public/art/REGISTRY.md）。我一度准备在页面上加一行「插画由 AI 生成」补 AIGC 标识，
 *    随即发现**我并不知道它们是不是 AI 生成的**——方案记录的是另外 3 张。
 *    贴一行未经证实的来源声明，本身就是编造。几何图形由本文件确定性生成，来源问题不存在。
 *
 * ③ 七项合规里原本打不了勾的两项（IP 近似 / AIGC 标识）在这里**没有对象**：
 *    没有角色设计可近似，没有生成过程可标识。盲审这道门也随之不再卡在 `/explore` 上。
 *
 * 代价要说清楚：**视觉温度确实降了**。这批几何标记比原来的 3D 角色冷。
 * 保留温度的手段改由形状本身（圆润端点、柔和底色）承担，而不是靠一张拟人脸。
 * 若日后拿到盲审与校方确认，恢复只需把 QuestCard 的 <SubjectMark> 换回 <Image>——
 * 原 WebP 仍在 git 历史里。
 *
 * 配色：**不按学科分色**（§3.1 R1 颜色不表达归属，与卡片其余部分同一处置），
 * 统一走 --accent-tint 底 + currentColor 线，靠**形状**区分。
 */

import type { ExploreQuest } from "@/lib/data/explore";

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** 每个学科一组几何笔画。都是**物件/图形**的抽象，不含面孔与身体。 */
const MARKS: Record<ExploreQuest["icon"], { label: string; paths: React.ReactNode }> = {
  function: {
    label: "抽象图形：坐标轴与一条抛物线",
    paths: (
      <>
        <path d="M28 92 L92 92" {...S} />
        <path d="M28 92 L28 28" {...S} />
        <path d="M34 84 Q60 20 86 84" {...S} />
      </>
    ),
  },
  language: {
    // 首版画的是两组同向引号弧，自检时读起来像随机波纹而不是引号——
    // 弧的方向没有镜像、两组还错开了高度，眼睛找不到「成对」这个关系。
    // 改为对话框轮廓：几何形（圆角矩形 + 三角尾），不含人形，且「对话/语言」这层意思不用猜。
    label: "抽象图形：对话框轮廓",
    paths: (
      <>
        <path d="M26 36 h68 a8 8 0 0 1 8 8 v34 a8 8 0 0 1 -8 8 H54 l-16 14 v-14 h-12 a8 8 0 0 1 -8 -8 V44 a8 8 0 0 1 8 -8 z" {...S} />
        <path d="M40 55 h40" {...S} strokeWidth={5} />
        <path d="M40 69 h24" {...S} strokeWidth={5} />
      </>
    ),
  },
  atom: {
    label: "抽象图形：三条同心椭圆轨道",
    paths: (
      <>
        <ellipse cx="60" cy="60" rx="34" ry="14" {...S} />
        <ellipse cx="60" cy="60" rx="34" ry="14" transform="rotate(60 60 60)" {...S} />
        <ellipse cx="60" cy="60" rx="34" ry="14" transform="rotate(120 60 60)" {...S} />
      </>
    ),
  },
  scroll: {
    label: "抽象图形：层叠的水平地层带",
    paths: (
      <>
        <path d="M28 40 L92 40" {...S} />
        <path d="M28 56 L78 56" {...S} />
        <path d="M28 72 L92 72" {...S} />
        <path d="M28 88 L66 88" {...S} />
      </>
    ),
  },
  code: {
    label: "抽象图形：左右两组折线构成的尖括号",
    paths: (
      <>
        <path d="M44 40 L24 60 L44 80" {...S} />
        <path d="M76 40 L96 60 L76 80" {...S} />
        <path d="M66 34 L54 86" {...S} />
      </>
    ),
  },
  dna: {
    // 首版用 Q 二次曲线连了两段，末端甩出一个回环，三根横档又和曲线同宽——
    // 在 6px 线宽下整体糊成一团。改为两条**三次贝塞尔**的镜像正弦，横档改细并按
    // 螺旋透视收窄（中间宽、两端窄），交错关系才读得出来。
    label: "抽象图形：两条镜像正弦与横档",
    paths: (
      <>
        <path d="M44 24 C84 44 84 76 44 96" {...S} />
        <path d="M76 24 C36 44 36 76 76 96" {...S} />
        <path d="M52 40 h16" {...S} strokeWidth={4} />
        <path d="M47 60 h26" {...S} strokeWidth={4} />
        <path d="M52 80 h16" {...S} strokeWidth={4} />
      </>
    ),
  },
  flask: {
    label: "抽象图形：倒三角与圆的组合",
    paths: (
      <>
        <path d="M42 28 L78 28" {...S} />
        <path d="M50 28 L50 56 L32 88 L88 88 L70 56 L70 28" {...S} />
        <circle cx="54" cy="76" r="5" fill="currentColor" stroke="none" />
        <circle cx="68" cy="70" r="3.5" fill="currentColor" stroke="none" />
      </>
    ),
  },
  globe: {
    label: "抽象图形：圆与经纬网格",
    paths: (
      <>
        <circle cx="60" cy="60" r="32" {...S} />
        <ellipse cx="60" cy="60" rx="14" ry="32" {...S} />
        <path d="M29 50 L91 50" {...S} />
        <path d="M29 70 L91 70" {...S} />
      </>
    ),
  },
};

export function SubjectMark({ icon, className }: { icon: ExploreQuest["icon"]; className?: string }) {
  const mark = MARKS[icon] ?? MARKS.globe;
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      // 装饰图：文字等价物由卡片上的学科 chip 与标题承担（§6.4 末条「插画不得承载唯一信息」）。
      // 因此 aria-hidden，不给 role="img"——给了反而会让读屏多念一遍冗余描述。
      aria-hidden
      focusable="false"
      data-subject-mark={icon}
    >
      <title>{mark.label}</title>
      <circle cx="60" cy="60" r="52" fill="var(--accent-tint)" />
      <g color="var(--accent-focus)">{mark.paths}</g>
    </svg>
  );
}
