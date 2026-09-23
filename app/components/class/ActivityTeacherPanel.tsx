"use client";

import { useEffect, useState } from "react";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { ClipboardList, Loader2, Send, Sparkles, CheckCircle2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { templatesForSubject } from "@/lib/data/activityTemplates";

/**
 * W-B3 · 教师端项目活动（规格⑥）：发布 → 按学生完成状态面板 → 批阅（通过入册/退回附理由）。
 * 面板只呈现完成状态与完成率，不做任何按成绩排序（红线 R1）。
 * 附：AI 成长建议草稿区（R5）——生成的草稿标「待老师确认」，改定后发布才对学生可见，可撤回。
 */

const SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理"];
const STATUS_LABEL: Record<string, string> = { none: "未开始", draft: "进行中", submitted: "已提交", approved: "已通过", returned: "已退回" };

interface BoardRow { studentId: string; name: string; status: string }
interface Act { id: string; subject: string; title: string; brief: string; dueAt: number | null; status: string; createdAt: number; board: BoardRow[]; completion: number | null }
interface AdviceRow { id: string; status: string; draftText: string; finalText: string | null; createdAt: number }

export function ActivityTeacherPanel({ students }: { students: { id: string; name: string }[] }) {
  const [acts, setActs] = useState<Act[] | null>(null);
  const [subject, setSubject] = useState("语文");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [dueDate, setDueDate] = useState(""); // G2：截止日期（当天 23:59 生效）
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reviewFor, setReviewFor] = useState<{ actId: string; studentId: string } | null>(null);
  const [feedback, setFeedback] = useState("");

  const load = () => {
    fetch("/api/activities").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setActs(d.activities)).catch(() => setNotice("活动加载失败"));
  };
  useEffect(load, []);

  const publish = async () => {
    if (!title.trim() || !brief.trim() || busy) return;
    setBusy(true); setNotice("");
    try {
      // dueAt = 所选日期当天 23:59:59（学生按自己的日历理解「截止到那天」）
      const dueAt = dueDate ? new Date(`${dueDate}T23:59:59`).getTime() : undefined;
      const r = await fetch("/api/activities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, title: title.trim(), brief: brief.trim(), ...(dueAt ? { dueAt } : {}) }) });
      const d = await r.json();
      if (r.ok) { setTitle(""); setBrief(""); setDueDate(""); setNotice("活动已发布，全班可见。"); load(); }
      else setNotice(d.message || "发布失败");
    } catch { setNotice("网络异常，请重试"); } finally { setBusy(false); }
  };

  const review = async (verdict: "approve" | "return") => {
    if (!reviewFor || busy) return;
    if (verdict === "return" && !feedback.trim()) { setNotice("退回必须写明理由——学生看得到「为什么」，才改得动。"); return; }
    setBusy(true); setNotice("");
    try {
      const r = await fetch(`/api/activities/${reviewFor.actId}/review`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId: reviewFor.studentId, verdict, feedback: feedback.trim() || undefined }),
      });
      const d = await r.json();
      if (r.ok) { setNotice(verdict === "approve" ? "已通过，自动收进该生档案袋。" : "已退回。"); setReviewFor(null); setFeedback(""); load(); }
      else setNotice(d.message || "批阅失败");
    } catch { setNotice("网络异常，请重试"); } finally { setBusy(false); }
  };

  return (
    <section aria-label="项目活动" className="surface-card p-4 md:p-5">
      <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text)]"><ClipboardList size={15} className="text-[var(--accent)]" /> 项目活动</h2>
      <p className="mt-1 text-[12px] text-[var(--text-2)]">发布学科小项目；学生提交后在这里批阅——通过自动入档案袋，退回必须附理由。</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="活动学科"
          className="h-[40px] rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-2.5 text-[13px]">
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="活动标题，如：家乡的一处风景" maxLength={80} aria-label="活动标题"
          className="h-[40px] min-w-0 flex-1 rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 text-[13px] outline-none focus:border-[var(--c-edu)]/45" />
        <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
          截止
          <input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)}
            aria-label="截止日期（可选）"
            className="h-[40px] rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-2.5 text-[13px] text-[var(--text)]" />
        </label>
      </div>
      {/* G2 模板库：一键填充（可再改——模板是脚手架不是牢笼） */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {templatesForSubject(subject).map((t) => (
          <button key={t.title} type="button" onClick={() => { setTitle(t.title); setBrief(t.brief); setNotice(""); }}
            className="inline-flex min-h-[40px] items-center rounded-full border border-dashed border-[var(--border-2)] px-3 text-[12px] text-[var(--text-2)] transition-colors hover:border-[var(--c-edu)]/45 hover:text-[var(--text)]">
            {t.title}
          </button>
        ))}
      </div>
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} maxLength={2000} aria-label="活动说明"
        placeholder="写清楚要做什么、交什么（例：观察并写 200 字笔记）"
        className="mt-2 w-full rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-3 text-[13px] outline-none focus:border-[var(--c-edu)]/45" />
      <button type="button" onClick={publish} disabled={busy || !title.trim() || !brief.trim()}
        className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:-translate-y-px disabled:opacity-50"
        style={{ backgroundImage: "var(--grad-primary)" }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 发布活动
      </button>

      {acts && acts.length > 0 && (
        <div className="mt-4 space-y-3">
          {acts.map((a) => (
            <div key={a.id} className="rounded-[12px] border border-[var(--border-2)] p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full border border-[var(--border-2)] px-2 py-0.5 text-[12px] text-[var(--text-2)]">{a.subject}</span>
                <span className="text-[13px] font-semibold text-[var(--text)]">{a.title}</span>
                <span className="ml-auto text-[12px] text-[var(--text-3)]">
                  {a.dueAt ? `截止 ${new Date(a.dueAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} · ` : ""}
                  {a.completion !== null ? `完成率 ${Math.round(a.completion * 100)}%` : "暂无名册"}
                </span>
              </div>
              {/* 按学生完成状态（规格⑥-3「有门没人跑」面板）；只显示状态，无成绩排序 */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.board.map((b) => {
                  const active = reviewFor?.actId === a.id && reviewFor?.studentId === b.studentId;
                  const reviewable = b.status === "submitted";
                  return (
                    <button key={b.studentId} type="button" disabled={!reviewable}
                      onClick={() => { setReviewFor(active ? null : { actId: a.id, studentId: b.studentId }); setFeedback(""); setNotice(""); }}
                      aria-pressed={active}
                      className={cn("inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3 text-[12px] transition-colors",
                        active ? "border-[var(--c-edu)]/60 bg-[var(--rg-selected-bg)] font-semibold text-[var(--c-primary)]"
                          : b.status === "approved" ? "border-[var(--ok-ink)]/40 text-[var(--ok-ink)]"
                          : reviewable ? "border-[var(--c-edu)]/40 text-[var(--text)]"
                          : "border-[var(--border-2)] text-[var(--text-3)]",
                        !reviewable && "cursor-default")}>
                      {b.name} · {STATUS_LABEL[b.status] ?? b.status}
                    </button>
                  );
                })}
              </div>
              {reviewFor?.actId === a.id && (
                <div className="mt-2">
                  <SubmissionPreview actId={a.id} studentId={reviewFor.studentId} />
                  <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} maxLength={500} aria-label="批阅意见"
                    placeholder="评语（通过可选填；退回必填理由）"
                    className="mt-2 w-full rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-2.5 text-[13px] outline-none focus:border-[var(--c-edu)]/45" />
                  <div className="mt-1.5 flex gap-2">
                    <button type="button" onClick={() => review("approve")} disabled={busy}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-[12px] border border-[var(--ok-ink)]/40 px-3.5 text-[13px] text-[var(--ok-ink)] transition-colors hover:bg-[var(--ok-bg)] disabled:opacity-50">
                      <CheckCircle2 size={14} /> 通过并入册
                    </button>
                    <button type="button" onClick={() => review("return")} disabled={busy}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text)] transition-colors hover:border-[var(--c-alert)]/45 disabled:opacity-50">
                      <Undo2 size={14} /> 退回修改
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AdviceDraftArea students={students} />
      {notice && <p role="status" aria-live="polite" className="mt-2 text-[12px] text-[var(--text-2)]">{notice}</p>}
    </section>
  );
}

function SubmissionPreview({ actId, studentId }: { actId: string; studentId: string }) {
  const [content, setContent] = useState("");
  const [artifact, setArtifact] = useState<{ name: string; chars: number; preview: string } | null>(null);
  const [showArtifact, setShowArtifact] = useState(false);
  useEffect(() => {
    fetch(`/api/activities/${actId}/submission?studentId=${encodeURIComponent(studentId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setContent(d.content ?? ""); setArtifact(d.artifact ?? null); })
      .catch(() => { setContent(""); setArtifact(null); });
  }, [actId, studentId]);
  if (!content) return null;
  return (
    <div className="mt-2">
      <p className="whitespace-pre-wrap rounded-[10px] bg-[var(--rg-control-bg)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text)]">{content}</p>
      {artifact && (
        <div className="mt-1.5">
          <button type="button" onClick={() => setShowArtifact((v) => !v)} aria-expanded={showArtifact}
            className="inline-flex min-h-[40px] items-center rounded-[10px] border border-[var(--border-2)] px-3 text-[12px] text-[var(--text-2)] transition-colors hover:text-[var(--text)]">
            佐证材料：{artifact.name}（{artifact.chars} 字）· {showArtifact ? "收起" : "展开预览"}
          </button>
          {showArtifact && (
            <p className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-[var(--border-2)] px-3 py-2 text-[12px] leading-relaxed text-[var(--text-2)]">{artifact.preview}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** R5 草稿区：AI 生成 → 标「待老师确认」→ 教师改定发布 → 可撤回。 */
function AdviceDraftArea({ students }: { students: { id: string; name: string }[] }) {
  const [studentId, setStudentId] = useState("");
  const [rows, setRows] = useState<AdviceRow[]>([]);
  const [editText, setEditText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState("");

  const load = (sid: string) => {
    if (!sid) { setRows([]); return; }
    fetch(`/api/portfolio/advice?studentId=${encodeURIComponent(sid)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.advice ?? []))
      .catch(() => setRows([]));
  };

  const gen = async () => {
    if (!studentId || busy) return;
    setBusy(true); setGenerating(true); setNote("");
    try {
      const r = await fetch("/api/portfolio/advice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId }) });
      const d = await r.json();
      if (r.ok) { setNote("草稿已生成——AI 起草，发布前请审改。"); load(studentId); }
      else setNote(d.message || "生成失败");
    } catch { setNote("网络异常，请重试"); } finally { setBusy(false); setGenerating(false); }
  };

  const act = async (id: string, action: "publish" | "withdraw") => {
    if (busy) return;
    setBusy(true); setNote("");
    try {
      const body: Record<string, string> = { id, action };
      if (action === "publish") body.finalText = (editText[id] ?? rows.find((r) => r.id === id)?.draftText ?? "").trim();
      const r = await fetch("/api/portfolio/advice", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { setNote(action === "publish" ? "已发布，学生端可见（署名双归因）。" : "已撤回，学生端不再显示。"); load(studentId); }
      else setNote(d.message || "操作失败");
    } catch { setNote("网络异常，请重试"); } finally { setBusy(false); }
  };

  return (
    <div className="mt-4 rounded-[12px] border border-[var(--border-2)] p-3">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text)]"><Sparkles size={14} className="text-[var(--accent)]" /> AI 成长建议草稿区</h3>
      <p className="mt-1 text-[12px] text-[var(--text-3)]">AI 只起草，你审改并确认后学生才看得到；随时可撤回。建议基于该生真实数据生成。</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={studentId} onChange={(e) => { setStudentId(e.target.value); load(e.target.value); }} aria-label="选择学生"
          className="h-[40px] rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-2.5 text-[13px]">
          <option value="">选择学生…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" onClick={gen} disabled={!studentId || busy}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text)] transition-colors hover:border-[var(--c-edu)]/45 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 生成建议草稿
        </button>
      </div>
      <GenerationProgress active={generating} label="正在生成成长建议草稿" detail="返回后需由教师审改并确认，不会自动发布" />
      {rows.map((r) => (
        <div key={r.id} className="mt-2.5 rounded-[10px] border border-[var(--border-2)] p-2.5">
          <span className={cn("rounded-full border px-2 py-0.5 text-[12px]",
            r.status === "draft" ? "border-[var(--c-alert)]/40 text-[var(--c-alert)]" : "border-[var(--ok-ink)]/40 text-[var(--ok-ink)]")}>
            {r.status === "draft" ? "待老师确认 · AI 草稿" : "已发布"}
          </span>
          {r.status === "draft" ? (
            <>
              <textarea defaultValue={r.draftText} rows={4} maxLength={2000} aria-label="建议改稿"
                onChange={(e) => setEditText((m) => ({ ...m, [r.id]: e.target.value }))}
                className="mt-2 w-full rounded-[10px] border border-[var(--border-2)] bg-[var(--card)] p-2.5 text-[13px] leading-relaxed outline-none focus:border-[var(--c-edu)]/45" />
              <button type="button" onClick={() => act(r.id, "publish")} disabled={busy}
                className="mt-1.5 inline-flex min-h-[40px] items-center gap-1 rounded-[12px] px-3.5 text-[13px] font-semibold text-white shadow-sm disabled:opacity-50"
                style={{ backgroundImage: "var(--grad-primary)" }}>确认并发布</button>
            </>
          ) : (
            <>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-2)]">{r.finalText}</p>
              <button type="button" onClick={() => act(r.id, "withdraw")} disabled={busy}
                className="mt-1.5 inline-flex min-h-[40px] items-center rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:opacity-50">撤回</button>
            </>
          )}
        </div>
      ))}
      {note && <p role="status" aria-live="polite" className="mt-2 text-[12px] text-[var(--text-2)]">{note}</p>}
    </div>
  );
}
