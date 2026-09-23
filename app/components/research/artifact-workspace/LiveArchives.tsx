"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, Eye, EyeOff, LockKeyhole, RefreshCw, Search, Trash2 } from "lucide-react";
import { WorkButton, WorkDialog, ResearchArt } from "@/components/research/workspace-shared";
import type { ArtifactItem } from "@/lib/types";
import { MarkdownBody } from "./DocumentPreview";
import s from "./workspace.module.css";

function validArtifact(value: unknown): value is ArtifactItem {
  if (!value || typeof value !== "object") return false;
  const a = value as ArtifactItem;
  return typeof a.id === "string" && typeof a.title === "string" && typeof a.content === "string" && typeof a.sessionId === "string" && Number.isFinite(a.createdAt) && (a.visibility === "private" || a.visibility === "class");
}
function responseMessage(status: number) {
  return status === 401 ? "登录已失效，请重新登录后再试。" : status === 403 ? "当前账号无权执行此操作。" : status === 404 ? "记录不存在或已无访问权限，请刷新归档。" : status === 400 ? "提交内容不符合接口要求，未完成操作。" : "服务返回异常，操作结果未确认，请刷新归档核对。";
}
export function LiveArchives() {
  const [items, setItems] = useState<ArtifactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [reading, setReading] = useState<ArtifactItem | null>(null);
  const [pending, setPending] = useState<{ item: ArtifactItem; action: "publish" | "retract" | "delete" } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController(); let alive = true;
    const timeout = setTimeout(() => controller.abort(), 20000);
    void (async () => {
      setLoading(true); setError("");
      try {
        const res = await fetch("/api/artifacts", { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(responseMessage(res.status));
        const data = await res.json() as { scope?: string; artifacts?: unknown };
        if (data.scope !== "own" || !Array.isArray(data.artifacts) || !data.artifacts.every(validArtifact)) throw new Error("无法确认本人归档数据，请重新加载。");
        if (alive) { setItems(data.artifacts); setUncertain(false); }
      } catch (e) { if (alive) setError(e instanceof Error && e.name !== "AbortError" ? e.message : "读取超时或网络中断，请重试。"); }
      finally { clearTimeout(timeout); if (alive) setLoading(false); }
    })();
    return () => { alive = false; clearTimeout(timeout); controller.abort(); };
  }, [reload]);
  const open = (item: ArtifactItem, action: "publish" | "retract" | "delete") => { setPending({ item, action }); setConfirmed(false); setNotice(""); };
  const mutate = async () => {
    if (!pending || lock.current || !confirmed || uncertain) return;
    lock.current = true; setBusy(true); setNotice("");
    const controller = new AbortController(); mutation.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(pending.action === "delete" ? `/api/artifacts?id=${encodeURIComponent(pending.item.id)}` : "/api/artifacts", pending.action === "delete" ? { method: "DELETE", signal: controller.signal } : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: pending.item.id, visibility: pending.action === "publish" ? "class" : "private" }), signal: controller.signal });
      if (!res.ok) { if (res.status >= 500 || res.status === 408) setUncertain(true); throw new Error(responseMessage(res.status)); }
      const data = await res.json() as { ok?: boolean };
      if (data.ok !== true) { setUncertain(true); throw new Error("保存结果未确认，请刷新归档核对后再操作。"); }
      setPending(null); setReading(null); setReload(v => v + 1); setNotice("操作已由服务器确认。");
    } catch (e) {
      if (controller.signal.aborted || e instanceof TypeError || e instanceof SyntaxError) setUncertain(true);
      setNotice(e instanceof Error && e.name !== "AbortError" ? e.message : "请求超时，结果未确认。请刷新归档核对，不要重复提交。");
    } finally { clearTimeout(timeout); mutation.current = null; lock.current = false; setBusy(false); }
  };
  const filtered = items.filter(a => `${a.title} ${a.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section aria-label="我的真实归档">
    <header className={s.header}><ResearchArt name="artifacts" size={56} /><div className={s.headingText}><h1>我的归档</h1><p>当前账号的真实教学产物</p></div><WorkButton disabled={loading || busy} onClick={() => setReload(v => v + 1)}><RefreshCw size={16} />刷新归档</WorkButton></header>
    <p className={s.notice}><LockKeyhole size={16} />真实归档不含版本或审阅元数据。发布会分享该条记录的完整正文，不会自动过滤教师备注与答案。</p>
    {notice && <p role="status" className={s.notice}>{notice}</p>}
    {loading ? <div className={s.empty}><p role="status">正在读取真实归档…</p><div className={s.indeterminateProgress} role="progressbar" aria-label="正在读取真实归档"><span /></div></div> : error ? <div className={s.empty}><h2>读取失败</h2><p role="alert">{error}</p><WorkButton onClick={() => setReload(v => v + 1)}>重试</WorkButton></div> : <>
      <label className={s.search}><Search size={17} /><input value={query} aria-label="搜索真实归档" placeholder="搜索已读取的标题或正文" onChange={e => setQuery(e.target.value)} /></label>
      {!filtered.length ? <div className={s.empty}><h2>{items.length ? "没有匹配的归档" : "尚无归档材料"}</h2>{items.length ? <WorkButton onClick={() => setQuery("")}>清除搜索</WorkButton> : <Link className={s.linkButton} href="/chat">去备课对话<ArrowRight size={16} /></Link>}</div> : <div className={s.liveList}>{filtered.map(a => <article key={a.id}><div className={s.headingText}><h2>{a.title}</h2><p>{new Date(a.createdAt).toLocaleString("zh-CN")} · {a.visibility === "class" ? `本班可见${a.classId ? ` · ${a.classId}` : ""}` : "仅自己"}</p><p className={s.excerpt}>{a.content.slice(0, 180)}</p></div><div className={s.actions}><WorkButton onClick={() => setReading(a)}><Eye size={16} />全文</WorkButton><Link className={s.linkButton} href={`/chat?session=${encodeURIComponent(a.sessionId)}`}>源会话<ArrowRight size={15} /></Link><WorkButton disabled={busy || uncertain} onClick={() => open(a, a.visibility === "class" ? "retract" : "publish")}>{a.visibility === "class" ? <EyeOff size={16} /> : <Eye size={16} />}{a.visibility === "class" ? "撤回" : "发布到本班"}</WorkButton><WorkButton disabled={busy || uncertain} onClick={() => open(a, "delete")}><Trash2 size={16} />删除</WorkButton></div></article>)}</div>}
    </>}
    <WorkDialog open={!!reading} onOpenChange={v => { if (!v) setReading(null); }} title={reading?.title || "归档全文"} description="原始归档正文，不代表已审阅或学生专用版本。" className={`${s.workspace} ${s.liveReader}`}>
      {reading && <><MarkdownBody content={reading.content} /><div className={s.dialogFooter}><WorkButton onClick={async () => { try { await navigator.clipboard.writeText(reading.content); setNotice("原始正文已复制，可能包含教师备注，请确认粘贴对象。"); } catch { setNotice("复制失败，请在全文中手动选择文字。"); } }}><Copy size={16} />复制原始正文</WorkButton><WorkButton onClick={() => setReading(null)}>关闭</WorkButton></div></>}
    </WorkDialog>
    <WorkDialog className={s.workspace} open={!!pending} onOpenChange={v => { if (!v && !lock.current) setPending(null); }} title={pending?.action === "delete" ? "永久删除真实归档" : pending?.action === "retract" ? "撤回本班访问" : "发布真实归档到本班"} description={pending?.item.title}>
      <p>{pending?.action === "delete" ? "仅删除这条归档，不删除源会话。该操作没有回收站，无法撤销。" : pending?.action === "retract" ? "撤回后停止平台上的后续访问，无法收回已下载或复制的内容。" : "目标为服务器会话中的当前班级。将分享完整原始正文，不会过滤答案、教师备注或内部讨论；当前接口不支持版本快照。"}</p>
      {pending?.action === "publish" && <details><summary>核对将分享的完整正文</summary><div className={s.liveConfirmationContent}><MarkdownBody content={pending.item.content} /></div></details>}
      <label className={s.checkLabel}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{pending?.action === "publish" ? "我已核对完整正文及本班适用范围，同意真实发布" : "我已理解本次真实操作的影响"}</label>
      {notice && <p role="alert" className={s.error}>{notice}</p>}
      {busy && <div className={s.indeterminateProgress} role="progressbar" aria-label="正在提交真实归档操作"><span /></div>}
      <div className={s.dialogFooter}><WorkButton disabled={busy} onClick={() => setPending(null)}>取消</WorkButton>{uncertain ? <WorkButton onClick={() => { setPending(null); setReload(v => v + 1); }}>刷新归档核对</WorkButton> : <WorkButton primary disabled={!confirmed || busy} onClick={() => void mutate()}>{busy ? "正在提交…" : "确认执行真实操作"}</WorkButton>}</div>
    </WorkDialog>
  </section>;
}
