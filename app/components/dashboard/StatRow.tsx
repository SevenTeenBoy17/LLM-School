"use client";

import * as motion from "motion/react-client";
import * as Icons from "lucide-react";
import { TeacherFeatureGlyph, featureGlyphForDashboardStat } from "@/components/common/TeacherFeatureGlyph";

interface StatItem {
  id: string;
  label: string;
  value: string;
  /** 一句口径说明（如「按回复文本估算」「12 待跟进」），**不是**增减量。
   *  这里曾并列一个 up:boolean，被渲染成绿↑/红↓——给一句说明文字套上了涨跌语义，
   *  最刺眼的组合是「安全/越权事件 0」配一个向上的绿箭头。本系统没有任何同比
   *  环比数据源，趋势不存在，字段已整体删除而非隐藏。 */
  delta: string;
  icon: string;
  tone: "blue" | "violet" | "cyan" | "green" | "red" | "gold";
}

interface Props {
  stats: StatItem[];
}

export function StatRow({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {stats.map((s, i) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Icon = (Icons as any)[s.icon] as React.ComponentType<{ size?: number }>;
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.4 }}
            className="teacher-feature-surface surface-card relative overflow-hidden p-4 transition-shadow hover:shadow-[var(--shadow-md)]"
          >
            <div className="flex items-start justify-between">
              <TeacherFeatureGlyph name={featureGlyphForDashboardStat(s.id)} size={46} fallback={Icon} />
              {/* 中性色 + 无箭头：delta 是口径说明，不承载方向。 */}
              <span className="text-[12px] text-[var(--text-2)]">{s.delta}</span>
            </div>
            <div className="mt-3 text-[12px] text-[var(--text-2)]">{s.label}</div>
            <div className="mt-1 text-[24px] font-semibold tracking-tight text-num">{s.value}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
