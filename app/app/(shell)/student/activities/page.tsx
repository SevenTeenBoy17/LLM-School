"use client";

/**
 * /student/activities —— 学科项目活动（W-B3，规格⑥）。
 * 学生侧闭环：看活动 → 写草稿 → 提交 → 被退回改后再交 → 通过自动入档案袋。
 * 只看得到自己的提交与老师给自己的理由——无任何班内比较视图（红线 R1）。
 * 入口：学生首页队列卡 + 成长页档案袋（顶层保持 4 入口，NAV_ORPHANS 已登记）。
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, Send, Save, CheckCircle2, Undo2, Paperclip, X } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import { cn } from "@/lib/utils";
import { PageIcon } from "@/components/common/PlayIcon";
import { ManorAssignedTasks } from "@/components/student/ManorAssignedTasks";

interface Mine { status: "draft" | "submitted" | "approved" | "returned"; content: string; teacherFeedback: string | null; updatedAt: number; artifactName: string | null }
interface Act { id: string; subject: string; title: string; brief: string; dueAt: number | null; pastDue: boolean; status: string; createdAt: number; mine: Mine | null }

const STATUS_TEXT: Record<Mine["status"] | "none", string> = {
  none: "未开始", draft: "草稿", submitted: "已提交，等老师批阅", approved: "已通过，进入档案袋", returned: "被退回，看看老师的理由",
};

export default function StudentActivitiesPage() {
  const [acts, setActs] = useState<Act[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  // F3 佐证材料：undefined=沿用已存引用；null=显式移除；字符串=新上传的 uploadId
  const [uploadId, setUploadId] = useState<string | null | undefined>(undefined);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetch("/api/activities")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setActs(d.activities))
      .catch(() => setError("活动列表加载失败，稍后再试"));
  };
  useEffect(load, []);

  const openEditor = (a: Act) => {
    setOpenId(a.id);
    setText(a.mine?.content ?? "");
    setUploadId(undefined);
    setUploadName(a.mine?.artifactName ?? "");
    setNotice("");
  };

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true); setNotice("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok && d.status === "parsed") { setUploadId(d.id); setUploadName(`${d.name}（${d.chars} 字）`); }
      else setNotice(d.message || "佐证材料解析失败");
    } catch { setNotice("网络异常，请重试"); } finally { setUploading(false); }
  };

  const send = async (id: string, action: "draft" | "submit") => {
    if (!text.trim() || busy) return;
    setBusy(true); setNotice("");
    try {
      const r = await fetch(`/api/activities/${id}/submit`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: text.trim(), action, ...(uploadId !== undefined ? { uploadId } : {}) }),
      });
      const d = await r.json();
      if (r.ok) {
        setNotice(action === "submit" ? "已提交，等老师批阅。" : "草稿已保存。");
        load();
        if (action === "submit") setOpenId("");
      } else setNotice(d.message || "保存失败，请重试");
    } catch { setNotice("网络异常，请重试"); } finally { setBusy(false); }
  };

  return (
    <div data-register="campus" className="flex-1 min-w-0 overflow-x-hidden p-5 md:p-7">
      <div className="mx-auto max-w-[760px]">
        <ManorAssignedTasks />
        <Reveal>
          <div className="flex items-center gap-3">
            <PageIcon name="project" fallback={ClipboardList} />
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">项目活动</h1>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">老师发布的学科小项目——通过批阅后会自动收进你的成长档案袋。</p>
            </div>
          </div>

          {error && <p role="alert" className="mt-4 text-[13px] text-[var(--c-alert)]">{error}</p>}
          <Link href="/student/resources" className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-[var(--accent)]"><ClipboardList size={18} />打开课堂文件与 HTML 活动</Link>
          {acts && acts.length === 0 && (
            <p className="mt-5 rounded-[12px] border border-dashed border-[var(--border-2)] p-4 text-[13px] text-[var(--text-2)]">
              现在还没有进行中的活动。老师发布后，这里和首页的任务队列都会出现它。
            </p>
          )}

          <div className="mt-5 space-y-3">
            {acts?.map((a) => {
              const st = a.mine?.status ?? "none";
              const pastDue = a.pastDue; // 服务端权威判定（提交路由同口径 409）
              const editable = a.status === "open" && !pastDue && st !== "submitted" && st !== "approved";
              return (
                <section key={a.id} aria-label={a.title} className="surface-card p-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="rounded-full border border-[var(--border-2)] px-2 py-0.5 text-[12px] text-[var(--text-2)]">{a.subject}</span>
                    <h2 className="text-[14px] font-semibold text-[var(--text)]">{a.title}</h2>
                    <span className={cn("ml-auto inline-flex items-center gap-1 text-[12px]",
                      st === "approved" ? "text-[var(--ok-ink)]" : st === "returned" ? "text-[var(--c-alert)]" : "text-[var(--text-3)]")}>
                      {st === "approved" && <CheckCircle2 size={13} />}
                      {st === "returned" && <Undo2 size={13} />}
                      {STATUS_TEXT[st]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">{a.brief}</p>
                  {a.dueAt && (
                    <p className={cn("mt-1 text-[12px]", pastDue ? "text-[var(--c-alert)]" : "text-[var(--text-3)]")}>
                      {pastDue ? "已截止" : `截止 ${new Date(a.dueAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`}
                    </p>
                  )}
                  {st === "returned" && a.mine?.teacherFeedback && (
                    <p className="mt-2 rounded-[10px] bg-[var(--rg-control-bg)] px-3 py-2 text-[13px] text-[var(--text)]">老师的话：{a.mine.teacherFeedback}</p>
                  )}
                  {st === "approved" && a.mine?.teacherFeedback && (
                    <p className="mt-2 text-[13px] text-[var(--text-2)]">老师评语：{a.mine.teacherFeedback}</p>
                  )}
                  {(st === "submitted" || st === "approved") && a.mine?.artifactName && (
                    <p className="mt-1 text-[12px] text-[var(--text-3)]">佐证材料：{a.mine.artifactName}</p>
                  )}

                  {editable && openId !== a.id && (
                    <button type="button" onClick={() => openEditor(a)}
                      className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text)] transition-colors hover:border-[var(--c-edu)]/45">
                      {st === "none" ? "开始作答" : "继续作答"}
                    </button>
                  )}
                  {editable && openId === a.id && (
                    <div className="mt-3">
                      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4000}
                        aria-label="活动作答"
                        placeholder="把你的观察、想法或成果写在这里……"
                        className="w-full rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-3 text-[13px] leading-relaxed outline-none focus:border-[var(--c-edu)]/45" />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input ref={fileRef} type="file" accept=".docx,.pdf,.txt" hidden onChange={pickFile} />
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:opacity-50">
                          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} {uploadName || "附佐证材料"}
                        </button>
                        {uploadName && (
                          <button type="button" aria-label="移除佐证材料" onClick={() => { setUploadId(null); setUploadName(""); }}
                            className="inline-flex min-h-[40px] items-center rounded-[12px] border border-[var(--border-2)] px-2.5 text-[var(--text-3)] transition-colors hover:text-[var(--text)]">
                            <X size={14} />
                          </button>
                        )}
                        <button type="button" onClick={() => send(a.id, "draft")} disabled={busy || !text.trim()}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:opacity-50">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 存草稿
                        </button>
                        <button type="button" onClick={() => send(a.id, "submit")} disabled={busy || !text.trim()}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:-translate-y-px disabled:opacity-50"
                          style={{ backgroundImage: "var(--grad-primary)" }}>
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 提交给老师
                        </button>
                        <span className="text-[12px] text-[var(--text-3)]">提交后进入批阅，批阅期间不能修改。</span>
                      </div>
                      {notice && <p role="status" aria-live="polite" className="mt-1.5 text-[12px] text-[var(--text-2)]">{notice}</p>}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
