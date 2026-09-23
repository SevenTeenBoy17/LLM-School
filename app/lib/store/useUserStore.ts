"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole, Stage } from "@/lib/types";

interface UserState {
  name: string;
  role: UserRole;
  stage: Stage; // 学段（学生端语气/防代写分级；安全默认=小学，最强保护）
  department: string;
  avatarLetter: string;
  // 评审 P1（越权/角色一致性）：移除 setRole/setStage 写口——角色/学段只能经 setUser 由 /api/auth/* 服务端响应注入，
  // 前端不得单方面提权或自降防代写强度。本 store 仅为「非权威 UI 镜像」：真正的准入由 proxy（HMAC cookie）把关、
  // 防代写强度由 /api/chat 用会话 stage 服务端计算，故客户端篡改 role/stage 至多只影响本机 UI 呈现（点击即被 proxy 拦截）。
  setUser: (u: { name: string; role: UserRole; stage: Stage; department: string; avatarLetter: string }) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // 铁律②：默认值不得是任何真人身份。这里曾写死「王思远 / 计算机学院 · 教师」
      // ——一个连播种数据里都没有的院系——导致所有不经登录表单的会话（API 登录、
      // cookie 续期）把这个人显示给每一个角色。现改为诚实的占位：SessionIdentityProvider
      // 会在 shell 挂载时用服务端会话身份写回本 store，占位至多存在一帧。
      // role/stage 的默认值保持原样：teacher 是 hydration 基线（见 SessionRoleProvider
      // 头注释），primary 是 fail-closed 的最强保护学段，两者都不是「身份」。
      name: "校内用户",
      role: "teacher",
      stage: "primary", // 安全默认取最强保护学段（评审 P1：未知学段不欠保护低龄儿童）
      department: "身份同步中…",
      avatarLetter: "校",
      setUser: (u) => set(u),
    }),
    {
      name: "eduai-user",
      version: 1,
      // 旧快照（本轮前无 stage 字段）回填为最强保护学段，避免 Select 非受控 / undefined
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<UserState>;
        if (p.stage === undefined) p.stage = "primary";
        return p as UserState;
      },
    }
  )
);

/**
 * 登出时清客户端身份镜像。
 *
 * 为什么必须有：本 store 走 zustand persist 落在 localStorage("eduai-user")，
 * 而登出路径（Topbar 与 Sidebar 各一处）此前只清服务端 cookie。于是在共用机房设备上：
 *   · 下一位用户的**首帧**会看到上一位的姓名与院系（侧栏页脚、学生首页问候语等所有读者）；
 *   · store 的默认 role 是 teacher（hydration 基线），学生首帧还会拿到教师态的判定。
 * 这不是准入漏洞——proxy.ts 读签名 cookie，点进去照样被拦（铁律④）——
 * 但它是**身份信息的泄露**，而且泄露对象正好是同一台设备的下一个学生。
 *
 * 用 persist.clearStorage() 清盘，再把内存态复位成占位值：只清存储不复位内存，
 * 当前这一帧仍然显示着上一个人。
 */
export function clearClientIdentity(): void {
  try {
    useUserStore.persist.clearStorage();
  } catch {
    /* 隐私模式 / 存储被禁：内存复位仍要执行 */
  }
  useUserStore.setState({
    name: "校内用户",
    role: "teacher",
    stage: "primary",
    department: "身份同步中…",
    avatarLetter: "校",
  });
}
