"use client";

import {
  CalendarCheck,
  Info,
  Target,
  TrendingUp,
} from "lucide-react";
import { Sparkline } from "@/components/common/Sparkline";
import { usePrefsStore } from "@/lib/store/usePrefsStore";
import type { ExploreProgress } from "@/lib/data/explore";

export function Leaderboard({ progress }: { progress: ExploreProgress }) {
  const showPeer = usePrefsStore((s) => s.showPeerComparison);
  const trendStart = progress.weeklyTrend[0] ?? 0;
  const trendEnd = progress.weeklyTrend[progress.weeklyTrend.length - 1] ?? 0;
  const delta = progress.vsYesterday;

  return (
    <div className="space-y-3">
      <div className="rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text)]">
            <TrendingUp size={13} className="text-[var(--c-edu)]" /> 比昨天的我
          </span>
          <span className={`text-num font-semibold ${delta >= 0 ? "text-[var(--ok-ink)]" : "text-[var(--err-ink)]"}`}>
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        </div>
        <div className="mt-1.5">
          <Sparkline
            data={progress.weeklyTrend}
            withArea
            ariaLabel={`近 7 日真实学习活跃趋势，从 ${trendStart}% 到 ${trendEnd}%`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-2)]">
            <CalendarCheck size={12} className="text-[var(--ok-ink)]" /> 本周来过
          </div>
          <div className="mt-0.5 text-num text-[18px] font-bold text-[var(--text)]">
            {progress.activeDays} <span className="text-[11px] text-[var(--text-3)]">天</span>
          </div>
        </div>
        <div className="rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-2)]">
            <Target size={12} className="text-[var(--c-edu)]" /> 覆盖估算
          </div>
          <div className="mt-0.5 text-num text-[18px] font-bold text-[var(--text)]">
            {progress.masteryCoverage}<span className="text-[11px] text-[var(--text-3)]">%</span>
          </div>
        </div>
      </div>

      {showPeer && progress.peerComparisonStatus === "available" && progress.peerBand ? (
        <div className="rounded-[12px] bg-[var(--p-mint)] px-3 py-2 text-[12px] text-[var(--p-mint-ink)]">
          匿名班级对比已开启：{progress.peerBand}
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-[12px] leading-relaxed text-[var(--text-2)]">
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--text)]">
            <Info size={12} /> 同伴对比未接入
          </span>
          <span className="mt-1 block">当前只展示自我成长，不用示例学生或虚构排行制造压力。</span>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--text-3)]">
        完成 {progress.questsDone}/{progress.questsTotal} 个探索信号；所有数字来自当前账号的真实记录或明确标注的估算。
      </p>
    </div>
  );
}
