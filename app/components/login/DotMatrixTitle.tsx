"use client";

import { useEffect, useRef, useState } from "react";

/**
 * DotMatrixTitle — 把中文标题渲染成点阵（LED 屏质感）。
 *
 * 参考稿的点阵标题依赖拉丁点阵字体；中文没有可免费商用的高质量点阵字体，
 * 引入字体文件也违背轻资产纪律。方案改为**运行时采样**：
 *
 *   1. 真 <h1> 始终在 DOM（SEO / 读屏 / 选中复制 / LCP 全部由它承担）；
 *   2. 挂载后：offscreen canvas 以同字号同字重(700)绘制文本 → getImageData →
 *      按网格采样 → alpha 过阈的格心画圆点（半径随 alpha 微调，字缘自然变细）；
 *      点色直接取采样色——所以「降灰段」只需在 offscreen 里用两种颜色分段 fillText；
 *   3. 完成后 h1 `color: transparent` 交接（不是 hidden：读屏与选中不受影响、
 *      盒模型不变、零 CLS），canvas aria-hidden 纯视觉；
 *   4. ResizeObserver 监听 h1（含 fontScale 改根字号的场景）重采样；
 *   5. 任何一步失败 / canvas 不可用 / 视口 < enableFrom → 保持真文本。
 *      **最终态永远可读**是底线，点阵只是增强。
 */

export interface TitleSegment {
  text: string;
  /** 降灰段（复刻参考稿 and 的明暗节奏） */
  dim?: boolean;
}

export function DotMatrixTitle({
  lines,
  className = "",
  enableFrom = 768,
}: {
  lines: TitleSegment[][];
  className?: string;
  /** 小于此视口宽度时不启用点阵（38px 点阵可读性存疑，移动端直接真文本） */
  enableFrom?: number;
}) {
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    const h1 = h1Ref.current;
    const canvas = canvasRef.current;
    if (!h1 || !canvas) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const render = async () => {
      if (!alive) return;
      if (window.innerWidth < enableFrom) {
        setPainted(false);
        return;
      }
      try {
        // 等字体就绪再采样——采到回退字体的字形，交接瞬间会「变脸」。
        await document.fonts.ready;
        if (!alive) return;

        const rect = h1.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return;
        const cs = getComputedStyle(h1);
        const fontSize = parseFloat(cs.fontSize);
        const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.12;
        const dpr = Math.min(2, window.devicePixelRatio || 1);

        // ── offscreen：分段分色绘制 ──
        const off = document.createElement("canvas");
        off.width = Math.ceil(rect.width * dpr);
        off.height = Math.ceil(rect.height * dpr);
        const octx = off.getContext("2d", { willReadFrequently: true });
        if (!octx) return;
        octx.scale(dpr, dpr);
        octx.font = `700 ${fontSize}px ${cs.fontFamily}`;
        octx.textBaseline = "middle";
        // Chromium 支持 ctx.letterSpacing；不支持的环境静默忽略（字距略紧，无害）
        try { (octx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing; } catch { /* ignore */ }

        // 颜色必须**解析成实色**再喂给 canvas：
        // ① 降灰段最初用 rgba(…, 0.42)——采样时 alpha≈107 低于 110 过阈线，
        //    整段「在校内」被剔除到只剩抗锯齿残点（实测第二行前三字直接消失）。
        //    降灰要降**明度**不降 alpha：点还是实心点，只是更暗。
        // ② --lh-text-3 是 color-mix() 表达式，getPropertyValue 拿到的是原始字符串，
        //    canvas fillStyle 不保证认；挂一个探针元素让浏览器解析成 rgb() 最稳。
        const resolve = (cssColor: string) => {
          const probe = document.createElement("span");
          probe.style.color = cssColor;
          probe.style.display = "none";
          document.body.appendChild(probe);
          const out = getComputedStyle(probe).color;
          probe.remove();
          return out;
        };
        const bright = resolve("var(--lh-text)");
        const dimColor = resolve("var(--lh-text-3)");

        lines.forEach((segments, li) => {
          const y = lineHeight * li + lineHeight / 2;
          const total = segments.reduce((w, s) => w + octx.measureText(s.text).width, 0);
          let x = (rect.width - total) / 2;
          for (const seg of segments) {
            octx.fillStyle = seg.dim ? dimColor : bright;
            octx.fillText(seg.text, x, y);
            x += octx.measureText(seg.text).width;
          }
        });

        // ── 采样成点 ──
        const img = octx.getImageData(0, 0, off.width, off.height);
        const step = Math.max(5, Math.min(8, Math.round(fontSize / 11))) * dpr;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let gy = step / 2; gy < off.height; gy += step) {
          for (let gx = step / 2; gx < off.width; gx += step) {
            const i = (Math.floor(gy) * off.width + Math.floor(gx)) * 4;
            const a = img.data[i + 3];
            if (a < 110) continue;
            const r = step * 0.28 + (a / 255) * step * 0.16;
            ctx.fillStyle = `rgba(${img.data[i]}, ${img.data[i + 1]}, ${img.data[i + 2]}, ${(a / 255).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(gx, gy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (alive) setPainted(true);
      } catch {
        // 任何异常 → 保持真文本。点阵是增强，不是依赖。
        if (alive) setPainted(false);
      }
    };

    void render();
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void render(), 180);
    });
    ro.observe(h1);
    return () => {
      alive = false;
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [lines, enableFrom]);

  return (
    <div className={`relative ${className}`}>
      <h1
        ref={h1Ref}
        className="text-center font-bold tracking-[0.02em] text-[var(--lh-text)]"
        style={{
          fontSize: "clamp(38px, 6.5vw, 76px)",
          lineHeight: 1.12,
          // transparent 而非 visibility:hidden：读屏、选中、布局全部保留，只让像素让位给点阵层
          color: painted ? "transparent" : undefined,
        }}
      >
        {lines.map((segments, li) => (
          <span key={li} className="block">
            {segments.map((seg, si) => (
              <span key={si} className={seg.dim && !painted ? "text-[var(--lh-text-3)]" : undefined}>
                {seg.text}
              </span>
            ))}
          </span>
        ))}
      </h1>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ opacity: painted ? 1 : 0, transition: "opacity 200ms var(--ease-out)" }}
      />
    </div>
  );
}
