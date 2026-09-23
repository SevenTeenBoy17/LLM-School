"use client";

import {
  useDeferredValue,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ExternalLink,
  LibraryBig,
  ListChecks,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { TeacherFeatureIcon } from "@/components/common/TeacherNavIcon";
import {
  SKILL_LIBRARY_RESOURCE_COUNT,
  SKILL_LIBRARY_SECTIONS,
  SKILL_LINK_AUDIT_DATE,
  type SkillLibraryIcon,
  type SkillLibrarySection,
  type SkillLibraryTone,
  type SkillResource,
} from "@/lib/data/skillLibrary";
import { cn } from "@/lib/utils";

type ToneStyle = CSSProperties & {
  "--tile-surface": string;
  "--tile-strong": string;
  "--tile-ink": string;
  "--tile-edge": string;
  "--tile-accent": string;
  "--tile-shadow": string;
};

const TONES: Record<SkillLibraryTone, ToneStyle> = {
  blue: {
    "--tile-surface": "color-mix(in srgb, var(--info-bg) 84%, var(--card))",
    "--tile-strong": "var(--info-bg)",
    "--tile-ink": "var(--info-ink)",
    "--tile-edge": "color-mix(in srgb, var(--info) 38%, var(--border))",
    "--tile-accent": "color-mix(in srgb, var(--info) 76%, white)",
    "--tile-shadow": "color-mix(in srgb, var(--info) 22%, transparent)",
  },
  mint: {
    "--tile-surface": "color-mix(in srgb, var(--ok-bg) 84%, var(--card))",
    "--tile-strong": "var(--ok-bg)",
    "--tile-ink": "var(--ok-ink)",
    "--tile-edge": "color-mix(in srgb, var(--ok) 38%, var(--border))",
    "--tile-accent": "color-mix(in srgb, var(--ok) 76%, white)",
    "--tile-shadow": "color-mix(in srgb, var(--ok) 20%, transparent)",
  },
  amber: {
    "--tile-surface": "color-mix(in srgb, var(--warn-bg) 84%, var(--card))",
    "--tile-strong": "var(--warn-bg)",
    "--tile-ink": "var(--warn-ink)",
    "--tile-edge": "color-mix(in srgb, var(--warn) 40%, var(--border))",
    "--tile-accent": "color-mix(in srgb, var(--warn) 78%, white)",
    "--tile-shadow": "color-mix(in srgb, var(--warn) 20%, transparent)",
  },
  coral: {
    "--tile-surface": "color-mix(in srgb, var(--err-bg) 84%, var(--card))",
    "--tile-strong": "var(--err-bg)",
    "--tile-ink": "var(--err-ink)",
    "--tile-edge": "color-mix(in srgb, var(--err) 36%, var(--border))",
    "--tile-accent": "color-mix(in srgb, var(--err) 74%, white)",
    "--tile-shadow": "color-mix(in srgb, var(--err) 18%, transparent)",
  },
};

const SECTION_ARTWORK: Record<SkillLibrarySection["id"], string> = {
  directories: "/art/skills-v3/category-discovery.webp",
  repositories: "/art/skills-v3/category-source-audit.webp",
  education: "/art/skills-v3/category-teaching-research.webp",
  curriculum: "/art/skills-v3/category-curriculum-design.webp",
};

const ICON_ARTWORK: Record<SkillLibraryIcon, string> = {
  compass: "/art/skills-v3/scene-portal-directory.webp",
  collection: "/art/skills-v3/scene-skill-collection.webp",
  school: "/art/skills-v3/scene-teacher-assistant.webp",
  route: "/art/skills-v3/scene-curriculum-route.webp",
  github: "/art/skills-v3/scene-code-audit.webp",
  book: "/art/skills-v3/scene-lesson-plan.webp",
  lesson: "/art/skills-v3/scene-lesson-plan.webp",
  rubric: "/art/skills-v3/scene-rubric-evaluation.webp",
  research: "/art/skills-v3/scene-research-lab.webp",
  curriculum: "/art/skills-v3/scene-curriculum-crosswalk.webp",
  layers: "/art/skills-v3/scene-differentiation.webp",
  sparkles: "/art/skills-v3/scene-directory-network.webp",
};

const RESOURCE_ARTWORK: Record<string, string> = {
  skillsmp: "/art/skills-v3/scene-portal-directory.webp",
  "agent-skills-md": "/art/skills-v3/scene-search-catalog.webp",
  "skills-sh": "/art/skills-v3/scene-skill-collection.webp",
  skillstore: "/art/skills-v3/scene-directory-network.webp",
  "skills-directory": "/art/skills-v3/scene-search-catalog.webp",
  "agent-skills-me": "/art/skills-v3/scene-portal-directory.webp",
  "anthropic-skills": "/art/skills-v3/scene-code-audit.webp",
  "vercel-agent-skills": "/art/skills-v3/scene-repository-branch.webp",
  "awesome-agent-skills": "/art/skills-v3/scene-source-toolbox.webp",
  "antfu-skills": "/art/skills-v3/scene-review-checklist.webp",
  "agent-skills-hunter": "/art/skills-v3/scene-skill-collection.webp",
  "education-agent-skills": "/art/skills-v3/scene-teacher-assistant.webp",
  "anthropic-k12-teacher-skills": "/art/skills-v3/scene-lesson-plan.webp",
  "teaching-skills-codex": "/art/skills-v3/scene-research-lab.webp",
  "k12-lesson-plan-creation": "/art/skills-v3/scene-lesson-plan.webp",
  "k12-lesson-differentiation": "/art/skills-v3/scene-differentiation.webp",
  "agent-teacher": "/art/skills-v3/scene-teacher-assistant.webp",
  "backwards-design-unit-planner": "/art/skills-v3/scene-curriculum-route.webp",
  "scope-and-sequence-designer": "/art/skills-v3/scene-curriculum-crosswalk.webp",
  "criterion-referenced-rubric": "/art/skills-v3/scene-rubric-evaluation.webp",
  "curriculum-crosswalk": "/art/skills-v3/scene-curriculum-crosswalk.webp",
  "panel-review": "/art/skills-v3/scene-panel-review.webp",
  "curriculum-developer": "/art/skills-v3/scene-curriculum-route.webp",
  "learning-path-designer": "/art/skills-v3/scene-differentiation.webp",
  "rubric-designer": "/art/skills-v3/scene-rubric-evaluation.webp",
};

function matches(resource: SkillResource, query: string) {
  if (!query) return true;
  const haystack = [
    resource.title,
    resource.description,
    resource.source,
    resource.kind,
    ...resource.tags,
  ].join(" ").toLocaleLowerCase("zh-CN");
  return haystack.includes(query);
}

function SkillArtwork({
  src,
  size,
  selected = false,
  eager = false,
}: {
  src: string;
  size: "category" | "section" | "scene";
  selected?: boolean;
  eager?: boolean;
}) {
  const sizeClass = {
    category: "h-[86px] w-[86px]",
    section: "h-[66px] w-[66px]",
    scene: "h-[130px] w-[158px] max-w-[78%]",
  }[size];

  return (
    <motion.span
      aria-hidden="true"
      animate={{ y: selected ? -3 : 0, scale: selected ? 1.035 : 1 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative block shrink-0 select-none transition-transform duration-200",
        "group-hover:-translate-y-0.5 group-active:translate-y-px",
        sizeClass,
      )}
      style={{ filter: "drop-shadow(0 8px 9px var(--tile-shadow))" }}
    >
      <Image
        data-skill-artwork={src}
        src={src}
        alt=""
        width={size === "scene" ? 384 : 512}
        height={size === "scene" ? 384 : 512}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
        sizes={size === "scene" ? "158px" : size === "category" ? "86px" : "66px"}
        className="h-full w-full object-contain"
      />
    </motion.span>
  );
}

function ResourceScene({ resource, selected }: { resource: SkillResource; selected: boolean }) {
  const artwork = RESOURCE_ARTWORK[resource.id] ?? ICON_ARTWORK[resource.icon];

  return (
    <span
      aria-hidden="true"
      className="relative flex h-[138px] items-center justify-center overflow-hidden border-b border-white/75 bg-[var(--tile-surface)]"
    >
      <span className="absolute inset-x-[22%] bottom-3 h-2 rounded-full bg-[var(--tile-strong)] opacity-65" />
      <SkillArtwork src={artwork} size="scene" selected={selected} />
    </span>
  );
}

function SelectionBurst() {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-3 text-[var(--tile-ink)]"
      initial={{ opacity: 0, scale: 0.45, rotate: -18 }}
      animate={{ opacity: [0, 1, 0], scale: [0.45, 1.1, 1.35], rotate: [-18, 8, 18] }}
      transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
    >
      <Sparkles size={28} strokeWidth={1.8} />
    </motion.span>
  );
}

function ResourceTile({
  resource,
  tone,
  selected,
  onToggle,
}: {
  resource: SkillResource;
  tone: SkillLibraryTone;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.article
      data-testid="skill-resource-card"
      data-resource-id={resource.id}
      data-selected={selected ? "true" : "false"}
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: selected ? -3 : 0, scale: selected ? 1.012 : 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[8px] border",
        "transition-[background-color,border-color,box-shadow] duration-200",
        selected
          ? "border-[var(--tile-edge)] bg-[var(--tile-surface)]"
          : "border-[var(--border-2)] bg-[var(--card)]",
      )}
      style={{
        ...TONES[tone],
        boxShadow: selected
          ? "inset 0 0 0 2px var(--tile-edge), inset 0 2px 0 rgba(255,255,255,.85), 0 12px 22px var(--tile-shadow)"
          : "inset 0 1px 0 rgba(255,255,255,.85), 0 8px 18px rgba(45,62,96,.08)",
      }}
    >
      <button
        type="button"
        data-testid={`skill-select-${resource.id}`}
        aria-pressed={selected}
        aria-label={selected ? `从考察清单移除 ${resource.title}` : `加入考察清单 ${resource.title}`}
        onClick={onToggle}
        className="group block min-h-[218px] w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-focus)]"
      >
        <span className="relative block">
          <ResourceScene resource={resource} selected={selected} />
          <span
            className={cn(
              "absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border transition-[transform,background-color,color,border-color] duration-200",
              "shadow-[inset_0_2px_0_rgba(255,255,255,.72),0_4px_8px_rgba(45,62,96,.12)]",
              selected
                ? "scale-105 border-[var(--tile-ink)] bg-[var(--tile-ink)] text-white"
                : "border-[var(--border)] bg-white/85 text-[var(--text-3)] group-hover:border-[var(--tile-edge)] group-hover:text-[var(--tile-ink)]",
            )}
          >
            {selected ? <Check size={17} strokeWidth={2.8} /> : <span className="h-2.5 w-2.5 rounded-full border border-current" />}
          </span>
        </span>

        <span className="block px-3.5 pb-3 pt-3">
          <span className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 text-[14px] font-semibold leading-5 text-[var(--text)]">{resource.title}</span>
            <span className="shrink-0 rounded-full bg-[var(--tile-strong)] px-2 py-0.5 text-[9px] font-semibold text-[var(--tile-ink)]">
              {selected ? "已选" : resource.kind}
            </span>
          </span>
          <span className="mt-1.5 line-clamp-2 min-h-10 text-[11px] leading-5 text-[var(--text-2)]">
            {resource.description}
          </span>
          <span className="mt-2 flex flex-wrap gap-1">
            {resource.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-[var(--rg-hover-bg)] px-2 py-0.5 text-[9px] text-[var(--text-2)]">
                {tag}
              </span>
            ))}
          </span>
        </span>
      </button>

      <div className="flex min-h-11 items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--tile-edge)_54%,var(--border-2))] px-3.5 py-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[9px] text-[var(--text-3)]">
          <BadgeCheck size={11} className="shrink-0 text-[var(--tile-ink)]" aria-hidden />
          <span className="truncate">{resource.source}</span>
        </span>
        <a
          data-testid="skill-resource-link"
          data-resource-id={resource.id}
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${resource.title}，在新标签页打开外部资源`}
          className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-[8px] px-2 text-[10px] font-semibold text-[var(--tile-ink)] transition-[background-color,transform] hover:bg-[var(--tile-strong)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-focus)]"
        >
          查看来源 <ExternalLink size={12} aria-hidden />
        </a>
      </div>

      <AnimatePresence>{selected && <SelectionBurst key="burst" />}</AnimatePresence>
    </motion.article>
  );
}

function CategoryTile({
  section,
  expanded,
  onToggle,
}: {
  section: SkillLibrarySection;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      data-testid={`skill-category-${section.id}`}
      data-active={expanded ? "true" : "false"}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={`skill-section-panel-${section.id}`}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "group relative flex min-h-[104px] min-w-0 items-center gap-3 overflow-hidden rounded-[8px] border p-3 text-left",
        "transition-[border-color,box-shadow,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-focus)]",
        "bg-[var(--tile-surface)] hover:-translate-y-0.5",
        expanded ? "border-[var(--tile-edge)]" : "border-white/80",
      )}
      style={{
        ...TONES[section.tone],
        boxShadow: expanded
          ? "inset 0 0 0 2px var(--tile-edge), inset 0 2px 0 rgba(255,255,255,.8), 0 11px 20px var(--tile-shadow)"
          : "inset 0 2px 0 rgba(255,255,255,.8), 0 7px 15px rgba(45,62,96,.08)",
      }}
    >
      <SkillArtwork src={SECTION_ARTWORK[section.id]} size="category" eager />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-5 text-[var(--text)]">{section.title}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-[var(--text-2)]">{section.eyebrow}</span>
        <span className="mt-2 inline-flex rounded-full bg-white/62 px-2 py-0.5 text-[9px] font-semibold text-[var(--tile-ink)]">
          {section.resources.length} 个入口
        </span>
      </span>
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border",
          expanded
            ? "border-[var(--tile-ink)] bg-[var(--tile-ink)] text-white"
            : "border-white/90 bg-white/62 text-[var(--tile-ink)]",
        )}
      >
        {expanded ? <Check size={15} strokeWidth={2.7} /> : <ChevronDown size={15} className="-rotate-90" />}
      </span>
    </motion.button>
  );
}

function SectionDisclosure({
  section,
  resources,
  expanded,
  selectedIds,
  onToggleSection,
  onToggleResource,
}: {
  section: SkillLibrarySection;
  resources: SkillResource[];
  expanded: boolean;
  selectedIds: Set<string>;
  onToggleSection: () => void;
  onToggleResource: (resource: SkillResource) => void;
}) {
  const panelId = `skill-section-panel-${section.id}`;

  return (
    <section
      id={`skill-section-${section.id}`}
      data-testid={`skill-section-${section.id}`}
      className="scroll-mt-24 border-t border-[var(--border)] pt-2"
      style={TONES[section.tone]}
    >
      <button
        type="button"
        onClick={onToggleSection}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="group flex min-h-[68px] w-full items-center gap-3 rounded-[8px] px-1.5 text-left transition-colors hover:bg-[var(--rg-hover-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-focus)]"
      >
        <SkillArtwork src={SECTION_ARTWORK[section.id]} size="section" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold text-[var(--text)]">{section.title}</span>
            <span className="text-[10px] font-semibold text-[var(--tile-ink)]">{section.eyebrow}</span>
          </span>
          <span className="mt-0.5 block text-[11px] leading-5 text-[var(--text-2)]">{section.description}</span>
        </span>
        <span className="text-num rounded-full bg-[var(--tile-surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--tile-ink)]">
          {resources.length}
        </span>
        <ChevronDown
          size={17}
          aria-hidden
          className={cn("text-[var(--text-3)] transition-transform duration-200", !expanded && "-rotate-90")}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="pb-6 pt-3"
          >
            <motion.div
              layout
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 228px), 1fr))" }}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {resources.map((resource) => (
                  <ResourceTile
                    key={resource.id}
                    resource={resource}
                    tone={section.tone}
                    selected={selectedIds.has(resource.id)}
                    onToggle={() => onToggleResource(resource)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function SkillLibraryClient() {
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState<Set<SkillLibrarySection["id"]>>(
    () => new Set(["directories"]),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState("考察清单为空");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));

  const filteredSections = useMemo(
    () => SKILL_LIBRARY_SECTIONS
      .map((section) => ({
        section,
        resources: section.resources.filter((resource) => (
          matches(resource, deferredQuery) && (!selectedOnly || selectedIds.has(resource.id))
        )),
      }))
      .filter(({ resources }) => resources.length > 0),
    [deferredQuery, selectedIds, selectedOnly],
  );

  const resultCount = filteredSections.reduce((total, item) => total + item.resources.length, 0);

  const setSearch = (value: string) => {
    setQuery(value);
    const normalized = value.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) {
      setOpenSections(new Set(SKILL_LIBRARY_SECTIONS.map((section) => section.id)));
      return;
    }
    const matchingSections = SKILL_LIBRARY_SECTIONS
      .filter((section) => section.resources.some((resource) => matches(resource, normalized)))
      .map((section) => section.id);
    setOpenSections(new Set(matchingSections));
  };

  const toggleSection = (id: SkillLibrarySection["id"]) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleResource = (resource: SkillResource) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(resource.id)) {
        next.delete(resource.id);
        setSelectionMessage(`${resource.title} 已从考察清单移除`);
      } else {
        next.add(resource.id);
        setSelectionMessage(`${resource.title} 已加入考察清单`);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMessage("考察清单已清空");
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-5 md:px-7 md:py-7 lg:px-9">
      <header className="border-b border-[var(--border)] pb-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <TeacherFeatureIcon name="skills" size={58} fallback={LibraryBig} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[24px] font-semibold leading-tight text-[var(--text)]">技能库</h1>
                <span className="rounded-full bg-[var(--accent-tint)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent-focus)]">
                  外部资源导航
                </span>
              </div>
              <p className="mt-1.5 max-w-[72ch] text-[13px] leading-[1.75] text-[var(--text-2)]">
                为教学、教研与课程设计集中整理 Skill 发现入口。这里不执行安装，也不代表校方审定；进入源码页后，请先检查权限、脚本、许可证与维护状态。
              </p>
            </div>
          </div>

          <div className="w-full xl:max-w-[520px]">
            <label htmlFor="skill-library-search" className="sr-only">搜索技能资源</label>
            <div className="flex h-[48px] items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--card)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_5px_14px_rgba(42,62,98,0.07)] focus-within:border-[var(--accent-focus)] focus-within:ring-2 focus-within:ring-[var(--accent-tint)]">
              <Search size={17} className="shrink-0 text-[var(--text-3)]" aria-hidden />
              <input
                id="skill-library-search"
                value={query}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索教学、课程、量规、仓库或来源"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="清空搜索"
                  title="清空搜索"
                  className="grid h-9 w-9 place-items-center rounded-[8px] text-[var(--text-3)] transition-colors hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-focus)]"
                >
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-3)]">
              <span role="status" aria-live="polite">
                {deferredQuery || selectedOnly ? `当前显示 ${resultCount} 个资源` : `共 ${SKILL_LIBRARY_RESOURCE_COUNT} 个已登记入口`}
              </span>
              <span className="inline-flex items-center gap-1">
                <BadgeCheck size={12} aria-hidden /> 链接核验于 {SKILL_LINK_AUDIT_DATE}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="skill-library-categories" className="py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="skill-library-categories" className="text-[14px] font-semibold text-[var(--text)]">资源分区</h2>
          <span className="text-[11px] text-[var(--text-3)]">4 个分区</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* Keep wayfinding stable while search and checklist filters update the resource panels below. */}
          {SKILL_LIBRARY_SECTIONS.map((section) => (
            <CategoryTile
              key={section.id}
              section={section}
              expanded={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
      </section>

      <section aria-label="考察清单" className="mb-2 flex flex-col gap-3 border-y border-[var(--border)] py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[var(--ok-bg)] text-[var(--ok-ink)] shadow-[inset_0_2px_0_rgba(255,255,255,.72)]">
            <ListChecks size={19} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-[13px] font-semibold text-[var(--text)]">考察清单</h2>
              <span data-testid="skill-selection-count" className="text-num text-[11px] font-semibold text-[var(--ok-ink)]">
                {selectedIds.size} 项
              </span>
            </div>
            <p className="text-[10px] leading-4 text-[var(--text-3)]">仅用于对比审查，不会安装或执行 Skill。</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="资源显示范围" className="inline-flex rounded-[8px] border border-[var(--border)] bg-[var(--rg-control-bg)] p-1">
            <button
              type="button"
              aria-pressed={!selectedOnly}
              onClick={() => setSelectedOnly(false)}
              className={cn(
                "min-h-[32px] rounded-[6px] px-3 text-[10px] font-semibold transition-[background-color,color,transform] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-focus)]",
                !selectedOnly ? "bg-[var(--card)] text-[var(--text)] shadow-[0_2px_6px_rgba(45,62,96,.1)]" : "text-[var(--text-2)]",
              )}
            >
              全部
            </button>
            <button
              type="button"
              aria-pressed={selectedOnly}
              onClick={() => setSelectedOnly(true)}
              className={cn(
                "min-h-[32px] rounded-[6px] px-3 text-[10px] font-semibold transition-[background-color,color,transform] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-focus)]",
                selectedOnly ? "bg-[var(--ok-bg)] text-[var(--ok-ink)] shadow-[0_2px_6px_rgba(45,62,96,.1)]" : "text-[var(--text-2)]",
              )}
            >
              仅看已选
            </button>
          </div>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="min-h-[40px] rounded-[8px] px-3 text-[10px] font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-focus)]"
            >
              清空
            </button>
          )}
        </div>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{selectionMessage}</span>
      </section>

      <div aria-label="技能资源分区">
        {filteredSections.map(({ section, resources }) => (
          <SectionDisclosure
            key={section.id}
            section={section}
            resources={resources}
            expanded={openSections.has(section.id)}
            selectedIds={selectedIds}
            onToggleSection={() => toggleSection(section.id)}
            onToggleResource={toggleResource}
          />
        ))}
      </div>

      {(deferredQuery || selectedOnly) && filteredSections.length === 0 && (
        <section className="border-y border-[var(--border)] py-12 text-center" aria-label="无筛选结果">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] bg-[var(--rg-control-bg)] text-[var(--text-3)]">
            {selectedOnly && !deferredQuery ? <ListChecks size={20} aria-hidden /> : <Search size={20} aria-hidden />}
          </div>
          <h2 className="mt-3 text-[15px] font-semibold text-[var(--text)]">
            {selectedOnly && !deferredQuery ? "考察清单还是空的" : "没有匹配的资源"}
          </h2>
          <p className="mt-1 text-[12px] text-[var(--text-2)]">
            {selectedOnly && !deferredQuery ? "返回全部资源，选择需要进一步核验的 Skill。" : "尝试课程、教学、量规、GitHub 等更短的关键词。"}
          </p>
          <button
            type="button"
            onClick={() => {
              if (deferredQuery) setSearch("");
              else setSelectedOnly(false);
            }}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-[8px] bg-[var(--accent-focus)] px-4 text-[12px] font-semibold text-white transition-transform active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-focus)]"
          >
            {selectedOnly && !deferredQuery ? "查看全部资源" : "清空搜索"}
          </button>
        </section>
      )}

      <footer className="mt-3 flex items-start gap-3 border-t border-[var(--border)] py-5 text-[12px] leading-[1.7] text-[var(--text-2)]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[var(--warn-bg)] text-[var(--warn-ink)]">
          <ShieldAlert size={18} aria-hidden />
        </span>
        <p className="max-w-[84ch]">
          <strong className="text-[var(--text)]">安装前检查：</strong>
          本页的“已核验”只表示链接在登记日期可访问，不代表 Skill 已安装、内容安全、适合本校或得到校方推荐。请审阅 SKILL.md、脚本、外部下载、权限范围、许可证与最近提交；未经审核不要接触学生隐私或校内敏感数据。
        </p>
      </footer>
      </div>
    </MotionConfig>
  );
}
