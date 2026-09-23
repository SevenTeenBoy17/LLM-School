"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, FolderOpen, Save, X } from "lucide-react";
import { SchoolResourceIcon } from "@/components/common/SchoolResourceIcon";
import { ACCEPT, fileExtension, inferKind, requireResourceCrypto, validateResourceFile, type SchoolResource } from "@/lib/school-resources/model";
import { ACTIVITY_EXAMPLES } from "@/lib/school-resources/activityExamples";
import { downloadBlob, readActivityPackage, sha256Blob, sourceBlob, type ActivityBrief } from "@/lib/school-resources/activityPackage";
import { HtmlActivityPlayer } from "./HtmlActivityPlayer";
import { DocumentMediaPreview } from "./DocumentMediaPreview";
import styles from "./school-resources.module.css";

type Opened = { resource: SchoolResource; brief?: ActivityBrief; packageId?: string };
export function StudentResourceCenter({ accountId }: { accountId: string }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [observation, setObservation] = useState("");
  const [question, setQuestion] = useState("");
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const operation = useRef(false);
  const legacyKeys = (hash: string, packageId?: string) => [`eduai-resource-note-v2:${accountId}:${hash}:${packageId ? encodeURIComponent(packageId) : "file"}`, `eduai-resource-note-v1:${accountId}:${hash}`];
  const noteKey = (hash: string, packageId?: string) => `eduai-resource-note-v3:${accountId}:${hash}:${packageId !== undefined ? `package:${encodeURIComponent(packageId)}` : "file"}`;
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (link.href === window.location.href || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("学习笔记尚未保存，离开会丢失这些修改。确定离开？")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  async function select(next: Opened) {
    const hash = next.resource.sha256 ?? await sha256Blob(sourceBlob(next.resource));
    next.resource = { ...next.resource, sha256: hash };
    setOpened(next); setObservation(""); setQuestion(""); setNotice(""); setError(""); setDirty(false);
    try {
      let raw = localStorage.getItem(noteKey(hash, next.packageId));
      if (!raw) {
        for (const key of legacyKeys(hash, next.packageId)) {
          const legacy = localStorage.getItem(key);
          if (legacy && (JSON.parse(legacy).packageId ?? null) === (next.packageId ?? null)) { raw = legacy; break; }
        }
      }
      if (raw) {
        const data = JSON.parse(raw);
        if (data.resourceHash !== hash || (data.packageId ?? null) !== (next.packageId ?? null) || typeof data.observation !== "string" || data.observation.length > 2000 || typeof data.question !== "string" || data.question.length > 1000) throw new Error("invalid-note");
        setObservation(data.observation); setQuestion(data.question); setNotice("已恢复此材料与任务的本机学习笔记，尚未提交给教师。");
      }
    } catch { setError("本机笔记无法恢复，可重新记录；原文件未受影响。"); }
  }
  async function openFile(file: File) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError("");
    try {
      if (fileExtension(file.name) === "eduactivity") await select(await readActivityPackage(file));
      else {
        const issue = validateResourceFile(file); if (issue) throw new Error(issue);
        await select({ resource: { id: `opened-${requireResourceCrypto().randomUUID()}`, origin: "local", title: file.name, kind: inferKind(file.name), subject: "", grade: "",
          description: "", author: "本机选择的文件", scope: "private", rights: "licensed", updatedAt: Date.now(), revision: 1,
          fileName: file.name, fileSize: file.size, mimeType: file.type, blob: file } });
      }
    } catch (issue) { setError(issue instanceof Error ? issue.message : "文件未能打开，请重试。"); }
    finally { operation.current = false; setBusy(false); }
  }
  async function openExample() {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError("");
    try { await select({ resource: ACTIVITY_EXAMPLES[0], brief: {
      audience: "四年级 · 示例", instructions: "分别选出整体的 1/2 与 2/4，比较涂色面积。", question: "这两种分法有什么相同和不同？请用观察到的现象说明。",
    } }); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "示例未能打开，请重试。"); }
    finally { operation.current = false; setBusy(false); }
  }
  function close() {
    if (dirty && !window.confirm("尚有未保存的学习笔记。关闭后这些修改不会保留，确定关闭？")) return;
    setOpened(null); setError(""); setNotice(""); setDirty(false); requestAnimationFrame(() => openButton.current?.focus());
  }
  function downloadMaterial() {
    if (!opened) return;
    setError(""); setNotice("");
    try {
      downloadBlob(sourceBlob(opened.resource), opened.resource.fileName);
      setNotice(["html", "htm"].includes(fileExtension(opened.resource.fileName)) ? "已生成 HTML 下载；离开平台后不再受隔离保护。" : "已生成原文件下载，请查看浏览器下载列表。");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "原文件下载失败。"); }
  }
  function saveNote(exportFile: boolean) {
    if (!opened || !opened.resource.sha256) return;
    setError(""); setNotice("");
    if (!observation.trim()) { setError("请先写下自己的观察或发现，不按点击次数自动生成学习结论。"); return; }
    const record = { schema: "eduai-local-learning-note/v1", resourceHash: opened.resource.sha256, packageId: opened.packageId ?? null,
      title: opened.resource.title, observation: observation.trim(), question: question.trim(), savedAt: new Date().toISOString(), submitted: false, teacherReviewed: false };
    try {
      localStorage.setItem(noteKey(opened.resource.sha256, opened.packageId), JSON.stringify(record)); setDirty(false);
      if (exportFile) {
        const text = `# ${record.title}\n\n学生本机学习记录，未在线提交、未获教师评价。\n\n## 我的观察与依据\n${record.observation}\n\n## 我仍想弄懂的问题\n${record.question || "暂未填写"}\n\n资源 SHA-256：${record.resourceHash}\n活动包：${record.packageId || "无"}\n记录时间：${record.savedAt}\n`;
        downloadBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), "我的活动学习记录.md");
        setNotice("学习记录已生成下载文件，尚未在线提交给教师。");
      } else setNotice("学习笔记已保存到本账号的此浏览器，尚未提交给教师。");
    } catch { setError("本机存储不可用，笔记未保存。请保留页面并检查浏览器存储设置。"); }
  }
  return <section className={`${styles.theme} ${styles.library} ${styles.studentResources}`} data-testid="student-resource-center">
    <div className={styles.breadcrumb}><Link href="/student/activities"><ArrowLeft size={15} />项目活动</Link><span>学习资源</span></div>
    <header className={styles.header}><div className={styles.headingGroup}><SchoolResourceIcon name="activity" size={62} /><div><h1>学习资源</h1><p>打开课堂材料，留下自己的观察。</p></div></div>
      <button ref={openButton} className={styles.primary} title={opened ? "先关闭当前材料，再打开另一份文件" : "打开活动包或教学文件"} disabled={busy || Boolean(opened)} onClick={() => fileInput.current?.click()}><FolderOpen size={18} />{busy ? "正在读取…" : "打开教师给的文件"}</button>
      <input ref={fileInput} type="file" data-testid="student-resource-file-input" className={styles.hiddenInput} accept={`${ACCEPT},.eduactivity`} aria-label="选择教师活动包或教学文件"
        onChange={e => { const file = e.target.files?.[0]; if (file) void openFile(file); e.target.value = ""; }} />
    </header>
    <div className={styles.modeNote}>本机使用 · 在线任务收取尚未接入，当前没有从教师账号接收的资源。</div>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    {!opened ? <div className={styles.studentEmpty}>
      <SchoolResourceIcon name="folder" size={92} /><h2>先打开一份课堂材料</h2><p>活动包会带上任务说明。文件只在当前窗口使用，不会自动上传。</p>
      <button className={styles.secondary} disabled={busy} onClick={() => void openExample()}><SchoolResourceIcon name="activity" size={24} />试用分数互动示例</button>
    </div> : <>
      <div className={styles.openedHeading}><div><h2>{opened.resource.title}</h2><p>{opened.resource.origin === "example" ? "内置教学示例，不是教师发布任务" : "外部文件 · 发布者身份未由平台验证"}</p></div><div className={styles.openedActions}>
        <button className={styles.secondary} title="下载当前材料原文件，HTML 离开平台后不再受隔离保护" onClick={downloadMaterial}><Download size={17} />下载原文件</button>
        <button className={styles.secondary} onClick={close}><X size={17} />关闭材料</button>
      </div></div>
      {opened.brief && <div className={styles.activityBrief}><span>{opened.brief.audience}</span><h3>活动任务</h3><p>{opened.brief.instructions}</p><h3>观察与反思</h3><p>{opened.brief.question}</p></div>}
      {["html", "htm"].includes(fileExtension(opened.resource.fileName)) ? <HtmlActivityPlayer key={opened.resource.id} resource={opened.resource} /> : <DocumentMediaPreview key={opened.resource.id} resource={opened.resource} />}
      <section className={styles.studentNotes} aria-labelledby="student-note-heading"><h2 id="student-note-heading">我的学习笔记</h2>
        <label>我的观察与依据<textarea aria-label="我的观察与依据" rows={4} maxLength={2000} value={observation} onChange={e => { setObservation(e.target.value); setDirty(true); }} /></label>
        <label>我仍想弄懂的问题<textarea aria-label="我仍想弄懂的问题" rows={2} maxLength={1000} value={question} onChange={e => { setQuestion(e.target.value); setDirty(true); }} /></label>
        <div className={styles.assignmentActions}><button className={styles.secondary} onClick={() => saveNote(false)}><Save size={17} />保存本机笔记</button><button className={styles.primary} onClick={() => saveNote(true)}><Download size={17} />导出学习记录</button></div>
        <p className={styles.mutedSmall}>笔记不是成绩，不会自动进入成长档案。共享电脑请导出后移除本机笔记。</p>
        <button className={styles.textButton} onClick={() => { if (!opened.resource.sha256 || !window.confirm("移除此材料与任务的本机笔记？已下载的记录不受影响。")) return; try {
          localStorage.removeItem(noteKey(opened.resource.sha256, opened.packageId));
          for (const key of legacyKeys(opened.resource.sha256, opened.packageId)) {
            const legacy = localStorage.getItem(key);
            if (legacy && (JSON.parse(legacy).packageId ?? null) === (opened.packageId ?? null)) localStorage.removeItem(key);
          }
          setObservation(""); setQuestion(""); setDirty(false); setNotice("本机笔记已移除。");
        } catch { setError("本机笔记移除失败，请重试。"); } }}>移除本机笔记</button>
      </section>
    </>}
  </section>;
}
