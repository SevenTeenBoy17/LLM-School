"use client";

import { useState } from "react";
import { Check, RefreshCw, Save } from "lucide-react";
import { WorkButton, WorkDialog } from "@/components/research/workspace-shared";
import { groupProgress, type GroupMember, type GroupSnapshot, type GroupTask } from "@/lib/research-groups";
import type { ResearchGroupsController } from "./useResearchGroups";
import { BotPortrait } from "./GroupScene";
import styles from "./group-workspace.module.css";

export function PendingBar({ label }: { label: string }) {
  return <div className={styles.pending} role="progressbar" aria-label={label}><span /></div>;
}

function Checklist({ task, snapshot, controller, onDirty }: {
  task: GroupTask; snapshot: GroupSnapshot; controller: ResearchGroupsController; onDirty: (id: string, dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<{ revision: number; doneIds: string[] } | null>(null);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const readOnly = snapshot.viewer.readOnly || !!controller.index?.viewer.readOnly;
  const allowed = !readOnly && (snapshot.viewer.isOwner || snapshot.viewer.id === task.assigneeId);
  const doneIds = draft?.doneIds ?? task.items.filter((item) => item.done).map((item) => item.id);
  const conflict = draft !== null && draft.revision !== task.revision;
  const disabled = !allowed || controller.pending || controller.uncertain;
  const reset = () => { setDraft(null); setMessage(""); setSaved(false); onDirty(task.id, false); };
  const toggle = (id: string, checked: boolean) => {
    setSaved(false);
    setMessage("");
    const next = checked ? [...doneIds, id] : doneIds.filter((entry) => entry !== id);
    const same = next.length === task.completed && task.items.every((item) => next.includes(item.id) === item.done);
    if (same && !conflict) { setDraft(null); onDirty(task.id, false); }
    else { setDraft({ revision: draft?.revision ?? task.revision, doneIds: next }); onDirty(task.id, true); }
  };
  const save = async () => {
    if (!draft || saving || disabled || conflict) return;
    setSaving(true);
    setMessage("");
    const result = await controller.mutate({ kind: "action", action: "update-task", taskId: task.id, revision: draft.revision, doneIds: draft.doneIds });
    setSaving(false);
    if (result.ok) { setDraft(null); setSaved(true); onDirty(task.id, false); }
    else setMessage(result.conflict ? "该任务已被其他人更新。你的勾选保留在此处，请先核对服务器最新版本。" : result.message);
  };
  return <section className={styles.checklist} aria-label={task.title}>
    <div className={styles.taskHeading}><h4>{task.title}</h4><span>v{task.revision}</span></div>
    <div className={styles.taskMeta}><span>{task.dueDate ? `截止 ${task.dueDate}` : "未设截止日期"}</span><span>已保存 {task.completed}/{task.total} 项</span></div>
    {task.items.map((item) => <label key={item.id} className={styles.checkItem}>
      <input type="checkbox" checked={doneIds.includes(item.id)} disabled={disabled} onChange={(event) => toggle(item.id, event.target.checked)} />
      <span>{item.text}</span>
    </label>)}
    {conflict && <div className={styles.warning} role="alert">
      <p>服务器已有 v{task.revision}，当前未保存的勾选基于 v{draft.revision}。为避免覆盖他人的进度，暂不能提交。</p>
      <p>服务器已完成：{task.items.filter((item) => item.done).map((item) => item.text).join("、") || "暂无"}</p>
      <WorkButton onClick={reset} disabled={controller.pending}><RefreshCw size={15} />放弃本次勾选，载入最新版本</WorkButton>
    </div>}
    {message && <p className={styles.errorText} role="alert">{message}</p>}
    {saving && <PendingBar label={`正在保存${task.title}的检查项`} />}
    <div className={styles.checklistFooter}>
      <span className={styles.hint}>{!allowed ? readOnly ? "当前会话只读" : "仅组长或负责人可修改" : draft ? "有未保存的勾选" : saved ? <><Check size={14} />已保存到服务器</> : "与服务器已保存版本一致"}</span>
      {allowed && <div className={styles.actions}>
        {draft && <WorkButton onClick={reset} disabled={controller.pending}>放弃勾选</WorkButton>}
        <WorkButton primary onClick={() => void save()} disabled={disabled || !draft || conflict}><Save size={15} />{saving ? "正在保存" : "保存进度"}</WorkButton>
      </div>}
    </div>
  </section>;
}

export function TaskDialog({ member, taskId, snapshot, controller, onClose }: {
  member?: GroupMember; taskId?: string; snapshot: GroupSnapshot; controller: ResearchGroupsController; onClose: () => void;
}) {
  const [dirtyTasks, setDirtyTasks] = useState<string[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);
  const tasks = taskId ? snapshot.tasks.filter((task) => task.id === taskId) : snapshot.tasks.filter((task) => task.assigneeId === member?.userId);
  const progress = groupProgress(tasks);
  const currentMember = member && snapshot.members.find((entry) => entry.userId === member.userId);
  const name = member?.name ?? "未在组的成员";
  const close = () => {
    if (controller.pending) return;
    if (dirtyTasks.length) setConfirmClose(true);
    else onClose();
  };
  return <WorkDialog open onOpenChange={(open) => { if (!open) close(); }} title={`${name}的任务`} description="查看分工与服务器已保存的检查项进度。" className={styles.taskDialog}>
    <div className={styles.memberProfile}>
      {member && <BotPortrait member={member} />}
      <div><h3>{name}</h3><p>{currentMember ? `${currentMember.department || "未填写部门"}${currentMember.isOwner ? " · 组长" : ""}` : "未在组 · 原有任务仍保留"}</p></div>
      <span className={styles.profileProgress}>{progress.total ? `${progress.completed}/${progress.total} 项 · ${progress.percent}%` : "未分配"}</span>
    </div>
    {progress.total > 0 && <div className={styles.profileMeter} role="progressbar" aria-label={`${name}已保存的任务进度`} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed} aria-valuetext={`${progress.completed}/${progress.total} 个检查项，${progress.percent}%`}><span style={{ width: `${progress.percent}%` }} /></div>}
    <div className={styles.taskDialogBody}>
      {!tasks.length && <p className={styles.emptyInline}>尚未分配任务。任务由组长创建。</p>}
      {tasks.map((task) => <Checklist key={task.id} task={task} snapshot={snapshot} controller={controller}
        onDirty={(id, dirty) => setDirtyTasks((current) => dirty ? [...new Set([...current, id])] : current.filter((entry) => entry !== id))} />)}
    </div>
    {controller.uncertain && <div className={styles.warning} role="alert">上次提交结果不确定。请关闭弹窗后同步并核对任务进度；当前勾选尚不能作为已保存结果。</div>}
    {confirmClose ? <div className={styles.warning} role="alert"><p>有未保存的勾选。返回后将丢弃这些勾选，服务器任务不会被改动。</p><div className={styles.actions}>
      <WorkButton onClick={() => setConfirmClose(false)}>继续检查</WorkButton><WorkButton onClick={onClose}>放弃勾选并返回</WorkButton>
    </div></div> : <div className={styles.dialogFooter}><WorkButton onClick={close} disabled={controller.pending}>返回教研组</WorkButton></div>}
  </WorkDialog>;
}
