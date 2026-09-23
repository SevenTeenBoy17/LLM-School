export type QuestStatus = "new" | "hot" | "continue" | "done";

export interface ExploreQuest {
  id: string;
  title: string;
  subject: string;
  icon: "function" | "language" | "atom" | "scroll" | "code" | "dna" | "flask" | "globe";
  accent: string;
  ink: string;
  durationMin: number;
  progress: number;
  model: { name: string; color: string };
  status: QuestStatus;
  href: string;
  evidence: string;
}

export interface ExploreTask {
  id: string;
  label: string;
  done: boolean;
  evidence: string;
  href: string;
}

export interface ExploreAchievement {
  id: string;
  label: string;
  icon: "flame" | "trophy" | "star" | "rocket" | "brain" | "medal";
  unlocked: boolean;
}

export interface ExploreProgress {
  /** 本周来过的天数——不要求连续、缺席不清零（方案 §3.3 禁机制：不得制造缺席负债感） */
  activeDays: number;
  weeklyPercent: number;
  masteryCoverage: number;
  vsYesterday: number;
  weeklyTrend: number[];
  questsDone: number;
  questsTotal: number;
  peerBand: string | null;
  peerComparisonStatus: "not_connected" | "available";
}

export interface ExploreSnapshot {
  generatedAt: number;
  user: { id: string; name: string; role: string; classId: string };
  progress: ExploreProgress;
  quests: ExploreQuest[];
  tasks: ExploreTask[];
  achievements: ExploreAchievement[];
  honestStates: Array<{ id: string; title: string; status: "connected" | "not_connected"; note: string }>;
  sourceSummary: {
    sessions: number;
    userMessages: number;
    assistantMessages: number;
    favorites: number;
    feedback: number;
    knowledgeFiles: number;
    integrityWeekly: number;
  };
}

// SUBJECT_ART（8 张 /illustrations/subject-*.webp 的映射）已删除。
// 学科图改由 components/explore/SubjectMark.tsx 的**纯几何 SVG** 承担——
// 方案 §6.4-4 的默认路径（未取得盲审与校方确认前不用拟人化形象资产）。
// 原位图仍在 git 历史里；若日后确认通过，恢复只需把 QuestCard 换回 <Image> 并取回文件。
