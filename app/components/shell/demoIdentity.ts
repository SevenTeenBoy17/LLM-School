"use client";

/**
 * 演示身份的「我从哪来」记号 + 一个极小的外部存储订阅。
 *
 * 为什么需要它：`/api/auth/switch-role` 会重新签发会话 cookie，切完之后服务端会话
 * **就是**那个角色——从服务端看不出「这是一次演示切换」还是「本来就是这个人」。
 * 但用户需要看得出：一位老师以学生身份浏览时，看到的每一条数据都可能被误当成真实学情。
 * Canvas 的 Student View 用「全屏描边 + 底部常驻条 + 显式退出」三重冗余防的正是这件事。
 *
 * 为什么用 sessionStorage 而不是 localStorage：演示态**不应该跨浏览器重启存活**。
 * 关掉标签页就该回到「我是我自己」的默认假设——这与共用机房设备的现实一致。
 *
 * 为什么不写进签名会话：`switch-role` 在生产环境一律 403（route.ts 首行 isProd 判定），
 * 所以演示态只存在于开发/预发。为一个生产上不存在的状态去改签名令牌的负载结构，
 * 代价与收益不匹配。这个记号只承担「提示」职责，不承担任何准入判定——
 * 准入始终由 proxy.ts 读签名 cookie 决定（铁律④）。
 *
 * 为什么自带 subscribe：sessionStorage 的同标签页写入**不触发 storage 事件**，
 * 所以读它的组件不会自动更新。这里维护一个模块级订阅表，让消费方能走
 * useSyncExternalStore——这正是 React 对「订阅外部数据源」的规定写法，
 * 也避免了在 effect 里 setState（那会引起级联渲染，且被 lint 正确地拦下）。
 */
import type { UserRole } from "@/lib/types";

const KEY = "eduai-demo-identity-from";

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

export function subscribeDemoIdentity(onChange: () => void): () => void {
  listeners.add(onChange);
  // 跨标签页的变更仍走原生 storage 事件（sessionStorage 在不同标签页互相独立，
  // 这里主要覆盖同源 iframe 一类场景；成本一行，缺了也只是少一种同步途径）。
  if (typeof window !== "undefined") window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
  };
}

/** 快照必须是纯读且**引用稳定**：返回 string|null，同值即同引用，不会引起无限重渲。 */
export function readDemoOrigin(): UserRole | null {
  try {
    return (sessionStorage.getItem(KEY) as UserRole | null) ?? null;
  } catch {
    // 隐私模式下 sessionStorage 可能不可用：没有记号就不显示横幅，不影响任何功能
    return null;
  }
}

/** 服务端快照恒为 null：SSR 拿不到 sessionStorage，横幅晚一帧出现即可。 */
export function readDemoOriginServer(): UserRole | null {
  return null;
}

/** 记下「切换之前我是谁」。已在演示态时不覆盖——否则连切两次就找不到回家的路。 */
export function markDemoSwitch(originalRole: UserRole): void {
  try {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, originalRole);
  } catch {
    /* ignore */
  }
  emit();
}

export function clearDemoSwitch(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit();
}
