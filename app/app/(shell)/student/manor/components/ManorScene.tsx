"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Droplets, FlaskConical, Lightbulb, MessageSquareText, Telescope, Trees } from "lucide-react";
import type { ManorExperienceSnapshot } from "../model/manor-experience";
import { sceneStatusLabel } from "../model/manor-experience";
import styles from "../manor.module.css";

const NODE_ICONS: Record<string, LucideIcon> = {
  question: Droplets,
  method: Trees,
  observe: Telescope,
  analyse: BarChart3,
  explain: MessageSquareText,
  act: FlaskConical,
  reflect: Lightbulb,
};

const FIELD_CORNERS = {
  topLeft: { x: 39.9, y: 24.1 },
  topRight: { x: 84.4, y: 39.2 },
  bottomRight: { x: 63.5, y: 89.0 },
  bottomLeft: { x: 22.2, y: 56.2 },
};

function pointOnField(column: number, row: number) {
  const u = column / 4;
  const v = row / 4;
  const topX = FIELD_CORNERS.topLeft.x + (FIELD_CORNERS.topRight.x - FIELD_CORNERS.topLeft.x) * u;
  const topY = FIELD_CORNERS.topLeft.y + (FIELD_CORNERS.topRight.y - FIELD_CORNERS.topLeft.y) * u;
  const bottomX = FIELD_CORNERS.bottomLeft.x + (FIELD_CORNERS.bottomRight.x - FIELD_CORNERS.bottomLeft.x) * u;
  const bottomY = FIELD_CORNERS.bottomLeft.y + (FIELD_CORNERS.bottomRight.y - FIELD_CORNERS.bottomLeft.y) * u;
  return { x: topX + (bottomX - topX) * v, y: topY + (bottomY - topY) * v };
}

function plotStyle(index: number) {
  const row = Math.floor(index / 4);
  const column = index % 4;
  const points = [
    pointOnField(column, row),
    pointOnField(column + 1, row),
    pointOnField(column + 1, row + 1),
    pointOnField(column, row + 1),
  ];
  const center = pointOnField(column + 0.5, row + 0.5);
  return {
    "--plot-shape": `polygon(${points.map((point) => `${point.x}% ${point.y}%`).join(", ")})`,
    "--plot-label-x": `${center.x}%`,
    "--plot-label-y": `${center.y}%`,
  } as CSSProperties;
}

interface ManorSceneProps {
  snapshot: ManorExperienceSnapshot;
  zoom: number;
  pan: { x: number; y: number };
  onNode: (nodeId: string, trigger: HTMLButtonElement) => void;
  onPlot: (plotIndex: number, nodeId: string, trigger: HTMLButtonElement) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function ManorScene({ snapshot, zoom, pan, onNode, onPlot, onPointerDown, onPointerMove, onPointerUp }: ManorSceneProps) {
  const worldStyle = {
    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
  } satisfies CSSProperties;

  return (
    <section
      className={styles.worldViewport}
      aria-label="校园节水学习庄园场景"
      data-testid="manor-scene"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={styles.world} style={worldStyle} data-testid="manor-world">
        <div className={styles.sceneImage} aria-hidden="true" />
        <div className={styles.sceneShade} aria-hidden="true" />

        {snapshot.sceneNodes.map((node) => {
          const Icon = NODE_ICONS[node.milestoneId] ?? Lightbulb;
          return (
            <button
              key={node.id}
              type="button"
              className={styles.sceneNode}
              style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
              data-status={node.status}
              data-testid={`scene-node-${node.milestoneId}`}
              aria-label={`${node.title}，${sceneStatusLabel(node.status)}，${node.nextAction}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => onNode(node.id, event.currentTarget)}
            >
              <span className={styles.nodeIcon} aria-hidden="true"><Icon size={20} strokeWidth={2.4} /></span>
              <span className={styles.nodeCopy}>
                <strong>{node.shortLabel}</strong>
                <small>{sceneStatusLabel(node.status)}</small>
              </span>
              {node.evidenceCount > 0 && <span className={styles.nodeCount} aria-label={`${node.evidenceCount} 条证据`}>{node.evidenceCount}</span>}
            </button>
          );
        })}

        <div className={styles.plotGrid} data-testid="learning-plot-grid" aria-label="十六块学习证据地块">
          {Array.from({ length: 16 }, (_, index) => {
            const node = snapshot.sceneNodes[index % snapshot.sceneNodes.length];
            return (
              <button
                key={index}
                type="button"
                className={styles.plotHotspot}
                style={plotStyle(index)}
                data-plot={index + 1}
                data-status={node.status}
                aria-label={`学习地块 ${index + 1}，关联${node.title}，${sceneStatusLabel(node.status)}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => onPlot(index, node.id, event.currentTarget)}
              >
                <span aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
