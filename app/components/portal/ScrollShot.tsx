"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * ScrollShot — ProofStrip 的截图框。
 *
 * **为什么它必须是客户端组件**：这一层唯一的职责，就是让「可滚动」这个承诺
 * 与事实一致。原先的写法把 `tabIndex={0}`、`role="group"` 和一句以
 * 「可横向滚动」结尾的 aria-label **恒定**挂在四个框上，但实测 ≥768px 时
 * 四个框全都不可滚（ev-help 那张在 390–1440 全档位都不可滚）：
 *
 *   · 对键盘用户：桌面档凭空多出 4 个既不能滚、也没有任何动作的 Tab 停靠点，
 *     占该档位可聚焦元素的 4/21；
 *   · 对读屏用户更糟：aria-label 主动宣称了一个**不存在的操作**。
 *
 * 「能不能滚」取决于视口宽度与图片宽度的关系，纯 CSS 判定不了，服务端也算不出。
 * 所以这里用 ResizeObserver 实测 `scrollWidth > clientWidth`，
 * 只有真的能滚时才挂 tabIndex / role / 那句 label。
 *
 * SSR 首帧按「不可滚」渲染（scrollable 初值 false）：读屏用户宁可少拿到一个
 * 可滚提示，也不该拿到一个假的。水合后立即以真值纠正。
 */
export function ScrollShot({
  src,
  width,
  height,
  alt,
  title,
  fade,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  title: string;
  /** 该端的裁图切断了界面内容，需淡出收边（逐张按行墨迹实测过才填）。 */
  fade?: "top" | "bottom";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      // 只在真能滚时才成为键盘停靠点，并且只有此时才宣称「可横向滚动」。
      {...(scrollable
        ? { tabIndex: 0, role: "group", "aria-label": `${title} — 界面截图，可横向滚动` }
        : {})}
      className="w-fit max-w-full overflow-x-auto rounded-[var(--r-ctl)] bg-[var(--card)] ring-1 ring-[var(--border-2)]"
    >
      <Image
        src={src}
        width={width}
        height={height}
        alt={alt}
        unoptimized
        className="block h-auto max-w-none"
        /* 遮罩写行内 style 而非 Tailwind 任意值：mask-image 的值带逗号和括号，
           任意值语法要靠下划线转义，写出来没人读得懂。色标用 black 关键字不用 hex——
           遮罩只取 alpha 通道，而且含 hex 的渐变会被色彩棘轮门判为「裸渐变」。 */
        style={
          fade
            ? {
                maskImage: `linear-gradient(to ${fade === "top" ? "bottom" : "top"}, transparent 0, black 28px)`,
                WebkitMaskImage: `linear-gradient(to ${fade === "top" ? "bottom" : "top"}, transparent 0, black 28px)`,
              }
            : undefined
        }
      />
    </div>
  );
}
