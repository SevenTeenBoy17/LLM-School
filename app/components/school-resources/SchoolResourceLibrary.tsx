"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, HardDrive, LayoutGrid, List, Loader2, Search, Star, X } from "lucide-react";
import { SchoolResourceIcon } from "@/components/common/SchoolResourceIcon";
import { EXAMPLE_RESOURCES, GRADES, KINDS, SUBJECTS, emptyResourceState, fileExtension, filterResources, readableBytes, type LocalResourceState, type ResourceKind, type SchoolResource } from "@/lib/school-resources/model";
import { loadLocalResources, removeLocalResource, saveLocalResources, toggleLocalFavorite } from "@/lib/school-resources/localRepository";
import { UploadResourceDialog } from "./UploadResourceDialog";
import { ResourceDetail, downloadResource } from "./ResourceDetail";
import { ACTIVITY_EXAMPLES } from "@/lib/school-resources/activityExamples";
import styles from "./school-resources.module.css";

const TYPE_ICON = { slides: "slides", lesson: "lesson", worksheet: "worksheet", activity: "activity", media: "media", other: "folder" } as const;
const ALL_EXAMPLES = [...EXAMPLE_RESOURCES, ...ACTIVITY_EXAMPLES];

export function SchoolResourceLibrary({ accountId, author }: { accountId: string; author: string }) {
  const [local, setLocal] = useState<LocalResourceState>(emptyResourceState);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolResource | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const revision = useRef(0);
  const mutation = useRef(false);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      if (mutation.current) return;
      const requestRevision = ++revision.current;
      try {
        const result = await loadLocalResources(accountId);
        if (alive && requestRevision === revision.current) { setLocal(result); setStorageError(""); }
      } catch (error) {
        if (alive && requestRevision === revision.current) setStorageError(error instanceof Error ? error.message : "本机草稿读取失败。");
      } finally { if (alive) setLoading(false); }
    };
    void read(); window.addEventListener("focus", read);
    return () => { alive = false; window.removeEventListener("focus", read); };
  }, [accountId, reloadKey]);

  const resources = [...local.drafts, ...ALL_EXAMPLES];
  const selected = resources.find(resource => resource.id === selectedId) ?? null;
  const shown = filterResources(resources, { query, subject, grade, kind, tab, sort, favoriteIds: local.favoriteIds });
  const hasFilters = Boolean(query || subject || grade || kind);
  const clearFilters = () => { setQuery(""); setSubject(""); setGrade(""); setKind(""); };
  const closeDetail = () => { setSelectedId(null); requestAnimationFrame(() => (returnFocus.current?.isConnected ? returnFocus.current : uploadRef.current)?.focus()); };

  async function change(action: () => Promise<LocalResourceState>) {
    if (mutation.current) throw new Error("上一项操作尚未完成，请稍后重试。");
    if (loading || storageError) throw new Error("本机存储尚未就绪，请先重试读取。");
    mutation.current = true; revision.current++; setPending(true);
    try { const next = await action(); setLocal(next); return next; }
    finally { mutation.current = false; setPending(false); }
  }
  async function favorite(resource: SchoolResource) {
    setNoticeError(false);
    try {
      const next = await change(() => toggleLocalFavorite(accountId, resource.id));
      setNotice(next.favoriteIds.includes(resource.id) ? "已收藏到本机。" : "已取消本机收藏。");
    } catch (error) { setNoticeError(true); setNotice(error instanceof Error ? error.message : "收藏未保存。"); }
  }
  function download(resource: SchoolResource) {
    setNoticeError(false);
    try { downloadResource(resource); setNotice(["html", "htm"].includes(fileExtension(resource.fileName)) ? "已生成 HTML 下载；离开平台后不再受隔离保护。" : resource.origin === "example" ? "已生成示例提纲下载文件，不是原始课件。" : "已生成本机原文件下载，请查看浏览器下载列表。"); }
    catch (error) { setNoticeError(true); setNotice(error instanceof Error ? error.message : "下载失败。"); }
  }
  const openDetails = (resource: SchoolResource, trigger: HTMLElement) => { returnFocus.current = trigger; setSelectedId(resource.id); };
  const openUpload = () => { setEditing(null); setUploadOpen(true); };
  const canWrite = !loading && !storageError && !pending;

  return <section className={`${styles.theme} ${styles.library}`} data-testid="school-resource-library" aria-labelledby="school-resource-title">
    <div className={styles.breadcrumb}><Link href="/knowledge">知识库</Link><ChevronRight size={14} /><span>校内资源库</span></div>
    <header className={styles.header}>
      <div className={styles.headingGroup}><SchoolResourceIcon name="library" size={66} />
        <div><h1 id="school-resource-title">校内资源库</h1><p>把一次精心备课，留给下一次课堂。</p></div></div>
      <button ref={uploadRef} className={styles.primary} onClick={openUpload}><SchoolResourceIcon name="upload" size={27} />上传资源</button>
    </header>
    <div className={styles.modeNote}><HardDrive size={16} /><strong>前端体验</strong><span>当前展示示例资源与本机草稿，学校共享服务器尚未接入。</span></div>
    <div className={styles.categories} aria-label="按资源类型筛选">
      {(Object.entries(KINDS) as [ResourceKind, string][]).map(([id, label]) => {
        const examples = ALL_EXAMPLES.filter(r => r.kind === id).length;
        const drafts = local.drafts.filter(r => r.kind === id).length;
        return <button key={id} aria-pressed={kind === id} className={kind === id ? styles.categoryActive : ""} onClick={() => setKind(kind === id ? "" : id)}>
          <SchoolResourceIcon name={TYPE_ICON[id]} size={42} /><span><strong>{label}</strong><small>{examples} 份示例{drafts ? ` · ${drafts} 份草稿` : ""}</small></span>
          {kind === id && <CheckCircle2 size={16} />}
        </button>;
      })}
    </div>
    <div className={styles.tabRow}>
      <div className={styles.tabs} role="group" aria-label="资源范围">
        {[{ id: "all", label: "全部资源", count: resources.length }, { id: "drafts", label: "我的草稿", count: local.drafts.length }, { id: "favorites", label: "我的收藏", count: resources.filter(r => local.favoriteIds.includes(r.id)).length }].map(item =>
          <button key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? styles.tabActive : ""} onClick={() => { setTab(item.id); clearFilters(); }}>{item.label}<span>{item.count}</span></button>)}
      </div>
      <div className={styles.viewToggle} role="group" aria-label="资源显示方式">
        <button title="列表视图" aria-label="列表视图" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={17} /></button>
        <button title="网格视图" aria-label="网格视图" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={17} /></button>
      </div>
    </div>
    <div className={styles.filters}>
      <div className={styles.search}><Search size={17} /><input type="search" value={query} aria-label="搜索校内资源" placeholder="搜索名称、学科或内容关键词" onChange={event => setQuery(event.target.value)} />
        {query && <button aria-label="清空搜索" title="清空搜索" onClick={() => setQuery("")}><X size={15} /></button>}</div>
      <select aria-label="资源学科筛选" value={subject} onChange={e => setSubject(e.target.value)}><option value="">全部学科</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
      <select aria-label="资源年级筛选" value={grade} onChange={e => setGrade(e.target.value)}><option value="">全部年级</option>{GRADES.map(g => <option key={g}>{g}</option>)}</select>
      <select aria-label="资源排序" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">最近更新</option><option value="title">名称排序</option></select>
    </div>
    <div className={styles.resultLine} aria-live="polite"><span>{loading ? "正在读取本机草稿…" : `显示 ${shown.length} 份 · ${shown.filter(r => r.origin === "example").length} 份示例 / ${shown.filter(r => r.origin === "local").length} 份本机草稿`}</span>
      {hasFilters && <button className={styles.textButton} onClick={clearFilters}><X size={14} />清除筛选</button>}</div>
    {storageError && <div className={styles.error} role="alert"><p>{storageError}</p><button className={styles.secondary} onClick={() => { setReloadKey(k => k + 1); }}>重试读取本机草稿</button></div>}
    {notice && <div role={noticeError ? "alert" : "status"} className={noticeError ? styles.error : styles.notice}>{noticeError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}<span>{notice}</span><button title="关闭提示" aria-label="关闭操作提示" onClick={() => setNotice("")}><X size={15} /></button></div>}
    {!shown.length ? <div className={styles.empty}>
      <SchoolResourceIcon name="folder" size={82} /><h2>{hasFilters ? "没有找到匹配的资源" : tab === "favorites" ? "还没有收藏资源" : "从第一份教学资料开始"}</h2>
      <p>{hasFilters ? "试试更短的关键词，或调整学科与年级。" : tab === "favorites" ? "收藏的资源会保留在此浏览器，方便再次查找。" : "添加课件、教案或学习单，先整理为自己的本机草稿。"}</p>
      {hasFilters ? <button className={styles.secondary} onClick={clearFilters}>清除筛选</button> : tab === "favorites" ? <button className={styles.secondary} onClick={() => setTab("all")}>浏览全部资源</button> : <button className={styles.primary} onClick={openUpload}>添加第一份资源</button>}
    </div> : view === "list" ? <div className={styles.tableWrap}><table className={styles.table}>
      <caption className={styles.srOnly}>教学资源列表，示例与本机草稿分开标识</caption>
      <thead><tr><th scope="col">资源名称</th><th scope="col">学科 / 年级</th><th scope="col">来源</th><th scope="col">更新日期</th><th scope="col">操作</th></tr></thead>
      <tbody>{shown.map(resource => <tr key={resource.id} data-testid={`resource-row-${resource.id}`}>
        <td><button className={styles.resourceTitle} onClick={e => openDetails(resource, e.currentTarget)}><SchoolResourceIcon name={TYPE_ICON[resource.kind]} size={42} />
          <span><strong>{resource.title}</strong><small>{KINDS[resource.kind]} · {resource.origin === "example" && resource.kind !== "activity" ? "示例提纲" : fileExtensionLabel(resource.fileName)} · {readableBytes(resource.fileSize)}</small></span></button></td>
        <td className={styles.subjectCell}><span>{resource.subject}</span><small>{resource.grade}</small></td>
        <td><span className={resource.origin === "example" ? styles.exampleTag : styles.localTag}>{resource.origin === "example" ? "示例资源" : "本机草稿"}</span><small className={styles.author}>{resource.author}</small></td>
        <td className={styles.dateCell}>{resource.origin === "example" ? "—" : new Date(resource.updatedAt).toLocaleDateString("zh-CN")}</td>
        <td><div className={styles.rowActions}><button className={styles.iconButton} disabled={!canWrite} title={local.favoriteIds.includes(resource.id) ? "取消收藏" : "收藏"}
          aria-label={`${local.favoriteIds.includes(resource.id) ? "取消收藏" : "收藏"} ${resource.title}`} aria-pressed={local.favoriteIds.includes(resource.id)} onClick={() => void favorite(resource)}><Star size={17} fill={local.favoriteIds.includes(resource.id) ? "currentColor" : "none"} /></button>
          <button className={styles.textButton} aria-label={`查看 ${resource.title}`} onClick={e => openDetails(resource, e.currentTarget)}>查看<ChevronRight size={15} /></button></div></td>
      </tr>)}</tbody>
    </table></div> : <div className={styles.grid}>{shown.map(resource => <article key={resource.id} className={styles.resourceCard}>
      <div className={styles.cardTop}><SchoolResourceIcon name={TYPE_ICON[resource.kind]} size={58} /><span className={resource.origin === "example" ? styles.exampleTag : styles.localTag}>{resource.origin === "example" ? "示例资源" : "本机草稿"}</span></div>
      <button className={styles.cardTitle} onClick={e => openDetails(resource, e.currentTarget)}>{resource.title}</button>
      <p>{resource.description || "暂未填写简介"}</p><div className={styles.cardMeta}>{resource.subject} · {resource.grade} · {KINDS[resource.kind]}</div>
      <div className={styles.cardFooter}><span>{resource.author}</span><button className={styles.iconButton} title="收藏" aria-label={`收藏 ${resource.title}`} aria-pressed={local.favoriteIds.includes(resource.id)} disabled={!canWrite} onClick={() => void favorite(resource)}><Star size={17} fill={local.favoriteIds.includes(resource.id) ? "currentColor" : "none"} /></button></div>
    </article>)}</div>}
    <footer className={styles.libraryFooter}><HardDrive size={15} /><span>本机草稿 {readableBytes(local.drafts.reduce((sum, r) => sum + r.fileSize, 0))} / 200 MB</span><span>学校在线共享：未接入</span></footer>
    {pending && <span className={styles.srOnly} role="status"><Loader2 />正在保存本机变更</span>}
    {selected && !uploadOpen && <ResourceDetail resource={selected} accountId={accountId} favorite={local.favoriteIds.includes(selected.id)} pending={pending} writable={canWrite}
      onClose={closeDetail} onFavorite={() => void favorite(selected)} onDownload={() => download(selected)}
      onEdit={() => { setEditing(selected); setUploadOpen(true); setSelectedId(null); }}
      onRemove={async () => { await change(() => removeLocalResource(accountId, selected.id)); setNoticeError(false); setNotice("本机副本已移除，电脑原文件未受影响。"); closeDetail(); }} />}
    {uploadOpen && <UploadResourceDialog author={author} editing={editing} onClose={() => { setUploadOpen(false); setEditing(null); requestAnimationFrame(() => uploadRef.current?.focus()); }}
      onSave={async (records, expected) => { await change(() => saveLocalResources(accountId, records, expected)); setTab("drafts"); clearFilters(); setNoticeError(false); setNotice(`已保存 ${records.length} 份本机草稿，文件未上传到学校服务器。`); }} />}
  </section>;
}
function fileExtensionLabel(name: string) { return name.split(".").pop()?.toUpperCase() ?? "文件"; }
