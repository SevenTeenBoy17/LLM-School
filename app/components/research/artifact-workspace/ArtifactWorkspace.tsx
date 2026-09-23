"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Download, Eye, FolderInput, LayoutGrid, List, LockKeyhole, Search, Trash2, Upload, Users, X } from "lucide-react";
import { WorkspaceFrame, ResearchArt, WorkButton, WorkDialog, DemoNotice, useDemoState, ExportTasks } from "@/components/research/workspace-shared";
import { DocumentThumbnail } from "./DocumentPreview";
import { MaterialDetail } from "./MaterialDetail";
import { LiveArchives } from "./LiveArchives";
import { exportFiles, INITIAL_MATERIALS, latest, makeId, MAX_MATERIALS, MAX_TEXT, MAX_TOTAL_TEXT, totalText, validateMaterials, type DemoMaterial, type MaterialVersion } from "./model";
import s from "./workspace.module.css";

export function ArtifactWorkspace() {
  const [items, setItems, storage] = useDemoState<DemoMaterial[]>("research-artifacts-v1", INITIAL_MATERIALS, validateMaterials);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState("");
  const [folder, setFolder] = useState("");
  const [sort, setSort] = useState("recent");
  const [grid, setGrid] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [batch, setBatch] = useState<"delete" | "folder" | null>(null);
  const [folderDraft, setFolderDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [files, setFiles] = useState<ReturnType<typeof exportFiles>>([]);
  const folders = [...new Set(items.map(x => x.folder).filter(Boolean))];
  const chosen = items.filter(x => selected.includes(x.id));
  const current = items.find(x => x.id === detail);
  const filtered = useMemo(() => items.filter(item => {
    const v = latest(item);
    return (!query || `${v.title} ${item.source} ${v.student} ${item.folder}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && (!type || item.type === type) && (!subject || item.subject === subject) && (!folder || item.folder === folder) && (!visibility || (visibility === "class" ? !!item.shared : !item.shared)) && (tab === "all" || tab === "pending" && item.unorganized || tab === "reviewed" && !!v.reviewedAt || tab === "shared" && !!item.shared);
  }).sort((a, b) => sort === "title" ? latest(a).title.localeCompare(latest(b).title, "zh-CN") : sort === "oldest" ? latest(a).createdAt - latest(b).createdAt : latest(b).createdAt - latest(a).createdAt), [items, query, type, subject, visibility, folder, tab, sort]);
  const update = (item: DemoMaterial) => {
    if (!storage.ready) { setNotice("本机材料尚未载入，未保存本次修改。"); return false; }
    const next = items.map(x => x.id === item.id ? item : x);
    if (totalText(next) > MAX_TOTAL_TEXT) { setNotice("本机文本容量已达上限，请先导出并整理材料；本次未保存。"); return false; }
    setItems(next); return true;
  };
  const copy = (item: DemoMaterial, v: MaterialVersion) => {
    if (!storage.ready) { setNotice("本机材料尚未载入，未创建副本。"); return false; }
    if (items.length >= MAX_MATERIALS || totalText(items) + v.student.length + v.notes.length > MAX_TOTAL_TEXT) { setNotice("本机材料容量已达上限，请先导出并整理。"); return false; }
    const id = makeId();
    const next: DemoMaterial = { ...item, id, source: v.title, sourceId: item.id, sourceVersion: v.label, unorganized: false, shared: undefined, versions: [{ ...v, id: makeId(), label: "v1.0", title: `${v.title.slice(0, 112)} · 改编版`, checks: [false, false, false], reviewedAt: undefined, createdAt: Date.now() }] };
    setItems(prev => [...prev, next]); setDetail(id); setNotice("已创建仅自己的改编副本，来源保留，审阅需重新确认。");
    return true;
  };
  const startExport = (list: DemoMaterial[]) => { setFiles(exportFiles(list)); setExportOpen(true); };
  const resetFilters = () => { setQuery(""); setType(""); setSubject(""); setVisibility(""); setFolder(""); setTab("all"); };
  return <WorkspaceFrame className={s.workspace}><div data-testid="artifact-workspace">
    <div className={s.modeBar}>{!current && <div className={s.segmented} role="group" aria-label="产物数据来源"><button aria-pressed={mode === "demo"} onClick={() => setMode("demo")}>本机演示</button><button aria-pressed={mode === "live"} onClick={() => setMode("live")}>我的归档</button></div>}{mode === "demo" ? <DemoNotice /> : <span className={s.muted}>当前账号 · 真实归档</span>}</div>
    {mode === "live" ? <LiveArchives /> : <>
      {storage.ready && (storage.message || !storage.persistent) && <p role="status" className={s.notice}>{storage.message || "浏览器存储不可用，本次仅保留在内存；离开前请导出材料。"}</p>}
      {!storage.ready ? <div className={s.empty}><p role="status">正在读取本机材料…</p><div className={s.indeterminateProgress} role="progressbar" aria-label="正在读取本机演示材料"><span /></div></div> : current ? <MaterialDetail key={current.id} item={current} onChange={update} onBack={() => setDetail(null)} onCopy={copy} onExport={version => startExport([{ ...current, versions: [version] }])} onSource={id => { if (!items.some(x => x.id === id)) return false; setDetail(id); return true; }} /> : <>
        <header className={s.header}><ResearchArt name="artifacts" size={58} /><div className={s.headingText}><h1>教学产物</h1><p>我的教学材料 · 本机工作区</p></div><div className={s.actions}><Link className={s.linkButton} href="/research/prep">去备课<ArrowRight size={16} /></Link><WorkButton primary onClick={() => setImporting(true)}><Upload size={17} />导入材料</WorkButton></div></header>
        <div className={s.tabs} role="group" aria-label="产物状态">{[["all", "全部产物"], ["pending", "待整理"], ["reviewed", "已审阅"], ["shared", "演示已分享"]].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}{id === "pending" && <span className={s.count}>{items.filter(x => x.unorganized).length}</span>}</button>)}</div>
        <div className={s.filters}><label className={s.search}><Search size={18} /><input aria-label="搜索材料" placeholder="搜索标题、课题或来源" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="材料类型" value={type} onChange={e => setType(e.target.value)}><option value="">全部类型</option>{[...new Set(items.map(x => x.type))].map(x => <option key={x}>{x}</option>)}</select><select aria-label="学科" value={subject} onChange={e => setSubject(e.target.value)}><option value="">全部学科</option>{[...new Set(items.map(x => x.subject))].map(x => <option key={x}>{x}</option>)}</select><select aria-label="可见范围" value={visibility} onChange={e => setVisibility(e.target.value)}><option value="">可见范围</option><option value="private">仅自己</option><option value="class">演示已分享</option></select><select aria-label="材料排序" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">最近更新</option><option value="oldest">最早更新</option><option value="title">标题排序</option></select><div className={s.segmented} role="group" aria-label="排列方式"><button title="列表视图" aria-label="列表视图" aria-pressed={!grid} onClick={() => setGrid(false)}><List size={19} /></button><button title="缩略图视图" aria-label="缩略图视图" aria-pressed={grid} onClick={() => setGrid(true)}><LayoutGrid size={18} /></button></div></div>
        {folder && <p className={s.folderFilter}>课题：{folder}<button aria-label="清除课题筛选" onClick={() => setFolder("")}><X size={16} /></button></p>}
        {chosen.length > 0 && <div className={s.batchBar}><strong>已选 {chosen.length} 份</strong><WorkButton onClick={() => startExport(chosen)}><Download size={16} />导出</WorkButton><WorkButton onClick={() => { setFolderDraft(""); setBatch("folder"); }}><FolderInput size={16} />按课题整理</WorkButton><WorkButton onClick={() => setBatch("delete")}><Trash2 size={16} />删除</WorkButton><WorkButton onClick={() => setSelected([])}>取消选择</WorkButton></div>}
        {notice && <p className={s.notice} role="status">{notice}</p>}
        {!filtered.length ? <div className={s.empty}><Search size={28} /><h2>{items.length ? "没有匹配的材料" : "本机材料库还是空的"}</h2><WorkButton onClick={items.length ? resetFilters : () => setImporting(true)}>{items.length ? "清除筛选" : "导入本地材料"}</WorkButton></div> : <div className={grid ? s.materialGrid : s.materialList}>
          {!grid && <div className={s.listHeading}><input aria-label="选择当前筛选的全部材料" type="checkbox" checked={filtered.length > 0 && filtered.every(x => selected.includes(x.id))} onChange={e => setSelected(prev => e.target.checked ? [...new Set([...prev, ...filtered.map(x => x.id)])] : prev.filter(id => !filtered.some(x => x.id === id)))} /><span>材料与用途</span><span>来源</span><span>审阅状态</span><span>可见范围</span><span>更新</span><span>操作</span></div>}
          {filtered.map(item => { const v = latest(item); return <article key={item.id} className={s.materialRow}><input type="checkbox" aria-label={`选择 ${v.title}`} checked={selected.includes(item.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id))} /><button className={s.materialName} onClick={() => { setNotice(""); setDetail(item.id); }}><DocumentThumbnail content={v.student} title={v.title} art={item.art} /><span><strong>{v.title}</strong><small>{item.type} · {item.grade} · {item.subject}</small></span></button><div className={s.sourceCell}>{item.source}<small>{item.sourceVersion || v.label}</small></div><div><span className={v.reviewedAt ? s.reviewed : item.unorganized ? s.draftBadge : s.pending}>{v.reviewedAt ? "本机已审阅" : item.unorganized ? "待整理" : "待核对"}</span></div><div className={s.visibilityCell}>{item.shared ? <Users size={16} /> : <LockKeyhole size={16} />}{item.shared ? `演示 ${item.shared.label}` : "仅自己"}</div><time className={s.timeCell}>{new Date(v.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</time><div className={s.rowActions}><button title="预览材料" aria-label={`预览 ${v.title}`} onClick={() => setDetail(item.id)}><Eye size={18} /></button><button title="删除本机材料" aria-label={`删除 ${v.title}`} onClick={() => { setSelected([item.id]); setBatch("delete"); }}><Trash2 size={16} /></button></div></article>; })}
        </div>}
        <p className={s.resultCount}>{filtered.length} 份材料{filtered.length !== items.length ? ` / 共 ${items.length} 份` : ""}</p>
        <div className={s.folders}><h2>按课题整理</h2>{folders.map(name => <button key={name} aria-pressed={folder === name} onClick={() => setFolder(folder === name ? "" : name)}><ResearchArt name="folder" size={44} />{name}</button>)}</div>
      </>}
      {current && notice && <p role="status" className={s.notice}>{notice}</p>}
      {importing && <ImportDialog onClose={() => setImporting(false)} onImport={newItems => { if (!storage.ready) return "本机材料尚未就绪，所选文件仍保留。"; const next = [...items, ...newItems]; if (next.length > MAX_MATERIALS || totalText(next) > MAX_TOTAL_TEXT) return "超过本机材料容量（100份或100万字符），请先导出整理。"; if (!validateMaterials(next)) return "材料格式校验失败，未修改本机材料库，请重新选择文件。"; setItems(next); setImporting(false); setNotice(`已读取 ${newItems.length} 份本地材料，未上传。`); return null; }} />}
      <WorkDialog className={s.workspace} open={!!batch} onOpenChange={open => { if (!open) setBatch(null); }} title={batch === "delete" ? "删除本机材料" : "按课题整理"} description={batch === "delete" ? `将删除所选 ${chosen.length} 份本机材料及其版本。不会影响真实归档，删除后无法恢复。` : `将所选 ${chosen.length} 份材料归入同一课题。`}>
        {batch === "folder" && <label className={s.field}>课题名称<input autoFocus value={folderDraft} maxLength={60} onChange={e => setFolderDraft(e.target.value)} list="artifact-folder-options" /><datalist id="artifact-folder-options">{folders.map(x => <option key={x}>{x}</option>)}</datalist></label>}
        <div className={s.dialogFooter}><WorkButton onClick={() => setBatch(null)}>取消</WorkButton><WorkButton primary disabled={!chosen.length || batch === "folder" && !folderDraft.trim()} onClick={() => { setItems(prev => batch === "delete" ? prev.filter(x => !selected.includes(x.id)) : prev.map(x => selected.includes(x.id) ? { ...x, folder: folderDraft.trim(), unorganized: false } : x)); setSelected([]); setBatch(null); }}>{batch === "delete" ? "确认删除" : "保存整理"}</WorkButton></div>
      </WorkDialog>
    </>}
    <ExportTasks open={exportOpen} onOpenChange={setExportOpen} files={files} title="导出本机教学材料" />
  </div></WorkspaceFrame>;
}

function ImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (items: DemoMaterial[]) => string | null }) {
  const [incoming, setIncoming] = useState<DemoMaterial[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const operation = useRef(0);
  const read = async (files: FileList | null) => {
    const token = ++operation.current; setIncoming([]); setError("");
    if (!files?.length) return;
    if (files.length > 5) { setError("每次最多选择5个文件。"); return; }
    setProgress({ completed: 0, total: files.length }); setBusy(true);
    try {
      const next: DemoMaterial[] = [];
      for (const file of Array.from(files)) {
        if (!/\.(txt|md|markdown)$/i.test(file.name) || file.size > 65536) throw new Error("仅支持 UTF-8 文本或 Markdown，每份不超过64 KiB。");
        const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
        if (!text.trim() || text.includes("\u0000") || text.length > MAX_TEXT) throw new Error(`${file.name} 为空、非文本或超过30000字符。`);
        const title = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 120) || "未命名导入材料";
        next.push({ id: makeId(), type: "本地文本", subject: "未分类", grade: "未设置", art: "worksheet", source: file.name.slice(0, 120), conditions: "请核对文件来源、使用许可与适用班级。", folder: "本地导入", unorganized: true, versions: [{ id: makeId(), label: "v1.0", title, student: text, notes: "", checks: [false, false, false], createdAt: Date.now() }] });
        if (token === operation.current) setProgress({ completed: next.length, total: files.length });
      }
      if (!validateMaterials(next)) throw new Error("文件材料格式校验失败，请重新选择文件。");
      if (token === operation.current) setIncoming(next);
    } catch (e) { if (token === operation.current) setError(e instanceof Error ? e.message : "文件读取失败，请重新选择。"); }
    finally { if (token === operation.current) setBusy(false); }
  };
  const close = () => { operation.current++; onClose(); };
  return <WorkDialog className={s.workspace} open onOpenChange={open => { if (!open) close(); }} title="导入本地材料" description="仅在当前浏览器读取与保存，不上传文件。请先移除学生姓名、联系方式及其他敏感信息。">
    <label className={s.importZone}><Upload size={26} /><strong>选择文本或 Markdown 文件</strong><span>最多5份 · 每份64 KiB / 30000字符 · UTF-8</span><input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" multiple onChange={e => void read(e.target.files)} /></label>
    {busy && <div className={s.importProgress}><p role="status">正在读取本地文件 · 已完成 {progress.completed} / {progress.total} 份</p><div className={s.progressTrack} role="progressbar" aria-label="本地文件读取进度" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed} aria-valuetext={`已读取 ${progress.completed} / ${progress.total} 份`}><span style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }} /></div></div>}{incoming.map(x => <p key={x.id}><Check size={16} />{latest(x).title} · {latest(x).student.length} 字符</p>)}{error && <p role="alert" className={s.error}>{error}</p>}
    <div className={s.dialogFooter}><WorkButton onClick={close}>取消</WorkButton><WorkButton primary disabled={busy || !incoming.length} onClick={() => { if (!validateMaterials(incoming)) { setError("导入材料格式校验失败，未修改本机材料库。"); return; } const message = onImport(incoming); if (message) setError(message); }}>加入本机材料库</WorkButton></div>
  </WorkDialog>;
}
