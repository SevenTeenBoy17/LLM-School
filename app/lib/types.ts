// Domain types for EduAI Prism Platform

export type ModelProvider = "chatgpt" | "claude" | "gpt-image" | "gemini" | "minimax" | "deepseek" | "glm";

export type ModelStatus = "selected" | "available" | "request" | "disabled" | "maintain";

export interface ModelCardItem {
  id: ModelProvider;
  key: string;
  name: string;
  description: string;
  // `color` 字段已删：全站无人读取（唯二的 `.color` 命中分别属于 DashboardModelShare
  // 与 ExploreQuest.model，是另外的类型）。与 USAGE_SHARE.color 同一类——
  // 类型里带着、却从未被渲染过的颜色字段，改它不如删它。
  gradient: [string, string];
  tags: string[];
  scenarios: string[];
  status: ModelStatus;
  actionText: string;
  contextWindow: string;
  capabilities: ("text" | "long-text" | "vision" | "image-gen" | "code" | "chinese")[];
}

export type UserRole = "teacher" | "student" | "admin" | "researcher" | "college-admin";

// 学段（用于学生端语气/防代写严格度分级；评审 P1-4 / summit）：小学 / 初中 / 高中
export type Stage = "primary" | "junior" | "senior";

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  avatar?: string;
  email: string;
  permissions: string[];
}

export type PromptCategory =
  | "all" | "teach" | "ppt" | "quiz" | "research" | "study" | "admin" | "star" | "featured";

export type DifficultyLevel = "入门" | "进阶" | "专家";

export interface PromptVariable {
  key: string;
  defaultValue: string;
  placeholder?: string;
}

export interface PromptItem {
  id: string;
  category: PromptCategory;
  icon: string;
  gradient: string;
  title: string;
  scene: string;
  role: string;
  recommendedModel: ModelProvider;
  level: DifficultyLevel;
  description: string;
  uses: number;
  favorites: number;
  score: number;
  featured?: boolean;
  status?: "pub" | "draft";
  variables?: PromptVariable[];
  body?: string;
  outputExample?: string;
}

export type AgentStatus = "draft" | "review" | "pub" | "disabled";
/** 教学产物（备课工作区 V1）：教师会话中的长结构化回复自动归档为个人产物。
 *  V1 仅私有（visibility 恒 private）——「对学生可见」要等学生侧呈现面一起上（V2），
 *  先造开关后造效果属承诺不存在的路径。 */
export interface ArtifactItem {
  id: string;
  ownerId: string;
  sessionId: string;
  messageId: string;
  title: string;
  content: string;
  /** V2：private=仅本人；class=对发布时教师所在班级的学生可见。 */
  visibility: "private" | "class";
  /** 发布目标班级。**发布时由服务端从教师会话取**（RBAC 服务端权威），撤回时清空。 */
  classId?: string;
  createdAt: number;
}

/** 智能体来源分级（受管目录范式的 K-12 改造）：school=校方审定，teacher=教师自建。
 *  没有 community 级——未过审的对学生一律不可见，而不是打标后放行。
 *  可选字段：旧库行没有该值时 UI 不渲染任何徽标（数据缺席则主张缺席，不猜）。 */
export type AgentOrigin = "school" | "teacher";

export interface AgentItem {
  id: string;
  name: string;
  category: "教学" | "科研" | "行政" | "学习";
  icon: string;
  gradient: string;
  description: string;
  systemPrompt?: string;
  capabilities: string[];
  recommendedModel: ModelProvider;
  knowledgeBase: string;
  calls: number;
  score: number;
  status: AgentStatus;
  origin?: AgentOrigin;
  creator: string;
  unread?: number;
}

export type FileType = "PDF" | "DOC" | "PPT" | "XLS" | "IMG" | "TXT";
export type FileStatus = "done" | "proc" | "wait" | "err";
export type Scope = "全校" | "学院" | "教师" | "课程成员" | "仅本人";

export type RiskLevel = "low" | "mid" | "high";
export type AuditState = "handled" | "pending" | "ignored" | "mid" | "high";

export interface AuditRow {
  when: string;
  who: string;
  role: string;
  op: string;
  resource: string;
  risk: RiskLevel;
  state: AuditState;
}

export interface CollegeUsage {
  name: string;
  value: number;
  color: string;
}

/**
 * 漏斗分段。
 *
 * 之所以要有这个显式类型：`AdoptionFunnel` 组件原本把 prop 声明成 `typeof ADOPTION_FUNNEL`，
 * 也就是**让示例数据反过来定义组件的公开契约**。方向是反的——示例应当符合类型，
 * 而不是定义类型。这在示例数组加上 `as const` 的那一刻就暴露了：字面量类型被收窄，
 * 服务端来的真实数据立刻不再可赋值。
 */
export interface FunnelStage {
  stage: string;
  value: number;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId?: ModelProvider;
  source?: "remote" | "local" | "local-fallback" | "safety" | "care" | "integrity-scaffold";
  timestamp: number;
  thinking?: boolean;
  streaming?: boolean;
  references?: { name: string; meta: string }[];
  durationMs?: number;
  /** V3 归档回执：该回复已自动存入教学产物时由 done 事件携带的产物 id（服务端真值）。 */
  artifactId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  modelId: ModelProvider;
  agentId?: string;
  rounds: number;
  pinned?: boolean;
}

export type AssistantRole = "teacher" | "student" | "research" | "admin";
