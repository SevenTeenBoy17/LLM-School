"use client";

import { useState } from "react";
import { Loader2, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * W-B2 · 教师快捷点评（ClassDojo 一键事件流的启示：低负担=点选学生+点选标签即提交）。
 * 数据进 evaluations 表，供学生雷达「教师评价」维与档案袋使用。
 * 「需要关注」记 0 分（零分反馈：点评是反馈不是惩罚）；无任何班内比较视图（禁排行榜）。
 */

const TAGS = ["专注投入", "积极提问", "乐于互助", "明显进步", "课堂展示", "需要关注"] as const;

export function QuickEvalPanel({ students }: { students: { id: string; name: string }[] }) {
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const submit = async (tag: string) => {
    if (!studentId || busy) return;
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/evaluations", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, tag }),
      });
      const j = await r.json();
      if (r.ok) {
        const name = students.find((s) => s.id === studentId)?.name ?? studentId;
        setNotice(`已记录：${name} · ${tag}`);
      } else {
        setNotice(j.message || "提交失败，请重试");
      }
    } catch { setNotice("网络异常，请重试"); } finally { setBusy(false); }
  };

  return (
    <section aria-label="快捷点评" className="surface-card p-4 md:p-5">
      <h2 className="text-[14px] font-semibold text-[var(--text)]">快捷点评</h2>
      <p className="mt-1 text-[12px] text-[var(--text-2)]">
        选学生、点标签即完成一次课堂点评——会进入学生的课堂雷达与成长记录。「需要关注」只作提醒，不扣分。
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {students.map((s) => (
          <button key={s.id} type="button" onClick={() => setStudentId(s.id)}
            aria-pressed={studentId === s.id}
            className={cn(
              "inline-flex min-h-[40px] items-center rounded-full border px-3 text-[13px] transition-colors",
              studentId === s.id
                ? "border-[var(--c-edu)]/60 bg-[var(--rg-selected-bg)] font-semibold text-[var(--c-primary)]"
                : "border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text)]"
            )}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TAGS.map((tag) => (
          <button key={tag} type="button" onClick={() => submit(tag)} disabled={!studentId || busy}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text)] transition-colors hover:border-[var(--c-edu)]/45 disabled:cursor-not-allowed disabled:opacity-45">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ThumbsUp size={13} />} {tag}
          </button>
        ))}
      </div>
      {notice && <p role="status" aria-live="polite" className="mt-2 text-[12px] text-[var(--text-2)]">{notice}</p>}
    </section>
  );
}
