"use client";
import { useState } from "react";
import { LockKeyhole, Plus } from "lucide-react";
import { WorkDialog, WorkButton, useResearchOwner } from "@/components/research/workspace-shared";
import { newProject, type PrepKind, type PrepProject } from "./model";
import s from "./prep.module.css";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { clearCreationBuffer, EMPTY_CREATION, readCreationBuffer, writeCreationBuffer } from "./draftBuffers";
import { useDepartureBuffer } from "./useDepartureBuffer";

type CreateProps = { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (project: PrepProject) => string | null };
export function CreatePrepDialog(props: CreateProps) {
  const owner = useResearchOwner();
  return owner ? <CreatePrepForm key={owner} {...props} owner={owner} /> : null;
}
function CreatePrepForm({ owner, open, onOpenChange, onCreate }: CreateProps & { owner: string }) {
  const [restored, setRestored] = useState(() => readCreationBuffer(owner));
  const initial = restored ?? EMPTY_CREATION;
  const [title, setTitle] = useState(initial.title);
  const [grade, setGrade] = useState(initial.grade);
  const [subject, setSubject] = useState(initial.subject);
  const [kind, setKind] = useState<PrepKind>(initial.kind);
  const [question, setQuestion] = useState(initial.question);
  const [conditions, setConditions] = useState(initial.conditions);
  const [members, setMembers] = useState(initial.members);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const dirty = !!(title || grade || subject || question || conditions || members || kind !== "日常共备");
  const clearDepartureBuffer = useDepartureBuffer({ title, grade, subject, kind, question, conditions, members }, draft => writeCreationBuffer(owner, draft), () => clearCreationBuffer(owner));
  useUnsavedChanges(dirty);
  const reset = () => { clearDepartureBuffer(); setRestored(undefined); setTitle(""); setGrade(""); setSubject(""); setKind("日常共备"); setQuestion(""); setConditions(""); setMembers(""); setClosing(false); setError(""); };
  const close = (next: boolean) => { if (!next && dirty) setClosing(true); else onOpenChange(next); };
  return <WorkDialog open={open} onOpenChange={close} title="新建共备" description="先建立草稿，成员与资料可以稍后补充" className={s.createDialog}>
    <form className={s.form} onSubmit={event => { event.preventDefault(); if (!title.trim() || !grade || !subject) return; const issue = onCreate(newProject({ title, grade, subject, kind, question, conditions, members })); if (issue) { setError(issue); return; } reset(); onOpenChange(false); }}>
      {error && <p className={s.warning} role="alert">{error}</p>}
      {restored && dirty && <p className={s.meta}>已恢复本账号的未创建表单；仅为页面内存缓冲，刷新仍可能丢失。</p>}
      <fieldset className={s.kindPicker}><legend>备课方式</legend>{(["日常共备", "研究课"] as const).map(k => <label key={k} data-selected={kind === k}><input type="radio" name="prep-kind" checked={kind === k} onChange={() => setKind(k)} /><span><strong>{k}</strong><small>{k === "日常共备" ? "共同底稿与本班改编" : "增加观课、证据与复盘"}</small></span></label>)}</fieldset>
      <label>课题名称 <span className={s.required}>*</span><input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} placeholder="填写本次共同备课的课题" /></label>
      <div className={s.formPair}><label>学段 / 年级 <span className={s.required}>*</span><select required value={grade} onChange={e => setGrade(e.target.value)}><option value="">选择年级</option>{["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "七年级", "八年级", "九年级", "高一", "高二", "高三"].map(g => <option key={g}>{g}</option>)}</select></label><label>学科 <span className={s.required}>*</span><select required value={subject} onChange={e => setSubject(e.target.value)}><option value="">选择学科</option>{["语文", "数学", "英语", "信息科技", "科学", "生物", "物理", "化学", "历史", "地理", "道德与法治", "艺术", "体育", "跨学科"].map(g => <option key={g}>{g}</option>)}</select></label></div>
      <label>希望共同解决的问题<textarea maxLength={2000} rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="可稍后补充，不自动假设学习难点" /></label>
      <details><summary>更多条件 <span>课时、教材与参考资料</span></summary><label>课时与适用条件<textarea value={conditions} maxLength={3000} onChange={e => setConditions(e.target.value)} rows={3} /></label><label>拟协作成员（本机备注）<input value={members} maxLength={200} onChange={e => setMembers(e.target.value)} placeholder="不会实际发送邀请" /></label></details>
      <div className={s.privacy}><LockKeyhole size={17} /><div>当前可见范围：仅自己<small>本机演示，仅保留在当前账号的浏览器标签页；不会保存到服务器。本步骤不调用 AI，不会邀请或通知成员。</small></div></div>
      {closing ? <div className={s.warning} role="alert"><p>尚有未创建的内容，如何关闭？</p><div className={s.actions}><WorkButton type="button" onClick={() => setClosing(false)}>继续填写</WorkButton><WorkButton type="button" onClick={() => { setClosing(false); onOpenChange(false); }}>保留内容并关闭</WorkButton><WorkButton type="button" onClick={() => { reset(); onOpenChange(false); }}>放弃内容</WorkButton></div></div> : <footer className={s.modalActions}><WorkButton type="button" onClick={() => close(false)}>取消</WorkButton><WorkButton primary type="submit"><Plus size={17} />创建草稿</WorkButton></footer>}
    </form>
  </WorkDialog>;
}
