"use client";

import { useEffect, useId, useState } from "react";
import styles from "./generation-progress.module.css";

type Props = {
  active?: boolean;
  label: string;
  detail?: string;
  completed?: number;
  total?: number;
  unit?: string;
  startedAt?: number;
  className?: string;
};

export function GenerationProgress({ active = true, ...props }: Props) {
  return active ? <RunningProgress {...props} /> : null;
}

function RunningProgress({ label, detail, completed, total, unit = "项", startedAt, className = "" }: Omit<Props, "active">) {
  const id = useId();
  const [mountedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = typeof startedAt === "number" && Number.isFinite(startedAt) ? startedAt : mountedAt;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [mountedAt, startedAt]);

  const measured = typeof total === "number" && Number.isFinite(total) && total > 0
    && typeof completed === "number" && Number.isFinite(completed);
  const done = measured ? Math.max(0, Math.min(completed, total)) : 0;
  const percent = measured ? Math.floor(done / total * 100) : undefined;
  const countLabel = measured ? `${done} / ${total} ${unit}` : undefined;
  const time = elapsed < 60 ? `${elapsed} 秒` : `${Math.floor(elapsed / 60)} 分 ${String(elapsed % 60).padStart(2, "0")} 秒`;

  return <div className={`${styles.root} ${className}`} data-generation-progress={measured ? "determinate" : "indeterminate"}>
    <div className={styles.heading}>
      <span className={styles.label} id={`${id}-label`}>{label}</span>
      <span className={styles.metrics}>
        {countLabel && <span>{countLabel} · {percent}%</span>}
        <span className={styles.elapsed} aria-hidden="true">已等待 {time}</span>
      </span>
    </div>
    <div className={styles.track} role="progressbar" aria-labelledby={`${id}-label`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      aria-valuetext={countLabel || "正在处理，暂无可用完成比例"}>
      <span className={measured ? styles.fill : styles.indeterminate} style={measured ? { width: `${percent}%` } : undefined} />
    </div>
    <div className={styles.detail} role="status" aria-live="polite" aria-atomic="true">
      {detail || (measured ? `已完成 ${countLabel}` : "正在等待服务返回结果")}
    </div>
  </div>;
}
