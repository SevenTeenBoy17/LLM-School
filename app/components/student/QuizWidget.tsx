"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { pointsForSubject } from "@/lib/knowledgePoints";
import { cn } from "@/lib/utils";
import { GenerationProgress } from "@/components/common/GenerationProgress";

/**
 * W-B2 · AI 随堂小测（雷达「正确率」的唯一供数源，规格红线 R2）。
 * 出题=真实网关（失败诚实报错，无假题库）；判分=服务端确定性比对（答案不下发）；
 * 答错自动回流错题本并明说。一题一答，防刷正确率。
 */

const SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理"];

interface Q { id: string; subject: string; knowledgePoint: string; question: string; options: string[] }
interface Verdict { correct: boolean; answerIdx: number; mistakeAdded: boolean }

export function QuizWidget() {
  const [subject, setSubject] = useState("数学");
  const [point, setPoint] = useState<string>(pointsForSubject("数学")[0]);
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const gen = async () => {
    setLoading(true); setError(""); setQ(null); setVerdict(null); setPicked(null);
    try {
      const r = await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, knowledgePoint: point }) });
      const j = await r.json();
      if (!r.ok) { setError(j.message || "暂时无法出题，请稍后再试"); return; }
      setQ(j);
    } catch { setError("网络异常，请重试"); } finally { setLoading(false); }
  };

  const answer = async (idx: number) => {
    if (!q || verdict || picked !== null) return;
    setPicked(idx);
    try {
      const r = await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: q.id, answerIdx: idx }) });
      const j = await r.json();
      if (r.ok) setVerdict(j);
      else { setError("提交失败，请重新出题"); setPicked(null); }
    } catch { setError("网络异常，请重试"); setPicked(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={subject} onChange={(e) => { setSubject(e.target.value); setPoint(pointsForSubject(e.target.value)[0]); }}
          aria-label="选择学科"
          className="h-[40px] rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-2.5 text-[13px]">
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={point} onChange={(e) => setPoint(e.target.value)} aria-label="选择知识点"
          className="h-[40px] min-w-0 rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-2.5 text-[13px]">
          {pointsForSubject(subject).map((p) => <option key={p}>{p}</option>)}
        </select>
        <button type="button" onClick={gen} disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:-translate-y-px disabled:opacity-50"
          style={{ backgroundImage: "var(--grad-primary)" }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} {q || verdict ? "再来一题" : "开始小测"}
        </button>
      </div>

      <GenerationProgress active={loading} label="正在生成随堂小测" detail="正在等待题目与选项返回" />
      <GenerationProgress active={!loading && picked !== null && verdict === null} label="正在核对作答结果" />
      {error && <p role="alert" className="text-[13px] text-[var(--c-alert)]">{error}</p>}

      {q && (
        <div className="rounded-[16px] border border-[var(--border-2)] bg-[var(--card)] p-4">
          <p className="text-[14px] font-semibold leading-relaxed text-[var(--text)]">{q.question}</p>
          <p className="mt-1 text-[12px] text-[var(--text-3)]">AI 出题 · {q.subject}「{q.knowledgePoint}」 · 判分由服务端完成</p>
          <div className="mt-3 space-y-2">
            {q.options.map((opt, i) => {
              const isPicked = picked === i;
              const isAnswer = verdict !== null && verdict.answerIdx === i;
              const wrongPick = verdict !== null && isPicked && !verdict.correct;
              return (
                <button key={i} type="button" onClick={() => answer(i)} disabled={verdict !== null || picked !== null}
                  className={cn(
                    "flex w-full min-h-[44px] items-center gap-2 rounded-[12px] border px-3 py-2 text-left text-[13px] transition-colors",
                    isAnswer ? "border-[var(--ok-ink)]/50 bg-[var(--ok-bg)]" :
                    wrongPick ? "border-[var(--c-alert)]/50 bg-[var(--c-alert)]/5" :
                    isPicked ? "border-[var(--c-edu)]/50" : "border-[var(--border-2)] hover:border-[var(--c-edu)]/35"
                  )}>
                  <span className="text-[var(--text-2)]">{String.fromCharCode(65 + i)}.</span>
                  <span className="min-w-0 flex-1 text-[var(--text)]">{opt.replace(/^[A-D][.、\s]+/, "")}</span>
                  {isAnswer && <CheckCircle2 size={15} className="shrink-0 text-[var(--ok-ink)]" />}
                  {wrongPick && <XCircle size={15} className="shrink-0 text-[var(--c-alert)]" />}
                </button>
              );
            })}
          </div>
          {verdict && (
            <p role="status" className="mt-3 text-[13px] text-[var(--text-2)]">
              {verdict.correct ? "答对了，这一题计入你的正确率。" : `没答对——正确答案是 ${String.fromCharCode(65 + verdict.answerIdx)}。${verdict.mistakeAdded ? "这道题已自动收进错题本，等你回头清理。" : ""}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
