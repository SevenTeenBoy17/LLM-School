"use client";

import Image from "next/image";
import { useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";

type IconLike = ComponentType<{ size?: number; className?: string }>;

export type TeacherFeatureGlyphName =
  | "agent-workspace"
  | "conversations"
  | "verified-quality"
  | "published-toolbox"
  | "research-review"
  | "lesson-plan"
  | "document-edit"
  | "courseware-board"
  | "lesson-test"
  | "paper-polish"
  | "courseware-art"
  | "source-database"
  | "class-mastery"
  | "pending-review"
  | "knowledge-book"
  | "fair-use"
  | "prompt-lesson-plan"
  | "prompt-lesson-hook"
  | "prompt-unit-design"
  | "prompt-pbl"
  | "prompt-reading-levels"
  | "prompt-slide-outline"
  | "prompt-study-sheet"
  | "prompt-lecture-script"
  | "prompt-tiered-homework"
  | "prompt-test-builder"
  | "prompt-mistake-analysis"
  | "prompt-essay-feedback"
  | "prompt-report-comment"
  | "prompt-socratic"
  | "prompt-concept-explain"
  | "prompt-abstract-polish"
  | "prompt-literature-review"
  | "prompt-teaching-reflection"
  | "prompt-school-notice"
  | "prompt-parent-meeting"
  | "prompt-parent-dialogue"
  | "prompt-class-meeting"
  | "prompt-library"
  | "model-marketplace"
  | "category-all"
  | "category-teaching"
  | "category-courseware"
  | "category-assessment"
  | "category-research"
  | "category-learning"
  | "category-admin"
  | "category-featured";

const PROMPT_GLYPHS: Record<string, TeacherFeatureGlyphName> = {
  "pv2-lesson-plan": "prompt-lesson-plan",
  "pv2-lesson-hook": "prompt-lesson-hook",
  "pv2-unit-design": "prompt-unit-design",
  "pv2-pbl": "prompt-pbl",
  "pv2-text-level": "prompt-reading-levels",
  "pv2-ppt-outline": "prompt-slide-outline",
  "pv2-study-sheet": "prompt-study-sheet",
  "pv2-lecture-script": "prompt-lecture-script",
  "pv2-tiered-hw": "prompt-tiered-homework",
  "pv2-quiz-params": "prompt-test-builder",
  "pv2-variant-drill": "prompt-mistake-analysis",
  "pv2-essay-feedback": "prompt-essay-feedback",
  "pv2-comments": "prompt-report-comment",
  "pv2-socratic": "prompt-socratic",
  "pv2-mistake-explain": "prompt-concept-explain",
  "pv2-abstract-polish": "prompt-abstract-polish",
  "pv2-lit-review": "prompt-literature-review",
  "pv2-teach-reflect": "prompt-teaching-reflection",
  "pv2-notice": "prompt-school-notice",
  "pv2-parent-meeting": "prompt-parent-meeting",
  "pv2-parent-talk": "prompt-parent-dialogue",
  "pv2-class-meeting": "prompt-class-meeting",
};

const PROMPT_CATEGORY_GLYPHS: Record<string, TeacherFeatureGlyphName> = {
  all: "category-all",
  teach: "category-teaching",
  ppt: "category-courseware",
  quiz: "category-assessment",
  research: "category-research",
  study: "category-learning",
  admin: "category-admin",
  star: "category-featured",
  featured: "category-featured",
};

const AGENT_GLYPHS: Record<string, TeacherFeatureGlyphName> = {
  BookOpen: "lesson-plan",
  FileText: "paper-polish",
  BarChart3: "class-mastery",
  Users: "prompt-class-meeting",
  MessageCircle: "conversations",
  ShieldCheck: "verified-quality",
  CheckSquare: "pending-review",
  Presentation: "courseware-board",
};

const DASHBOARD_GLYPHS: Record<string, TeacherFeatureGlyphName> = {
  "today-chat": "conversations",
  assistant: "agent-workspace",
  class: "class-mastery",
  grading: "pending-review",
  kb: "knowledge-book",
  quota: "fair-use",
};

export function featureGlyphForPrompt(promptId: string): TeacherFeatureGlyphName {
  return PROMPT_GLYPHS[promptId] ?? "prompt-library";
}

export function featureGlyphForPromptCategory(categoryId: string): TeacherFeatureGlyphName {
  return PROMPT_CATEGORY_GLYPHS[categoryId] ?? "category-all";
}

export function featureGlyphForAgent(iconName: string): TeacherFeatureGlyphName {
  return AGENT_GLYPHS[iconName] ?? "agent-workspace";
}

export function featureGlyphForDashboardStat(statId: string): TeacherFeatureGlyphName {
  return DASHBOARD_GLYPHS[statId] ?? "verified-quality";
}

export function TeacherFeatureGlyph({
  name,
  size = 48,
  className,
  fallback: Fallback,
  priority = false,
}: {
  name: TeacherFeatureGlyphName;
  size?: number;
  className?: string;
  fallback?: IconLike;
  priority?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const sharedProps = {
    className: cn("teacher-feature-glyph", broken && "teacher-feature-glyph-fallback", className),
    style: {
      width: size,
      height: size,
      display: "inline-grid",
      flex: "none",
      placeItems: "center",
      overflow: "visible",
      border: 0,
      background: "transparent",
      boxShadow: "none",
      lineHeight: 0,
      transformOrigin: "center",
      filter: "drop-shadow(0 4px 6px rgba(31, 48, 82, 0.16))",
    },
    "data-teacher-feature-glyph": name,
    "aria-hidden": true,
  } as const;

  if (broken) {
    return Fallback ? (
      <span {...sharedProps} data-fallback="true">
        <Fallback size={Math.round(size * 0.56)} />
      </span>
    ) : null;
  }

  return (
    <span {...sharedProps}>
      <Image
        src={`/art/teacher-feature-icons-v2/${name}.png`}
        alt=""
        width={320}
        height={320}
        priority={priority}
        unoptimized
        draggable={false}
        className="teacher-feature-glyph-image"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          maxWidth: "none",
          objectFit: "contain",
          background: "transparent",
          userSelect: "none",
        }}
        onError={() => setBroken(true)}
      />
    </span>
  );
}
