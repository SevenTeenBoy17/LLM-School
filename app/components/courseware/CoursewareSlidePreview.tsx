"use client";

import {
  ArrowRight,
  BarChart3,
  Beaker,
  BookOpen,
  Check,
  CircleDot,
  Map,
  Route,
  Sigma,
  Target,
} from "lucide-react";
import {
  COURSEWARE_PALETTES,
  type CoursewarePlan,
  type CoursewareSlide,
} from "@/lib/courseware/core";

type Props = {
  plan: CoursewarePlan;
  slide: CoursewareSlide;
  compact?: boolean;
  className?: string;
};

const ICONS = [Target, BookOpen, CircleDot, Check];

function withHash(value: string) {
  return `#${value}`;
}

function VisualGlyph({ slide, color, compact }: { slide: CoursewareSlide; color: string; compact: boolean }) {
  const size = compact ? 14 : 28;
  const Icon = slide.layout === "map-focus"
    ? Map
    : slide.layout === "experiment"
      ? Beaker
      : slide.layout === "formula"
        ? Sigma
        : slide.layout === "data-story"
          ? BarChart3
          : slide.layout === "timeline" || slide.layout === "process"
            ? Route
            : BookOpen;
  return <Icon size={size} strokeWidth={1.8} style={{ color }} aria-hidden />;
}

function CardGrid({ slide, compact, colors }: { slide: CoursewareSlide; compact: boolean; colors: string[] }) {
  const labels = slide.visual.labels.length ? slide.visual.labels : slide.bullets;
  return (
    <div className="grid h-full grid-cols-3 gap-[2%]">
      {slide.bullets.slice(0, 3).map((bullet, index) => {
        const Icon = ICONS[index % ICONS.length];
        return (
          <div key={`${slide.id}-card-${index}`} className="min-w-0 rounded-[5px] bg-white p-[7%] shadow-sm">
            <div className="grid aspect-square w-[24%] place-items-center rounded-full" style={{ backgroundColor: colors[index % colors.length] }}>
              <Icon className="text-white" size={compact ? 6 : 13} strokeWidth={2.2} />
            </div>
            <div className={`mt-[7%] truncate font-semibold text-slate-900 ${compact ? "text-[5px]" : "text-[11px]"}`}>{labels[index] || `要点 ${index + 1}`}</div>
            {!compact && <p className="mt-[5%] line-clamp-3 text-[8px] leading-[1.45] text-slate-600">{bullet}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Comparison({ slide, compact, colors, tints }: { slide: CoursewareSlide; compact: boolean; colors: string[]; tints: string[] }) {
  const labels = slide.visual.labels.length ? slide.visual.labels : ["对象 A", "对象 B", "综合判断"];
  return (
    <div className="grid h-full grid-cols-3 gap-[2%]">
      {[0, 1, 2].map((index) => (
        <div key={`${slide.id}-compare-${index}`} className="min-w-0 overflow-hidden rounded-[5px] bg-white shadow-sm">
          <div className="relative h-[42%] overflow-hidden" style={{ backgroundColor: tints[index % tints.length] }}>
            <div className="absolute right-[12%] top-[12%] aspect-square w-[17%] rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
            <div className="absolute bottom-[-14%] left-[8%] h-[42%] w-[84%] rotate-[-5deg] rounded-[45%]" style={{ backgroundColor: colors[index % colors.length], opacity: 0.78 }} />
          </div>
          <div className="p-[7%]">
            <div className={`truncate font-semibold text-slate-900 ${compact ? "text-[5px]" : "text-[11px]"}`}>{labels[index] || `对象 ${index + 1}`}</div>
            {!compact && <p className="mt-[5%] line-clamp-3 text-[8px] leading-[1.45] text-slate-600">{slide.bullets[index] || slide.purpose}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MapFocus({ slide, compact, accent, secondary, warm }: { slide: CoursewareSlide; compact: boolean; accent: string; secondary: string; warm: string }) {
  const labels = slide.visual.labels.length ? slide.visual.labels : ["位置", "分布", "联系"];
  return (
    <div className="grid h-full grid-cols-[40%_1fr] gap-[3%]">
      <div className="grid min-h-0 grid-rows-4 gap-[3%]">
        {slide.bullets.slice(0, 4).map((bullet, index) => (
          <div key={`${slide.id}-map-note-${index}`} className="flex min-w-0 items-center gap-[5%] rounded-[4px] bg-white px-[5%] shadow-sm">
            <span className={`grid aspect-square w-[13%] shrink-0 place-items-center rounded-full font-bold text-white ${compact ? "text-[4px]" : "text-[8px]"}`} style={{ backgroundColor: index < 2 ? accent : secondary }}>{String(index + 1).padStart(2, "0")}</span>
            <span className={`line-clamp-2 font-medium leading-tight text-slate-700 ${compact ? "text-[4px]" : "text-[8px]"}`}>{bullet}</span>
          </div>
        ))}
      </div>
      <div className="relative overflow-hidden rounded-[5px] bg-sky-100">
        <div className="absolute left-[14%] top-[17%] h-[65%] w-[64%] rotate-[-8deg] rounded-[44%_34%_52%_42%] bg-emerald-200" />
        <div className="absolute right-[-8%] top-[8%] h-[82%] w-[34%] rounded-full border-[6px] border-sky-300 opacity-70" />
        {labels.slice(0, 3).map((label, index) => {
          const positions = ["left-[18%] top-[20%]", "left-[53%] top-[42%]", "left-[30%] top-[70%]"];
          return (
            <div key={`${slide.id}-map-label-${index}`} className={`absolute flex items-center gap-1 rounded-full bg-white/95 px-[4%] py-[2%] font-semibold text-slate-800 shadow-sm ${positions[index]} ${compact ? "text-[4px]" : "text-[8px]"}`}>
              <span className="aspect-square w-[7px] rounded-full" style={{ backgroundColor: [accent, warm, secondary][index] }} />{label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Process({ slide, compact, colors }: { slide: CoursewareSlide; compact: boolean; colors: string[] }) {
  const labels = slide.visual.labels.length ? slide.visual.labels : ["观察", "证据", "解释", "迁移"];
  return (
    <div className="relative flex h-full items-center justify-between px-[3%]">
      <div className="absolute left-[8%] right-[8%] top-[39%] h-[3px] rounded-full bg-slate-200" />
      {labels.slice(0, 4).map((label, index) => (
        <div key={`${slide.id}-process-${index}`} className="relative z-10 flex w-[21%] flex-col items-center text-center">
          <div className={`grid aspect-square w-[35%] place-items-center rounded-full font-bold text-white shadow-sm ${compact ? "text-[5px]" : "text-[11px]"}`} style={{ backgroundColor: colors[index % colors.length] }}>{index + 1}</div>
          <div className={`mt-[10%] font-semibold text-slate-900 ${compact ? "text-[4px]" : "text-[9px]"}`}>{label}</div>
          {!compact && <p className="mt-[5%] line-clamp-2 text-[7px] leading-tight text-slate-500">{slide.bullets[index] || slide.purpose}</p>}
        </div>
      ))}
    </div>
  );
}

function Experiment({ slide, compact, accent, secondary, warm }: { slide: CoursewareSlide; compact: boolean; accent: string; secondary: string; warm: string }) {
  return (
    <div className="grid h-full grid-cols-[48%_1fr] gap-[4%]">
      <div className="grid grid-rows-4 gap-[3%]">
        {slide.bullets.slice(0, 4).map((bullet, index) => (
          <div key={`${slide.id}-experiment-${index}`} className="flex min-w-0 items-center gap-[5%] rounded-[4px] bg-white px-[5%] shadow-sm">
            <span className={`grid aspect-square w-[13%] place-items-center rounded-full font-bold text-white ${compact ? "text-[4px]" : "text-[8px]"}`} style={{ backgroundColor: index < 2 ? accent : secondary }}>{index + 1}</span>
            <span className={`line-clamp-2 font-medium text-slate-700 ${compact ? "text-[4px]" : "text-[8px]"}`}>{bullet}</span>
          </div>
        ))}
      </div>
      <div className="relative overflow-hidden rounded-[5px] bg-white shadow-sm">
        <Beaker className="absolute bottom-[13%] left-[12%]" size={compact ? 24 : 76} strokeWidth={1.5} style={{ color: accent }} />
        <div className="absolute right-[17%] top-[17%] aspect-square w-[19%] rounded-full" style={{ backgroundColor: warm }} />
        <div className="absolute right-[9%] top-[47%] aspect-square w-[25%] rounded-full" style={{ backgroundColor: secondary }} />
        {!compact && <div className="absolute bottom-[11%] right-[7%] rounded-full bg-slate-100 px-[8%] py-[3%] text-[8px] font-semibold text-slate-700">变量 · 证据</div>}
      </div>
    </div>
  );
}

function DataStory({ slide, compact, colors }: { slide: CoursewareSlide; compact: boolean; colors: string[] }) {
  const labels = slide.visual.labels.length ? slide.visual.labels : ["证据 A", "证据 B", "证据 C"];
  const values = slide.visual.values.length ? slide.visual.values : [68, 84, 76];
  return (
    <div className="grid h-full grid-cols-[43%_1fr] gap-[4%]">
      <div className="grid grid-rows-4 gap-[3%]">
        {slide.bullets.slice(0, 4).map((bullet, index) => <div key={`${slide.id}-data-note-${index}`} className={`line-clamp-2 rounded-[4px] bg-white px-[6%] py-[5%] font-medium text-slate-700 shadow-sm ${compact ? "text-[4px]" : "text-[8px]"}`}>{String(index + 1).padStart(2, "0")} · {bullet}</div>)}
      </div>
      <div className="flex flex-col justify-center gap-[10%] rounded-[5px] bg-white px-[8%] shadow-sm">
        {labels.slice(0, 4).map((label, index) => (
          <div key={`${slide.id}-bar-${index}`}>
            <div className={`mb-[2%] flex justify-between font-semibold text-slate-700 ${compact ? "text-[4px]" : "text-[8px]"}`}><span>{label}</span>{!compact && <span>{values[index] ?? 70}</span>}</div>
            <div className="h-[5px] overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${values[index] ?? 70}%`, backgroundColor: colors[index % colors.length] }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoursewareSlidePreview({ plan, slide, compact = false, className = "" }: Props) {
  const palette = COURSEWARE_PALETTES[plan.theme.palette];
  const accent = withHash(palette.accent);
  const secondary = withHash(palette.secondary);
  const warm = withHash(palette.warm);
  const ink = withHash(palette.ink);
  const canvas = withHash(palette.canvas);
  const tint = withHash(palette.tint);
  const colors = [accent, secondary, warm, ink];
  const tints = [tint, "#E7F1E6", "#FAE8D6"];

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-[6px] border border-black/5 shadow-sm ${className}`} style={{ backgroundColor: canvas, color: ink }} aria-label={`第 ${slide.index} 页预览：${slide.title}`}>
      {slide.layout === "cover" ? (
        <div className="relative h-full p-[6%]">
          <div className="absolute bottom-0 left-0 top-0 w-[3%]" style={{ backgroundColor: accent }} />
          <div className="absolute -right-[8%] -top-[18%] aspect-square w-[34%] rounded-full" style={{ backgroundColor: tint }} />
          <div className="absolute -bottom-[12%] right-[4%] aspect-square w-[20%] rounded-full opacity-85" style={{ backgroundColor: secondary }} />
          <div className={`inline-flex rounded-full px-[3%] py-[1.5%] font-semibold ${compact ? "text-[4px]" : "text-[9px]"}`} style={{ backgroundColor: tint, color: accent }}>{slide.eyebrow || `${plan.subject} · ${plan.grade}`}</div>
          <div className="mt-[9%] w-[63%]">
            <h3 className={`font-bold leading-[1.13] tracking-[0] ${compact ? "text-[9px]" : "text-[24px]"}`}>{slide.title}</h3>
            <p className={`mt-[4%] font-medium opacity-70 ${compact ? "text-[4px]" : "text-[10px]"}`}>{slide.subtitle || `${plan.grade} · ${plan.subject}`}</p>
          </div>
          <div className="absolute bottom-[10%] left-[6%] w-[55%] rounded-[5px] bg-white px-[4%] py-[3%] shadow-sm">
            <div className={`font-semibold ${compact ? "text-[4px]" : "text-[8px]"}`} style={{ color: accent }}>本课挑战</div>
            {!compact && <div className="mt-[2%] text-[10px] font-semibold">{slide.takeaway || slide.purpose}</div>}
          </div>
          <div className="absolute right-[9%] top-[28%] grid aspect-square w-[22%] place-items-center rounded-[18%] bg-white shadow-sm">
            <div className="grid aspect-square w-[58%] place-items-center rounded-full" style={{ backgroundColor: accent }}><VisualGlyph slide={slide} color="#FFFFFF" compact={compact} /></div>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="h-[2%] shrink-0" style={{ backgroundColor: accent }} />
          <header className="shrink-0 px-[5%] pb-[2%] pt-[3%]">
            <div className={`font-semibold ${compact ? "text-[4px]" : "text-[8px]"}`} style={{ color: accent }}>{slide.eyebrow || slide.kind}</div>
            <h3 className={`mt-[1%] truncate font-bold tracking-[0] ${compact ? "text-[7px]" : "text-[18px]"}`}>{slide.title}</h3>
            {!compact && <p className="mt-[1%] truncate text-[8px] text-slate-500">{slide.subtitle || slide.purpose}</p>}
          </header>
          <div className="min-h-0 flex-1 px-[5%] pb-[5%]">
            {slide.layout === "cards" && <CardGrid slide={slide} compact={compact} colors={colors} />}
            {slide.layout === "comparison" && <Comparison slide={slide} compact={compact} colors={colors} tints={tints} />}
            {slide.layout === "map-focus" && <MapFocus slide={slide} compact={compact} accent={accent} secondary={secondary} warm={warm} />}
            {(slide.layout === "process" || slide.layout === "timeline") && <Process slide={slide} compact={compact} colors={colors} />}
            {slide.layout === "experiment" && <Experiment slide={slide} compact={compact} accent={accent} secondary={secondary} warm={warm} />}
            {slide.layout === "data-story" && <DataStory slide={slide} compact={compact} colors={colors} />}
            {slide.layout === "formula" && (
              <div className="flex h-full flex-col gap-[7%]">
                <div className={`grid h-[38%] place-items-center rounded-[5px] px-[6%] text-center font-bold text-white shadow-sm ${compact ? "text-[7px]" : "text-[18px]"}`} style={{ backgroundColor: ink }}><Sigma className="mr-[3%] inline" size={compact ? 9 : 22} />{slide.visual.emphasis || slide.takeaway || slide.title}</div>
                <div className="min-h-0 flex-1"><CardGrid slide={slide} compact={compact} colors={colors} /></div>
              </div>
            )}
            {slide.layout === "practice" && <CardGrid slide={slide} compact={compact} colors={colors} />}
            {slide.layout === "summary" && (
              <div className="flex h-full flex-col gap-[7%]"><div className="min-h-0 flex-1"><CardGrid slide={slide} compact={compact} colors={colors} /></div><div className={`shrink-0 rounded-full px-[5%] py-[2%] text-center font-semibold text-white ${compact ? "text-[4px]" : "text-[9px]"}`} style={{ backgroundColor: ink }}>{slide.takeaway || "带着一条证据和一个新问题离开课堂"}</div></div>
            )}
            {!["cards", "comparison", "map-focus", "process", "timeline", "experiment", "data-story", "formula", "practice", "summary"].includes(slide.layout) && (
              <div className="grid h-full grid-cols-2 gap-[4%]">
                <div className="rounded-[5px] bg-white p-[7%] shadow-sm">{slide.bullets.slice(0, 4).map((bullet, index) => <div key={`${slide.id}-split-${index}`} className={`mb-[6%] flex gap-[4%] leading-snug text-slate-700 ${compact ? "text-[4px]" : "text-[8px]"}`}><Check size={compact ? 5 : 11} className="shrink-0" style={{ color: accent }} />{bullet}</div>)}</div>
                <div className="relative grid place-items-center overflow-hidden rounded-[5px]" style={{ backgroundColor: tint }}><div className="grid aspect-square w-[44%] place-items-center rounded-full" style={{ backgroundColor: accent }}><VisualGlyph slide={slide} color="#FFFFFF" compact={compact} /></div><ArrowRight className="absolute bottom-[8%] right-[8%]" size={compact ? 7 : 16} style={{ color: ink }} /></div>
              </div>
            )}
          </div>
          {!compact && <div className="absolute bottom-[1.5%] right-[3%] text-[7px] font-semibold" style={{ color: accent }}>{String(slide.index).padStart(2, "0")} / {String(plan.slides.length).padStart(2, "0")}</div>}
        </div>
      )}
    </div>
  );
}
