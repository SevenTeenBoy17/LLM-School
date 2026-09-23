"use client";

import * as motion from "motion/react-client";
import { ArrowRight, Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ModelCardItem } from "@/lib/types";
import { MODEL_GRADIENT_CSS } from "@/lib/data/models";
import { ModelGlyph } from "@/components/common/ModelGlyph";
import { useModelStore } from "@/lib/store/useModelStore";
import { cn } from "@/lib/utils";

interface Props {
  model: ModelCardItem;
  index: number;
}

export function ModelCard({ model, index }: Props) {
  const router = useRouter();
  const current = useModelStore((s) => s.current);
  const setCurrent = useModelStore((s) => s.setCurrent);
  const selected = current === model.id;
  const baseStatus = model.status === "selected" ? "available" : model.status;
  const status = selected ? "selected" : baseStatus;
  const badge = status === "selected" ? "当前使用" : status === "request" ? "需申请" : status === "maintain" ? "维护中" : "已开通";
  const action = status === "selected" ? "已选用" : model.actionText;
  const grad = MODEL_GRADIENT_CSS(model);

  const handleClick = () => {
    if (status === "request" || status === "maintain") return;
    setCurrent(model.id);
    router.push("/chat");
  };

  return (
    <motion.article
      data-model-id={model.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      whileHover={{ y: -4 }}
      className={cn(
        "group relative overflow-hidden rounded-[20px] border bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-xl",
        selected ? "border-[var(--c-primary)]/40 bg-gradient-to-br from-[var(--rg-hover-bg)] to-[var(--card)]" : "border-[var(--border-2)]",
        status === "request" && !selected && "opacity-95"
      )}
    >
      <div
        className="absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-10 blur-2xl transition group-hover:opacity-20"
        style={{ backgroundImage: grad }}
      />

      <div className="relative z-10 mb-4 flex items-start justify-between">
        <div className="grid h-14 w-14 place-items-center rounded-[20px] text-white shadow-lg" style={{ backgroundImage: grad }}>
          <ModelGlyph id={model.id} size={28} />
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            selected ? "bg-[var(--rg-selected-bg)] text-[var(--info-ink)]" : status === "request" ? "bg-[var(--warn-bg)] text-[var(--warn-ink)]" : "bg-[var(--ok-bg)] text-[var(--ok-ink)]"
          )}
        >
          {badge}
        </span>
      </div>

      <div className="relative z-10">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-3)]">{model.key}</div>
        <h3 className="mt-1.5 text-[24px] font-semibold tracking-tight text-[var(--text)]">{model.name}</h3>
        <p className="mt-2 min-h-[60px] text-[13px] leading-[1.7] text-[var(--text-2)]">{model.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {model.tags.map((t) => (
            <span key={t} className="rounded-full bg-[var(--rg-control-bg)] px-2.5 py-1 text-[11px] text-[var(--text-2)]">
              {t}
            </span>
          ))}
        </div>

        <div className="mt-4 rounded-[20px] bg-[var(--rg-hover-bg)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">推荐场景</div>
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] text-[var(--text-2)]">
            {model.scenarios.map((s) => (<span key={s}>#{s}</span>))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleClick}
          disabled={status === "request"}
          className={cn(
            "mt-4 inline-flex h-12 min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[12px] text-[13px] font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed",
            status === "selected" && "bg-[var(--c-edu)]",
            status === "request" && "bg-[var(--c-gold)] hover:bg-[var(--c-gold)]",
            status === "available" && "bg-[length:200%_100%] hover:bg-[position:right]"
          )}
          style={status === "available" ? { backgroundImage: grad } : undefined}
        >
          {status === "selected" && <Check size={14} />}
          {status === "request" && <Lock size={14} />}
          {status === "available" && <ArrowRight size={14} />}
          {action}
        </button>
      </div>
    </motion.article>
  );
}
