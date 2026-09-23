export const MANOR_LAYOUT_SLOTS = [
  { id: "west-1", label: "花径入口", x: 30, y: 43 },
  { id: "west-2", label: "花径中段", x: 28, y: 54 },
  { id: "west-3", label: "花径南侧", x: 32, y: 65 },
  { id: "north-1", label: "草坪北侧", x: 48, y: 29 },
  { id: "north-2", label: "草坪东侧", x: 62, y: 29 },
  { id: "east-1", label: "工坊前庭", x: 83, y: 44 },
] as const;
export type ManorLayoutSlot = typeof MANOR_LAYOUT_SLOTS[number]["id"];
export interface ManorDecoration {
  id: string; partId: string; name: string; slotId: ManorLayoutSlot | null;
  acquiredAt: number; legacyPosition: boolean;
}
export interface ManorSceneSnapshot {
  layoutRevision: number;
  publication: { enabled: boolean; revision: number; classId: string | null };
  inventory: ManorDecoration[];
  catalog: Array<{ id: string; name: string; price: number; badgeGate: number; eligible: boolean }>;
  balance: number;
  neighbors: Array<{ id: string; name: string }>;
  classmateCount: number;
}
export type ManorSceneCommand =
  | { action: "purchase"; operationId: string; partId: string }
  | { action: "layout"; operationId: string; itemId: string; slotId: ManorLayoutSlot | null; expectedRevision: number }
  | { action: "publication"; operationId: string; enabled: boolean; expectedRevision: number; expectedClassId: string | null };
export const MANOR_DECORATION_ORDER = ["flower", "bush", "path", "tree", "bench", "pond", "house", "tower", "library"];
