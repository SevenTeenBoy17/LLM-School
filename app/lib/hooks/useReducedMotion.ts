"use client";

import { usePrefsStore } from "@/lib/store/usePrefsStore";

/**
 * 统一的动效偏好：合并 OS 的 prefers-reduced-motion 与应用内「减少动效」开关。
 * 用法：<MotionConfig reducedMotion={useMotionPref()}>
 * "always" = 强制关闭（应用内开关已开）；"user" = 跟随系统设置。
 * 修复评审 a11y P1-4：应用内开关此前管不到 motion(JS) 动画。
 */
export function useMotionPref(): "always" | "user" {
  const reduceMotion = usePrefsStore((s) => s.reduceMotion);
  return reduceMotion ? "always" : "user";
}
