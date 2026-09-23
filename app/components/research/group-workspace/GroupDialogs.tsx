"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Copy, KeyRound, LogOut, Plus, RefreshCw } from "lucide-react";
import { WorkButton, WorkDialog } from "@/components/research/workspace-shared";
import type { GroupSnapshot } from "@/lib/research-groups";
import type { ResearchGroupsController } from "./useResearchGroups";
import { PendingBar } from "./TaskDialog";
import styles from "./group-workspace.module.css";

const hasControls = (value: string) => /[\u0000-\u001f\u007f]/.test(value);

export function MembershipDialog({ mode, onClose, controller }: {
  mode: "create" | "join" | null; onClose: () => void; controller: ResearchGroupsController;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const disabled = controller.pending || controller.uncertain || !controller.index || controller.index.viewer.readOnly;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || !mode) return;
    setMessage("");
    if (mode === "create" && (hasControls(name) || hasControls(subject))) { setMessage("名称与学科中不能包含控制字符。"); return; }
    if (mode === "join" && !/^[a-f0-9]{48}$/.test(inviteCode.trim())) { setMessage("请输入组长提供的完整 48 位邀请码。"); return; }
    const result = await controller.mutate(mode === "create" ? { kind: "create", name: name.trim(), subject: subject.trim() } : { kind: "join", inviteCode: inviteCode.trim() });
    if (result.ok) { setName(""); setSubject(""); setInviteCode(""); onClose(); }
    else setMessage(result.message);
  };
  return <WorkDialog open={!!mode} onOpenChange={(open) => { if (!open && !controller.pending) { setMessage(""); onClose(); } }}
    title={mode === "join" ? "加入私有教研组" : "创建私有教研组"} description={mode === "join" ? "使用组长提供的邀请码加入。只有本组成员可查看组内分工。" : "创建后你将成为组长，可邀请教师并分配检查项任务。"} className={styles.formDialog}>
    <form onSubmit={(event) => void submit(event)} className={styles.form}>
      <fieldset disabled={disabled}>
        {mode === "join" ? <label>邀请码<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} maxLength={64} required autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="粘贴组长提供的完整邀请码" /></label> : <>
          <label>教研组名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="例如：八年级地理备课组" autoComplete="off" /></label>
          <label>学科 / 教研主题<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={40} required placeholder="例如：地理" autoComplete="off" /></label>
        </>}
      </fieldset>
      {message && <p className={styles.errorText} role="alert">{message}</p>}
      {controller.uncertain && <p className={styles.warning} role="alert">上次提交结果不确定，暂不能再次提交。返回目录同步并核对后，才能解除提交保护。填写内容会保留在当前页面。</p>}
      {controller.pending && <PendingBar label={mode === "join" ? "正在加入教研组" : "正在创建教研组"} />}
      <div className={styles.dialogFooter}><WorkButton disabled={controller.pending} onClick={onClose}>返回目录</WorkButton><WorkButton type="submit" primary disabled={disabled || (mode === "create" ? !name.trim() || !subject.trim() : !inviteCode.trim())}>{mode === "join" ? <KeyRound size={16} /> : <Plus size={16} />}{controller.pending ? "正在提交" : mode === "join" ? "加入教研组" : "创建教研组"}</WorkButton></div>
    </form>
  </WorkDialog>;
}

export function CreateTaskDialog({ open, onClose, snapshot, controller }: {
  open: boolean; onClose: () => void; snapshot: GroupSnapshot; controller: ResearchGroupsController;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState("");
  const [message, setMessage] = useState("");
  const values = items.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const disabled = controller.pending || controller.uncertain || snapshot.viewer.readOnly || !!controller.index?.viewer.readOnly || !snapshot.viewer.isOwner;
  const assigneeExists = snapshot.members.some((member) => member.userId === assigneeId);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    if (!values.length || values.length > 16 || values.some((value) => value.length > 240 || hasControls(value)) || hasControls(title)) {
      setMessage("请填写 1–16 个检查项，每项最多 240 字，且不能包含控制字符。"); return;
    }
    if (!assigneeExists) { setMessage("请选择仍在本组的负责人。"); return; }
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(`${dueDate}T12:00:00Z`)) || new Date(`${dueDate}T12:00:00Z`).toISOString().slice(0, 10) !== dueDate)) {
      setMessage("请选择有效的截止日期。"); return;
    }
    setMessage("");
    const result = await controller.mutate({ kind: "action", action: "create-task", title: title.trim(), assigneeId, dueDate, items: values });
    if (result.ok) { setTitle(""); setAssigneeId(""); setDueDate(""); setItems(""); onClose(); }
    else setMessage(result.message);
  };
  return <WorkDialog open={open} onOpenChange={(next) => { if (!next && !controller.pending) onClose(); }} title="分配教研任务" description="负责人和组长可更新检查项。保存后任务对本组成员可见。" className={styles.formDialog}>
    <form onSubmit={(event) => void submit(event)} className={styles.form}>
      <fieldset disabled={disabled}>
        <label>任务名称<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="例如：核对水循环探究活动的问题链" /></label>
        <div className={styles.formColumns}>
          <label>负责人<select aria-label="负责人" value={assigneeExists ? assigneeId : ""} onChange={(event) => setAssigneeId(event.target.value)} required><option value="">选择本组成员</option>{snapshot.members.map((member) => <option key={member.userId} value={member.userId}>{member.name}{member.isOwner ? "（组长）" : ""}</option>)}</select></label>
          <label><span>截止日期 <small>选填</small></span><input aria-label="截止日期" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        </div>
        <label>检查项<textarea value={items} onChange={(event) => setItems(event.target.value)} rows={7} maxLength={4000} required placeholder={"梳理核心概念\n核对课堂活动材料\n补充课堂观察记录"} aria-describedby="research-task-item-limits" /></label>
        <p id="research-task-item-limits" className={styles.hint}>每行一个检查项，最多 16 项，每项 240 字。已填写 {values.length}/16 项。</p>
      </fieldset>
      {message && <p className={styles.errorText} role="alert">{message}</p>}
      {controller.uncertain && <p className={styles.warning} role="alert">上次提交结果不确定。请先返回任务栏核对，避免重复分配；填写内容会保留到你切换教研组或离开此页面。</p>}
      {controller.pending && <PendingBar label="正在创建教研任务" />}
      <div className={styles.dialogFooter}><WorkButton disabled={controller.pending} onClick={onClose}>返回教研组</WorkButton><WorkButton type="submit" primary disabled={disabled || !title.trim() || !assigneeExists || !values.length || values.length > 16}><Plus size={16} />{controller.pending ? "正在分配" : "分配任务"}</WorkButton></div>
    </form>
  </WorkDialog>;
}

export function InviteDialog({ snapshot, controller, onClose }: { snapshot: GroupSnapshot; controller: ResearchGroupsController; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copyEpoch = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; copyEpoch.current += 1; }; }, []);
  const disabled = controller.pending || controller.uncertain || snapshot.viewer.readOnly || !!controller.index?.viewer.readOnly || !snapshot.viewer.isOwner;
  const copy = async () => {
    if (!snapshot.inviteCode || disabled) return;
    const code = snapshot.inviteCode;
    const ticket = ++copyEpoch.current;
    setMessage(""); setCopiedCode(null);
    try {
      await navigator.clipboard.writeText(code);
      if (mounted.current && ticket === copyEpoch.current) setCopiedCode(code);
    } catch { if (mounted.current && ticket === copyEpoch.current) setMessage("复制失败，请选中上方邀请码手动复制。"); }
  };
  const rotate = async () => {
    if (disabled) return;
    copyEpoch.current += 1;
    setCopiedCode(null); setMessage("");
    const result = await controller.mutate({ kind: "action", action: "rotate-invite" });
    if (result.ok) { setConfirm(false); setMessage("邀请码已更新，旧邀请码已失效。"); }
    else setMessage(result.message);
  };
  return <WorkDialog open onOpenChange={(open) => { if (!open && !controller.pending) onClose(); }} title="邀请教师加入" description="邀请码仅对组长展示。请只提供给需要加入本组的教师，不要公开发布。" className={styles.formDialog}>
    <div className={styles.form}>
      {snapshot.inviteCode ? <label>本组邀请码<input readOnly value={snapshot.inviteCode} className={styles.inviteInput} onFocus={(event) => event.target.select()} aria-label="本组邀请码" /></label> : <p className={styles.warning}>当前会话不能查看邀请码。</p>}
      <WorkButton onClick={() => void copy()} disabled={disabled || !snapshot.inviteCode}><Copy size={16} />{copiedCode && copiedCode === snapshot.inviteCode ? "已复制邀请码" : "复制邀请码"}</WorkButton>
      <div className={styles.divider} />
      {confirm ? <div className={styles.warning}><p>更新后，所有未使用的旧邀请码立即失效；已加入的成员不受影响。</p><div className={styles.actions}><WorkButton disabled={controller.pending} onClick={() => setConfirm(false)}>保留现有邀请码</WorkButton><WorkButton disabled={disabled} onClick={() => void rotate()}><RefreshCw size={15} />确认更新</WorkButton></div></div>
        : <WorkButton onClick={() => setConfirm(true)} disabled={disabled}><RefreshCw size={16} />更新邀请码</WorkButton>}
      {message && <p className={styles.hint} role="status">{message}</p>}
      {controller.uncertain && <p className={styles.warning} role="alert">更新结果尚未确认，请返回教研组重新同步，核对当前邀请码后再分享。</p>}
      {controller.pending && <PendingBar label="正在更新邀请码" />}
      <div className={styles.dialogFooter}><WorkButton disabled={controller.pending} onClick={onClose}>返回教研组</WorkButton></div>
    </div>
  </WorkDialog>;
}

export function LeaveDialog({ snapshot, controller, onClose }: { snapshot: GroupSnapshot; controller: ResearchGroupsController; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const leave = async () => {
    const result = await controller.mutate({ kind: "action", action: "leave" });
    if (result.ok) onClose(); else setMessage(result.message);
  };
  return <WorkDialog open onOpenChange={(open) => { if (!open && !controller.pending) onClose(); }} title={`退出“${snapshot.group.name}”`} description="退出后不能再查看或更新组内任务，已分配给你的任务仍会保留。重新加入需要有效的邀请码。" className={styles.formDialog}>
    {message && <p className={styles.errorText} role="alert">{message}</p>}
    {controller.pending && <PendingBar label="正在退出教研组" />}
    <div className={styles.dialogFooter}><WorkButton disabled={controller.pending} onClick={onClose}>留在本组</WorkButton><WorkButton disabled={controller.pending || controller.uncertain || snapshot.viewer.readOnly || !!controller.index?.viewer.readOnly || snapshot.viewer.isOwner} onClick={() => void leave()}><LogOut size={16} />确认退出</WorkButton></div>
  </WorkDialog>;
}
