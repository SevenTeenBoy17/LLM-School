"use client";

/**
 * AdoptionFunnel — AI 回答采纳漏斗（对标 AIRecruit360 Candidate Conversion）。
 * Console 严肃调：横向递减条 + 数值 + 总转化% + 环比%。无装饰动画（仅宽度过渡）。
 */
import { ADOPTION_FUNNEL } from "@/lib/data/admin";
import type { FunnelStage } from "@/lib/types";

export function AdoptionFunnel({ data = ADOPTION_FUNNEL }: { data?: FunnelStage[] }) {
  const top = data[0]?.value || 1;
  return (
    <div className="space-y-3.5">
      {data.map((s, i) => {
        const pct = Math.round((s.value / top) * 100);
        const prev = i > 0 ? data[i - 1].value : 0;
        const step = i > 0 ? (prev > 0 ? Math.round((s.value / prev) * 100) : 0) : 100;
        // 「漏斗」这个词隐含逐级递减。删掉安全工单那一段之后，剩下三段在语义上确实是
        // 逐级收窄，但**并非结构上不可能超过 100%**：「重新生成」会产生额外的助手消息
        // 而不新增用户提问，于是「AI 完成回复」可以多于「用户提问」。
        //
        // 那种情况下不能装作没发生：条宽钳到 100%（否则溢出容器，视觉上等于悄悄截断），
        // 但**百分比数字照实显示**，并明确标注「超出上一级」。
        // 宁可承认这里不是严格漏斗，也不要把一个超过 100% 的分段画成一条满格的普通条。
        const overflowed = i > 0 && s.value > prev;
        return (
          <div key={s.stage}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="font-semibold text-[var(--text)]">{s.stage}</span>
              <span className="text-[var(--text-2)]">
                <span className="text-num font-semibold text-[var(--text)]">{s.value.toLocaleString()}</span>
                <span className="mx-1">·</span>{pct}%
                {i > 0 && <span className="ml-2 text-[var(--text-2)]">环比 {step}%</span>}
                {overflowed && (
                  <span className="ml-2 text-[var(--warn-ink)]" title="本级计数多于上一级（如「重新生成」会新增回复而不新增提问），因此此处不构成严格漏斗">
                    超出上一级
                  </span>
                )}
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-[12px] bg-[var(--bg-2)]">
              <div
                className="h-full rounded-[12px]"
                style={{ width: `${Math.min(pct, 100)}%`, background: s.color, transition: "width var(--t-slow) var(--ease-out)" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
