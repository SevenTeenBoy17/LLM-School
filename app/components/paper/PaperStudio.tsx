"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, BookOpen, Check, Clipboard, Download, FileText, FlaskConical, FolderOpen, Library, Search, Send, ShieldCheck, Square, Trash2, Upload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TeacherFeatureIcon } from "@/components/common/TeacherNavIcon";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { MODELS } from "@/lib/data/models";
import { checkPaperIdentity, IDENTITY_UNAVAILABLE } from "@/lib/paper/identity";
import { PHASES, TEMPLATES, RESEARCH_SKILLS, SOURCE_REVIEW_DATE, type PhaseId } from "@/lib/paper/catalog";
import { buildResearchPrompt, emptyResearchProject, PROJECT_FILE_LIMIT, RESEARCH_STATES, exportResearchRecord, parseResearchProject, safeSourceUrl, replaceMaterial, copyResearchOutput, type EvidenceItem, type ResearchBrief, type ResearchProject } from "@/lib/paper/workspace";
import { SkillGuide } from "./SkillGuide";
import { EvidencePanel } from "./EvidencePanel";
import { PaperDraftSession, clearPaperDraft, readPaperDraft, retainPaperDraft } from "./PaperDraftSession";
import s from "./paper-studio.module.css";

type Pending = { id: string; title: string; startedAt: number };
const TEXT_MODELS = MODELS.filter(m => m.id !== "gpt-image");
const GENERATION_TIMEOUT = 180000;

function downloadFile(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PaperStudio({ ownerId }: { ownerId: string }) {
  return <PaperDraftSession><PaperWorkspace key={ownerId} ownerId={ownerId} /></PaperDraftSession>;
}

function PaperWorkspace({ ownerId }: { ownerId: string }) {
  const [data, setData] = useState<ResearchProject>(() => readPaperDraft(ownerId)?.project ?? emptyResearchProject());
  const { brief, evidence, outputs, materialHistory, outputHistory, evidenceDraft } = data;
  const [tab, setTab] = useState("work");
  const [phase, setPhase] = useState<PhaseId>("topic");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("question");
  const [authorized, setAuthorized] = useState(false);
  const [model, setModel] = useState("minimax");
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exported, setExported] = useState(() => readPaperDraft(ownerId)?.exported ?? "");
  const [importing, setImporting] = useState(false);
  const [projectEpoch, setProjectEpoch] = useState(0);
  const [identityInvalid, setIdentityInvalid] = useState(false);
  const [identityChecking, setIdentityChecking] = useState(true);
  const [identityIssue, setIdentityIssue] = useState("");
  const [identityRetry, setIdentityRetry] = useState(0);
  const importingRef = useRef(false);
  const revisionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const task = TEMPLATES.find(t => t.id === selected)!;
  const guide = RESEARCH_SKILLS.find(item => item.id === task.skill)!;
  const phaseInfo = PHASES.find(p => p.id === phase)!;
  const prompt = buildResearchPrompt(task, brief, evidence);
  const project = JSON.stringify(data);
  const hasContent = !!(brief.topic || brief.audience || brief.context || brief.material || evidence.length || Object.keys(outputs).length || materialHistory.length || outputHistory.length || Object.values(evidenceDraft).some(Boolean));
  const dirty = hasContent && project !== exported;
  const result = outputs[selected];
  const visible = TEMPLATES.filter(t => query.trim() ? `${t.title} ${t.deliverable} ${t.input}`.toLowerCase().includes(query.trim().toLowerCase()) : t.phase === phase);

  useEffect(() => {
    if (!dirty) return;
    const guardNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin === window.location.origin && target.pathname !== window.location.pathname && !window.confirm("当前研究内容尚未导出。离开后可能丢失，确定离开吗？")) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("click", guardNavigation, true);
    return () => { document.removeEventListener("click", guardNavigation, true); };
  }, [dirty]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { if (!identityInvalid) retainPaperDraft(ownerId, data, exported, dirty); }, [ownerId, data, exported, dirty, identityInvalid]);
  useEffect(() => {
    let live = true;
    let initialized = false;
    const verify = async () => {
      if (!initialized) setIdentityChecking(true);
      try {
        const matches = await checkPaperIdentity(ownerId);
        if (live && !matches) {
          abortRef.current?.abort(); clearPaperDraft(); setAuthorized(false); setIdentityInvalid(true);
        }
        if (live && matches) setIdentityIssue("");
      } catch { if (live) { abortRef.current?.abort(); setAuthorized(false); setIdentityIssue(IDENTITY_UNAVAILABLE); } }
      finally { initialized = true; if (live) setIdentityChecking(false); }
    };
    const onVisibility = () => { if (document.visibilityState === "visible") void verify(); };
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", onVisibility);
    void verify();
    return () => { live = false; window.removeEventListener("focus", verify); document.removeEventListener("visibilitychange", onVisibility); };
  }, [ownerId, identityRetry]);

  function updateProject(update: (current: ResearchProject) => ResearchProject) {
    if (importingRef.current) return;
    revisionRef.current += 1;
    setData(update);
  }
  function updateBrief(key: keyof ResearchBrief, value: string) {
    updateProject(current => ({ ...current, brief: { ...current.brief, [key]: value } })); setAuthorized(false);
  }
  function updateEvidence(items: EvidenceItem[]) {
    updateProject(current => ({ ...current, evidence: items, outputs: Object.fromEntries(Object.entries(current.outputs).map(([id, output]) => [id, { ...output, checks: [false, false] }])) }));
    setAuthorized(false);
  }
  function carryMaterial(material: string) {
    if (pending || importingRef.current) return;
    try {
      const next = replaceMaterial(data, material);
      if (brief.material && !window.confirm("替换材料区内容？当前材料将独立保留在材料历史中，可随项目一起导出。")) return;
      updateProject(() => next); setAuthorized(false);
      setNotice("材料已带入，原内容已保留在材料历史中。超出请求限额时请先选取片段。");
    } catch (failure) { setNotice(failure instanceof Error ? failure.message : "材料未改变。"); }
  }
  function chooseTask(id: string) {
    const next = TEMPLATES.find(t => t.id === id)!;
    setSelected(id); setPhase(next.phase); setError("");
  }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setNotice(`${label}已复制。`); }
    catch { setNotice("剪贴板不可用，请在完整提示词或输出中选择文字复制，或导出研究记录。"); }
  }
  async function generate() {
    if (identityInvalid || identityIssue || identityChecking || abortRef.current || importingRef.current || !authorized || prompt.length > 2000 || (!brief.topic.trim() && !brief.material.trim())) return;
    if (outputs[task.id] && outputHistory.length >= 20) { setError("已保留 20 份历史输出，未覆盖旧结果。请导出项目后新建研究。"); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    const origin = { id: task.id, title: task.title, startedAt: Date.now() };
    setPending(origin); setError(""); setNotice("");
    let timedOut = false;
    let checkingIdentity = true;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, GENERATION_TIMEOUT);
    try {
      if (!await checkPaperIdentity(ownerId, controller.signal)) {
        clearPaperDraft(); setAuthorized(false); setIdentityInvalid(true);
        throw new Error("登录身份已变化，已停止发送。请刷新页面后以当前身份重新开始。");
      }
      checkingIdentity = false;
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: prompt, modelId: model, knowledge: false, deepThink: false }), signal: controller.signal });
      if (!response.ok) {
        const messages: Record<number, string> = { 401: "登录已失效，请重新登录后再试。", 429: "请求较多，请稍后重试。", 400: "请求或模型暂不可用，请检查字数或切换模型。", 413: "请求超出服务端长度限制，请缩短材料。" };
        throw new Error(messages[response.status] || `服务暂不可用（${response.status}），材料已保留。`);
      }
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("reply" in data) || typeof data.reply !== "string" || !data.reply.trim() || data.reply.length > 30000) throw new Error("未收到有效结果，请稍后重试；材料已保留。");
      const source = "source" in data ? data.source : undefined;
      const kind = "kind" in data ? data.kind : undefined;
      if (kind === "quota" || kind === "blocked") throw new Error(data.reply);
      const sourceLabel = source === "remote" && kind === "normal" ? "模型生成 · 待教师核验" : source === "local-fallback" || kind === "degraded" ? "本地兜底 · 非真实模型研究结果" : "平台安全 / 引导响应 · 非研究结果";
      if (!controller.signal.aborted) {
        updateProject(previous => ({ ...previous, outputHistory: previous.outputs[origin.id] ? [...previous.outputHistory, previous.outputs[origin.id]] : previous.outputHistory, outputs: { ...previous.outputs, [origin.id]: { title: origin.title, text: data.reply as string, prompt, source: sourceLabel, checks: [false, false] } } }));
        setNotice(`“${origin.title}”已返回。${sourceLabel}。`);
      }
    } catch (failure) {
      if (checkingIdentity && !controller.signal.aborted) { setAuthorized(false); setIdentityIssue(IDENTITY_UNAVAILABLE); }
      setError(controller.signal.aborted ? timedOut ? "等待已超时，输入已保留。服务端可能仍在处理，请勿立即重复提交。" : "已停止本页等待，输入已保留；服务端可能仍在处理或计费。" : failure instanceof Error ? failure.message : "生成失败，请稍后重试。");
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) { abortRef.current = null; setPending(null); }
    }
  }
  async function importProject(file?: File) {
    if (!file || abortRef.current || importingRef.current) return;
    importingRef.current = true; setImporting(true);
    const revision = revisionRef.current;
    try {
      if (file.size > PROJECT_FILE_LIMIT) throw new Error("项目文件过大，请选择 8 MB 以内的 JSON 文件。");
      const data = parseResearchProject(await file.text());
      if (revision !== revisionRef.current || abortRef.current) throw new Error("读取期间内容发生变化，本次导入未应用，请重新选择文件。");
      if (Object.keys(data.outputs).some(id => !TEMPLATES.some(t => t.id === id))) throw new Error("文件包含当前版本不支持的任务，原内容未改变。");
      if (dirty && !window.confirm("导入将替换本页未导出的内容，是否继续？")) return;
      setData(data); revisionRef.current += 1; setProjectEpoch(epoch => epoch + 1); setAuthorized(false); setExported(""); setError("");
      setNotice("项目已导入。来源核验、发送选择与审阅勾选已重置，请重新确认。");
    } catch (failure) { setNotice(failure instanceof Error ? failure.message : "项目无法读取，原内容未改变。"); }
    finally { importingRef.current = false; setImporting(false); if (importRef.current) importRef.current.value = ""; }
  }

  if (identityInvalid) return <section className={s.studio} data-testid="paper-studio"><h1>登录身份已变化</h1><p role="alert">已隐藏原身份的研究内容并停止发送。请刷新页面，以当前身份重新开始。</p><button className={s.primary} onClick={() => window.location.reload()}>刷新页面</button></section>;

  return <div className={s.studio} data-testid="paper-studio">
    {identityChecking && <GenerationProgress label="正在核对登录身份" />}
    {identityIssue && <section><p role="alert">{identityIssue}</p><button className={s.primary} disabled={identityChecking} onClick={() => setIdentityRetry(value => value + 1)}>重试身份核对</button></section>}
    <div hidden={identityChecking || !!identityIssue}>
    <header className={s.header}>
      <div className={s.titleGroup}><TeacherFeatureIcon name="research-paper" size={46} fallback={FileText} /><div><div className={s.titleLine}><h1>课题与论文</h1><span className={s.tag}>教师研究工作台</span></div><p>从课堂问题出发，让论证回到证据。</p></div></div>
      <div className={s.projectActions}>
        <span className={s.muted}>{dirty ? "有未导出的内容" : exported ? "已导出项目快照" : "本页临时编辑"}</span>
        <button className={s.secondary} disabled={!!pending || importing} onClick={() => importRef.current?.click()}><FolderOpen size={16} />导入项目</button>
        <button className={s.secondary} disabled={!hasContent || !!pending || importing} onClick={() => { downloadFile(project, "research-project.json", "application/json"); setExported(project); setNotice("项目已导出，包含材料历史、历史输出和来源草稿。文件包含研究材料，请妥善保管。"); }}><Download size={16} />导出项目</button>
        <button className={s.iconButton} title="新建研究（清空本页）" aria-label="新建研究（清空本页）" disabled={!!pending || importing || !hasContent} onClick={() => { if (window.confirm("清空当前研究与历史版本？请确认已导出需要保留的项目。")) { updateProject(() => emptyResearchProject()); setExported(""); setAuthorized(false); setProjectEpoch(epoch => epoch + 1); setNotice("已新建研究。"); setError(""); } }}><Trash2 size={16} /></button>
        <input className="sr-only" aria-label="导入研究项目文件" type="file" accept=".json,application/json" ref={importRef} onChange={e => void importProject(e.target.files?.[0])} />
      </div>
    </header>
    {importing && <GenerationProgress label="正在读取研究项目" detail="原内容保留到文件校验成功；读取期间暂停编辑。" />}
    <fieldset disabled={importing} className={s.importGuard}><Tabs value={tab} onValueChange={setTab} className={s.tabs}>
      <TabsList className={s.tabsList} aria-label="课题与论文视图">
        <TabsTrigger value="work" className={s.tab}><FlaskConical size={16} />研究工作台</TabsTrigger>
        <TabsTrigger value="evidence" className={s.tab}><Library size={16} />文献与证据{evidence.length > 0 && <span className={s.count}>{evidence.length}</span>}</TabsTrigger>
        <TabsTrigger value="skills" className={s.tab}><BookOpen size={16} />Skill 参考</TabsTrigger>
      </TabsList>
      {notice && <p className={s.notice} role="status"><Check size={15} />{notice}</p>}
      {pending && <GenerationProgress label={`正在处理：${pending.title}`} detail="已提交平台模型通道，等待完整回复；没有可用的百分比进度。" startedAt={pending.startedAt} className={s.progress} />}
      {pending && <button className={s.stop} onClick={() => abortRef.current?.abort()}><Square size={14} />停止等待</button>}
      {error && <p className={s.error} role="alert">{error}</p>}
      <TabsContent value="work" className={s.tabContent}>
        <div className={s.phaseBar} role="group" aria-label="研究阶段">{PHASES.map((item, index) => <button key={item.id} aria-pressed={phase === item.id} data-tone={item.tone} onClick={() => { setPhase(item.id); setQuery(""); chooseTask(TEMPLATES.find(t => t.phase === item.id)!.id); }}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}</button>)}</div>
        <div className={s.workspace}>
          <aside className={s.templatePane} aria-label="研究任务模板">
            <label className={s.searchField}><Search size={16} /><input aria-label="搜索研究模板" placeholder="搜索全部模板" value={query} onChange={e => setQuery(e.target.value)} /></label>
            <div className={s.libraryHeading}><h2>{query ? "搜索结果" : phaseInfo.title}</h2><p>{query ? `${visible.length} 个匹配模板` : phaseInfo.hint}</p></div>
            <div className={s.templateList}>{visible.map(t => <button className={s.templateButton} key={t.id} aria-pressed={selected === t.id} onClick={() => chooseTask(t.id)}><span><strong>{t.title}</strong>{outputs[t.id] && <Check size={14} aria-label="已有输出" />}</span><small>{t.deliverable}</small></button>)}</div>
            {!visible.length && <p className={s.muted}>没有匹配模板。<button className={s.textButton} onClick={() => setQuery("")}>清除搜索</button></p>}
            <div className={s.taskReference}><span className={s.eyebrow}>模板方法参考 · 非运行中 Skill</span><h3>{guide.title}</h3><SkillGuide skill={guide} /></div>
          </aside>
          <section className={s.editor} aria-label="当前研究任务">
            <div className={s.editorHeading}><div><span className={s.eyebrow}>内置提示词模板</span><h2>{task.title}</h2><p>{task.deliverable}</p></div><span className={s.taskNumber}>{String(TEMPLATES.findIndex(t => t.id === selected) + 1).padStart(2, "0")}<small> / {TEMPLATES.length}</small></span></div>
            <fieldset disabled={!!pending} className={s.brief}>
              <legend className="sr-only">研究材料</legend>
              <div className={s.twoColumns}>
                <label className={s.field}><span>研究方向 / 课堂问题</span><input value={brief.topic} maxLength={80} onChange={e => updateBrief("topic", e.target.value)} placeholder="例如：合作学习中，如何观察个体贡献" /></label>
                <label className={s.field}><span>学段与学科</span><input value={brief.audience} maxLength={60} onChange={e => updateBrief("audience", e.target.value)} placeholder="例如：初中 · 信息科技" /></label>
              </div>
              <div className={s.twoColumns}>
                <label className={s.field}><span>情境与约束</span><input value={brief.context} maxLength={240} onChange={e => updateBrief("context", e.target.value)} placeholder="周期、对象、可用时间、申报要求" /></label>
                <label className={s.field}><span>研究状态</span><select value={brief.researchState} onChange={e => updateBrief("researchState", e.target.value)}>{Object.entries(RESEARCH_STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              </div>
              <label className={s.field}><span>已有材料 / 原文片段 <small>不填写时仅形成澄清问题或参考框架</small></span><textarea value={brief.material} rows={5} maxLength={20000} placeholder={task.input} onChange={e => updateBrief("material", e.target.value)} /></label>
              {!!materialHistory.length && <details className={s.promptPreview}><summary>材料历史 · {materialHistory.length} 份</summary>{materialHistory.map((text, index) => <div key={index}><pre>{text}</pre><button type="button" className={s.textButton} onClick={() => carryMaterial(text)}>恢复材料版本 {index + 1}</button></div>)}</details>}
              <div className={s.evidenceReceipt}><Library size={15} /><span>本次附带 {evidence.filter(e => e.selected).length} 条证据</span><button type="button" className={s.textButton} onClick={() => setTab("evidence")}>选择 / 核对来源 <ArrowRight size={13} /></button></div>
              <label className={s.checkbox}><input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} />我确认以上材料及所选证据可交由平台模型通道处理，不含可识别学生信息或未经授权的保密内容。</label>
            </fieldset>
            <div className={s.runBar}>
              <label className={s.modelSelect}><span className="sr-only">研究模型</span><select aria-label="研究模型" value={model} disabled={!!pending} onChange={e => { setModel(e.target.value); setAuthorized(false); }}>{TEXT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              <button className={s.primary} disabled={!!pending || !authorized || prompt.length > 2000 || (!brief.topic.trim() && !brief.material.trim())} onClick={() => void generate()}><Send size={16} />{result ? "重新生成建议" : "生成研究建议"}</button>
              <button className={s.secondary} onClick={() => void copy(prompt, "完整提示词")}><Clipboard size={16} />复制提示词</button>
            </div>
            <div className={s.inputMeta}><span className={prompt.length > 2000 ? s.error : s.muted}>完整请求 {prompt.length} / 2000 字符{prompt.length > 2000 ? " · 请缩短材料或减少所选证据，不会自动截断" : ""}</span><span className={s.muted}>生成走现有安全通道 · 不自动联网检索</span></div>
            <details className={s.promptPreview}><summary>查看完整提示词</summary><pre>{prompt}</pre></details>
            <section className={s.outputSection} aria-label="研究输出">
              <div className={s.sectionHeading}><h3>输出与教师审阅</h3>{result && <span className={s.outputSource}>{result.source}</span>}</div>
              {result ? <>
                <div className={s.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span>[外部图片未加载：{alt}]</span>, a: ({ href, children }) => safeSourceUrl(href || "") ? <a href={safeSourceUrl(href!)!} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span> }}>{result.text}</ReactMarkdown></div>
                <div className={s.actions}><button className={s.secondary} onClick={() => { if (window.confirm("将复制输出、完整提示词、原始材料和生成时证据快照。粘贴到共享文档前请检查保密内容。是否继续？")) void copy(copyResearchOutput(result), "输出与完整快照"); }}><Clipboard size={15} />复制输出与完整快照</button><button className={s.secondary} disabled={!!pending} onClick={() => carryMaterial(`AI草稿，待核验：\n${result.text}`)}><ArrowRight size={15} />带入下一任务</button><button className={s.secondary} onClick={() => downloadFile(exportResearchRecord(brief, evidence, Object.values(outputs), materialHistory, evidenceDraft, outputHistory), "research-record.md", "text/markdown;charset=utf-8")}><Download size={15} />导出研究记录</button></div>
                <div className={s.reviewChecks}><ShieldCheck size={17} /><div>{["已对照原文核对引文与事实", "已复核方法、局限与结论强度"].map((label, index) => <label className={s.checkbox} key={label}><input type="checkbox" checked={result.checks[index]} onChange={e => { const checked = e.target.checked; updateProject(previous => ({ ...previous, outputs: { ...previous.outputs, [selected]: { ...previous.outputs[selected], checks: previous.outputs[selected].checks.map((v, i) => i === index ? checked : v) } } })); }} />{label}</label>)}<small>人工勾选不是学术认证；修改证据后需重新审阅。</small></div></div>
                <details className={s.promptPreview}><summary>查看本次生成的提示词快照</summary><pre>{result.prompt}</pre></details>
              </> : <div className={s.outputEmpty}><FileText size={24} /><div><strong>尚无本任务输出</strong><p>先填写研究方向或材料。AI 建议需回到原文、课堂证据和教师判断。</p></div></div>}
            </section>
            {!!outputHistory.length && <details className={s.promptPreview}><summary>历史输出 · {outputHistory.length} 份</summary>{outputHistory.map((output, index) => <div key={index}><h3>{output.title} · 版本 {index + 1}</h3><pre>{copyResearchOutput(output)}</pre></div>)}</details>}
          </section>
        </div>
      </TabsContent>
      <TabsContent value="evidence" className={s.tabContent} forceMount hidden={tab !== "evidence"}><EvidencePanel key={projectEpoch} items={evidence} draft={evidenceDraft} setDraft={draft => updateProject(current => ({ ...current, evidenceDraft: draft }))} onChange={updateEvidence} onMessage={setNotice} /></TabsContent>
      <TabsContent value="skills" className={s.tabContent}>
        <div className={s.sectionHeading}><div><h2>研究方法与 Skill 参考</h2><p className={s.muted}>提炼模板已可在工作台调用；下列外部 Skill 需在支持它们的工具中另行安装。</p></div><span className={s.muted}>来源查阅：{SOURCE_REVIEW_DATE}</span></div>
        <div className={s.skillGrid}>{RESEARCH_SKILLS.map((skill, index) => <article key={skill.id} className={s.skillCard}><div className={s.skillIndex}>{String(index + 1).padStart(2, "0")}</div><div><span className={s.eyebrow}>{skill.kind} · {skill.owner}</span><h3>{skill.title}</h3><p>{skill.summary}</p><div className={s.actions}><SkillGuide skill={skill} /><button className={s.textButton} onClick={() => { const related = TEMPLATES.find(t => t.skill === skill.id); if (related) { chooseTask(related.id); setQuery(""); setTab("work"); } }}>调用相关模板 <ArrowRight size={14} /></button></div></div></article>)}</div>
        <div className={s.warning}><ShieldCheck size={17} /><span>查阅链接不代表安全认证或安装完成。教师应先检查依赖、许可与数据外发范围，勿向未经批准的服务提供学生数据或保密稿件。</span></div>
      </TabsContent>
    </Tabs></fieldset>
    <footer className={s.footer}><Upload size={14} />草稿仅在本标签页内存临时保留，不写入浏览器存储。刷新或关闭前导出项目；敏感研究文件请妥善保管。</footer>
    </div>
  </div>;
}
