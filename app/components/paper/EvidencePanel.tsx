"use client";

import { useState } from "react";
import { ExternalLink, Plus, Search, Trash2, Pencil, X } from "lucide-react";
import { SEARCH_PORTALS, METHOD_REFERENCES } from "@/lib/paper/catalog";
import { EVIDENCE_STATUS, EMPTY_EVIDENCE_DRAFT, safeSourceUrl, type EvidenceDraft, type EvidenceItem } from "@/lib/paper/workspace";
import s from "./paper-studio.module.css";

const BLANK = EMPTY_EVIDENCE_DRAFT;
export function EvidencePanel({ items, draft, setDraft, onChange, onMessage }: { items: EvidenceItem[]; draft: EvidenceDraft; setDraft: (draft: EvidenceDraft) => void; onChange: (items: EvidenceItem[]) => void; onMessage: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const editing = draft.editing;
  const [error, setError] = useState("");
  function save() {
    if (editing && !items.some(item => item.id === editing)) { setError("该来源已删除，请取消编辑后重新添加。草稿尚未丢弃。"); return; }
    if (!draft.title.trim()) { setError("请填写文献或材料名称。"); return; }
    const url = draft.url.trim() ? safeSourceUrl(draft.url) : "";
    if (url === null) { setError("来源链接需为有效的 http 或 https 地址，不可包含账号密码。"); return; }
    if (url.length > 1000) { setError("链接编码后超过 1000 字符，请使用较短的原文链接或 DOI；当前草稿未改变。"); return; }
    if (items.some(e => e.id !== editing && (url ? e.url === url : e.title === draft.title.trim()))) { setError("这条来源已存在，请编辑已有记录。"); return; }
    if (!editing && items.length >= 30) { setError("本项目最多记录 30 条来源。"); return; }
    const next: EvidenceItem = { title: draft.title.trim(), claim: draft.claim, locator: draft.locator, url, id: editing ?? `E-${crypto.randomUUID().slice(0, 8)}`, status: "unverified", selected: false };
    onChange(editing ? items.map(e => e.id === editing ? next : e) : [...items, next]);
    setDraft(BLANK); setError(""); onMessage("来源已记录，核验状态为待核验。");
  }
  return <div className={s.evidenceView}>
    <section className={s.resourceSection}>
      <div className={s.sectionHeading}><h2>文献检索入口</h2><span className={s.muted}>外部网站 · 不自动导入检索结果</span></div>
      <label className={s.searchField}><Search size={17} /><input aria-label="外部检索关键词" value={query} maxLength={150} onChange={e => setQuery(e.target.value)} placeholder="输入公开主题词，例如：合作学习 形成性评价" /></label>
      <p className={s.muted}>点击入口时才向该网站传递关键词。不要填写学生信息、未公开题目或保密材料。</p>
      <div className={s.portals}>{SEARCH_PORTALS.map(portal => <a key={portal.id} href={"searchPrefix" in portal && query.trim() ? `${portal.searchPrefix}${encodeURIComponent(query.trim())}` : portal.url} target="_blank" rel="noopener noreferrer"><strong>{portal.title}<ExternalLink size={15} /></strong><span>{portal.description}</span></a>)}</div>
      <p className={s.muted}>校内文献库尚未连接；全文访问范围与费用由各数据库或学校授权决定。</p>
    </section>
    <section>
      <div className={s.sectionHeading}><h2>我的证据记录 <span className={s.count}>{items.length}</span></h2><span className={s.muted}>临时记录 · 导出项目后可恢复</span></div>
      <div className={s.evidenceLayout}>
        <div className={s.evidenceList}>
          {!items.length && <div className={s.empty}><BookEvidence /><h3>先为一个论断找到出处</h3><p>记录原文位置、研究方法与局限；找到论文不等于论断已得到支持。</p></div>}
          {items.map(item => <article key={item.id} className={s.evidenceItem}>
            <div className={s.sectionHeading}><code>{item.id}</code><div className={s.inlineActions}><button aria-label={`编辑来源：${item.title}`} title="编辑来源" onClick={() => { if (Object.entries(draft).some(([key, value]) => key !== "editing" && value) && !window.confirm("放弃尚未提交的来源草稿，编辑这条记录？")) return; setDraft({ title: item.title, url: item.url, claim: item.claim, locator: item.locator, editing: item.id }); setError(""); }}><Pencil size={15} /></button><button aria-label={`删除来源：${item.title}`} title="删除来源" onClick={() => { if (window.confirm(`删除来源“${item.title}”？`)) { onChange(items.filter(e => e.id !== item.id)); if (editing === item.id) setDraft({ ...draft, editing: null }); } }}><Trash2 size={15} /></button></div></div>
            <h3>{item.title}</h3>
            {item.url && <a className={s.sourceLink} href={item.url} target="_blank" rel="noopener noreferrer">打开原始来源 <ExternalLink size={13} /></a>}
            <p><strong>待支持论断：</strong>{item.claim || "待补充"}</p><p><strong>原文位置与局限：</strong>{item.locator || "待补充"}</p>
            <label className={s.field}><span>核验状态</span><select aria-label={`核验状态：${item.title}`} value={item.status} onChange={e => { const status = e.target.value as EvidenceItem["status"]; if (status === "checked" && (!item.claim.trim() || !item.locator.trim())) { onMessage("请先编辑并补充论断、原文位置与局限，再标记核对。"); return; } onChange(items.map(x => x.id === item.id ? { ...x, status } : x)); }}>{Object.entries(EVIDENCE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className={s.checkbox}><input type="checkbox" checked={item.selected} onChange={e => onChange(items.map(x => x.id === item.id ? { ...x, selected: e.target.checked } : x))} />随下一次生成发送此条证据</label>
          </article>)}
          {!!items.length && <p className={s.muted}>核验状态由教师手动填写，不代表系统认证；修改原文记录后需重新核验。</p>}
        </div>
        <form className={s.evidenceForm} onSubmit={e => { e.preventDefault(); save(); }}>
          <div className={s.sectionHeading}><h3>{editing ? "编辑来源" : "记录一条来源"}</h3>{editing && <button type="button" className={s.iconButton} title="取消编辑" aria-label="取消编辑" onClick={() => { setDraft(BLANK); setError(""); }}><X size={17} /></button>}</div>
          <label className={s.field}><span>文献 / 材料名称 *</span><input value={draft.title} maxLength={120} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className={s.field}><span>原始链接（可选）</span><input type="text" value={draft.url} maxLength={1000} placeholder="https://doi.org/..." onChange={e => setDraft({ ...draft, url: e.target.value })} /></label>
          <label className={s.field}><span>支持或反驳的论断</span><textarea rows={3} value={draft.claim} maxLength={400} onChange={e => setDraft({ ...draft, claim: e.target.value })} /></label>
          <label className={s.field}><span>原文页码 / 章节、摘录与局限</span><textarea rows={3} value={draft.locator} maxLength={400} onChange={e => setDraft({ ...draft, locator: e.target.value })} /></label>
          {error && <p role="alert" className={s.error}>{error}</p>}
          <button className={s.primary} type="submit"><Plus size={16} />{editing ? "更新记录" : "添加来源"}</button>
        </form>
      </div>
    </section>
    <section className={s.methodLinks}><h3>方法与伦理参考</h3>{METHOD_REFERENCES.map(item => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<ExternalLink size={13} /></a>)}<p className={s.muted}>PRISMA 用于系统综述报告，不是通用质量评分。境外指南仅作参考，实际研究遵循本地机构要求。</p></section>
  </div>;
}
function BookEvidence() { return <Search size={28} aria-hidden />; }
