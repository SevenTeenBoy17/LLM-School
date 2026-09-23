"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Check, Copy, ExternalLink, Plus, SearchX, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { Content } from "@radix-ui/react-dialog";
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { TeacherFeatureGlyph } from "@/components/common/TeacherFeatureGlyph";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { apiCreateAgent } from "@/lib/client/libraryApi";
import { AGENT_GROUPS, AGENT_REFERENCES, AGENT_TEMPLATES, agentTemplateInput, agentTemplatePrompt, type AgentGroup, type AgentTemplate } from "@/lib/agent/templates";
import s from "./agent-workbench.module.css";

const pendingCreates = new Set<string>();
function pendingKey(userId: string, templateId: string) { return `eduai.agent.pending.v1:${userId}:${templateId}`; }
function isUnconfirmed(key: string) {
  try { return pendingCreates.has(key) || sessionStorage.getItem(key) === "1"; }
  catch { return pendingCreates.has(key); }
}
function rememberPending(key: string, pending: boolean) {
  if (pending) pendingCreates.add(key); else pendingCreates.delete(key);
  try { if (pending) sessionStorage.setItem(key, "1"); else sessionStorage.removeItem(key); } catch { /* In-memory protection remains when storage is unavailable. */ }
}

export function AgentTemplateLibrary({ query, clearQuery, userId, inspectExisting }: { query: string; clearQuery: () => void; userId: string; inspectExisting: () => void }) {
  const router = useRouter();
  const [group, setGroup] = useState<AgentGroup>("全部场景");
  const [selected, setSelected] = useState<AgentTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const dialogSession = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const templates = useMemo(() => AGENT_TEMPLATES.filter(t => (group === "全部场景" || t.group === group)
    && `${t.name} ${t.description} ${t.materials.join(" ")} ${t.outputs.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [group, query]);

  const create = async () => {
    if (!selected || !userId || lock.current || uncertain) return;
    if (savedId) { router.push(`/chat?agent=${encodeURIComponent(savedId)}`); return; }
    lock.current = true; setBusy(true); setError("");
    const key = pendingKey(userId, selected.id);
    rememberPending(key, true);
    const aborter = new AbortController(); controller.current = aborter;
    const timer = setTimeout(() => aborter.abort(), 45000);
    try {
      const saved = await apiCreateAgent(agentTemplateInput(selected), aborter.signal);
      if (!saved) { rememberPending(key, false); setError("未能创建草稿。请确认当前账号可创建智能体，稍后重试。"); return; }
      rememberPending(key, false);
      setSavedId(saved.id);
      router.push(`/chat?agent=${encodeURIComponent(saved.id)}`);
    } catch {
      setUncertain(true);
      setError("保存结果未确认，请先到现有智能体查看，避免重复创建。");
    } finally { clearTimeout(timer); controller.current = null; lock.current = false; setBusy(false); }
  };
  const copy = async () => {
    if (!selected) return;
    const session = dialogSession.current;
    try { await navigator.clipboard.writeText(agentTemplatePrompt(selected)); if (session === dialogSession.current) { setCopied(true); setError(""); } }
    catch { if (session === dialogSession.current) setError("复制失败，可展开任务指令后手动选择文字。"); }
  };

  return <section className={s.library} aria-label="教师场景助手" data-testid="agent-template-library">
    <div className={s.sectionHeading}><div><h2>今天，需要哪位助手？</h2><p>教师任务模板 · 创建后为个人草稿，审核通过后方可发布</p></div><span className={s.count}>{templates.length} 个场景</span></div>
    <div className={s.filters} role="group" aria-label="按教学场景筛选">{AGENT_GROUPS.map(g => <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}<span>{g === "全部场景" ? AGENT_TEMPLATES.length : AGENT_TEMPLATES.filter(t => t.group === g).length}</span></button>)}</div>
    {templates.length ? <div className={s.grid}>{templates.map(t => <article key={t.id} className={s.card} data-group={t.group}>
      <div className={s.cardTop}><TeacherFeatureGlyph name={t.glyph} size={48} fallback={Bot} /><span className={s.groupLabel}>{t.group}</span></div>
      <h3>{t.name}</h3><p className={s.description}>{t.description}</p>
      <div className={s.output}><span>交付</span><p>{t.outputs[0]} · {t.outputs[1]}</p></div>
      <button className={s.cardAction} aria-label={`查看与使用：${t.name}`} onClick={event => { dialogSession.current++; trigger.current = event.currentTarget; setSelected(t); setError(""); setCopied(false); setSavedId(""); setUncertain(isUnconfirmed(pendingKey(userId, t.id))); }}>查看与使用<ArrowRight size={16} /></button>
    </article>)}</div> : <div className={s.empty}><SearchX size={28} /><h3>没有匹配的场景</h3><p>试试“量规”“家校”或“观察”。</p><button onClick={() => { setGroup("全部场景"); clearQuery(); }}>清除筛选</button></div>}
    <div className={s.safety}><ShieldCheck size={17} /><span>材料先匿名化，输出由教师复核。模板不自动联网、读取知识库或代替学生评价。</span></div>
    <details className={s.references}><summary>设计参考与适用边界</summary><p>参考教育产品的任务组织方式和教师应用指引，非官方智能体，也不代表第三方能力已接入。</p><div>{Object.values(AGENT_REFERENCES).map(ref => <a key={ref.url} href={ref.url} target="_blank" rel="noopener noreferrer">{ref.name}<ExternalLink size={13} /></a>)}</div></details>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !lock.current) { dialogSession.current++; setSelected(null); } }}>
      <DialogPortal><DialogOverlay className={s.overlay} /><Content className={s.dialog} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        {selected && <>
          <header className={s.dialogHeader}><TeacherFeatureGlyph name={selected.glyph} size={54} fallback={Bot} /><div><span className={s.groupLabel}>{selected.group} · 教师任务模板</span><DialogTitle className={s.dialogTitle}>{selected.name}</DialogTitle></div><DialogClose className={s.close} disabled={busy} aria-label="关闭助手详情"><X size={20} /></DialogClose></header>
          <DialogDescription className={s.dialogDescription}>{selected.description}</DialogDescription>
          <div className={s.contract}><section><h3>准备材料</h3><ul>{selected.materials.map(m => <li key={m}>{m}</li>)}</ul></section><section><h3>你会得到</h3><ul>{selected.outputs.map(m => <li key={m}><Check size={14} />{m}</li>)}</ul></section></div>
          <section className={s.example}><h3>可以这样开始</h3><p>{selected.sample}</p></section>
          <p className={s.boundary}><ShieldCheck size={17} /><span>{selected.boundary}</span></p>
          <details className={s.prompt}><summary>任务指令</summary><pre>{agentTemplatePrompt(selected)}</pre><button onClick={copy}><Copy size={14} />{copied ? "已复制" : "复制指令"}</button></details>
          <a className={s.source} href={AGENT_REFERENCES[selected.source].url} target="_blank" rel="noopener noreferrer">场景参考：{AGENT_REFERENCES[selected.source].name}<ExternalLink size={13} /></a>
          <p className={s.draftNote}>仅保存为你的草稿，暂不绑定知识库。试用将在 AI 对话中进行，发送消息时才调用模型。</p>
          {error && <p role="alert" className={s.error}>{error}</p>}
          {uncertain && <div className={s.boundary}><div><p>上次保存结果尚未确认。请先到现有智能体核对是否已创建草稿。</p><button onClick={inspectExisting} className={s.secondary}>查看现有智能体<ArrowRight size={14} /></button><button className={s.secondary} onClick={() => { rememberPending(pendingKey(userId, selected.id), false); setUncertain(false); setError(""); }}>已核对目录，允许重新创建</button></div></div>}
          {busy && <><GenerationProgress label="正在创建个人智能体草稿" /><button className={s.secondary} onClick={() => controller.current?.abort()}>停止等待</button><p className={s.draftNote}>停止等待不会撤销已经到达服务器的保存。</p></>}
          <footer className={s.dialogActions}><DialogClose disabled={busy} className={s.secondary}><X size={16} />返回目录</DialogClose><Link aria-disabled={busy || uncertain} tabIndex={busy || uncertain ? -1 : undefined} onClick={event => { if (busy || uncertain) event.preventDefault(); }} href={`/agent/new?template=${selected.id}`} className={s.secondary}><SlidersHorizontal size={16} />自定义后创建</Link><button className={s.primary} onClick={create} disabled={busy || uncertain || !userId}><Plus size={16} />{savedId ? "继续试用" : busy ? "创建中" : "创建草稿并试用"}</button></footer>
        </>}
      </Content></DialogPortal>
    </Dialog>
  </section>;
}
