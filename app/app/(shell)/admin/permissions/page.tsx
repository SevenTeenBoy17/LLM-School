"use client";

import { useEffect, useState } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Users, ShieldCheck, FileDown } from "lucide-react";
import { ROLES, ROLE_USERS, type RoleId } from "@/lib/data/admin";
import { apiGetRolePerms, apiSaveRolePerms, exportCsv } from "@/lib/client/adminApi";
import { Reveal } from "@/components/common/EduArt";
import { cn } from "@/lib/utils";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";

const ROLE_PERMS: Record<RoleId, { label: string; on: boolean }[]> = {
  sysadmin: [
    { label: "全平台模型配置", on: true },  { label: "权限审批", on: true },
    { label: "审计日志查看",   on: true },  { label: "成本与配额管理", on: true },
    { label: "知识库管理",     on: true },  { label: "智能体审批", on: true },
  ],
  "college-admin": [
    { label: "本学院用户管理", on: true },  { label: "本学院知识库", on: true },
    { label: "智能体审核",     on: true },  { label: "成本查看",     on: true },
    { label: "权限审批",       on: false }, { label: "全局模型配置", on: false },
  ],
  teacher: [
    { label: "AI 对话",       on: true },  { label: "课程知识库", on: true },
    { label: "智能体创建",     on: true },  { label: "导出 Word / PPT", on: true },
    { label: "学院数据查看",   on: false }, { label: "用户管理", on: false },
  ],
  student: [
    { label: "AI 对话",         on: true }, { label: "学习智能体", on: true },
    { label: "指定知识库",       on: true }, { label: "导出对话",   on: false },
    { label: "GPT-Image 视觉方案",  on: false }, { label: "知识库创建", on: false },
  ],
  guest: [
    { label: "公开资源",       on: true },  { label: "试用 AI 对话（限额）", on: true },
    { label: "智能体使用",     on: false },  { label: "文件上传", on: false },
    { label: "导出",           on: false },  { label: "知识库", on: false },
  ],
};

export default function PermissionsPage() {
  const [role, setRole] = useState<RoleId>("teacher");
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = ROLE_USERS.filter((u) => !role || u.role === role).filter((u) => {
    if (!normalizedQuery) return true;
    return [u.name, u.id, u.college, u.role, u.status]
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
  const selectedUser = activeUser ? ROLE_USERS.find((u) => u.id === activeUser) : null;
  const currentPerms = ROLE_PERMS[role];

  // 角色权限位（服务端持久化，覆盖页面默认）——切换角色即载入。
  const [permState, setPermState] = useState<Record<string, boolean>>({});
  const [savedTip, setSavedTip] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      const server = await apiGetRolePerms(role);
      if (!alive) return;
      const base = Object.fromEntries(ROLE_PERMS[role].map((p) => [p.label, p.on]));
      setPermState(server ? { ...base, ...server } : base);
      setSavedTip("");
    })();
    return () => { alive = false; };
  }, [role]);
  const togglePerm = (label: string, v: boolean) => setPermState((s) => ({ ...s, [label]: v }));
  const savePerms = async () => {
    const ok = await apiSaveRolePerms(role, permState);
    setSavedTip(ok ? "已保存到服务端" : "保存失败，请重试");
  };

  return (
    <div className="flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden space-y-4">
      <Reveal className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white shadow-[var(--shadow-sm)]" style={{ backgroundImage: "var(--grad-primary)" }}><ShieldCheck size={20} /></span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">管理与监控中心 · 权限管理</h1>
            <p className="text-[13px] text-[var(--text-2)]">角色定义、用户授权、权限审批的统一入口</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline" size="sm" className="min-h-[var(--hit-min)] gap-1.5"
            onClick={() => exportCsv(
              `权限报表-${role}.csv`,
              ["角色", "权限项", "是否开启"],
              ROLE_PERMS[role].map((p) => [role, p.label, (permState[p.label] ?? p.on) ? "是" : "否"])
            )}
          ><FileDown size={13} /> 导出权限报表</Button>
          <NotYetAvailable why="自定义角色需角色模型 · 演示未开通"><Plus size={13} /> 新增角色</NotYetAvailable>
        </div>
      </Reveal>

      <AdminTabs />

      <div className="grid gap-3 lg:grid-cols-[260px_1fr_320px]">
        {/* Roles */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">角色列表</div>
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setActiveUser(null); }}
                aria-pressed={role === r.id}
                className={cn(
                  "w-full rounded-[12px] border p-3 text-left transition",
                  role === r.id ? "border-[var(--c-edu)] ring-2 ring-[var(--c-edu)]/20 bg-[var(--rg-selected-bg)]" : "border-[var(--border-2)] hover:border-[var(--c-edu)]/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold">{r.name}</span>
                  {/* 原为 `r.color + "22"`——字符串拼 hex 造透明度。改为两个各自完整的令牌，
                      渲染处不再做字符串运算（详见 lib/data/admin.ts 的 ROLES 说明）。 */}
                  <Badge style={{ background: r.tint, color: r.ink }} className="border-0">{r.userCount}</Badge>
                </div>
                <div className="mt-1 text-[12px] text-[var(--text-2)] line-clamp-2">{r.description}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* User table */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 flex-1 items-center gap-2 rounded-[12px] bg-[var(--rg-control-bg)] px-3 text-[var(--text-3)]">
                <Search size={13} />
                <input
                  aria-label="搜索用户"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-full w-full bg-transparent text-[13px] outline-none"
                  placeholder="搜索用户名 / 工号 / 学院..."
                />
              </div>
              <NotYetAvailable why="需真实用户目录 · 演示未开通"><Users size={12} /> 批量导入</NotYetAvailable>
            </div>
            <p className="mb-2 text-[11px] text-[var(--text-3)]">下方用户列表为界面示例；本页真实持久化的是「角色权限位」。</p>

            <div className="surface-card overflow-x-auto">
              <div className="grid min-w-[720px] grid-cols-[1.4fr_1fr_1.4fr_80px_70px] gap-3 border-b border-[var(--border-2)] bg-[var(--rg-hover-bg)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">
                <span>姓名</span><span>工号</span><span>所属</span><span>状态</span><span>操作</span>
              </div>
              {filteredUsers.length === 0 ? (
                <div className="min-w-[720px] px-3 py-8 text-center text-[13px] text-[var(--text-3)]">
                  未找到匹配的用户
                </div>
              ) : filteredUsers.map((u) => (
                // 去嵌套（内测 R2 遗留 P2）：行不再是 role=button（内含真实「编辑」button 违反 ARIA 无可聚焦后代），
                // 选择行为收敛到「编辑」真实 button，避免外层假可点击区域。
                <div
                  key={u.id}
                  className={cn(
                    "grid min-w-[720px] grid-cols-[1.4fr_1fr_1.4fr_80px_70px] items-center gap-3 border-b border-[var(--border-2)] px-3 py-2.5 text-left transition hover:bg-[var(--rg-hover-bg)]",
                    activeUser === u.id && "bg-[var(--rg-selected-bg)]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--rg-selected-bg)] text-[12px] font-semibold text-[var(--c-primary)]">{u.name[0]}</span>
                    <span className="text-[13px] font-semibold">{u.name}</span>
                  </div>
                  <span className="text-num text-[12px] text-[var(--text-2)]">{u.id}</span>
                  <span className="truncate text-[12px]">{u.college}</span>
                  <Badge variant={u.status === "active" ? "green" : "default"}>{u.status === "active" ? "正常" : "已停用"}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[var(--hit-min)] px-3"
                    aria-label={`编辑 ${u.name} 的权限`}
                    onClick={() => setActiveUser(u.id)}
                  >
                    编辑
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Permission details */}
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)] mb-2">
              {selectedUser ? "用户权限" : "角色权限"}
            </div>
            {selectedUser ? (
              <div>
                <div className="flex items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--rg-selected-bg)] text-[14px] font-semibold text-[var(--c-primary)]">{selectedUser.name[0]}</span>
                  <div>
                    <div className="text-[14px] font-semibold">{selectedUser.name}</div>
                    <div className="text-[11px] text-[var(--text-2)]">{selectedUser.id} · {selectedUser.college}</div>
                  </div>
                </div>
                <div className="mt-3 text-[12px] text-[var(--text-2)]">
                  当前角色：<Badge variant="primary">{ROLES.find((r) => r.id === selectedUser.role)?.name}</Badge>
                </div>
                <div className="mt-3 text-[12px] text-[var(--text-3)]">
                  下方继承自该角色，可单独覆盖。
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-[var(--text-2)] mb-2">展示「{ROLES.find((r) => r.id === role)?.name}」的默认权限，可点击切换。</div>
            )}

            <ScrollArea className="mt-3 max-h-[460px] pr-1">
              <div className="space-y-2">
                {currentPerms.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-[12px] border border-[var(--border-2)] px-3 py-2">
                    <span className="text-[13px]">{p.label}</span>
                    <Switch
                      aria-label={`${p.label} 权限开关`}
                      checked={permState[p.label] ?? p.on}
                      onCheckedChange={(v) => togglePerm(p.label, v)}
                      className="h-10 w-16 [&>span]:h-7 [&>span]:w-7 data-[state=checked]:[&>span]:translate-x-7"
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>

            {savedTip && <div role="status" aria-live="polite" className="mt-2 text-[12px] text-[var(--c-growth)]">{savedTip}</div>}
            <div className="mt-1 text-[11px] text-[var(--text-3)]">保存的是「角色级」权限位（服务端持久化）；用户级单独覆盖需真实用户目录（演示未开通）。</div>
            <div className="mt-3 flex gap-2">
              <NotYetAvailable why="需目标角色选择 · 演示未开通">复制到其他</NotYetAvailable>
              <Button onClick={savePerms} variant="grad" size="sm" className="min-h-[var(--hit-min)] flex-1 gap-1.5"><ShieldCheck size={12} /> 保存角色权限</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
