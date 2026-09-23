"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface ChartSize {
  width: number;
  height: number;
}

type ChartMountChildren = ReactNode | ((size: ChartSize) => ReactNode);

export function ChartMount({ children, ariaLabel }: { children: ChartMountChildren; ariaLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };

    const observer = new ResizeObserver(update);
    observer.observe(node);
    const timeout = window.setTimeout(update, 80);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !size) return;

    const sanitizeGeneratedSvgs = () => {
      node.querySelectorAll<SVGSVGElement>('svg[role="application"]').forEach((svg) => {
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.removeAttribute("tabindex");
      });
    };

    sanitizeGeneratedSvgs();
    const frame = window.requestAnimationFrame(sanitizeGeneratedSvgs);
    return () => window.cancelAnimationFrame(frame);
  }, [size]);

  return (
    <div ref={ref} className="h-full w-full" role={ariaLabel ? "img" : undefined} aria-label={ariaLabel}>
      {size ? (
        typeof children === "function" ? children(size) : children
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full rounded-[12px]"
          style={{
            background: "linear-gradient(90deg, var(--rg-control-bg), var(--card), var(--rg-control-bg))",
          }}
        />
      )}
    </div>
  );
}
