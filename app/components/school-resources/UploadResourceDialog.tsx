"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, X, Check, HardDrive, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SchoolResourceIcon } from "@/components/common/SchoolResourceIcon";
import { ACCEPT, GRADES, KINDS, MAX_BATCH_BYTES, MAX_BATCH_FILES, SCOPES, SUBJECTS, inferKind, readableBytes, requireResourceCrypto, validateResourceFile, type ResourceEditToken, type ResourceKind, type SchoolResource } from "@/lib/school-resources/model";
import styles from "./school-resources.module.css";
import { revealDialogFocus } from "./dialogFocus";

type QueueItem = { id: string; file: File; title: string; kind: ResourceKind };
export function UploadResourceDialog({ author, editing, onClose, onSave }: {
  author: string; editing: SchoolResource | null; onClose: () => void;
  onSave: (records: SchoolResource[], expected?: ResourceEditToken) => Promise<void>;
}) {
  const [queue, setQueue] = useState<QueueItem[]>(() => editing?.blob ? [{
    id: editing.id, file: new File([editing.blob], editing.fileName, { type: editing.mimeType }), title: editing.title, kind: editing.kind,
  }] : []);
  const [subject, setSubject] = useState(editing?.subject ?? "");
  const [grade, setGrade] = useState(editing?.grade ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [scope, setScope] = useState<SchoolResource["scope"]>(editing?.scope ?? "private");
  const [rights, setRights] = useState<SchoolResource["rights"]>(editing?.rights ?? "own");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [discard, setDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const showErrors = (items: string[]) => { setErrors(items); requestAnimationFrame(() => errorRef.current?.focus()); };

  function addFiles(files: FileList | File[]) {
    if (lock.current || editing) return;
    let secureCrypto: Crypto;
    try { secureCrypto = requireResourceCrypto(); }
    catch (issue) { showErrors([issue instanceof Error ? issue.message : "文件校验环境不可用。"]); return; }
    const next = [...queue];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const issue = validateResourceFile(file);
      if (issue) { rejected.push(`${file.name}：${issue}`); continue; }
      if (next.length >= MAX_BATCH_FILES) { rejected.push("一次最多添加 5 个文件。"); break; }
      if (next.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) {
        rejected.push(`${file.name} 已在待保存列表中。`); continue;
      }
      if (next.reduce((sum, item) => sum + item.file.size, file.size) > MAX_BATCH_BYTES) { rejected.push("本批文件总大小不能超过 100 MB。"); continue; }
      next.push({ id: secureCrypto.randomUUID(), file, title: file.name.replace(/\.[^.]+$/, ""), kind: inferKind(file.name) });
    }
    setQueue(next); setDirty(true); setErrors([...new Set(rejected)]);
  }
  function requestClose() {
    if (lock.current) return;
    if (dirty || (!editing && queue.length)) setDiscard(true); else onClose();
  }
  async function save() {
    if (lock.current) return;
    const invalid = [
      ...(!queue.length ? ["请先选择文件。"] : []),
      ...(!subject ? ["请选择学科。"] : []), ...(!grade ? ["请选择年级。"] : []),
      ...queue.filter(item => !item.title.trim() || item.title.trim().length > 100).map(() => "资源名称需要 1–100 个字符。"),
      ...(!consent ? ["请确认本机保存及资料使用权限。"] : []),
    ];
    if (invalid.length) { showErrors(invalid); return; }
    lock.current = true; setBusy(true); setErrors([]);
    try {
      const records: SchoolResource[] = [];
      for (const [index, item] of queue.entries()) {
        setStage(`正在校验文件 ${index + 1}/${queue.length}`);
        const issue = validateResourceFile(item.file);
        if (issue) throw new Error(issue);
        const digest = await requireResourceCrypto().subtle.digest("SHA-256", await item.file.arrayBuffer());
        const sha256 = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
        records.push({ id: editing?.id ?? `local-${item.id}`, origin: "local", title: item.title.trim(), kind: item.kind,
          subject, grade, description: description.trim(), author, scope, rights, updatedAt: Date.now(), revision: editing ? editing.revision + 1 : 1,
          fileName: item.file.name, fileSize: item.file.size, mimeType: item.file.type, sha256, blob: item.file });
      }
      setStage("正在写入本机草稿");
      await onSave(records, editing ? { id: editing.id, revision: editing.revision } : undefined);
      onClose();
    } catch (error) { showErrors([error instanceof Error ? error.message : "保存未完成，请重试。"]); }
    finally { lock.current = false; setBusy(false); setStage(""); }
  }

  return <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
    <DialogContent className={`${styles.theme} ${styles.uploadDialog}`} hideClose onFocusCapture={revealDialogFocus} onEscapeKeyDown={event => { event.preventDefault(); requestClose(); }}
      onInteractOutside={event => { event.preventDefault(); }}>
      <div className={styles.dialogHeader}>
        <SchoolResourceIcon name="upload" size={48} />
        <div><DialogTitle>{discard ? "保留尚未保存的内容？" : editing ? "编辑本机草稿" : "上传教学资源"}</DialogTitle>
          <DialogDescription>{discard ? "关闭后，尚未保存的修改不会保留。" : "文件仅保存到此浏览器，尚未上传到学校服务器。"}</DialogDescription></div>
        <button className={styles.iconButton} onClick={requestClose} disabled={busy} aria-label="关闭上传窗口" title="关闭"><X size={19} /></button>
      </div>
      {discard ? <div className={styles.discardActions}>
        <button className={styles.secondary} onClick={onClose}>放弃未保存内容</button>
        <button className={styles.primary} onClick={() => setDiscard(false)}><ArrowLeft size={16} />继续编辑</button>
      </div> : <>
        <div className={styles.dialogBody}>
          <div className={styles.steps} aria-label="添加资源流程"><span><b>1</b> 选择文件</span><span><b>2</b> 补充信息</span><span><b>3</b> 保存本机草稿</span></div>
          {!editing && <div className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
            onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
            <SchoolResourceIcon name="upload" size={64} />
            <div><button type="button" className={styles.chooseFile} disabled={busy} onClick={() => inputRef.current?.click()}>选择文件</button><span> 或拖拽到这里</span>
              <p>PPT / Word / PDF / 图片 / 音视频 / HTML · 每份 ≤50 MB，HTML ≤5 MB · 每次最多 5 份</p></div>
            <input ref={inputRef} data-testid="resource-file-input" type="file" accept={ACCEPT} multiple className={styles.hiddenInput} aria-label="选择教学资源文件" disabled={busy}
              onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
          </div>}
          {queue.length > 0 && <div className={styles.fileQueue} aria-label="待保存文件">
            {queue.map((item, index) => <div className={styles.queueRow} key={item.id}>
              <SchoolResourceIcon name={item.kind === "other" ? "folder" : item.kind} size={38} />
              <label className={styles.queueName}><span className={styles.srOnly}>资源名称 {index + 1}</span>
                <input value={item.title} maxLength={100} disabled={busy} onChange={event => { setDirty(true); setQueue(queue.map(q => q.id === item.id ? { ...q, title: event.target.value } : q)); }} />
                <small>{item.file.name} · {readableBytes(item.file.size)}</small></label>
              <select aria-label={`资源类型 ${index + 1}`} value={item.kind} disabled={busy} onChange={event => { setDirty(true); setQueue(queue.map(q => q.id === item.id ? { ...q, kind: event.target.value as ResourceKind } : q)); }}>
                {Object.entries(KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              {!editing && <button className={styles.iconButton} title="移除此文件" aria-label={`移除文件 ${item.file.name}`} disabled={busy} onClick={() => { setQueue(queue.filter(q => q.id !== item.id)); setDirty(true); }}><X size={16} /></button>}
            </div>)}
            {!editing && queue.length < 5 && <button className={styles.textButton} onClick={() => inputRef.current?.click()} disabled={busy}><Plus size={15} />继续添加</button>}
          </div>}
          <fieldset className={styles.metadata} disabled={busy}>
            <legend>资源信息</legend>
            <label>学科 <em>*</em><select value={subject} onChange={e => { setSubject(e.target.value); setDirty(true); }} required aria-label="上传资源学科"><option value="">选择学科</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>年级 <em>*</em><select value={grade} onChange={e => { setGrade(e.target.value); setDirty(true); }} required aria-label="上传资源年级"><option value="">选择年级</option>{GRADES.map(g => <option key={g}>{g}</option>)}</select></label>
            <label className={styles.fullField}>内容简介<textarea rows={3} maxLength={500} placeholder="适用课时、教学目标、使用建议……" value={description} onChange={e => { setDescription(e.target.value); setDirty(true); }} /></label>
            <label>接入后的分享意向<select value={scope} onChange={e => { setScope(e.target.value as SchoolResource["scope"]); setDirty(true); }}>{Object.entries(SCOPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label>资源来源<select value={rights} onChange={e => { setRights(e.target.value as SchoolResource["rights"]); setDirty(true); }}><option value="own">本人原创</option><option value="licensed">已获分享授权</option></select></label>
          </fieldset>
          <p className={styles.storageNote}><HardDrive size={16} />本机草稿仅自己可见，清理浏览器数据会丢失。共享电脑请及时下载并移除。</p>
          <label className={styles.consent}><input type="checkbox" checked={consent} disabled={busy} onChange={e => { setConsent(e.target.checked); setDirty(true); }} />
            <span>允许将所选文件保存在此浏览器；我有权使用这些资料，已移除学生姓名、照片等个人信息。</span></label>
          {errors.length > 0 && <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
        </div>
        <div className={styles.dialogFooter}>
          <span role="status">{busy ? stage : `${queue.length} 份文件 · ${queue.length ? readableBytes(queue.reduce((sum, q) => sum + q.file.size, 0)) : "未选择文件"}`}</span>
          <button className={styles.secondary} disabled={busy} onClick={requestClose}>取消</button>
          <button className={styles.primary} onClick={save} disabled={busy}>{busy ? <Loader2 className={styles.spin} size={16} /> : <Check size={16} />}{busy ? "保存中" : "保存本机草稿"}</button>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
