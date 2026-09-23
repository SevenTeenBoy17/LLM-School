"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronsLeft, ChevronsRight, ClipboardList, Copy, Eye, FileText, History, Info, LockKeyhole, MessageSquare, Pencil, Plus, Save, Sparkles, Target, Trash2, Users, X } from "lucide-react";
import { ResearchArt, WorkButton, WorkDialog, useResearchOwner } from "@/components/research/workspace-shared";
import { uid, PREP_LIMITS, preparePrepSave, samePrepContent, type PrepProject, type Discussion, type PrepEntry } from "./model";
import { hasUnsubmitted } from "./recovery";
import { PrepRecoveryPanel } from "./PrepRecoveryPanel";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { clearPrepBuffer, readPrepBuffer, writePrepBuffer } from "./draftBuffers";
import { useDepartureBuffer } from "./useDepartureBuffer";
import s from "./prep.module.css";

type View = "共同底稿" | "资料" | "课堂记录" | "复盘" | "版本";
type PrepDetailProps = { project: PrepProject; persistent: boolean; entry?: PrepEntry; onSave: (p: PrepProject) => string | null; onBack: () => void; onAdapt: (p: PrepProject) => string | null };
export function PrepDetail(props: PrepDetailProps) {
  const owner = useResearchOwner();
  return owner ? <PrepDetailEditor key={JSON.stringify([owner, props.project.id])} {...props} owner={owner} /> : null;
}
function PrepDetailEditor({ owner, project, persistent, entry = "document", onSave, onBack, onAdapt }: PrepDetailProps & { owner: string }) {
  const [restored] = useState(() => readPrepBuffer(owner, project));
  const [draft, setDraft] = useState(() => structuredClone(restored?.draft ?? project));
  const [view, setView] = useState<View>(entry === "observation" ? "课堂记录" : "共同底稿");
  const [outline, setOutline] = useState(true);
  const [side, setSide] = useState(entry !== "observation");
  const [compact, setCompact] = useState(false);
  const [editing, setEditing] = useState(!!restored && !samePrepContent(restored.draft, project));
  const [showAll, setShowAll] = useState(false);
  const [comment, setComment] = useState(restored?.unsubmitted.comment ?? "");
  const [replies, setReplies] = useState<Record<string, string>>(() => ({ ...restored?.unsubmitted.replies }));
  const [handling, setHandling] = useState<Discussion | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>(() => ({ ...restored?.unsubmitted.reasons }));
  const reason = handling ? reasons[handling.id] ?? "" : "";
  const [dialog, setDialog] = useState<"scope" | "model" | "leave" | "adapt" | "recovery" | null>(entry === "adapt" ? "adapt" : null);
  const [saveError, setSaveError] = useState("");
  const [includeText, setIncludeText] = useState(true);
  const [note, setNote] = useState(restored ? "已恢复本账号、本项目同一保存基线的内存草稿，修改与未提交文字仍未保存。" : "");
  const root = useRef<HTMLDivElement>(null);
  const measured = useRef(false);
  const dirty = !samePrepContent(draft, project);
  const unsubmitted = { comment, replies, reasons };
  const clearDepartureBuffer = useDepartureBuffer({ saved: project, draft, unsubmitted }, buffer => writePrepBuffer(owner, buffer), () => clearPrepBuffer(owner, project.id));
  const pendingText = hasUnsubmitted(unsubmitted);
  const anyDirty = dirty || pendingText;
  const pendingSummary = [comment.length > 0 ? "新意见" : "", Object.values(replies).some(value => value.length) ? "回应" : "", Object.values(reasons).some(value => value.length) ? "处理理由" : ""].filter(Boolean).join("、");
  useUnsavedChanges(anyDirty);
  useEffect(() => { if (!root.current) return; const observer = new ResizeObserver(entries => { const narrow = entries[0].contentRect.width < 1000; if (!measured.current && narrow && entry !== "discussion") setSide(false); measured.current = true; setCompact(narrow); }); observer.observe(root.current); return () => observer.disconnect(); }, [entry]);
  const change = <K extends keyof PrepProject>(key: K, value: PrepProject[K]) => setDraft(p => ({ ...p, [key]: value }));
  const save = (stage?: PrepProject["stage"]) => {
    if (pendingText) { setSaveError(`尚有未提交的${pendingSummary}，本次未保存。请先添加意见、回应或保留处理理由；也可清空对应输入或导出备份。`); return false; }
    const result = preparePrepSave(project, draft, stage);
    if (result.error) { setSaveError(result.error); return false; }
    if (!result.changed) { clearDepartureBuffer(); setDraft(structuredClone(project)); setSaveError(""); setEditing(false); setNote("内容与阶段均未变化，未新增版本或修订摘要。"); return true; }
    const next = result.project;
    const error = onSave(next);
    if (error) { setSaveError(error); return false; }
    clearDepartureBuffer();
    setSaveError(""); setDraft(next); setEditing(false); setNote(stage ? "已更新本机演示状态，未通知其他成员。" : persistent ? "已保存到本标签页。" : "已保留在页面内存，浏览器存储不可用。刷新可能丢失。");
    return true;
  };
  const updateDiscussion = (id: string, patch: Partial<Discussion>) => change("discussions", draft.discussions.map(d => d.id === id ? { ...d, ...patch } : d));
  const resumeUnsubmitted = () => {
    setDialog(null); setSide(true);
    const opinion = draft.discussions.find(d => reasons[d.id]?.length);
    if (opinion) setHandling(opinion);
  };
  const switchView = (next: View) => { setView(next); if (next === "复盘") { setOutline(false); setSide(false); } };
  const field = (key: "goal" | "question" | "conditions" | "studentMaterial" | "observationPlan", label: string) => editing ? <textarea aria-label={label} maxLength={12000} rows={3} value={draft[key]} onChange={e => change(key, e.target.value)} /> : <p className={!draft[key] ? s.muted : undefined}>{draft[key] || "待补充"}</p>;
  const evidenceText = draft.evidence.map(e => `原始观察：${e.observation}\n教师解释：${e.interpretation}\n下一次调整：${e.adjustment}`).join("\n\n");
  const comments = <div className={s.discussionContent}>
    <div className={s.sectionHeader}><h3>讨论 {draft.discussions.length}</h3>{!compact && <button className={s.iconButton} title="收起讨论" aria-label="收起讨论" onClick={() => setSide(false)}><X size={17} /></button>}</div>
    <div className={s.smallTabs}><button aria-pressed={!showAll} onClick={() => setShowAll(false)}>未处理</button><button aria-pressed={showAll} onClick={() => setShowAll(true)}>全部</button></div>
    {draft.discussions.filter(d => showAll || !d.reason).map(d => <article className={s.comment} key={d.id}><strong>{d.author}</strong><small>{d.section}</small><p>{d.text}</p>{d.replies.map((r, i) => <p className={s.reply} key={i}><b>我：</b>{r}</p>)}{d.reason ? <div className={s.resolved}><Check size={15} /><span>已处理：{d.reason}<small>不代表全员同意</small></span></div> : <><label className={s.srOnly} htmlFor={`reply-${d.id}`}>回应 {d.author} 的意见</label><textarea id={`reply-${d.id}`} rows={2} maxLength={2000} placeholder="回应这条意见…" value={replies[d.id] ?? ""} onChange={e => setReplies(p => ({ ...p, [d.id]: e.target.value }))} /><div className={s.actions}><button className={s.textButton} disabled={!replies[d.id]?.trim() || d.replies.length >= PREP_LIMITS.replies} title={d.replies.length >= PREP_LIMITS.replies ? "每条意见最多保留 20 条回应" : undefined} onClick={() => { if (d.replies.length >= PREP_LIMITS.replies) return; updateDiscussion(d.id, { replies: [...d.replies, replies[d.id].trim()] }); setReplies(p => ({ ...p, [d.id]: "" })); }}>回应</button><button className={s.textButton} onClick={() => { setHandling(d); }}>标记已处理</button></div></>}</article>)}
    {!draft.discussions.some(d => showAll || !d.reason) && <p className={s.muted}>没有{showAll ? "讨论记录" : "未处理意见"}</p>}
    <label>留下意见<textarea aria-label="留下意见" rows={3} maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} placeholder="问题、建议，或不同意见" /></label><WorkButton disabled={!comment.trim() || draft.discussions.length >= PREP_LIMITS.discussions} title="最多保留 40 条意见" onClick={() => { if (draft.discussions.length >= PREP_LIMITS.discussions) return; change("discussions", [...draft.discussions, { id: uid(), author: "我（本机）", section: view, text: comment.trim(), replies: [], reason: "" }]); setComment(""); }}>添加意见</WorkButton><p className={s.meta}>讨论 {draft.discussions.length}/{PREP_LIMITS.discussions} · 每条最多 {PREP_LIMITS.replies} 次回应。保存后保留回应与处理理由，不通知成员。</p>
  </div>;
  return <div ref={root} className={s.detail} data-testid="prep-detail">
    <button className={s.breadcrumb} onClick={() => anyDirty ? setDialog("leave") : onBack()}><ArrowLeft size={15} />集体备课 / 共备详情</button>
    <header className={s.heading}><ResearchArt name={draft.art} size={54} /><div><h1>{draft.title}</h1><p>{draft.grade} · {draft.subject} · {draft.kind} <span><LockKeyhole size={13} />仅本机可见{draft.example ? " · 示例项目" : " · 个人草稿"}</span></p></div><div className={s.actions}><WorkButton onClick={() => setDialog("adapt")}><Copy size={16} />个人改编</WorkButton><WorkButton primary onClick={() => save(view === "复盘" ? undefined : "待讨论")}><Save size={16} />{view === "复盘" ? "保存复盘" : "保存并提交讨论"}</WorkButton></div></header>
    {draft.source && <p className={s.sourceLine}>改编自：{draft.source.title} · v{draft.source.version}。课堂证据未继承。</p>}
    {note && <p className={s.feedback} role="status">{note}</p>}
    {saveError && !dialog && <p className={s.warning} role="alert">{saveError}</p>}
    {pendingText && <div className={s.warning} role="status"><p>未提交文字：{pendingSummary}。尚未加入讨论记录，不包含在已保存版本中。</p><WorkButton onClick={resumeUnsubmitted}>继续处理未提交文字</WorkButton></div>}
    <nav className={s.tabs} aria-label="共备详情">{(["共同底稿", "资料", "课堂记录", "复盘", "版本"] as View[]).filter(v => draft.kind === "研究课" || !["课堂记录", "复盘"].includes(v)).map(v => <button key={v} aria-current={view === v ? "page" : undefined} onClick={() => switchView(v)}>{v}</button>)}</nav>
    <div className={s.flow}><span><Target size={19} />聚焦问题</span><ArrowRight size={15} /><span className={view === "共同底稿" ? s.activeStep : ""}><Users size={19} />共同备课</span><ArrowRight size={15} /><span><ClipboardList size={19} />{draft.kind === "研究课" ? "课堂实施" : "个人改编"}</span>{draft.kind === "研究课" && <><ArrowRight size={15} /><span className={view === "复盘" ? s.activeStep : ""}><History size={19} />复盘改进</span></>}</div>
    <div className={s.documentLayout} data-outline={outline && !compact} data-discussion={side && !compact}>
      <aside className={s.outline}><button title={outline ? "收起提纲" : "展开提纲"} aria-label={outline ? "收起提纲" : "展开提纲"} className={s.iconButton} onClick={() => setOutline(!outline)}>{outline ? <ChevronsLeft size={19} /> : <ChevronsRight size={19} />}{outline && !compact && "收起"}</button>{outline && <nav aria-label="文档提纲">{[["goal", "本课目标"], ["question", "驱动问题"], ["tasks", "课堂任务"], ["observation", "观察计划"], ["materials", "学生材料"]].map(([id, label]) => <button key={id} title={label} onClick={() => { switchView("共同底稿"); requestAnimationFrame(() => document.getElementById(`prep-${id}`)?.scrollIntoView({ behavior: "instant", block: "center" })); }}><FileText size={17} />{!compact && label}</button>)}</nav>}</aside>
      <main className={s.document}>
        <div className={s.toolbar}><WorkButton onClick={() => setEditing(!editing)}><Pencil size={15} />{editing ? "预览正文" : "编辑正文"}</WorkButton>{dirty && <WorkButton onClick={() => save()}><Save size={15} />保存</WorkButton>}<WorkButton onClick={() => setDialog("recovery")}><History size={15} />备份与恢复</WorkButton><span role="status">v{draft.version} · {anyDirty ? pendingText ? "有未提交文字" : "未保存" : persistent ? "已保存到本标签页" : "仅页面内存"}</span><button className={s.iconButton} title="打开讨论" aria-label="打开讨论" onClick={() => setSide(true)}><MessageSquare size={18} /></button></div>
        {view === "共同底稿" && <div className={s.documentBody}><h2>{draft.question || draft.title}</h2><section id="prep-goal"><h3>学习目标</h3>{field("goal", "学习目标")}</section><section id="prep-question"><h3>驱动问题</h3>{field("question", "驱动问题")}</section><section id="prep-tasks"><div className={s.sectionHeader}><h3>课堂任务</h3>{editing && <WorkButton disabled={draft.rows.length >= PREP_LIMITS.rows} title="最多 40 个课堂环节" onClick={() => change("rows", [...draft.rows, { id: uid(), phase: "", task: "", support: "", observe: "" }])}><Plus size={15} />添加环节</WorkButton>}</div><div className={s.tableScroll}><table className={s.lessonTable}><thead><tr>{["环节", "学生任务", "教师支架", "观察线索"].map(x => <th key={x}>{x}</th>)}{editing && <th>操作</th>}</tr></thead><tbody>{draft.rows.map((r, index) => <tr key={r.id}>{(["phase", "task", "support", "observe"] as const).map((key, col) => <td key={key}>{editing ? <textarea rows={2} aria-label={`环节${index + 1} ${["名称", "学生任务", "教师支架", "观察线索"][col]}`} maxLength={2000} value={r[key]} onChange={e => change("rows", draft.rows.map(row => row.id === r.id ? { ...row, [key]: e.target.value } : row))} /> : r[key] || "待补充"}</td>)}{editing && <td><button className={s.iconButton} title="移除环节" aria-label={`移除环节${index + 1}`} onClick={() => change("rows", draft.rows.filter(row => row.id !== r.id))}><Trash2 size={15} /></button></td>}</tr>)}</tbody></table></div>{!draft.rows.length && <p className={s.emptyInline}>尚无课堂环节，编辑正文后添加。</p>}</section><section id="prep-observation"><h3>观察计划</h3>{field("observationPlan", "观察计划")}</section><section id="prep-materials"><h3>学生材料</h3>{field("studentMaterial", "学生材料")}</section><section className={s.warning}><h3>待确认 · 适用条件</h3>{field("conditions", "适用条件")}</section></div>}
        {(view === "复盘" || view === "课堂记录") && <div className={s.documentBody}><h2>{view === "复盘" ? "从课堂观察到下一次调整" : "课堂观察记录"}</h2><p className={s.meta}>关联本机备课版本 v{draft.version} · {draft.example ? "示例观察，非真实课堂记录" : "尚未核验实际授课版本"} · 未作效果判定</p><div className={s.observation}><strong>本轮观察问题</strong><span>{draft.observationPlan || "尚未填写，先约定观察问题"}</span></div><div className={s.tableScroll}><table className={s.lessonTable}><thead><tr><th>原始观察</th><th>解释与待验证</th><th>下一次调整</th>{editing && <th>操作</th>}</tr></thead><tbody>{draft.evidence.map((e, i) => <tr key={e.id}>{(["observation", "interpretation", "adjustment"] as const).map((key, col) => <td key={key}>{editing ? <textarea rows={4} maxLength={4000} aria-label={`记录${i + 1} ${["原始观察", "教师解释", "下一次调整"][col]}`} value={e[key]} onChange={event => change("evidence", draft.evidence.map(item => item.id === e.id ? { ...item, [key]: event.target.value } : item))} /> : <p>{e[key] || "尚不能判断"}</p>}{key === "observation" && <small>{editing ? <input aria-label={`记录${i + 1} 来源`} placeholder="匿名材料来源与采集条件" value={e.source} maxLength={1000} onChange={event => change("evidence", draft.evidence.map(item => item.id === e.id ? { ...item, source: event.target.value } : item))} /> : e.source || "来源未关联"}</small>}</td>)}{editing && <td><button className={s.iconButton} aria-label={`移除观察${i + 1}`} onClick={() => change("evidence", draft.evidence.filter(item => item.id !== e.id))}><Trash2 size={15} /></button></td>}</tr>)}</tbody></table></div>{!draft.evidence.length && <div className={s.empty}><ClipboardList size={26} /><h3>尚无课堂证据</h3><p>未自动添加学生作品或观察结果。请记录实际发生的情况。</p></div>}{editing && <WorkButton disabled={draft.evidence.length >= PREP_LIMITS.evidence} title="最多 40 条课堂观察" onClick={() => change("evidence", [...draft.evidence, { id: uid(), observation: "", interpretation: "", adjustment: "", source: "" }])}><Plus size={15} />添加匿名观察</WorkButton>}<p className={s.warning}><Info size={16} />证据不足：{draft.example ? "当前含示例观察；" : "材料由填写者提供，未独立核验；"}不支持因果结论。</p><div className={s.reflectionColumns}><section><h3>材料与出处</h3>{draft.evidence.map(e => <p key={e.id}><FileText size={16} />{e.source || "未关联来源"}</p>)}<p><FileText size={16} />本机共同底稿 v{draft.version}</p></section><section><h3>下一轮行动</h3>{editing ? <input aria-label="下一轮行动" maxLength={300} value={draft.next} onChange={e => change("next", e.target.value)} /> : <p>{draft.next || "待确认"}</p>}<p className={s.meta}>主备：{draft.lead} · 待确认</p><p>保留原方案，以个人改编形成新草稿。</p></section></div></div>}
        {view === "资料" && <div className={s.documentBody}><h2>资料与适用条件</h2><section><h3>班级与教材条件</h3>{field("conditions", "资料与适用条件")}</section><section><h3>学生材料正文</h3>{field("studentMaterial", "学生材料正文")}</section><p className={s.meta}>附件上传与组内共享未接入。本机备注不代表已取得材料授权。</p><section><h3>拟协作成员</h3><p>{draft.members || "尚未填写"}</p><small>仅本机备注，未实际邀请。</small></section></div>}
        {view === "版本" && <div className={s.documentBody}><h2>本机修订记录</h2><p className={s.meta}>保留目标与问题的修订摘要，不是服务器完整版本快照。</p>{draft.revisions.length ? [...draft.revisions].reverse().map((r, i) => <section key={i}><h3>v{r.version} · {r.note}</h3><small>{new Date(r.at).toLocaleString("zh-CN")}</small><p>{r.question || "问题待补充"}</p><p>{r.goal || "目标待补充"}</p></section>) : <p>尚无保存后的修订记录。</p>}</div>}
        <footer className={s.documentFooter}><Info size={15} />{draft.example ? "示例内容需替换为实际教学材料" : "教学判断与材料真实性由教师核对"}<span>{anyDirty ? pendingText ? "有未提交文字" : "有未保存修改" : "本机记录"}</span></footer>
      </main>
      {side && !compact && <aside className={s.sidePanel}>{comments}</aside>}
    </div>
    {(view === "复盘" || view === "课堂记录") && <section className={s.aiPanel}><div><strong><Sparkles size={19} />AI 整理 · 待确认</strong><p>发送：{includeText ? "仅本页复盘文字，不含附件" : "未选择任何材料"} · 模型与处理位置：未确认</p></div><div className={s.actions}><WorkButton onClick={() => setDialog("scope")}><Eye size={16} />查看发送内容</WorkButton><WorkButton onClick={() => setDialog("model")}>选择模型</WorkButton><WorkButton disabled title="本机演示不调用模型">生成改进建议</WorkButton></div></section>}
    <WorkDialog open={compact && side} onOpenChange={setSide} title="讨论" description="仅本机演示，不发送给其他成员">{comments}</WorkDialog>
    <WorkDialog open={!!handling} onOpenChange={open => { if (!open) setHandling(null); }} title="处理讨论意见" description="处理不代表全员同意，请保留采纳或暂不采纳的理由。"><div className={s.form}><p>{handling?.text}</p><label>处理理由<textarea value={reason} maxLength={2000} onChange={e => { if (handling) setReasons(p => ({ ...p, [handling.id]: e.target.value })); }} rows={4} /></label><p className={s.meta}>关闭窗口会保留尚未提交的处理理由。</p>{handling && replies[handling.id]?.length > 0 && <p className={s.warning}>这条意见还有未提交回应，请先返回讨论完成回应或清空该输入，再标记处理。</p>}<WorkButton primary disabled={!reason.trim() || !!(handling && replies[handling.id]?.length)} onClick={() => { if (!handling || !reason.trim() || replies[handling.id]?.length) return; updateDiscussion(handling.id, { reason: reason.trim() }); setReasons(p => ({ ...p, [handling.id]: "" })); setHandling(null); }}>保留理由并标记已处理</WorkButton></div></WorkDialog>
    <WorkDialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }} title={dialog === "scope" ? "核对发送范围" : dialog === "model" ? "模型与处理位置" : dialog === "adapt" ? "创建个人改编版" : dialog === "recovery" ? "完整备份与恢复" : "尚有未保存的修改"}><div className={s.form}>
      {saveError && <p className={s.warning} role="alert">{saveError}</p>}
      {dialog === "recovery" && <PrepRecoveryPanel saved={project} draft={draft} unsubmitted={unsubmitted} dirty={anyDirty} onRestore={backup => { setDraft(structuredClone(backup.draft)); setComment(backup.unsubmitted.comment); setReplies({ ...backup.unsubmitted.replies }); setReasons({ ...backup.unsubmitted.reasons }); setHandling(null); setDialog(null); setSaveError(""); setEditing(true); setSide(true); setNote("已恢复到编辑区，尚未保存。恢复不代表课堂材料已核验。"); }} onReset={() => { clearDepartureBuffer(); setDraft(structuredClone(project)); setComment(""); setReplies({}); setReasons({}); setHandling(null); setDialog(null); setSaveError(""); setEditing(false); setNote("已恢复上次保存状态，历史记录未变。"); }} />}
      {dialog === "scope" && <><label className={s.checkbox}><input type="checkbox" checked={includeText} onChange={e => setIncludeText(e.target.checked)} />选择本页复盘文字</label><pre className={s.preview}>{includeText ? evidenceText || "当前没有复盘文字。" : "未选择发送内容。"}</pre><p>不包含附件、内部讨论或其他课堂材料。本机演示不会发送任何请求。</p></>}
      {dialog === "model" && <><p>实际模型来源与处理位置尚未接入。</p><p>生成保持禁用，选择演示数据不能证明已取得外部处理授权。</p></>}
      {dialog === "adapt" && <><p>仅复制已保存底稿，保留来源名称与版本；不继承课堂证据、讨论和原项目成员。</p><p>{anyDirty ? "请先处理未提交文字并保存原项目。未保存的观察、讨论及正文不能随副本离开原项目。" : `来源版本：v${project.version}`}</p>{anyDirty && <><WorkButton onClick={() => save()} disabled={pendingText}><Save size={16} />先保存原项目</WorkButton>{pendingText && <WorkButton onClick={resumeUnsubmitted}>返回处理未提交文字</WorkButton>}<WorkButton onClick={() => setDialog("recovery")}>备份与恢复</WorkButton></>}<WorkButton primary disabled={anyDirty} data-testid="prep-create-adaptation" onClick={() => { if (anyDirty) return; const error = onAdapt(project); if (error) setSaveError(error); else setDialog(null); }}><Copy size={16} />创建个人副本</WorkButton></>}
      {dialog === "leave" && <>{pendingText && <p className={s.warning}>未提交的{pendingSummary}仍在输入框中，尚未保存。返回讨论处理后才可保存并离开。</p>}<div className={s.actions}><WorkButton onClick={() => setDialog(null)}>继续编辑</WorkButton>{pendingText && <WorkButton onClick={resumeUnsubmitted}>处理未提交文字</WorkButton>}<WorkButton disabled={pendingText} onClick={() => { if (save()) onBack(); }}>保存并返回</WorkButton><WorkButton onClick={() => setDialog("recovery")}>备份与恢复</WorkButton><WorkButton onClick={() => { clearDepartureBuffer(); onBack(); }}>放弃未保存修改及未提交文字</WorkButton></div></>}
    </div></WorkDialog>
  </div>;
}
