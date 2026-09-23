"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, FileText, LockKeyhole, Minus, PanelRightOpen, Pencil, Plus, Save, Share2, Users, X } from "lucide-react";
import { WorkButton, WorkDialog, ResearchArt } from "@/components/research/workspace-shared";
import { DocumentPreview, DocumentThumbnail } from "./DocumentPreview";
import { latest, makeId, MAX_TEXT, MAX_VERSIONS, pagesOf, REVIEW_LABELS, type DemoMaterial, type MaterialVersion, type ReviewChecks } from "./model";
import s from "./workspace.module.css";

export function MaterialDetail({ item, onChange, onBack, onCopy, onExport, onSource }: {
  item: DemoMaterial; onChange: (item: DemoMaterial) => boolean; onBack: () => void; onCopy: (item: DemoMaterial, version: MaterialVersion) => boolean; onExport: (version: MaterialVersion) => void; onSource: (id: string) => boolean;
}) {
  const [versionId, setVersionId] = useState(latest(item).id);
  const version = item.versions.find(v => v.id === versionId) ?? latest(item);
  const [audience, setAudience] = useState<"student" | "teacher">("student");
  const [panel, setPanel] = useState(true);
  const [tab, setTab] = useState("review");
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: version.title, student: version.student, notes: version.notes });
  const [share, setShare] = useState(false);
  const [discard, setDiscard] = useState<"back" | "cancel-edit" | null>(null);
  const [notice, setNotice] = useState("");
  const panelButton = useRef<HTMLButtonElement>(null);
  const content = audience === "student" ? version.student : `${version.student}\n\n---\n\n${version.notes}`;
  const pages = pagesOf(content);
  const dirty = editing && (draft.title !== version.title || draft.student !== version.student || draft.notes !== version.notes);
  useEffect(() => { if (!dirty) return; const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [dirty]);
  const setChecks = (index: number, checked: boolean) => {
    const checks = [...version.checks] as ReviewChecks; checks[index] = checked;
    if (!onChange({ ...item, versions: item.versions.map(v => v.id === version.id ? { ...v, checks, reviewedAt: undefined } : v) })) setNotice("核对项未保存，请先检查本机存储状态与容量。");
  };
  const startEdit = () => { setDraft({ title: version.title, student: version.student, notes: version.notes }); setEditing(true); setNotice(""); };
  const save = () => {
    if (!draft.title.trim() || !draft.student.trim()) { setNotice("标题与学生正文不能为空。"); return; }
    if (draft.title.length > 120 || draft.student.length > MAX_TEXT || draft.notes.length > MAX_TEXT) { setNotice("标题最多120字，正文与备注各最多30000字。"); return; }
    if (item.versions.length >= MAX_VERSIONS) { setNotice("已保留20个版本，请创建改编副本后继续；不会覆盖旧版本。"); return; }
    const previous = /^v1\.(\d+)$/.exec(latest(item).label);
    const v: MaterialVersion = { ...draft, title: draft.title.trim(), id: makeId(), label: `v1.${previous ? Number(previous[1]) + 1 : item.versions.length}`, createdAt: Date.now(), checks: [false, false, false] };
    if (!onChange({ ...item, unorganized: false, versions: [...item.versions, v] })) { setNotice("本机容量不足，修改仍在编辑区，请复制正文或导出旧版本后整理材料。"); return; }
    setVersionId(v.id); setEditing(false); setPage(0); setNotice("新版本已保存在本机，需重新审阅。已有分享快照未被替换。");
  };
  const closePanel = () => { setPanel(false); requestAnimationFrame(() => panelButton.current?.focus()); };
  return <section className={s.detail} aria-label="产物详情">
    <div className={s.breadcrumb}><WorkButton onClick={() => dirty ? setDiscard("back") : onBack()}><ArrowLeft size={16} />教学产物</WorkButton><span>/</span><span>{version.title}</span></div>
    <header className={s.detailHeader}><ResearchArt name="artifacts" size={62} /><div className={s.headingText}><h1>{version.title}</h1><div className={s.metadata}>{item.type} · {item.grade} · {item.subject}<span className={version.reviewedAt ? s.reviewed : s.pending}>{version.reviewedAt ? "本机已审阅" : "待核对"}</span><span><LockKeyhole size={14} />{item.shared ? `演示分享 ${item.shared.label}` : "仅自己"}</span></div></div>
      <div className={s.actions}>{editing ? <><WorkButton onClick={() => dirty ? setDiscard("cancel-edit") : setEditing(false)}>取消编辑</WorkButton><WorkButton primary onClick={save} disabled={!dirty}><Save size={16} />保存新版本</WorkButton></> : <><WorkButton onClick={() => { if (!onCopy(item, version)) setNotice("未创建改编副本，请先导出整理材料或等待本机存储就绪。"); }}><Copy size={16} />创建改编版</WorkButton><WorkButton primary onClick={startEdit}><Pencil size={16} />编辑内容</WorkButton></>}</div>
    </header>
    {notice && <p className={s.notice} role="status">{notice}</p>}
    {editing ? <div className={s.editor}>
      <p className={s.pending}>{dirty ? "有未保存修改" : "尚未修改"} · 保存为新版本，不覆盖原文</p>
      <label>材料标题<input value={draft.title} maxLength={120} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>学生正文 <span>{draft.student.length} / {MAX_TEXT}</span><textarea value={draft.student} maxLength={MAX_TEXT} rows={18} onChange={e => setDraft({ ...draft, student: e.target.value })} /></label>
      <label>教师备注与参考答案 <span>{draft.notes.length} / {MAX_TEXT}</span><textarea value={draft.notes} maxLength={MAX_TEXT} rows={7} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
    </div> : <>
      <div className={s.documentToolbar}>
        <div className={s.segmented} role="group" aria-label="文档版本视图">{(["student", "teacher"] as const).map(a => <button key={a} aria-pressed={audience === a} onClick={() => { setAudience(a); setPage(0); }}>{a === "student" ? "学生版" : "教师版"}</button>)}</div>
        <select aria-label="选择修订版本" value={version.id} onChange={e => { setVersionId(e.target.value); setPage(0); setNotice(""); }}>{item.versions.slice().reverse().map(v => <option key={v.id} value={v.id}>{v.label}{v.reviewedAt ? " · 已审阅" : " · 待核对"}</option>)}</select>
        <div className={s.zoom}><button title="缩小" aria-label="缩小" disabled={zoom <= 60} onClick={() => setZoom(z => z - 10)}><Minus size={16} /></button><output>{zoom}%</output><button title="放大" aria-label="放大" disabled={zoom >= 140} onClick={() => setZoom(z => z + 10)}><Plus size={16} /></button></div>
        <div className={s.actions}><WorkButton onClick={() => onExport(version)}><Download size={16} />导出 {version.label}</WorkButton><WorkButton disabled={!version.reviewedAt} title={!version.reviewedAt ? "先完成本版本三项核对并确认审阅" : "仅演示，不向真实班级发布"} onClick={() => setShare(true)}><Share2 size={16} />演示分享</WorkButton>{item.shared && <WorkButton onClick={() => { if (!onChange({ ...item, shared: undefined })) { setNotice("撤回未保存，请核对本机存储状态后重试。"); return; } setNotice("本机分享演示已撤回，真实班级不受影响。"); }}>撤回演示分享</WorkButton>}<button ref={panelButton} className={s.iconButton} aria-label={panel ? "收起审阅侧栏" : "展开审阅侧栏"} title={panel ? "收起审阅侧栏" : "展开审阅侧栏"} aria-expanded={panel} onClick={() => setPanel(v => !v)}><PanelRightOpen size={18} /></button></div>
      </div>
      {!version.reviewedAt && <p className={s.muted}>本版本尚未确认审阅，演示分享暂不可用。</p>}
      <div className={`${s.documentLayout} ${panel ? "" : s.panelClosed}`}>
        <div className={s.documentMain}><DocumentPreview content={content} art={item.art} page={page} zoom={zoom} /><div className={s.pagination}><button aria-label="上一页" title="上一页" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {pages.length}</span><button aria-label="下一页" title="下一页" disabled={page >= pages.length - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button></div></div>
        {panel && <aside className={s.reviewPanel} aria-label="审阅与来源"><div className={s.panelHeading}><h2>审阅与来源</h2><button className={s.iconButton} onClick={closePanel} aria-label="关闭审阅侧栏" title="收起侧栏"><ChevronRight size={18} /></button></div><div className={s.tabs} role="group" aria-label="详情辅助视图">{[["review", "审阅"], ["source", "来源"], ["versions", "版本"]].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
          {tab === "review" && <div className={s.panelBody}><h3>本版本核对</h3>{REVIEW_LABELS.map((label, i) => <label className={s.checkLabel} key={label}><input type="checkbox" checked={version.checks[i]} onChange={e => setChecks(i, e.target.checked)} />{label}</label>)}<p className={version.reviewedAt ? s.good : s.pending}>{version.reviewedAt ? "已完成本机审阅" : `还有 ${version.checks.filter(x => !x).length} 项待确认`}</p><hr /><h3>适用条件</h3><p>{item.conditions}</p><hr /><h3>来源</h3><p>{item.source} · {item.sourceVersion || "原始材料"}</p><WorkButton disabled={!!version.reviewedAt || !version.checks.every(Boolean)} onClick={() => { if (!onChange({ ...item, unorganized: false, versions: item.versions.map(v => v.id === version.id ? { ...v, reviewedAt: Date.now() } : v) })) { setNotice("审阅确认未保存，请先核对本机存储状态。"); return; } setNotice("本机审阅已记录，不代表教学效果认证。"); }}><CheckCircle2 size={17} />确认本版本已审阅</WorkButton><p className={s.muted}>教师确认不等于效果认证</p></div>}
          {tab === "source" && <div className={s.panelBody}><h3>来源与改编关系</h3><p>{item.source}</p><p>{item.sourceVersion || "未关联外部版本"}</p>{item.sourceId && <WorkButton onClick={() => { if (!onSource(item.sourceId!)) setNotice("源材料已移除，当前副本及来源说明仍保留。"); }}>打开源材料</WorkButton>}<h3>使用边界</h3><p>{item.conditions}</p><p className={s.muted}>演示材料不包含已核验的真实引用。导入材料的来源与使用许可需自行核对。</p></div>}
          {tab === "versions" && <div className={s.panelBody}>{item.versions.slice().reverse().map(v => <button className={s.versionRow} key={v.id} aria-pressed={version.id === v.id} onClick={() => { setVersionId(v.id); setPage(0); }}><strong>{v.label}</strong><span>{new Date(v.createdAt).toLocaleString("zh-CN")}</span><span>{v.reviewedAt ? "本机已审阅" : "待核对"}</span></button>)}{item.shared && <p className={s.notice}>演示分享固定于 {item.shared.label}，后续修订不自动替换。</p>}</div>}
        </aside>}
      </div>
    </>}
    {share && <ShareDialog item={item} version={version} onClose={() => setShare(false)} onShare={() => { if (!onChange({ ...item, shared: { versionId: version.id, label: version.label, title: version.title, student: version.student, at: Date.now() } })) { setShare(false); setNotice("本机容量不足，未保存分享快照。"); return; } setShare(false); setNotice(`已记录 ${version.label} 的本机分享演示，未向真实班级发布。`); }} />}
    <WorkDialog className={s.workspace} open={discard !== null} onOpenChange={open => { if (!open) setDiscard(null); }} title="未保存的修改" description="离开编辑将放弃这次尚未保存的修改，已保存版本不受影响。"><div className={s.dialogFooter}><WorkButton onClick={() => setDiscard(null)}>继续编辑</WorkButton><WorkButton onClick={() => { const intent = discard; setDiscard(null); setEditing(false); if (intent === "back") onBack(); }}>放弃本次修改</WorkButton></div></WorkDialog>
  </section>;
}

function ShareDialog({ item, version, onClose, onShare }: { item: DemoMaterial; version: MaterialVersion; onClose: () => void; onShare: () => void }) {
  const [checks, setChecks] = useState([false, false]);
  const [preview, setPreview] = useState(false);
  return <WorkDialog open onOpenChange={open => { if (!open) onClose(); }} title="演示分享给本班" description="仅在本机记录分享快照，不会向真实学生发布。" className={`${s.workspace} ${s.shareDialog}`}>
    <div className={s.shareSummary}><DocumentThumbnail content={version.student} art={item.art} title={version.title} /><div><h3>{version.title}</h3><p>学生版 · {version.label}</p><span className={s.good}><CheckCircle2 size={16} />本机已审阅</span></div></div>
    <h3>分享对象</h3><div className={s.targetClass}><Users size={18} />八年级（2）班<span><LockKeyhole size={14} />演示班级 · 只读</span></div>
    <h3>学生将看到</h3><p><FileText size={16} />学习单正文（{pagesOf(version.student).length} 页）</p><p>额外附件：0 份（本次不分享附件）</p>
    <div className={s.notice}><strong>不包含</strong><p>教师备注与参考答案、内部讨论、课堂观察原始材料</p></div>
    <WorkButton onClick={() => setPreview(v => !v)}>{preview ? "收起学生版预览" : "再次预览学生版"}</WorkButton>{preview && <div className={s.sharePreview}>{pagesOf(version.student).map((_, i) => <DocumentPreview key={i} content={version.student} page={i} />)}</div>}
    <h3>授权确认</h3>{["我已核对学生正文内容与适用班级", "我已核对素材来源与使用权限"].map((label, i) => <label className={s.checkLabel} key={label}><input type="checkbox" checked={checks[i]} onChange={e => setChecks(prev => prev.map((v, j) => j === i ? e.target.checked : v))} />{label}</label>)}
    <p className={s.muted}>固定学生版 {version.label} 的当前正文快照；后续修改不会自动替换。</p>
    <div className={s.dialogFooter}><WorkButton onClick={onClose}><X size={16} />返回检查</WorkButton><WorkButton primary disabled={!checks.every(Boolean)} onClick={onShare}><Share2 size={16} />确认演示分享</WorkButton></div>
  </WorkDialog>;
}
