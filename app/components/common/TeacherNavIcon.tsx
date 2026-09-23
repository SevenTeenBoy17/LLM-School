"use client";

import Image from "next/image";
import { useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";

type IconLike = ComponentType<{ size?: number; className?: string }>;

export type TeacherNavIconName =
  | "dashboard"
  | "class"
  | "manor-evidence"
  | "chat"
  | "prompts"
  | "knowledge"
  | "research-center"
  | "research-paper"
  | "research-prep"
  | "research-courseware"
  | "research-artifacts"
  | "hub"
  | "agent"
  | "skills";

type AtlasCell = {
  column: number;
  row: number;
};

/**
 * Teacher navigation icon atlas, ordered exactly as documented in
 * public/art/icons/teacher-nav-atlas-v1.json. Mapping by nav id keeps the two
 * FileText destinations (paper and courseware) visually distinct.
 */
const ATLAS_CELL: Record<TeacherNavIconName, AtlasCell> = {
  dashboard: { column: 0, row: 0 },
  class: { column: 1, row: 0 },
  "manor-evidence": { column: 2, row: 0 },
  chat: { column: 3, row: 0 },
  prompts: { column: 0, row: 1 },
  knowledge: { column: 1, row: 1 },
  "research-center": { column: 2, row: 1 },
  "research-paper": { column: 3, row: 1 },
  "research-prep": { column: 0, row: 2 },
  "research-courseware": { column: 1, row: 2 },
  "research-artifacts": { column: 2, row: 2 },
  hub: { column: 3, row: 2 },
  agent: { column: 0, row: 3 },
  // The atlas keeps three spare system objects on its last row. The tactile
  // adjustment controls are used here as a semantic Skill-composition object.
  skills: { column: 2, row: 3 },
};

export function hasTeacherNavIcon(navId: string): navId is TeacherNavIconName {
  return Object.prototype.hasOwnProperty.call(ATLAS_CELL, navId);
}

type TeacherObjectIconProps = {
  name: TeacherNavIconName;
  size: number;
  active?: boolean;
  className?: string;
  fallback?: IconLike;
};

function TeacherObjectIcon({
  name,
  size,
  active = false,
  className,
  fallback: Fallback,
  usage,
}: TeacherObjectIconProps & { usage: "navigation" | "feature" }) {
  const [broken, setBroken] = useState(false);
  const cell = ATLAS_CELL[name];
  const usageClass = usage === "navigation" ? "teacher-nav-icon" : "teacher-feature-icon";
  const dataAttribute = usage === "navigation"
    ? { "data-teacher-nav-icon": name }
    : { "data-teacher-feature-icon": name };

  if (broken) {
    return Fallback ? (
      <span
        className={cn(
          "teacher-object-icon teacher-object-icon-fallback",
          usageClass,
          usage === "navigation" && "teacher-nav-icon-fallback",
          usage === "feature" && "teacher-feature-icon-fallback",
          active && usage === "navigation" && "teacher-nav-icon-active",
          className,
        )}
        style={{ width: size, height: size }}
        {...dataAttribute}
        aria-hidden
      >
        <Fallback size={Math.round(size * 0.58)} />
      </span>
    ) : null;
  }

  return (
    <span
      className={cn(
        "teacher-object-icon",
        usageClass,
        active && usage === "navigation" && "teacher-nav-icon-active",
        className,
      )}
      style={{
        width: size,
        height: size,
      }}
      {...dataAttribute}
      aria-hidden
    >
      <span
        className={cn(
          "teacher-object-icon-atlas",
          usage === "navigation" ? "teacher-nav-icon-atlas" : "teacher-feature-icon-atlas",
        )}
        style={{
          width: size * 4,
          height: size * 4,
          left: -cell.column * size,
          top: -cell.row * size,
        }}
      >
        <Image
          src="/art/icons/teacher-nav-atlas-v2.webp"
          alt=""
          width={896}
          height={896}
          unoptimized
          onError={() => setBroken(true)}
          className="h-full w-full max-w-none object-contain"
        />
      </span>
    </span>
  );
}

export function TeacherNavIcon({
  name,
  size = 32,
  active = false,
  className,
  fallback,
}: Omit<TeacherObjectIconProps, "size"> & { size?: number }) {
  return (
    <TeacherObjectIcon
      usage="navigation"
      name={name}
      size={size}
      active={active}
      className={className}
      fallback={fallback}
    />
  );
}

export function TeacherFeatureIcon({
  name,
  size = 44,
  className,
  fallback,
}: Omit<TeacherObjectIconProps, "size" | "active"> & { size?: number }) {
  return (
    <TeacherObjectIcon
      usage="feature"
      name={name}
      size={size}
      className={className}
      fallback={fallback}
    />
  );
}
