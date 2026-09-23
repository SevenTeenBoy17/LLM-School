"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelProvider } from "@/lib/types";

interface ModelState {
  current: ModelProvider;
  knowledgeOn: boolean;
  deepThinkOn: boolean;
  webOn: boolean;
  setCurrent: (m: ModelProvider) => void;
  toggleKnowledge: () => void;
  toggleDeepThink: () => void;
  toggleWeb: () => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      // 默认模型按 R7 多模型横评：minimax 质量接近 claude、延迟约其一半、性价比最高，作均衡默认优于原 chatgpt（"性价比不突出"）。
      current: "minimax",
      knowledgeOn: true,
      deepThinkOn: true,
      webOn: false,
      setCurrent: (current) => set({ current }),
      toggleKnowledge: () => set((s) => ({ knowledgeOn: !s.knowledgeOn })),
      toggleDeepThink: () => set((s) => ({ deepThinkOn: !s.deepThinkOn })),
      toggleWeb: () => set((s) => ({ webOn: !s.webOn })),
    }),
    { name: "eduai-model" }
  )
);
