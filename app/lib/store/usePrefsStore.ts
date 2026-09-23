"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AssistantRole = "teacher" | "student" | "research" | "admin";
export type Density = "comfortable" | "compact";

interface PrefsState {
  assistantRole: AssistantRole;
  density: Density;
  reduceMotion: boolean;
  fontScale: number;
  onboarded: boolean;
  showPeerComparison: boolean; // 同伴对比默认关闭（opt-in，未成年人心理安全，评审 P0-3）
  setAssistantRole: (r: AssistantRole) => void;
  setDensity: (d: Density) => void;
  setReduceMotion: (v: boolean) => void;
  setFontScale: (v: number) => void;
  setOnboarded: (v: boolean) => void;
  setShowPeerComparison: (v: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      assistantRole: "teacher",
      density: "comfortable",
      reduceMotion: false,
      fontScale: 1,
      onboarded: false,
      showPeerComparison: false,
      setAssistantRole: (assistantRole) => set({ assistantRole }),
      setDensity: (density) => set({ density }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setFontScale: (fontScale) => set({ fontScale }),
      setOnboarded: (onboarded) => set({ onboarded }),
      setShowPeerComparison: (showPeerComparison) => set({ showPeerComparison }),
    }),
    { name: "eduai-prefs" }
  )
);
