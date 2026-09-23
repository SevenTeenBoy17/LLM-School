"use client";

import * as Icons from "lucide-react";

/**
 * KpiCard — 管理端的单个指标卡。
 *
 * 视觉分层的一次减法。实测 /admin/analytics 上有 17 个卡片容器，
 * 其中 6 张 KPI 卡各自叠着三层装饰：
 *   · 一颗 h-24 w-24 的渐变模糊球（`-right-6 -top-8 opacity-10 blur-2xl`），纯装饰
 *   · 一个 h-10 w-10 的饱和渐变图标块 + shadow-md（14px 根字号下实测 35×35 = 1225px²）
 *   · 24px 的数值本身
 * 前两层加起来的视觉重量压过了第三层——而卡片存在的**全部意义**就是那个数字。
 * 一屏 6 张，等于把这套竞争重复 6 遍。
 *
 * 两处减法（数值均为改后实测，非估计）：
 * 1. **删掉模糊球**：全页 6 颗 → 0 颗。它不承载任何信息，删掉是净收益，无可读性损失。
 * 2. **图标块从「饱和渐变 + 阴影」降为「浅底 + 同色图标」**：h-10 → h-7，
 *    面积 1225 → 600px²（−51%），且不再有渐变与阴影。
 *    保留它是因为图标承担了扫读时的辨认功能（六张卡靠图标区分而不是靠读标签），
 *    但它不该比数值更响。降级后数值是卡内唯一的强元素。
 *
 * 配色改用单色而非渐变：`accent` 取自既有语义令牌，底色用 color-mix 从同一个令牌
 * 派生 12%，不引入任何新色值（色彩门按文件统计唯一色，派生写法不增加计数）。
 * 字段名也从 `gradient` 改成 `accent`——它现在真的是一个颜色，不是渐变。
 */
export interface Kpi {
  label: string;
  value: string;
  /** 口径说明（「全部合计」「等待复核」），**不是**增减量 */
  delta: string;
  icon: string;
  /** 语义强调色（单色令牌，非渐变） */
  accent: string;
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (Icons as any)[kpi.icon] as React.ComponentType<{ size?: number }>;
  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px]"
          style={{
            background: `color-mix(in srgb, ${kpi.accent} 12%, var(--card))`,
            color: kpi.accent,
          }}
        >
          {Icon && <Icon size={14} />}
        </span>
        {/* delta 是口径说明，不是增减量。此处原有 positive:boolean 渲染成绿↑/红↓，
            等于给一句说明文字套上涨跌语义；本系统无任何同比环比数据源。 */}
        <span className="text-right text-[12px] text-[var(--text-2)]">{kpi.delta}</span>
      </div>
      <div className="mt-3 text-[12px] text-[var(--text-2)]">{kpi.label}</div>
      <div className="text-num text-[24px] font-bold">{kpi.value}</div>
    </div>
  );
}
