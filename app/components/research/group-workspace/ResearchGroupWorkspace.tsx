"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, Check, ClipboardList, KeyRound, LogOut, Plus, RefreshCw, ShieldCheck, UsersRound, WifiOff } from "lucide-react";
import { AnimatedPanel, useResearchOwner, WorkButton } from "@/components/research/workspace-shared";
import { groupProgress, type GroupMember, type GroupSnapshot, type GroupTask } from "@/lib/research-groups";
import { CreateTaskDialog, InviteDialog, LeaveDialog, MembershipDialog } from "./GroupDialogs";
import { GroupScene } from "./GroupScene";
import { PendingBar, TaskDialog } from "./TaskDialog";
import { useResearchGroups, type ResearchGroupsController } from "./useResearchGroups";
import styles from "./group-workspace.module.css";

function TaskRow({ task, snapshot, onOpen }: { task: GroupTask; snapshot: GroupSnapshot; onOpen: () => void }) {
  const member = snapshot.members.find((entry) => entry.userId === task.assigneeId);
  const percent = task.total ? Math.round(task.completed / task.total * 100) : 0;
  return <button type="button" className={styles.taskRow} onClick={onOpen}>
    <span className={`${styles.taskIcon} ${task.total > 0 && task.completed === task.total ? styles.taskDone : ""}`}>{task.total > 0 && task.completed === task.total ? <Check size={16} /> : <ClipboardList size={16} />}</span>
    <span className={styles.taskRowContent}><strong>{task.title}</strong><span className={styles.taskRowMeta}><span>{member?.name || "未在组的成员"}{!member && <small>未在组</small>}</span><span>{task.dueDate || "未设截止日期"}</span></span>
      {task.total ? <span className={styles.progressLine}><span className={styles.meter} aria-hidden="true"><span style={{ width: `${percent}%` }} /></span><span>{task.completed}/{task.total} 项 · {percent}%</span></span> : <span className={styles.hint}>未分配</span>}
    </span><ArrowRight size={15} className={styles.rowArrow} />
  </button>;
}

function GroupContent({ snapshot, controller }: { snapshot: GroupSnapshot; controller: ResearchGroupsController }) {
  const [dialog, setDialog] = useState<"task" | "invite" | "leave" | null>(null);
  const [memberDetail, setMemberDetail] = useState<GroupMember | null>(null);
  const [taskDetail, setTaskDetail] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const progress = groupProgress(snapshot.tasks);
  const disabled = controller.pending || controller.uncertain || snapshot.viewer.readOnly || !!controller.index?.viewer.readOnly;
  const tasks = snapshot.tasks.filter((task) => filter === "mine" ? task.assigneeId === snapshot.viewer.id : filter === "unfinished" ? task.completed < task.total : filter === "done" ? task.total > 0 && task.completed === task.total : true);
  const openTask = (task: GroupTask) => {
    setMemberDetail(snapshot.members.find((member) => member.userId === task.assigneeId) ?? null);
    setTaskDetail(task.id);
  };
  return <AnimatedPanel motionKey={snapshot.group.id} className={styles.groupContent}>
    <div className={styles.groupHeading}>
      <div><div className={styles.eyebrow}><ShieldCheck size={14} />私有教研组 <span>{snapshot.group.subject}</span></div><h2>{snapshot.group.name}</h2></div>
      <div className={styles.actions}>
        {snapshot.viewer.isOwner ? <>
          <WorkButton onClick={() => setDialog("invite")} disabled={disabled}><KeyRound size={16} />邀请教师</WorkButton>
          <WorkButton primary onClick={() => setDialog("task")} disabled={disabled || snapshot.tasks.length >= 200} title={snapshot.tasks.length >= 200 ? "本组已达到 200 项任务上限" : undefined}><Plus size={16} />分配任务</WorkButton>
        </> : <WorkButton onClick={() => setDialog("leave")} disabled={disabled}><LogOut size={16} />退出教研组</WorkButton>}
      </div>
    </div>
    <div className={styles.overview}>
      <span><UsersRound size={16} /><strong>{snapshot.members.length}</strong> 位成员</span>
      <span><ClipboardList size={16} /><strong>{snapshot.tasks.length}</strong> 项任务</span>
      <span>{progress.total ? <><Check size={16} />已完成 <strong>{progress.completed}/{progress.total}</strong> 个检查项 <b>{progress.percent}%</b></> : "未分配检查项"}</span>
    </div>
    <div className={styles.workspaceBody}>
      <GroupScene snapshot={snapshot} onMember={(member) => { setTaskDetail(null); setMemberDetail(member); }} />
      <aside className={styles.taskRail} aria-label="教研组任务">
        <div className={styles.sectionHeading}><h3>任务分工</h3><label className={styles.taskFilter}><span className={styles.srOnly}>筛选组内任务</span><select aria-label="筛选组内任务" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">全部任务</option><option value="mine">我的任务</option><option value="unfinished">未完成</option><option value="done">已完成</option></select></label></div>
        <div className={styles.taskList}>{tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} snapshot={snapshot} onOpen={() => openTask(task)} />) : <div className={styles.emptyTasks}><ClipboardList size={28} /><h4>{snapshot.tasks.length ? "没有符合条件的任务" : "尚未分配任务"}</h4><p>{snapshot.tasks.length ? "切换筛选查看其他分工。" : snapshot.viewer.isOwner ? "为本组成员安排本轮备课的检查项。" : "组长分配任务后，可在这里查看和更新进度。"}</p>{!snapshot.tasks.length && snapshot.viewer.isOwner && <WorkButton disabled={disabled} onClick={() => setDialog("task")}><Plus size={16} />分配第一项任务</WorkButton>}</div>}</div>
        <p className={styles.railNote}>进度来自成员保存的检查项，不代表在线状态或教学质量。</p>
      </aside>
    </div>
    {snapshot.viewer.isOwner && <p className={styles.ownerNote}>你是本组组长。当前版本不支持转交组长或组长退出。</p>}
    <CreateTaskDialog open={dialog === "task"} onClose={() => setDialog(null)} snapshot={snapshot} controller={controller} />
    {dialog === "invite" && <InviteDialog snapshot={snapshot} controller={controller} onClose={() => setDialog(null)} />}
    {dialog === "leave" && <LeaveDialog snapshot={snapshot} controller={controller} onClose={() => setDialog(null)} />}
    {(memberDetail || taskDetail) && <TaskDialog key={taskDetail ?? memberDetail?.userId} member={memberDetail ?? undefined} taskId={taskDetail ?? undefined} snapshot={snapshot} controller={controller} onClose={() => { setMemberDetail(null); setTaskDetail(null); }} />}
  </AnimatedPanel>;
}

function GroupSession({ ownerId }: { ownerId: string }) {
  const controller = useResearchGroups(ownerId);
  const [membership, setMembership] = useState<"create" | "join" | null>(null);
  const { index, snapshot, selectedId, error, identityFailed, syncing, pending, paused, lastSync } = controller;
  const readOnly = index?.viewer.readOnly ?? true;
  const disabled = !index || readOnly || pending || controller.uncertain || identityFailed;
  if (identityFailed) return <section className={styles.root} data-testid="research-group-workspace"><div className={styles.errorPanel} role="alert"><AlertCircle size={24} /><h2>当前身份需要重新确认</h2><p>{error || "请刷新页面重新进入教研组。"}</p><WorkButton onClick={() => window.location.reload()}><RefreshCw size={16} />刷新页面</WorkButton></div></section>;
  return <section className={styles.root} data-testid="research-group-workspace" aria-label="私有教研组工作区">
    <div className={styles.utilityRow}>
      <label className={styles.groupSelect}><UsersRound size={17} /><span className={styles.srOnly}>选择私有教研组</span><select aria-label="选择私有教研组" value={selectedId} onChange={(event) => controller.selectGroup(event.target.value)} disabled={!index?.groups.length || pending}>
        {!index?.groups.length && <option value="">{index ? "我的教研组" : "正在读取教研组"}</option>}
        {index?.groups.map((group) => <option key={group.id} value={group.id}>{group.name}（{group.memberCount} 人）</option>)}
      </select></label>
      <div className={styles.actions}>
        <WorkButton onClick={() => setMembership("join")} disabled={disabled}><KeyRound size={16} />加入教研组</WorkButton>
        <WorkButton onClick={() => setMembership("create")} disabled={disabled || (index?.groups.length ?? 0) >= 20} title={(index?.groups.length ?? 0) >= 20 ? "已达到 20 个教研组上限" : undefined}><Plus size={16} />创建教研组</WorkButton>
      </div>
    </div>
    <div className={styles.syncRow}>
      <span>{error ? <WifiOff size={14} /> : <span className={styles.syncDot} />}{error ? "同步中断" : paused ? "窗口未激活，已暂停同步" : syncing && !lastSync ? "正在连接服务器" : "服务器同步"}{lastSync && <span>最近成功 {new Date(lastSync).toLocaleTimeString("zh-CN", { hour12: false })}</span>}</span>
      <WorkButton aria-label="重新同步教研组" title="重新同步教研组" onClick={() => void controller.refresh()} disabled={syncing || pending || paused}><RefreshCw size={14} /></WorkButton>
    </div>
    {readOnly && index && <p className={styles.warning} role="status">当前为只读会话，可查看教研组；创建、加入、邀请和任务修改已停用。</p>}
    {error && <div className={styles.errorBanner} role="alert"><AlertCircle size={17} /><span>{error}{snapshot && " 当前显示最近一次成功同步的内容。"}</span><WorkButton onClick={() => void controller.refresh()} disabled={syncing || pending || paused}>重试</WorkButton></div>}
    {controller.uncertain && <div className={styles.warning} role="alert"><strong>上次提交结果未确认</strong><p>可能已经保存到服务器。请同步后检查组目录、任务或邀请码，避免重复操作。</p><div className={styles.actions}><WorkButton onClick={() => void controller.refresh()} disabled={syncing || pending || paused}><RefreshCw size={15} />同步并核对</WorkButton><WorkButton disabled={!controller.verifiedAfterUncertain || pending || syncing} onClick={controller.acknowledgeUncertain}>已核对服务器状态，解除提交保护</WorkButton></div></div>}
    {(pending || (syncing && !snapshot)) && <PendingBar label={pending ? "正在向服务器提交教研组操作" : "正在读取教研组和任务"} />}
    {!index && !error && <div className={styles.skeleton} aria-label="教研组正在加载" aria-busy="true"><span /><span /><span /></div>}
    {index && !index.groups.length && !error && <div className={styles.emptyState}><span className={styles.emptySymbol}><UsersRound size={32} /></span><h2>开始本组的备课协作</h2><p>创建一个私有教研组，或使用组长的邀请码加入。</p><div className={styles.actions}><WorkButton primary disabled={disabled} onClick={() => setMembership("create")}><Plus size={16} />创建教研组</WorkButton><WorkButton disabled={disabled} onClick={() => setMembership("join")}><KeyRound size={16} />使用邀请码加入</WorkButton></div></div>}
    {snapshot && snapshot.group.id === selectedId && snapshot.viewer.id === ownerId && <GroupContent key={snapshot.group.id} snapshot={snapshot} controller={controller} />}
    <MembershipDialog mode={membership} onClose={() => setMembership(null)} controller={controller} />
  </section>;
}

export default function ResearchGroupWorkspace() {
  const owner = useResearchOwner();
  const ownerId = owner?.split(":")[0];
  return owner && ownerId ? <GroupSession key={owner} ownerId={ownerId} /> : <section className={styles.root} data-testid="research-group-workspace"><p className={styles.hint}>正在确认工作区身份</p><PendingBar label="正在确认教研组访问身份" /></section>;
}
