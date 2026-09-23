"use client";

/**
 * 会话角色的「服务端真相」上下文（T5 轮修复 P1）。
 *
 * 背景：角色相关 UI（chat 助手 tab / 学生监督横幅 / 引导模式开关 / 右栏推荐提示词）此前只读
 * useUserStore。该 store 由 zustand persist 驱动，**SSR 时必然是默认值 teacher**——服务端 HTML
 * 因此渲染成教师态；客户端水合后与 SSR 不一致会触发 hydration mismatch，React 对不匹配子树
 * 「不予修补」，结果学生端永久停留教师态：看到教师助手 tab 与教师提示词，且看不到监督横幅与
 * 引导模式开关（M1 能力对学生不可见）。
 *
 * 修法与 S0 的 data-persona 一致：由 shell layout 用 getSessionUser() 注入服务端角色，
 * 服务端与客户端首帧因此一致（无 mismatch）；store 仅作为兜底（如 provider 缺省时）。
 */
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useUserStore } from "@/lib/store/useUserStore";
import type { UserRole, Stage } from "@/lib/types";

// V0 扩展：本 provider 原先**只承载 role**，而趣味分级（lib/delight/policy.ts）按 role × stage
// 判定——stage 只能从 useUserStore 拿，正是本文件开头批评的那类「首帧不可靠」来源。
// 服务端 toSessionUser 已经透传 stage（db.ts），所以只需接线，不需要新增后端能力。
interface SessionIdentity {
  role: UserRole | null;
  stage: Stage | null;
  /** 完整身份（姓名/院系/头像字）。铁律②修复：useUserStore 的默认值曾是一个
   *  **硬编码的真人身份**（姓名 + 一个连播种数据里都不存在的院系），而 store 只在
   *  登录表单成功后被 setUser 覆盖——任何不经表单建立的会话（API 登录、cookie 续期、
   *  清过 localStorage）都会让侧栏、学生首页问候语等**所有读者**对所有角色显示同一个人。
   *  修法：服务端会话是唯一权威，这里把它写回 store（见 provider 里的 useEffect），
   *  一处同步治好全部读者，不必逐个改消费组件。 */
  identity: { name: string; department: string; avatarLetter: string } | null;
  /**
   * 「切换身份（演示）」是否可用。**由服务端决定**：/api/auth/switch-role 在生产环境
   * 一律 403，而侧栏此前无条件渲染全部 5 个角色项——生产上那是 5 个点了必然失败的死控件，
   * 同时向学生暴露了系统里存在管理员与学院管理员这两种角色。
   * 无权即不可见：这个 flag 让渲染层能和服务端行为对齐，而不是各猜各的。
   */
  roleSwitchEnabled: boolean;
}
const SessionIdentityContext = createContext<SessionIdentity | null>(null);

export function SessionIdentityProvider({ role, stage, identity, roleSwitchEnabled, children }: SessionIdentity & { children: ReactNode }) {
  const setUser = useUserStore((s) => s.setUser);
  const name = useUserStore((s) => s.name);
  const department = useUserStore((s) => s.department);
  // 服务端身份与 store 镜像不一致时，以服务端为准写回。依赖列表故意只含服务端值与
  // 当前镜像值：正常路径下这个 effect 每次会话最多触发一次；表单登录的 setUser 与
  // 这里写入的是同一份服务端响应，不会互相打架。
  useEffect(() => {
    if (!identity || !role || !stage) return;
    if (name !== identity.name || department !== identity.department) {
      setUser({ name: identity.name, role, stage, department: identity.department, avatarLetter: identity.avatarLetter });
    }
  }, [identity, role, stage, name, department, setUser]);
  return (
    <SessionIdentityContext.Provider value={{ role, stage, identity, roleSwitchEnabled }}>
      {children}
    </SessionIdentityContext.Provider>
  );
}

/** 优先服务端会话角色；provider 未提供时回落到客户端 store（非权威镜像）。 */
export function useSessionRole(): UserRole {
  const identity = useContext(SessionIdentityContext);
  const storeRole = useUserStore((s) => s.role);
  return identity?.role ?? storeRole;
}

/**
 * 服务端会话学段。**取不到时返回 null，而不是回落 store 的 primary**——
 * policy.allowed() 对 null 判 L1（最低拟人化），这是趣味配额的正确 fail-closed 方向；
 * 若在此处回落 store 默认值，会给未知身份的用户发最高拟人化档，方向正好反了。
 */
export function useSessionStage(): Stage | null {
  return useContext(SessionIdentityContext)?.stage ?? null;
}

/**
 * 演示切换是否可用。默认 **false**（fail-closed）：provider 缺省时宁可不渲染切换控件，
 * 也不要渲染一个点了会 403 的按钮——按钮存在本身就是一句「你可以这么做」的承诺。
 */
export function useRoleSwitchEnabled(): boolean {
  return useContext(SessionIdentityContext)?.roleSwitchEnabled ?? false;
}
