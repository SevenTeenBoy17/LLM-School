"use client";

/**
 * 趣味分级的**唯一渲染入口**（方案 §3.3 / V4b 中不依赖资产的那一半）。
 *
 * 背景：`lib/delight/policy.ts` 早在 V0 就写好了——`allowed()` / `suppressed()` / `canRender()`
 * 三个纯函数，24 条单测全绿。但它**一个消费者都没有**：全站没有任何组件调用 canRender，
 * `data-delight` 属性只在 policy.ts 的一句注释里出现过。
 *
 * 也就是说，方案给 V4b 定的验收条件「`[data-delight]` 不得与安全态共现」
 * **在当时是一句结构上无法失败的断言**——属性压根不存在，测什么都绿。
 * 本组件就是把那句断言变成有对象可测的东西：所有趣味元素经此渲染，并打上 `data-delight`。
 *
 * 三条职责，缺一不可：
 *   ① 按 role × stage 限高（policy.allowed）；
 *   ② **安全态一律抑制**（policy.suppressed，含求助面板打开、会话出现过危机）；
 *   ③ 身份未就绪时**不渲染**（§6.3：避免首帧 fail-closed 到 L1、水合后又冒出来的「闪一下」）。
 */

import type { ReactNode } from "react";
import { useSessionRole, useSessionStage } from "@/components/shell/SessionRoleProvider";
import { useSafetyStore } from "@/lib/store/useSafetyStore";
import { canRender, type DelightLevel } from "@/lib/delight/policy";

export function Delight({
  level,
  children,
  className,
  "data-testid": testId,
}: {
  level: DelightLevel;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  const role = useSessionRole();
  const stage = useSessionStage();
  const safetyOpen = useSafetyStore((s) => s.open);

  // ③ 身份未就绪：不渲染，而不是「先按 L1 渲染再纠正」。
  // 后者在低龄段会造成「出现→消失」，比一直不出现更让人困惑。
  if (!role) return null;

  // ①②：限高 + 安全抑制。ctx 只传 safetyOpen——sessionHadCrisis 属会话级状态，
  // 由 chat 侧维护，这两个宿主页面（home / growth）不发起对话，不适用。
  if (!canRender(level, role, stage, { safetyOpen })) return null;

  return (
    <span data-delight={level} data-testid={testId} className={className}>
      {children}
    </span>
  );
}
