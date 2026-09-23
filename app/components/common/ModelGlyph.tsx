"use client";

import type { ModelProvider } from "@/lib/types";
import { LOGO_PATHS, type BrandLogoKey } from "@/lib/data/brandLogos";

interface ModelGlyphProps {
  id: ModelProvider;
  size?: number;
  className?: string;
}

/**
 * H3（2026-08-19 用户拍板）：模型图标与门户页脚品牌条对齐——弃用手绘几何线稿，
 * 统一走 lib/data/brandLogos.ts 的官方品牌矢量（currentColor 单色，随容器着色）。
 * GPT-5.4 与 GPT-Image-2 同属 OpenAI，共用同一枚标（与页脚口径一致）。
 */
const BRAND_OF: Record<ModelProvider, BrandLogoKey> = {
  chatgpt: "openai",
  "gpt-image": "openai",
  claude: "claude",
  gemini: "gemini",
  deepseek: "deepseek",
  glm: "zhipu",
  minimax: "minimax",
};

export function ModelGlyph({ id, size = 24, className }: ModelGlyphProps) {
  const key = BRAND_OF[id];
  if (!key) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d={LOGO_PATHS[key]} />
    </svg>
  );
}
