"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Save, Users, X } from "lucide-react";
import { createActivityPackage, downloadBlob, validateBrief, type ActivityBrief } from "@/lib/school-resources/activityPackage";
import type { SchoolResource } from "@/lib/school-resources/model";
import styles from "./school-resources.module.css";

export function ActivityDistribution({ resource, accountId, onClose, onBusyChange, onDirtyChange }: { resource: SchoolResource; accountId: string; onClose: () => void; onBusyChange: (value: boolean) => void; onDirtyChange: (value: boolean) => void }) {
  const [brief, setBrief] = useState<ActivityBrief>({ audience: resource.grade, instructions: "", question: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const key = `eduai-activity-brief-v1:${accountId}:${resource.id}:${resource.revision}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) { const stored = JSON.parse(raw); validateBrief(stored); queueMicrotask(() => setBrief(stored)); }
    } catch { queueMicrotask(() => setError("上次布置草稿无法读取，可重新填写；未修改原资源。")); }
  }, [key]);
  async function save(exportFile: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError(""); setStatus("");
    try {
      validateBrief(brief);
      // A real local write is distinct from publication or delivery to another account.
      localStorage.setItem(key, JSON.stringify(brief));
      onDirtyChange(false);
      if (exportFile) {
        const pack = await createActivityPackage(resource, brief);
        if (!alive.current) return;
        downloadBlob(new Blob([JSON.stringify(pack)], { type: "application/json" }), `${resource.title}.eduactivity`);
        setStatus("活动包已生成，请查看浏览器下载。尚未向任何学生账号发送。");
      } else setStatus("布置草稿已保存在此浏览器，尚未发送。");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "布置草稿未保存，请重试。"); }
    finally { lock.current = false; if (alive.current) { setBusy(false); onBusyChange(false); } }
  }
  return <section className={styles.assignment} aria-labelledby="activity-assignment-title">
    <div className={styles.previewHeading}><Users size={18} /><h3 id="activity-assignment-title">分享给学生</h3><button className={styles.iconButton} aria-label="关闭布置草稿" title="关闭布置草稿" onClick={onClose} disabled={busy}><X size={18} /></button></div>
    <p className={styles.modeNote}>在线发送尚未接入。可导出活动包，由教师通过现有校内渠道分发；学生在「学习资源」中打开。</p>
    <fieldset disabled={busy} className={styles.metadata}><legend>布置草稿</legend>
      <label className={styles.fullField}>适用对象<input aria-label="活动适用对象" maxLength={100} value={brief.audience} onChange={e => { setBrief({ ...brief, audience: e.target.value }); onDirtyChange(true); }} /></label>
      <label className={styles.fullField}>活动任务<textarea aria-label="活动任务" rows={3} maxLength={1000} value={brief.instructions} onChange={e => { setBrief({ ...brief, instructions: e.target.value }); onDirtyChange(true); }} /></label>
      <label className={styles.fullField}>观察与反思问题<textarea aria-label="观察与反思问题" rows={2} maxLength={500} value={brief.question} onChange={e => { setBrief({ ...brief, question: e.target.value }); onDirtyChange(true); }} /></label>
    </fieldset>
    <p className={styles.mutedSmall}>活动包包含原始 HTML、课堂任务和文件校验，不包含学生名单、账号信息或成绩。文件校验不能验证发布者身份。</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}{status && <p role="status" className={styles.notice}>{status}</p>}
    <div className={styles.assignmentActions}><button className={styles.secondary} onClick={() => void save(false)} disabled={busy}><Save size={17} />保存布置草稿</button><button className={styles.primary} onClick={() => void save(true)} disabled={busy}><Download size={17} />{busy ? "处理中…" : "导出活动包"}</button></div>
  </section>;
}
