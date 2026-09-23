"use client";

import { Clock, MapPin, Users } from "lucide-react";
import type { DashboardCourse } from "@/lib/data/dashboardSnapshot";

const STATUS_TONE: Record<DashboardCourse["status"], { bg: string; text: string; label: string }> = {
  done: { bg: "bg-[var(--ok-bg)]", text: "text-[var(--ok-ink)]", label: "已完成" },
  current: { bg: "bg-[var(--info-bg)]", text: "text-[var(--info-ink)]", label: "进行中" },
  upcoming: { bg: "bg-[var(--warn-bg)]", text: "text-[var(--warn-ink)]", label: "待处理" },
  not_connected: { bg: "bg-[var(--rg-control-bg)]", text: "text-[var(--text-3)]", label: "未接入" },
};

interface TodayCoursesProps {
  courses: DashboardCourse[];
}

export function TodayCourses({ courses }: TodayCoursesProps) {
  return (
    <div className="space-y-2">
      {courses.map((c) => {
        const tone = STATUS_TONE[c.status];
        return (
          <div key={c.id} data-status={c.status} className="flex items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-2.5 transition hover:bg-[var(--rg-hover-bg)]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--rg-selected-bg)] text-[var(--c-primary)]">
              <Clock size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-[var(--text)]">{c.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>{tone.label}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-2)]">
                <span>{c.time}</span>
                <span className="inline-flex items-center gap-1"><MapPin size={11} /> {c.room}</span>
                <span className="inline-flex items-center gap-1"><Users size={11} /> {c.roster}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
