"use client";

// 全局安全求助状态（评审 P0-3 / P1-4）：让 chat 危机分支能「程序化打开」求助弹窗，
// 而非用「右下角按钮」这类感官方位指代（屏幕阅读器/键盘用户无法定位）。
import { create } from "zustand";

export type SafetyPanel = "menu" | "help" | "privacy";

interface SafetyState {
  open: boolean;
  panel: SafetyPanel;
  setOpen: (v: boolean) => void;
  setPanel: (p: SafetyPanel) => void;
  openMenu: () => void;
  openHelp: () => void;
}

export const useSafetyStore = create<SafetyState>((set) => ({
  open: false,
  panel: "menu",
  setOpen: (open) => set({ open }),
  setPanel: (panel) => set({ panel }),
  openMenu: () => set({ open: true, panel: "menu" }),
  openHelp: () => set({ open: true, panel: "help" }),
}));
