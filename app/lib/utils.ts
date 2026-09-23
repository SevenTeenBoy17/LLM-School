import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, opts: { compact?: boolean } = {}) {
  if (opts.compact && n >= 10000) {
    return (n / 10000).toFixed(1) + "万";
  }
  return n.toLocaleString();
}

export function formatPercent(n: number, digits = 1) {
  return n.toFixed(digits) + "%";
}

export function timeAgo(when: Date | string): string {
  const date = when instanceof Date ? when : new Date(when);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return date.toLocaleDateString("zh-CN");
}
