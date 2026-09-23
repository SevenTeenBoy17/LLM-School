import type { UserRole } from "@/lib/types";

export type DashboardTone = "blue" | "violet" | "cyan" | "green" | "red" | "gold";
export type DashboardStatus = "connected" | "estimated" | "not_connected";

export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  delta: string;
  icon: string;
  tone: DashboardTone;
}

export interface DashboardTrendPoint {
  day: string;
  primary: number;
  secondary: number;
}

export interface DashboardTrend {
  data: DashboardTrendPoint[];
  primaryLabel: string;
  secondaryLabel: string;
}

export interface DashboardModelShare {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface DashboardRecentChat {
  id: string;
  name: string;
  desc: string;
  time: string;
  color: string;
  icon: string;
  href: string;
}

export interface DashboardQuickAction {
  id: string;
  title: string;
  desc: string;
  gradient: string;
  icon: string;
  seed: string;
  href: string;
}

export interface DashboardCourse {
  id: string;
  time: string;
  name: string;
  room: string;
  roster: number;
  status: "done" | "current" | "upcoming" | "not_connected";
}

export interface DashboardTodo {
  id: string;
  title: string;
  source: string;
  urgent: boolean;
  due: string;
  href: string;
  status: "pending" | "done" | "not_connected";
}

export interface DashboardSafetyItem {
  id: string;
  name: string;
  value: string;
  ok: boolean;
  status: DashboardStatus;
}

export interface DashboardQuota {
  used: number;
  total: number;
  unit: string;
  percent: number;
  footnote: string;
  status: DashboardStatus;
}

export interface DashboardHonestState {
  id: string;
  title: string;
  status: DashboardStatus;
  note: string;
}

export interface DashboardClassOverview {
  status: DashboardStatus;
  className: string;
  avgMastery: number;
  pendingGrading: number;
  students: number;
  href: string;
}

export interface DashboardSourceSummary {
  sessions: number;
  userMessages: number;
  assistantMessages: number;
  favorites: number;
  feedback: number;
  knowledgeFiles: number;
  integrityWeekly: number;
  classStudents: number;
  pendingGrading: number;
  users: number;
  agents: number;
  auditRows: number;
  tickets: number;
}

export interface DashboardWorkspace {
  title: string;
  subtitle: string;
  badge: string;
  stats: DashboardStat[];
  trend: DashboardTrend;
  modelShare: DashboardModelShare[];
  modelTotal: number;
  quota: DashboardQuota;
  safetyItems: DashboardSafetyItem[];
  courses: DashboardCourse[];
  todos: DashboardTodo[];
  honestStates: DashboardHonestState[];
  sourceSummary: DashboardSourceSummary;
}

export interface DashboardTeacherWorkspace extends DashboardWorkspace {
  classOverview: DashboardClassOverview | null;
  recentChats: DashboardRecentChat[];
  quickActions: DashboardQuickAction[];
  recommendedPrompts: string[];
}

export interface DashboardAdminQueueItem {
  id: string;
  name: string;
  desc: string;
  time: string;
  urgent: boolean;
  href: string;
}

export interface DashboardAuditPreviewItem {
  id: string;
  who: string;
  op: string;
  risk: "high" | "mid";
  time: string;
  href: string;
}

export interface DashboardAdminWorkspace extends DashboardWorkspace {
  collegeDistribution: Array<{ name: string; value: number; color: string }>;
  systemHealth: Array<{ name: string; state: "online" | "busy"; latency: string }>;
  queueItems: DashboardAdminQueueItem[];
  auditPreview: DashboardAuditPreviewItem[];
}

export interface DashboardSnapshot {
  generatedAt: number;
  user: { id: string; name: string; role: UserRole; classId: string };
  teacher: DashboardTeacherWorkspace;
  admin: DashboardAdminWorkspace | null;
}
