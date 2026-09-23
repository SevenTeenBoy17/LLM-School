"use client";
import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { WorkButton } from "@/components/research/workspace-shared";
import type { PrepProject } from "./model";
import { makePrepBackup, MAX_BACKUP_BYTES, validPrepBackup, type PrepBackup, type UnsubmittedText } from "./recovery";
import s from "./prep.module.css";

export function PrepRecoveryPanel({ saved, draft, unsubmitted, dirty, onRestore, onReset }: { saved: PrepProject; draft: PrepProject; unsubmitted: UnsubmittedText; dirty: boolean; onRestore: (backup: PrepBackup) => void; onReset: () => void }) {
  const [incoming, setIncoming] = useState<PrepBackup | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const operation = useRef(0);
  const urls = useRef(new Set<string>());
  useEffect(() => { const resources = urls.current; const generation = operation; return () => { generation.current++; for (const url of resources) URL.revokeObjectURL(url); resources.clear(); }; }, []);
  const download = () => {
    try {
      const text = JSON.stringify(makePrepBackup(saved, draft, unsubmitted), null, 2);
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      if (blob.size > MAX_BACKUP_BYTES) throw new Error("备份超过 16 MB 上限，请先缩短本次新增文字；当前输入仍保留。");
      const url = URL.createObjectURL(blob); urls.current.add(url);
      const link = document.createElement("a"); link.href = url; link.download = `${draft.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80)}-完整草稿备份.json`; document.body.append(link); link.click(); link.remove();
      setMessage("备份已交由浏览器下载，请确认文件已保存。未改变本机材料或审阅状态。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "导出未成功，当前编辑仍保留。"); }
  };
  const read = async (file?: File) => {
    const token = ++operation.current; setIncoming(null); setConfirmed(false); setMessage(""); setBusy(false);
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("仅接受不超过 16 MB 的备份文件。");
      const decoded: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()));
      if (!validPrepBackup(decoded)) throw new Error("备份结构不完整或字段超限，未更改当前输入。");
      if (decoded.saved.id !== saved.id || JSON.stringify(decoded.saved) !== JSON.stringify(saved)) throw new Error("备份不属于当前项目的已保存基线，未覆盖当前内容。请在原项目及对应保存版本中恢复。");
      if (operation.current === token) setIncoming(decoded);
    } catch (error) { if (operation.current === token) setMessage(error instanceof Error ? error.message : "无法读取备份，当前编辑仍保留。"); }
    finally { if (operation.current === token) setBusy(false); }
  };
  return <div className={s.form}>
    <p>备份包含已保存项目、当前编辑、观察与讨论、全部修订摘要，以及尚未添加的意见、回应和处理理由。含私有材料，请妥善保管。</p>
    <WorkButton onClick={download}><Download size={16} />导出完整草稿备份</WorkButton>
    <label>恢复本项目备份<input type="file" accept=".json,application/json" onChange={event => void read(event.target.files?.[0])} /></label>
    {busy && <p role="status">正在读取本地备份…</p>}
    {incoming && <><p>待恢复：{incoming.draft.title} · 基线 v{incoming.saved.version}。仅装入编辑区，不自动保存，也不表示证据已核验。</p><label className={s.checkbox}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />同意用备份替换当前未保存输入；已保存项目不变</label><WorkButton disabled={!confirmed} onClick={() => onRestore(incoming)}><Upload size={16} />恢复到编辑区</WorkButton></>}
    {dirty && <><p className={s.warning}>恢复上次保存会放弃当前未保存修改及未提交文字。需要保留时，请先确认备份文件可用。历史满额不会自动解除，个人改编仍不继承观察与讨论。</p><label className={s.checkbox}><input type="checkbox" checked={resetConfirmed} onChange={event => setResetConfirmed(event.target.checked)} />我已保留所需内容，同意放弃本次未保存输入</label><WorkButton disabled={!resetConfirmed} onClick={onReset}><RotateCcw size={16} />恢复上次保存</WorkButton></>}
    {message && <p role="status" className={s.warning}>{message}</p>}
  </div>;
}
