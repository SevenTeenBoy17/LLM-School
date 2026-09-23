"use client";

import { ThemeProvider } from "next-themes";
import { ReactNode, useEffect } from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePrefsStore } from "@/lib/store/usePrefsStore";

function PrefsBridge({ children }: { children: ReactNode }) {
  const reduce = usePrefsStore((s) => s.reduceMotion);
  const density = usePrefsStore((s) => s.density);
  const fontScale = usePrefsStore((s) => s.fontScale);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("reduce-motion", reduce);
    root.dataset.density = density;
    root.style.setProperty("--font-scale", String(fontScale));
    root.style.fontSize = `${14 * fontScale}px`;
  }, [reduce, density, fontScale]);

  // 根级 MotionConfig：让「减少动效」开关统一管控全站 motion(JS) 动画（评审 a11y P1-4）。
  // 全局 Toaster：此前全站无挂载点，sonner toast 静默不可见（探索完成庆祝/看板流转/安全求助均依赖它）。
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </MotionConfig>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="eduai-theme">
      <TooltipProvider delayDuration={300}>
        <PrefsBridge>{children}</PrefsBridge>
      </TooltipProvider>
    </ThemeProvider>
  );
}
