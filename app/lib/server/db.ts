// 仅服务端使用（被 route handlers 引用，Node runtime）；proxy(edge) 不引用本模块。
// 持久化：Node 内置 node:sqlite（DatabaseSync，同步 API），落库于 .data/eduai.sqlite。
// 相比旧的 JSON 文件 + 进程级缓存：SQLite 是磁盘上的单一真相源，跨路由/跨连接写入即时可见，
// 根治「进程级 cache 跨路由需重启」的问题；并发由 SQLite(WAL) 处理。公开 API 与签名保持不变。
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import type { SessionUser } from "@/lib/server/authToken";
import { verifyPassword, hashPassword, genSalt } from "@/lib/server/password";
import { KNOWLEDGE_POINTS } from "@/lib/knowledgePoints";
import { MANOR_ARTIFACT_SELECT, publicManorArtifact, type ManorArtifactRecord } from "@/lib/manor/artifacts";
import { gradientCss, legacyGradientToKey, isGradientKey, DEFAULT_GRADIENT_KEY, chartColor } from "@/lib/data/gradientKeys";
import { isProd } from "@/lib/server/env";
import { detectSubject } from "@/lib/subject";
import { PROMPTS as SEED_PROMPTS, PROMPT_SEED_VERSION } from "@/lib/data/prompts";
import { AGENTS as SEED_AGENTS } from "@/lib/data/agents";
import type { PromptItem, AgentItem } from "@/lib/types";
import type { ExploreAchievement, ExploreProgress, ExploreQuest, ExploreSnapshot } from "@/lib/data/explore";
import type {
  DashboardAdminWorkspace,
  DashboardCourse,
  DashboardModelShare,
  DashboardQuickAction,
  DashboardRecentChat,
  DashboardSafetyItem,
  DashboardSnapshot,
  DashboardSourceSummary,
  DashboardStat,
  DashboardTeacherWorkspace,
  DashboardTodo,
} from "@/lib/data/dashboardSnapshot";

export interface DbUser extends SessionUser {
  salt: string;
  passwordHash: string; // PBKDF2-SHA256（不明文存储口令）
}
export interface DbStudent {
  id: string; name: string; classId: string;
  mastery: number; trend: number; weakest: string; needHelp: boolean;
}
export interface AuditEntry {
  id: string; at: number; userId: string; role: string; path: string;
  action: string; result: "deny" | "allow";
}
export interface SafetyTicket {
  id: string; at: number; userId: string; type: "help" | "report";
  status: "received" | "in_progress" | "resolved"; detail?: string;
}
const TICKET_DETAIL_MAX = 500;
// 诚信频次·去标识化聚合桶（评审 P2·未成年隐私最小化）：不绑定 userId + 精确时间戳，
// 按 (班级, 天, 类型) 的不可逆计数（避免 6 人小班「谁 + 何时」逐事件指纹）。
export interface IntegrityBucket {
  id: string; classId: string; dayBucket: number; kind: "scaffold" | "example"; count: number;
}
export interface DbPending {
  id: string; studentId: string; classId: string; subject: string; title: string; submittedAt: number;
}
// ── 对话持久化（Phase B）：会话/消息/收藏/反馈。均以 userId 为归属边界（服务端 RBAC）。──
export interface ChatSession {
  id: string; userId: string; title: string; modelId: string;
  createdAt: number; updatedAt: number; pinned: boolean;
  agentId?: string;
  preview?: string; // 仅 listSessions 填充：最后一条消息摘要（供侧栏展示）
}
export interface ChatMessage {
  id: string; sessionId: string; role: "user" | "assistant"; content: string; modelId: string; createdAt: number;
  source?: "remote" | "local" | "local-fallback" | "safety" | "care" | "integrity-scaffold"; durationMs?: number;
}
export type FavoriteKind = "session" | "prompt" | "message" | "agent";
export interface Favorite {
  id: string; userId: string; kind: FavoriteKind; refId: string; meta?: string; createdAt: number;
}
export type Sentiment = "up" | "down";
const SESSION_TITLE_MAX = 60;
const MESSAGE_CONTENT_MAX = 8000;

// ── 提示词 / 智能体（Phase C）：种子数据 ownerId="system"（只读）；用户创建 ownerId=user.id（可改删）。──
// 返回形状复用前端领域类型 PromptItem / AgentItem，另带 ownerId 作归属边界。
export type DbPrompt = PromptItem & { ownerId: string; status: "pub" | "draft" };
export type DbAgent = AgentItem & { ownerId: string };
const SYSTEM_OWNER = "system";

// ── 用户偏好（Phase D）：服务端权威，替代/同步 localStorage。──
export interface UserPrefs {
  density: "comfortable" | "compact";
  fontScale: number;
  reduceMotion: boolean;
  showPeerComparison: boolean;
  defaultModel: string;
  assistantRole: "teacher" | "student" | "research" | "admin";
  bio: string;
  socratic: boolean; // M1/B1：学生自选苏格拉底引导（教师班级锁定另存 class_policy，服务端合并判定）
  onboardingVersion: number;
  onboardingStep: number;
  onboardingCompletedAt: number | null;
}
const DEFAULT_PREFS: UserPrefs = {
  density: "comfortable", fontScale: 1, reduceMotion: false, showPeerComparison: false,
  defaultModel: "chatgpt", assistantRole: "teacher", bio: "", socratic: false,
  onboardingVersion: 0, onboardingStep: 0, onboardingCompletedAt: null,
};
export interface Notification {
  id: string; userId: string; kind: string; title: string; body: string; read: boolean; createdAt: number;
}
export interface LearningSnapshot {
  generatedAt: number;
  user: { id: string; name: string; role: SessionUser["role"]; classId: string };
  kpis: Array<{ id: string; label: string; value: string; hint: string; tone: "blue" | "green" | "violet" | "gold" }>;
  weeklyTrend: Array<{ day: string; sessions: number; messages: number }>;
  recentSessions: Array<{ id: string; title: string; href: string; preview: string; updatedAt: number; messageCount: number; modelId: string }>;
  reviewItems: Array<{ id: string; subject: string; title: string; count: number; href: string }>;
  tasks: Array<{ id: string; label: string; done: boolean; evidence: string }>;
  achievements: Array<{ id: string; label: string; unlocked: boolean }>;
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
// ── 知识库文件（Phase E）：诚实的关键词检索（非向量）。存文件名/类型/大小/范围/已提取文本 + 分段计数。──
export interface KbFile {
  id: string; ownerId: string; uploader: string; name: string; type: string;
  sizeBytes: number; scope: string; chunkCount: number; hasText: boolean; createdAt: number;
}
export interface KbSearchHit { fileId: string; name: string; snippet: string; }
// ── 管理端持久化（Phase E-2）：模型配置 / 角色权限位。──
export interface ModelSettings {
  modelId: string; openToStudents: boolean; quotaTeacher: number; quotaStudent: number;
  dataIsolation: boolean; allowUpload: boolean; autoDowngrade: boolean;
}
const DEFAULT_MODEL_SETTINGS: Omit<ModelSettings, "modelId"> = {
  openToStudents: true, quotaTeacher: 100, quotaStudent: 50, dataIsolation: true, allowUpload: true, autoDowngrade: false,
};

const DATA_DIR = process.env.EDUAI_DB_DIR
  ?? (process.env.VERCEL === "1" ? path.join(os.tmpdir(), "eduai-prism") : path.join(process.cwd(), ".data"));
const DB_FILE = path.join(DATA_DIR, "eduai.sqlite");

let _db: DatabaseSync | null = null;
function ensureColumn(d: DatabaseSync, table: string, column: string, ddl: string): void {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Row[];
  if (!cols.some((c) => String(c.name) === column)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
}
function db(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const d = new DatabaseSync(DB_FILE);
  d.exec("PRAGMA journal_mode = WAL;");
  d.exec("PRAGMA busy_timeout = 5000;");
  d.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, passwordHash TEXT NOT NULL,
    name TEXT, role TEXT, stage TEXT, classId TEXT, avatarLetter TEXT, department TEXT);`);
  ensureColumn(d, "users", "sessionVersion", "INTEGER NOT NULL DEFAULT 1");
  d.exec(`CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY, name TEXT, classId TEXT, mastery INTEGER, trend INTEGER, weakest TEXT, needHelp INTEGER);`);
  d.exec(`CREATE TABLE IF NOT EXISTS pending (
    id TEXT PRIMARY KEY, studentId TEXT, classId TEXT, subject TEXT, title TEXT, submittedAt INTEGER);`);
  d.exec(`CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY, at INTEGER, userId TEXT, role TEXT, path TEXT, action TEXT, result TEXT);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY, at INTEGER, userId TEXT, type TEXT, status TEXT, detail TEXT);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_at ON tickets(at DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS integrity (
    id TEXT PRIMARY KEY, classId TEXT, dayBucket INTEGER, kind TEXT, count INTEGER,
    UNIQUE(classId, dayBucket, kind));`);
  // ── Phase B：对话持久化 ──
  d.exec(`CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, title TEXT, modelId TEXT,
    createdAt INTEGER, updatedAt INTEGER, pinned INTEGER DEFAULT 0);`);
  ensureColumn(d, "chat_sessions", "agentId", "TEXT");
  d.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(userId, pinned DESC, updatedAt DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY, sessionId TEXT NOT NULL, role TEXT, content TEXT, modelId TEXT, createdAt INTEGER);`);
  ensureColumn(d, "chat_messages", "source", "TEXT");
  ensureColumn(d, "chat_messages", "durationMs", "INTEGER");
  // M4/B5：消息级学科标注（NULL = 未识别，统计里如实归入「未分类」，绝不猜）
  ensureColumn(d, "chat_messages", "subject", "TEXT");
  d.exec(`CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(sessionId, createdAt ASC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, kind TEXT, refId TEXT, meta TEXT, createdAt INTEGER,
    UNIQUE(userId, kind, refId));`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(userId, kind, createdAt DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, messageId TEXT, sentiment TEXT, createdAt INTEGER,
    UNIQUE(userId, messageId));`);
  // ── Phase C：提示词 / 智能体 ──
  d.exec(`CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, category TEXT, icon TEXT, gradient TEXT,
    title TEXT, scene TEXT, role TEXT, recommendedModel TEXT, level TEXT, description TEXT,
    body TEXT, variables TEXT, uses INTEGER DEFAULT 0, favorites INTEGER DEFAULT 0,
    score REAL DEFAULT 0, featured INTEGER DEFAULT 0, status TEXT DEFAULT 'pub', createdAt INTEGER);`);
  ensureColumn(d, "prompts", "outputExample", "TEXT");
  d.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_owner ON prompts(ownerId, createdAt DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, name TEXT, category TEXT, icon TEXT, gradient TEXT,
    description TEXT, capabilities TEXT, recommendedModel TEXT, knowledgeBase TEXT,
    calls INTEGER DEFAULT 0, score REAL DEFAULT 0, status TEXT DEFAULT 'draft', creator TEXT, createdAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(ownerId, createdAt DESC);`);
  // 教学产物（备课工作区 V1）。messageId UNIQUE 即幂等闩：同一条助手消息只归档一次，
  // 重复触发（重试/重放）静默落空。
  d.exec(`CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, sessionId TEXT NOT NULL,
    messageId TEXT NOT NULL UNIQUE, title TEXT NOT NULL, content TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private', createdAt INTEGER NOT NULL);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_artifacts_owner ON artifacts(ownerId, createdAt DESC);`);
  // V2：发布目标班级。旧行为 NULL（即从未发布过），与 visibility='private' 语义一致。
  ensureColumn(d, "artifacts", "classId", "TEXT");

  // ── 迁移 003：gradient 自由字符串 → 枚举键（方案 §4.2.1）──────────────────────────
  // 旧 `gradient` 列存的是任意 CSS（且来自用户输入，直接进 style），既躲过源码色彩守卫，
  // 又是一个样式注入面。这里新增 gradientKey 并回填；**旧列保留一版作为回滚数据**，
  // 待 V2 结束确认无回退需求再 DROP。
  ensureColumn(d, "prompts", "gradientKey", "TEXT");
  ensureColumn(d, "agents", "gradientKey", "TEXT");
  // origin 分级（校方审定/教师自建）。旧行迁移后为 NULL——mapAgent 对 NULL 不给值，
  // UI 对无值不渲染徽标：不按 creator 名字猜来源，那是编造（铁律②）。
  ensureColumn(d, "agents", "origin", "TEXT");
  ensureColumn(d, "agents", "systemPrompt", "TEXT");
  for (const table of ["prompts", "agents"] as const) {
    const stale = d.prepare(`SELECT id, gradient FROM ${table} WHERE gradientKey IS NULL OR gradientKey = ''`).all() as Row[];
    if (stale.length) {
      const upd = d.prepare(`UPDATE ${table} SET gradientKey = ? WHERE id = ?`);
      for (const row of stale) upd.run(legacyGradientToKey(row.gradient == null ? null : String(row.gradient)), String(row.id));
    }
  }
  // ── Phase D：用户偏好 / 通知 ──
  d.exec(`CREATE TABLE IF NOT EXISTS user_prefs (
    userId TEXT PRIMARY KEY, density TEXT, fontScale REAL, reduceMotion INTEGER,
    showPeerComparison INTEGER, defaultModel TEXT, assistantRole TEXT, bio TEXT,
    socratic INTEGER DEFAULT 0, onboardingVersion INTEGER DEFAULT 0,
    onboardingStep INTEGER DEFAULT 0, onboardingCompletedAt INTEGER, updatedAt INTEGER);`);
  d.exec(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, kind TEXT, title TEXT, body TEXT, read INTEGER DEFAULT 0, createdAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId, createdAt DESC);`);
  // ── Phase E：知识库文件（关键词检索，非向量）──
  d.exec(`CREATE TABLE IF NOT EXISTS kb_files (
    id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, ownerClassId TEXT, ownerStage TEXT, uploader TEXT, name TEXT, type TEXT,
    sizeBytes INTEGER, scope TEXT, textContent TEXT, chunkCount INTEGER, createdAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_kb_owner ON kb_files(ownerId, createdAt DESC);`);
  // ── W-B1：对话附件上传（docx/pdf/txt 服务端解析后缓存文本；①对话/③导图/⑤错题共用地基）──
  d.exec(`CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, name TEXT, mime TEXT, sizeBytes INTEGER,
    textContent TEXT, chars INTEGER, status TEXT, intent TEXT, createdAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(userId, createdAt DESC);`);
  // ── W-B2：AI 随堂小测（雷达图「正确率」维度的唯一供数源，规格红线 R2）──
  // 判分可复算：原始题面/选项/标准答案/学生作答/规则版本全量落盘；
  // 出题时 answerIdx 只存服务端不下发——判分是服务端确定性比对，不是模型自由评价。
  d.exec(`CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, subject TEXT NOT NULL, knowledgePoint TEXT,
    question TEXT NOT NULL, options TEXT NOT NULL, answerIdx INTEGER NOT NULL,
    studentIdx INTEGER, correct INTEGER, ruleVersion TEXT, createdAt INTEGER, answeredAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_attempts(userId, createdAt DESC);`);
  // ── W-B2：教师快捷点评（雷达「教师评价」维度与档案袋数据源；受控标签，一击提交）──
  d.exec(`CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY, studentId TEXT NOT NULL, teacherId TEXT NOT NULL,
    tag TEXT NOT NULL, score INTEGER NOT NULL, note TEXT, createdAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_eval_student ON evaluations(studentId, createdAt DESC);`);
  // ── Phase E-2：管理端持久化 ──
  d.exec(`CREATE TABLE IF NOT EXISTS model_settings (
    modelId TEXT PRIMARY KEY, openToStudents INTEGER, quotaTeacher INTEGER, quotaStudent INTEGER,
    dataIsolation INTEGER, allowUpload INTEGER, autoDowngrade INTEGER, updatedAt INTEGER);`);
  d.exec(`CREATE TABLE IF NOT EXISTS role_perms (roleId TEXT PRIMARY KEY, perms TEXT, updatedAt INTEGER);`);
  // 每日调用计数（配额执行；按 用户×模型×天 桶）——让 model_settings 的额度真正生效。
  d.exec(`CREATE TABLE IF NOT EXISTS chat_usage (
    userId TEXT, modelId TEXT, day INTEGER, count INTEGER, PRIMARY KEY(userId, modelId, day));`);
  // ── S3：生图任务（gpt-image-2 异步管线；安全门先于外部 API，全量审计）──
  d.exec(`CREATE TABLE IF NOT EXISTS image_jobs (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, role TEXT, prompt TEXT NOT NULL, size TEXT,
    status TEXT NOT NULL, error TEXT, filePath TEXT, createdAt INTEGER, finishedAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_image_jobs_user ON image_jobs(userId, createdAt DESC);`);
  // ── S4：错题本（诊断+处方；学生本人数据，教师端仅去标识聚类计数）──
  d.exec(`CREATE TABLE IF NOT EXISTS mistakes (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, subject TEXT NOT NULL, knowledgePoint TEXT,
    content TEXT NOT NULL, reason TEXT, createdAt INTEGER, reviewedAt INTEGER);`);
  // V3：复习**明细**表。原实现只有 mistakes.reviewedAt 单列覆盖写，第二次复习会抹掉第一次，
  // 「同一知识点跨天复习两次」在旧 schema 上根本无法判定——而这正是庆祝的唯一合法触发条件。
  // 不加计数列而建明细表，是为了后续能做间隔重复/遗忘曲线，不必再迁一次。
  d.exec(`CREATE TABLE IF NOT EXISTS mistake_reviews (
    id TEXT PRIMARY KEY, mistakeId TEXT NOT NULL, userId TEXT NOT NULL, at INTEGER NOT NULL);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_mistake_reviews ON mistake_reviews(mistakeId, at DESC);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_mistake_reviews_user ON mistake_reviews(userId, at DESC);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(userId, createdAt DESC);`);
  // ── M1/B1：苏格拉底三态——班级锁定策略 + user_prefs 增列（存量库用守卫式 ALTER 迁移）──
  d.exec(`CREATE TABLE IF NOT EXISTS class_policy (
    classId TEXT PRIMARY KEY, socraticLock INTEGER DEFAULT 0, updatedBy TEXT, updatedAt INTEGER);`);
  // ── M3/B2：守护策略（全局一行 scope='global'；班级级细化留后续）──
  d.exec(`CREATE TABLE IF NOT EXISTS guardian_settings (
    scope TEXT PRIMARY KEY, limitMin INTEGER, curfewStart INTEGER, curfewEnd INTEGER, updatedBy TEXT, updatedAt INTEGER);`);
  try { d.exec("ALTER TABLE user_prefs ADD COLUMN socratic INTEGER DEFAULT 0"); } catch { /* 列已存在 */ }
  try { d.exec("ALTER TABLE user_prefs ADD COLUMN onboardingVersion INTEGER DEFAULT 0"); } catch { /* 列已存在 */ }
  try { d.exec("ALTER TABLE user_prefs ADD COLUMN onboardingStep INTEGER DEFAULT 0"); } catch { /* 列已存在 */ }
  try { d.exec("ALTER TABLE user_prefs ADD COLUMN onboardingCompletedAt INTEGER"); } catch { /* 列已存在 */ }
  // F3：活动提交佐证材料（复用 uploads 解析地基；存 uploadId 引用不复制内容）
  try { d.exec("ALTER TABLE activity_submissions ADD COLUMN artifactRef TEXT"); } catch { /* 列已存在 */ }
  // ── W-B3：学科项目活动（教师发布 → 学生草稿/提交 → 教师批阅 → 通过即入档案袋）──
  // 状态机是数据诚实性约束的载体：学生自报不可直达档案袋，必须过教师审核（规格⑥-3）。
  d.exec(`CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY, classId TEXT NOT NULL, teacherId TEXT NOT NULL,
    subject TEXT NOT NULL, title TEXT NOT NULL, brief TEXT NOT NULL,
    dueAt INTEGER, status TEXT NOT NULL DEFAULT 'open', createdAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_activities_class ON activities(classId, createdAt DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS activity_submissions (
    id TEXT PRIMARY KEY, activityId TEXT NOT NULL, studentId TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
    teacherFeedback TEXT, submittedAt INTEGER, reviewedAt INTEGER, updatedAt INTEGER,
    UNIQUE(activityId, studentId));`);
  ensureColumn(d, "activity_submissions", "artifactRef", "TEXT");
  d.exec(`CREATE INDEX IF NOT EXISTS idx_asub_activity ON activity_submissions(activityId);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_asub_student ON activity_submissions(studentId, updatedAt DESC);`);
  // ── W-B3：档案袋 AI 成长建议（规格红线 R5：AI 草稿 → 教师审改 → 发布才对学生可见，可撤回）──
  d.exec(`CREATE TABLE IF NOT EXISTS portfolio_advice (
    id TEXT PRIMARY KEY, studentId TEXT NOT NULL, teacherId TEXT NOT NULL,
    draftText TEXT NOT NULL, finalText TEXT, source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', createdAt INTEGER, publishedAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_padvice_student ON portfolio_advice(studentId, createdAt DESC);`);
  // ── W-B4：徽章/积分/庄园（判据绑定真实事件流；积分台账 eventKey 幂等；兑换在事务内扣减）──
  d.exec(`CREATE TABLE IF NOT EXISTS user_badges (
    userId TEXT NOT NULL, badgeId TEXT NOT NULL, awardedAt INTEGER, PRIMARY KEY(userId, badgeId));`);
  // H10：celebratedAt = 已向本人播放过解锁庆祝的时点（服务端权威，不用 localStorage——共用机房设备）。
  // 首次加列时把历史授予整体回填为已庆祝：庆祝只属于「此后新解锁」，不对存量账号补播轰炸。
  {
    const had = (d.prepare("SELECT COUNT(*) AS c FROM pragma_table_info('user_badges') WHERE name = 'celebratedAt'").get() as { c: number }).c > 0;
    ensureColumn(d, "user_badges", "celebratedAt", "INTEGER");
    if (!had) d.exec("UPDATE user_badges SET celebratedAt = awardedAt WHERE celebratedAt IS NULL");
  }
  d.exec(`CREATE TABLE IF NOT EXISTS points_ledger (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, kind TEXT NOT NULL, delta INTEGER NOT NULL,
    reason TEXT NOT NULL, eventKey TEXT UNIQUE, createdAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(userId, createdAt DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_items (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, partId TEXT NOT NULL,
    x INTEGER, y INTEGER, acquiredAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_user ON manor_items(userId);`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_items_coords_insert
    BEFORE INSERT ON manor_items
    WHEN (NEW.x IS NULL) <> (NEW.y IS NULL)
    BEGIN SELECT RAISE(ABORT, 'manor coordinates must both be null or both be set'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_items_coords_update
    BEFORE UPDATE OF x, y ON manor_items
    WHEN (NEW.x IS NULL) <> (NEW.y IS NULL)
    BEGIN SELECT RAISE(ABORT, 'manor coordinates must both be null or both be set'); END;`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_plots (
    userId TEXT NOT NULL, plot INTEGER NOT NULL, cropId TEXT,
    stage INTEGER NOT NULL DEFAULT 0, plantedAt INTEGER, updatedAt INTEGER,
    PRIMARY KEY(userId, plot));`);
  ensureColumn(d, "manor_plots", "revision", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(d, "manor_plots", "state", "TEXT NOT NULL DEFAULT 'empty'");
  ensureColumn(d, "manor_plots", "objectiveId", "TEXT");
  ensureColumn(d, "manor_plots", "evidenceId", "TEXT");
  d.exec(`CREATE TABLE IF NOT EXISTS manor_crop_unlocks (
    userId TEXT NOT NULL, cropId TEXT NOT NULL, source TEXT NOT NULL, unlockedAt INTEGER NOT NULL,
    PRIMARY KEY(userId, cropId));`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_harvests (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, cropId TEXT NOT NULL,
    plot INTEGER NOT NULL, harvestedAt INTEGER NOT NULL);`);
  ensureColumn(d, "manor_harvests", "evidenceId", "TEXT");
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_harvest_user ON manor_harvests(userId, harvestedAt DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_growth_spend (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, plot INTEGER NOT NULL,
    cropId TEXT NOT NULL, createdAt INTEGER NOT NULL);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_growth_user ON manor_growth_spend(userId);`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_operations (
    userId TEXT NOT NULL, operationId TEXT NOT NULL, actionKey TEXT NOT NULL,
    resultJson TEXT NOT NULL, createdAt INTEGER NOT NULL,
    PRIMARY KEY(userId, operationId));`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_profiles (
    studentId TEXT PRIMARY KEY,
    preferencesJson TEXT NOT NULL DEFAULT '[]',
    weeklyGoal INTEGER NOT NULL DEFAULT 3,
    personalized INTEGER NOT NULL DEFAULT 1,
    quietUntil INTEGER,
    endedAt INTEGER,
    revision INTEGER NOT NULL DEFAULT 1,
    stateVersion INTEGER NOT NULL DEFAULT 1,
    updatedAt INTEGER NOT NULL);`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_domain_events (
    eventId TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    correlationId TEXT NOT NULL,
    eventType TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    payloadJson TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    UNIQUE(studentId, sequence));`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_events_student ON manor_domain_events(studentId, sequence);`);
  d.exec(`CREATE TABLE IF NOT EXISTS learning_evidence (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    evidenceKey TEXT NOT NULL,
    objectiveId TEXT NOT NULL,
    missionId TEXT NOT NULL,
    evidenceType TEXT NOT NULL,
    latestAttemptId TEXT,
    attemptCount INTEGER NOT NULL DEFAULT 0,
    hintsUsedJson TEXT NOT NULL DEFAULT '[]',
    accommodationCodesJson TEXT NOT NULL DEFAULT '[]',
    provenance TEXT NOT NULL,
    status TEXT NOT NULL,
    evaluatorType TEXT NOT NULL,
    evaluatorId TEXT NOT NULL,
    rubricVersion TEXT NOT NULL,
    policyVersion TEXT NOT NULL,
    rewardClass TEXT NOT NULL,
    grantEligibility TEXT NOT NULL,
    confidence REAL,
    revision INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    decidedAt INTEGER,
    UNIQUE(studentId, evidenceKey));`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_learning_evidence_student ON learning_evidence(studentId, createdAt DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS evidence_attempts (
    id TEXT PRIMARY KEY,
    evidenceId TEXT NOT NULL,
    studentId TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    answerJson TEXT NOT NULL,
    hintsUsedJson TEXT NOT NULL,
    accommodationCodesJson TEXT NOT NULL,
    operationId TEXT NOT NULL,
    submittedAt INTEGER NOT NULL,
    UNIQUE(evidenceId, sequence),
    UNIQUE(studentId, operationId));`);
  d.exec(`CREATE TABLE IF NOT EXISTS evidence_decisions (
    id TEXT PRIMARY KEY,
    evidenceId TEXT NOT NULL,
    version INTEGER NOT NULL,
    evaluatorType TEXT NOT NULL,
    evaluatorId TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    rubricVersion TEXT NOT NULL,
    confidence REAL,
    createdAt INTEGER NOT NULL,
    UNIQUE(evidenceId, version));`);
  d.exec(`CREATE TABLE IF NOT EXISTS growth_grants (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    evidenceId TEXT NOT NULL UNIQUE,
    units INTEGER NOT NULL,
    remainingUnits INTEGER NOT NULL,
    allowedPurposesJson TEXT NOT NULL,
    status TEXT NOT NULL,
    policyVersion TEXT NOT NULL,
    issuedAt INTEGER NOT NULL,
    consumedAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_growth_grants_student ON growth_grants(studentId, status, issuedAt);`);
  d.exec(`CREATE TABLE IF NOT EXISTS grant_consumptions (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    grantId TEXT NOT NULL,
    purpose TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK(amount > 0),
    operationId TEXT NOT NULL,
    correlationId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    UNIQUE(studentId, operationId, grantId));`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_grant_consumptions_student ON grant_consumptions(studentId, createdAt);`);
  d.exec(`CREATE TABLE IF NOT EXISTS review_schedules (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    evidenceId TEXT NOT NULL,
    missionId TEXT NOT NULL,
    strategy TEXT NOT NULL,
    dueAt INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    revision INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(studentId, evidenceId));`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_review_schedules_student ON review_schedules(studentId, dueAt);`);
  ensureColumn(d, "review_schedules", "lastAnswer", "TEXT");
  ensureColumn(d, "review_schedules", "feedbackJson", "TEXT");
  ensureColumn(d, "review_schedules", "completedAt", "INTEGER");
  d.exec(`CREATE TABLE IF NOT EXISTS manor_review_attempts (
    id TEXT PRIMARY KEY, reviewId TEXT NOT NULL, studentId TEXT NOT NULL,
    evidenceId TEXT NOT NULL, answer TEXT NOT NULL, correct INTEGER NOT NULL,
    feedbackJson TEXT NOT NULL, createdAt INTEGER NOT NULL);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_review_attempts ON manor_review_attempts(studentId,reviewId,createdAt);`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_task_runs (
    id TEXT PRIMARY KEY, studentId TEXT NOT NULL, missionId TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT 'evidence', answer TEXT NOT NULL DEFAULT '',
    reflection TEXT NOT NULL DEFAULT '', evidenceId TEXT, artifactId TEXT,
    revision INTEGER NOT NULL DEFAULT 1, createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL, completedAt INTEGER, UNIQUE(studentId,missionId));`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_task_run_history (
    id TEXT PRIMARY KEY, studentId TEXT NOT NULL, missionId TEXT NOT NULL,
    runJson TEXT NOT NULL, archivedAt INTEGER NOT NULL);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_task_history ON manor_task_run_history(studentId,archivedAt DESC);`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_task_history_immutable_update BEFORE UPDATE ON manor_task_run_history BEGIN SELECT RAISE(ABORT, 'task run history is immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_task_history_immutable_delete BEFORE DELETE ON manor_task_run_history BEGIN SELECT RAISE(ABORT, 'task run history is immutable'); END;`);
  d.exec(`CREATE TABLE IF NOT EXISTS learning_artifacts (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    evidenceId TEXT,
    artifactType TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    contentHash TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_learning_artifacts_student ON learning_artifacts(studentId, updatedAt DESC);`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS evidence_attempts_immutable_update BEFORE UPDATE ON evidence_attempts BEGIN SELECT RAISE(ABORT, 'evidence attempts are immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS evidence_attempts_immutable_delete BEFORE DELETE ON evidence_attempts BEGIN SELECT RAISE(ABORT, 'evidence attempts are immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS evidence_decisions_immutable_update BEFORE UPDATE ON evidence_decisions BEGIN SELECT RAISE(ABORT, 'evidence decisions are immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS evidence_decisions_immutable_delete BEFORE DELETE ON evidence_decisions BEGIN SELECT RAISE(ABORT, 'evidence decisions are immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_domain_events_immutable_update BEFORE UPDATE ON manor_domain_events BEGIN SELECT RAISE(ABORT, 'manor events are immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_domain_events_immutable_delete BEFORE DELETE ON manor_domain_events BEGIN SELECT RAISE(ABORT, 'manor events are immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS grant_consumptions_immutable_update BEFORE UPDATE ON grant_consumptions BEGIN SELECT RAISE(ABORT, 'grant consumptions are immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS grant_consumptions_immutable_delete BEFORE DELETE ON grant_consumptions BEGIN SELECT RAISE(ABORT, 'grant consumptions are immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS growth_grants_bounds_insert BEFORE INSERT ON growth_grants
    WHEN NEW.units < 1 OR NEW.remainingUnits < 0 OR NEW.remainingUnits > NEW.units
    BEGIN SELECT RAISE(ABORT, 'invalid growth grant balance'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS growth_grants_bounds_update BEFORE UPDATE ON growth_grants
    WHEN NEW.units < 1 OR NEW.remainingUnits < 0 OR NEW.remainingUnits > NEW.units OR NEW.units != OLD.units
    BEGIN SELECT RAISE(ABORT, 'invalid growth grant balance'); END;`);
  // V7 learning is additive: no resetting balances, evidence, drafts or existing runs.
  d.exec(`CREATE TABLE IF NOT EXISTS manor_student_grades (
    studentId TEXT PRIMARY KEY, classId TEXT NOT NULL, gradeBand TEXT NOT NULL,
    teacherId TEXT NOT NULL, updatedAt INTEGER NOT NULL);`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_assignments (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, classId TEXT NOT NULL, teacherId TEXT NOT NULL,
    gradeBand TEXT NOT NULL, assignmentVersion INTEGER NOT NULL, resourceVersion TEXT NOT NULL,
    datasetVersion TEXT, rewardUnits INTEGER NOT NULL DEFAULT 0 CHECK(rewardUnits BETWEEN 0 AND 24),
    studentIdsJson TEXT, supersedesId TEXT, status TEXT NOT NULL DEFAULT 'published',
    revision INTEGER NOT NULL DEFAULT 1, publishedAt INTEGER NOT NULL);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_assignments_class ON manor_assignments(classId,status,publishedAt);`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_assignment_missions (
    id TEXT PRIMARY KEY, assignmentId TEXT NOT NULL, templateId TEXT NOT NULL, snapshotJson TEXT NOT NULL,
    UNIQUE(assignmentId,templateId));`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_assignment_content_immutable BEFORE UPDATE ON manor_assignments
    WHEN NEW.title IS NOT OLD.title OR NEW.classId IS NOT OLD.classId OR NEW.teacherId IS NOT OLD.teacherId
      OR NEW.gradeBand IS NOT OLD.gradeBand OR NEW.assignmentVersion IS NOT OLD.assignmentVersion
      OR NEW.resourceVersion IS NOT OLD.resourceVersion OR NEW.datasetVersion IS NOT OLD.datasetVersion
      OR NEW.rewardUnits IS NOT OLD.rewardUnits OR NEW.studentIdsJson IS NOT OLD.studentIdsJson
      OR NEW.supersedesId IS NOT OLD.supersedesId OR NEW.publishedAt IS NOT OLD.publishedAt
    BEGIN SELECT RAISE(ABORT, 'published assignment content is immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_mission_snapshot_immutable BEFORE UPDATE ON manor_assignment_missions
    BEGIN SELECT RAISE(ABORT, 'published mission snapshot is immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_mission_snapshot_no_delete BEFORE DELETE ON manor_assignment_missions
    BEGIN SELECT RAISE(ABORT, 'published mission snapshot is immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_assignment_no_delete BEFORE DELETE ON manor_assignments
    BEGIN SELECT RAISE(ABORT, 'published assignment is immutable'); END;`);
  for (const table of ["learning_evidence", "manor_task_runs"]) {
    ensureColumn(d, table, "assignmentId", "TEXT");
    ensureColumn(d, table, "assignmentVersion", "INTEGER");
    ensureColumn(d, table, "resourceVersion", "TEXT");
    ensureColumn(d, table, "datasetVersion", "TEXT");
  }
  ensureColumn(d, "learning_evidence", "taskRunId", "TEXT");
  ensureColumn(d, "learning_artifacts", "taskRunId", "TEXT");
  ensureColumn(d, "learning_artifacts", "acceptedRevision", "INTEGER");
  ensureColumn(d, "learning_artifacts", "acceptedContentHash", "TEXT");
  ensureColumn(d, "learning_artifacts", "acceptedAt", "INTEGER");
  ensureColumn(d, "growth_grants", "milestoneKey", "TEXT");
  d.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_manor_grant_milestone ON growth_grants(studentId,milestoneKey) WHERE milestoneKey IS NOT NULL;`);
  d.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_manor_expression_run ON learning_evidence(studentId,taskRunId,evidenceType)
    WHERE taskRunId IS NOT NULL AND evidenceType='expression';`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_artifact_versions (
    artifactId TEXT NOT NULL, revision INTEGER NOT NULL, studentId TEXT NOT NULL, evidenceId TEXT,
    content TEXT NOT NULL, contentHash TEXT NOT NULL, acceptedAt INTEGER NOT NULL,
    PRIMARY KEY(artifactId,revision));`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_archived_artifact_immutable BEFORE UPDATE ON learning_artifacts
    WHEN OLD.acceptedRevision IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'accepted artifact is immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_archived_artifact_no_delete BEFORE DELETE ON learning_artifacts
    WHEN OLD.acceptedRevision IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'accepted artifact is immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_artifact_version_immutable BEFORE UPDATE ON manor_artifact_versions
    BEGIN SELECT RAISE(ABORT, 'accepted artifact version is immutable'); END;`);
  d.exec(`CREATE TRIGGER IF NOT EXISTS manor_artifact_version_no_delete BEFORE DELETE ON manor_artifact_versions
    BEGIN SELECT RAISE(ABORT, 'accepted artifact version is immutable'); END;`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_planting_cycles (
    id TEXT PRIMARY KEY, studentId TEXT NOT NULL, plotId INTEGER NOT NULL, cropId TEXT NOT NULL,
    startedAt INTEGER NOT NULL, endedAt INTEGER, status TEXT NOT NULL DEFAULT 'active',
    historyComplete INTEGER NOT NULL DEFAULT 1, harvestId TEXT);`);
  d.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_manor_active_cycle ON manor_planting_cycles(studentId,plotId) WHERE status='active';`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_cycle_page ON manor_planting_cycles(studentId,plotId,startedAt DESC,id DESC);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_cycle_student_page ON manor_planting_cycles(studentId,startedAt DESC,id DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS manor_plot_actions (
    id TEXT PRIMARY KEY, studentId TEXT NOT NULL, cycleId TEXT NOT NULL, action TEXT NOT NULL,
    operationId TEXT NOT NULL, correlationId TEXT NOT NULL, fromStage INTEGER NOT NULL,
    toStage INTEGER NOT NULL, createdAt INTEGER NOT NULL, UNIQUE(studentId,operationId));`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_cycle_actions ON manor_plot_actions(studentId,cycleId,createdAt);`);
  ensureColumn(d, "grant_consumptions", "plantingCycleId", "TEXT");
  ensureColumn(d, "grant_consumptions", "plotActionId", "TEXT");
  d.exec(`CREATE INDEX IF NOT EXISTS idx_manor_cycle_allocations ON grant_consumptions(studentId,plantingCycleId,plotActionId,createdAt,id);`);
  ensureColumn(d, "manor_harvests", "plantingCycleId", "TEXT");
  ensureColumn(d, "manor_plots", "plantingCycleId", "TEXT");
  d.exec(`CREATE TABLE IF NOT EXISTS manor_project_runs (
    id TEXT PRIMARY KEY, studentId TEXT NOT NULL, assignmentId TEXT NOT NULL, projectId TEXT NOT NULL,
    datasetVersion TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'incomplete', revision INTEGER NOT NULL DEFAULT 1,
    contributionsJson TEXT NOT NULL DEFAULT '[]', artifactId TEXT, content TEXT, completedAt INTEGER,
    UNIQUE(studentId,assignmentId,projectId));`);
  for (const action of ["UPDATE", "DELETE"]) {
    d.exec(`CREATE TRIGGER IF NOT EXISTS manor_project_complete_no_${action.toLowerCase()} BEFORE ${action} ON manor_project_runs
      WHEN OLD.status='complete' BEGIN SELECT RAISE(ABORT, 'completed project is immutable'); END;`);
    d.exec(`CREATE TRIGGER IF NOT EXISTS manor_project_artifact_no_${action.toLowerCase()} BEFORE ${action} ON learning_artifacts
      WHEN EXISTS (SELECT 1 FROM manor_project_runs p WHERE p.artifactId=OLD.id AND p.studentId=OLD.studentId AND p.status='complete')
      BEGIN SELECT RAISE(ABORT, 'completed project artifact is immutable'); END;`);
    d.exec(`CREATE TRIGGER IF NOT EXISTS manor_plot_actions_no_${action.toLowerCase()} BEFORE ${action} ON manor_plot_actions
      BEGIN SELECT RAISE(ABORT, 'plot action history is immutable'); END;`);
    d.exec(`CREATE TRIGGER IF NOT EXISTS manor_legacy_accepted_no_${action.toLowerCase()} BEFORE ${action} ON learning_artifacts
      WHEN OLD.artifactType='expression' AND EXISTS (
        SELECT 1 FROM learning_evidence e JOIN evidence_attempts t ON t.id=e.latestAttemptId AND t.studentId=e.studentId
        JOIN evidence_decisions d ON d.evidenceId=e.id AND d.version=e.revision AND d.evaluatorType='teacher' AND d.evaluatorId=e.evaluatorId AND d.status=e.status
        WHERE e.id=OLD.evidenceId AND e.studentId=OLD.studentId AND e.evidenceType='expression' AND e.status='accepted_mastery'
          AND json_extract(t.answerJson,'$.content')=OLD.content AND OLD.revision=t.sequence AND OLD.updatedAt<=d.createdAt
          AND OLD.id=(SELECT id FROM learning_artifacts WHERE studentId=OLD.studentId AND evidenceId=e.id AND artifactType='expression' ORDER BY createdAt,id LIMIT 1)
      ) BEGIN SELECT RAISE(ABORT, 'accepted legacy artifact is immutable'); END;`);
  }
  // F5：参观点赞（每人每天对每座庄园至多 1 赞，主键即幂等）+ 班级共建认捐
  d.exec(`CREATE TABLE IF NOT EXISTS manor_likes (
    visitorId TEXT NOT NULL, ownerId TEXT NOT NULL, day INTEGER NOT NULL,
    PRIMARY KEY(visitorId, ownerId, day));`);
  // G3：档案袋学期快照（规格⑦-2「确认→锁定→版本化」；快照不可变，锁定后只能追加新学期）
  d.exec(`CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, term TEXT NOT NULL,
    payload TEXT NOT NULL, createdAt INTEGER, UNIQUE(userId, term));`);
  d.exec(`CREATE TABLE IF NOT EXISTS class_build_contrib (
    id TEXT PRIMARY KEY, classId TEXT NOT NULL, userId TEXT NOT NULL,
    amount INTEGER NOT NULL, createdAt INTEGER);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_cbc_class ON class_build_contrib(classId);`);
  seedIfAllowed(d);
  bootstrapProductionAdmin(d);
  seedPromptsAgents(d);
  assertNoProductionDemoAccounts(d);
  _db = d;
  return d;
}

/** Internal storage adapter for the v2 manor domain. Route handlers must use domain services, not raw SQL. */
export function manorV2Database(): DatabaseSync {
  return db();
}

/** Internal storage adapter for the courseware domain. Route handlers use courseware services, never raw SQL. */
export function coursewareDatabase(): DatabaseSync {
  return db();
}

/** Internal adapter for membership-scoped research group services. */
export function researchGroupsDatabase(): DatabaseSync {
  return db();
}

function demoSeedEnabled(): boolean {
  const flag = process.env.EDUAI_ENABLE_DEMO_SEED;
  if (isProd() && flag === "true") throw new Error("EDUAI_ENABLE_DEMO_SEED must not be true in production");
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !isProd();
}

const DEMO_USER_IDS = ["u-teacher", "u-student", "u-admin", "u-research", "u-student-p", "u-student-s"];

function bootstrapProductionAdmin(database: DatabaseSync): void {
  if (!isProd()) return;
  const users = database.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (Number(users.n) > 0) return;

  const username = process.env.EDUAI_BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.EDUAI_BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.EDUAI_BOOTSTRAP_ADMIN_NAME?.trim() || "学校管理员";
  if (!username || !password) return;
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) throw new Error("EDUAI_BOOTSTRAP_ADMIN_USERNAME must be 3-64 safe characters");
  if (password.length < 12 || password.length > 256) throw new Error("EDUAI_BOOTSTRAP_ADMIN_PASSWORD must be 12-256 characters");

  const salt = randomBytes(16).toString("hex");
  const passwordHash = pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
  database.prepare(`INSERT INTO users
    (id,username,salt,passwordHash,name,role,stage,classId,avatarLetter,department,sessionVersion)
    VALUES (?,?,?,?,?,'admin','senior','school',?,'校级管理',1)`)
    .run(`u-admin-${randomBytes(8).toString("hex")}`, username, salt, passwordHash, name.slice(0, 80), name.slice(0, 1) || "管");
}

function assertNoProductionDemoAccounts(database: DatabaseSync): void {
  if (!isProd()) return;
  const placeholders = DEMO_USER_IDS.map(() => "?").join(",");
  const row = database.prepare(`SELECT id FROM users WHERE id IN (${placeholders}) LIMIT 1`).get(...DEMO_USER_IDS);
  if (row) throw new Error("Production database contains demo accounts; scrub or rotate the database before startup");
}

export function databaseReadiness(): { ok: true; storage: "sqlite"; initialized: true; users: number } {
  if (isProd() && process.env.VERCEL === "1") {
    throw new Error("ephemeral Vercel storage is not a supported persistent production database");
  }
  const result = db().prepare("SELECT 1 AS ok").get() as { ok: number };
  if (result.ok !== 1) throw new Error("database readiness query failed");
  const users = Number((db().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n);
  if (users < 1) throw new Error("database is not initialized: configure the bootstrap administrator or import school users");
  return { ok: true, storage: "sqlite", initialized: true, users };
}

function seedIfAllowed(d: DatabaseSync): void {
  const enabled = demoSeedEnabled();
  const row = d.prepare("SELECT COUNT(*) AS n FROM users").get();
  if (row && Number(row.n) > 0) return;
  if (!enabled) return;

  // 静态 seed 用户（PBKDF2 salt+hash；无运行时注册）。演示口令：teacher/Teacher@123 等。
  const insUser = d.prepare(
    "INSERT INTO users (id,username,salt,passwordHash,name,role,stage,classId,avatarLetter,department) VALUES (?,?,?,?,?,?,?,?,?,?)"
  );
  const users: Array<Omit<DbUser, "sessionVersion">> = [
    { id: "u-teacher", username: "teacher", salt: "slt_teacher_7a3f", passwordHash: "f1ff4f52ea4213ba2ef5929e638cfdbcc2d30209e4b98bab5619ce6ef98bb488", name: "王思远", role: "teacher", stage: "junior", classId: "c1", avatarLetter: "王", department: "信息科技教研组 · 教师" },
    { id: "u-student", username: "student", salt: "slt_student_9b1c", passwordHash: "84487e481ad07f4e66c39508a081fac98889989db7c84c0e9828ee89e748700f", name: "刘子涵", role: "student", stage: "junior", classId: "c1", avatarLetter: "刘", department: "初三(3)班" },
    { id: "u-admin", username: "admin", salt: "slt_admin_4c2e", passwordHash: "4e73131b6d1c910e7ff0dcf56c0eb5e808da01aeb4d3bd4c0d5730272bc4b8a4", name: "李校长", role: "admin", stage: "senior", classId: "c1", avatarLetter: "李", department: "校办 · 管理员" },
    { id: "u-research", username: "research", salt: "slt_research_2d8a", passwordHash: "aa3c0d9489b923da2e16537b23c722a86cafb6523ea11a4a74a878d9d9b05ef7", name: "陈研究", role: "researcher", stage: "senior", classId: "c1", avatarLetter: "陈", department: "教育研究院 · 科研" },
    // V0 补种（对抗审查 N-5）：原四个账号里**只有一个学生**且是 junior，两个 senior 是校长与研究员，
    // 永不进入 /student/*。于是趣味配额表的 primary 与 senior 两档**零样本**——
    // lib/delight/policy.ts 的 allowed('student','senior') 就算写反也没有任何端到端断言能抓到。
    // 补上这两个学生账号，配额三档才可测（口令与其它演示账号同规格）。
    { id: "u-student-p", username: "student-p", salt: "slt_studentp_5e7a", passwordHash: "23f62734d7aa92e3555997d74c0681e7c912109b9e17219d9c838e6b66c84749", name: "周小满", role: "student", stage: "primary", classId: "c1", avatarLetter: "周", department: "四年级(2)班" },
    { id: "u-student-s", username: "student-s", salt: "slt_students_8f3b", passwordHash: "50a24e627388a58f3d742c087a80eec33bb7ee0616a51ad97f378bd469d1d9e6", name: "赵宸", role: "student", stage: "senior", classId: "c1", avatarLetter: "赵", department: "高二(1)班" },
  ];
  for (const u of users) insUser.run(u.id, u.username, u.salt, u.passwordHash, u.name, u.role, u.stage, u.classId, u.avatarLetter, u.department);

  // 班级 c1 学生（服务端权威；与前端 classroom.ts 对齐）
  const insStu = d.prepare("INSERT INTO students (id,name,classId,mastery,trend,weakest,needHelp) VALUES (?,?,?,?,?,?,?)");
  const students: DbStudent[] = [
    { id: "s5", name: "李欣然", classId: "c1", mastery: 46, trend: 1, weakest: "二次函数", needHelp: true },
    { id: "s4", name: "陈一鸣", classId: "c1", mastery: 58, trend: -3, weakest: "受力分析", needHelp: true },
    { id: "s6", name: "周子墨", classId: "c1", mastery: 63, trend: 5, weakest: "时态运用", needHelp: false },
    { id: "s3", name: "王梓萱", classId: "c1", mastery: 74, trend: 6, weakest: "电路计算", needHelp: false },
    { id: "s2", name: "林晓彤", classId: "c1", mastery: 88, trend: 2, weakest: "完形填空", needHelp: false },
    { id: "s1", name: "赵宇航", classId: "c1", mastery: 92, trend: 4, weakest: "—", needHelp: false },
  ];
  for (const s of students) insStu.run(s.id, s.name, s.classId, s.mastery, s.trend, s.weakest, s.needHelp ? 1 : 0);

  const now = Date.now();
  const insPend = d.prepare("INSERT INTO pending (id,studentId,classId,subject,title,submittedAt) VALUES (?,?,?,?,?,?)");
  const pending: DbPending[] = [
    { id: "g1", studentId: "s4", classId: "c1", subject: "物理", title: "电路探秘 · 实验报告", submittedAt: now - 2 * 3600 * 1000 },
    { id: "g2", studentId: "s5", classId: "c1", subject: "数学", title: "习题 3.2", submittedAt: now - 5 * 3600 * 1000 },
    { id: "g3", studentId: "s6", classId: "c1", subject: "英语", title: "作文 My Hometown", submittedAt: now - 8 * 3600 * 1000 },
  ];
  for (const p of pending) insPend.run(p.id, p.studentId, p.classId, p.subject, p.title, p.submittedAt);
}

// 提示词 / 智能体种子（从 lib/data 迁移，ownerId=system 只读）。仅表空 + demo 门开启时插入。
function seedPromptsAgents(d: DatabaseSync): void {
  if (!demoSeedEnabled()) return;
  // 提示词种子版本化替换（第二代重建 + 对抗审计修订，见 lib/data/prompts.ts 头注）：
  // seed_meta 记录已播种版本，与 PROMPT_SEED_VERSION 不一致就整体替换 system 行——
  // 用户自建提示词（ownerId ≠ system）一行不动；同时清掉指向被删行的收藏，
  // 避免「我的收藏」里出现悬挂条目。内容修订必须 bump 版本号，否则老库不更新。
  d.exec(`CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT);`);
  const ver = d.prepare("SELECT value FROM seed_meta WHERE key = 'promptSeedVersion'").get();
  if (!ver || String(ver.value) !== PROMPT_SEED_VERSION) {
    d.prepare("DELETE FROM favorites WHERE kind = 'prompt' AND refId IN (SELECT id FROM prompts WHERE ownerId = ?)").run(SYSTEM_OWNER);
    d.prepare("DELETE FROM prompts WHERE ownerId = ?").run(SYSTEM_OWNER);
    d.prepare("INSERT INTO seed_meta (key, value) VALUES ('promptSeedVersion', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(PROMPT_SEED_VERSION);
  }
  const pRow = d.prepare("SELECT COUNT(*) AS n FROM prompts WHERE ownerId = ?").get(SYSTEM_OWNER);
  if (pRow && Number(pRow.n) === 0) {
    const ins = d.prepare(
      "INSERT INTO prompts (id,ownerId,category,icon,gradientKey,title,scene,role,recommendedModel,level,description,body,outputExample,variables,uses,favorites,score,featured,status,createdAt) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    );
    const now = Date.now();
    for (const p of SEED_PROMPTS) {
      ins.run(p.id, SYSTEM_OWNER, p.category, p.icon, legacyGradientToKey(p.gradient), p.title, p.scene, p.role, p.recommendedModel, p.level,
        p.description, p.body ?? null, p.outputExample ?? null, p.variables ? JSON.stringify(p.variables) : null,
        p.uses, p.favorites, p.score, p.featured ? 1 : 0, "pub", now);
    }
  }
  const aRow = d.prepare("SELECT COUNT(*) AS n FROM agents").get();
  if (aRow && Number(aRow.n) === 0) {
    const ins = d.prepare(
      "INSERT INTO agents (id,ownerId,name,category,icon,gradientKey,description,capabilities,recommendedModel,knowledgeBase,calls,score,status,creator,origin,createdAt) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    );
    const now = Date.now();
    for (const a of SEED_AGENTS) {
      ins.run(a.id, SYSTEM_OWNER, a.name, a.category, a.icon, legacyGradientToKey(a.gradient), a.description,
        JSON.stringify(a.capabilities), a.recommendedModel, a.knowledgeBase, a.calls, a.score, a.status, a.creator, a.origin ?? null, now);
    }
  }
}

function rid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ── row mappers（node:sqlite 返回松类型行；显式映射到领域类型）──
type Row = Record<string, string | number | bigint | Uint8Array | null>;
function mapUser(r: Row): DbUser {
  return {
    id: String(r.id), username: String(r.username), salt: String(r.salt), passwordHash: String(r.passwordHash),
    name: String(r.name), role: String(r.role) as SessionUser["role"], stage: String(r.stage) as SessionUser["stage"],
    classId: String(r.classId), avatarLetter: String(r.avatarLetter), department: String(r.department),
    sessionVersion: Math.max(1, Number(r.sessionVersion ?? 1)),
  };
}
function mapStudent(r: Row): DbStudent {
  return { id: String(r.id), name: String(r.name), classId: String(r.classId), mastery: Number(r.mastery), trend: Number(r.trend), weakest: String(r.weakest), needHelp: Number(r.needHelp) === 1 };
}
function mapPending(r: Row): DbPending {
  return { id: String(r.id), studentId: String(r.studentId), classId: String(r.classId), subject: String(r.subject), title: String(r.title), submittedAt: Number(r.submittedAt) };
}
function mapSession(r: Row): ChatSession {
  return { id: String(r.id), userId: String(r.userId), title: String(r.title ?? ""), modelId: String(r.modelId ?? ""), createdAt: Number(r.createdAt), updatedAt: Number(r.updatedAt), pinned: Number(r.pinned) === 1, agentId: r.agentId == null ? undefined : String(r.agentId), preview: r.preview == null ? undefined : String(r.preview) };
}
function mapMessage(r: Row): ChatMessage {
  return {
    id: String(r.id),
    sessionId: String(r.sessionId),
    role: String(r.role) as ChatMessage["role"],
    content: String(r.content ?? ""),
    modelId: String(r.modelId ?? ""),
    createdAt: Number(r.createdAt),
    source: r.source == null ? undefined : String(r.source) as ChatMessage["source"],
    durationMs: r.durationMs == null ? undefined : Number(r.durationMs),
  };
}
function mapFavorite(r: Row): Favorite {
  return { id: String(r.id), userId: String(r.userId), kind: String(r.kind) as FavoriteKind, refId: String(r.refId), meta: r.meta == null ? undefined : String(r.meta), createdAt: Number(r.createdAt) };
}
function safeJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  try { return JSON.parse(String(raw)) as T; } catch { return fallback; }
}
function mapPrompt(r: Row): DbPrompt {
  return {
    id: String(r.id), ownerId: String(r.ownerId), category: String(r.category) as PromptItem["category"],
    icon: String(r.icon ?? "Sparkles"), gradient: gradientCss(r.gradientKey ?? legacyGradientToKey(r.gradient as string)), title: String(r.title ?? ""),
    scene: String(r.scene ?? ""), role: String(r.role ?? ""), recommendedModel: String(r.recommendedModel) as PromptItem["recommendedModel"],
    level: String(r.level ?? "入门") as PromptItem["level"], description: String(r.description ?? ""),
    body: r.body == null ? undefined : String(r.body), outputExample: r.outputExample == null ? undefined : String(r.outputExample), variables: safeJson(r.variables, undefined as PromptItem["variables"]),
    uses: Number(r.uses), favorites: Number(r.favorites), score: Number(r.score),
    featured: Number(r.featured) === 1, status: String(r.status) === "draft" ? "draft" : "pub",
  };
}
function mapAgent(r: Row): DbAgent {
  return {
    id: String(r.id), ownerId: String(r.ownerId), name: String(r.name ?? ""), category: String(r.category) as AgentItem["category"],
    icon: String(r.icon ?? "Bot"), gradient: gradientCss(r.gradientKey ?? legacyGradientToKey(r.gradient as string)), description: String(r.description ?? ""),
    capabilities: safeJson<string[]>(r.capabilities, []), recommendedModel: String(r.recommendedModel) as AgentItem["recommendedModel"],
    ...(typeof r.systemPrompt === "string" ? { systemPrompt: r.systemPrompt } : {}),
    knowledgeBase: String(r.knowledgeBase ?? ""), calls: Number(r.calls), score: Number(r.score),
    status: String(r.status) as AgentItem["status"], creator: String(r.creator ?? ""),
    // NULL → undefined：旧行没有分级值就不给分级值，UI 端对 undefined 不渲染徽标。
    ...(r.origin === "school" || r.origin === "teacher" ? { origin: r.origin as AgentItem["origin"] } : {}),
  };
}
function mapArtifact(r: Row): import("@/lib/types").ArtifactItem {
  return {
    id: String(r.id), ownerId: String(r.ownerId), sessionId: String(r.sessionId),
    messageId: String(r.messageId), title: String(r.title ?? ""), content: String(r.content ?? ""),
    visibility: r.visibility === "class" ? "class" : "private",
    ...(r.classId ? { classId: String(r.classId) } : {}),
    createdAt: Number(r.createdAt),
  };
}
/** 发布给班级 / 撤回。owner 双条件即 RBAC；classId 必须来自服务端会话（调用方保证），
 *  不接受客户端传入的班级——教师不能替别的班发布。 */
export function setArtifactVisibility(ownerId: string, id: string, visibility: "private" | "class", classId: string | null): boolean {
  const r = db().prepare(
    "UPDATE artifacts SET visibility = ?, classId = ? WHERE id = ? AND ownerId = ?"
  ).run(visibility, visibility === "class" ? classId : null, id, ownerId);
  return Number(r.changes) > 0;
}
/** 学生侧：本班已发布产物。只按 visibility+classId 过滤，不暴露 private 行。 */
export function listClassArtifacts(classId: string): import("@/lib/types").ArtifactItem[] {
  return db().prepare(
    "SELECT * FROM artifacts WHERE visibility = 'class' AND classId = ? ORDER BY createdAt DESC"
  ).all(classId).map(mapArtifact);
}
/** 自动归档一条教师会话产物。标题取正文首个有效行（剥掉 markdown 记号），全部真实数据。
 *  INSERT OR IGNORE：messageId 撞 UNIQUE 时静默落空（幂等）。 */
export function saveChatArtifact(ownerId: string, sessionId: string, messageId: string, content: string): string | null {
  const firstLine = content.split(String.fromCharCode(10)).map((l) => l.replace(/^[#*>\-\s]+/, "").trim()).find((l) => l.length > 0) ?? "教学产物";
  const id = rid("art");
  const r = db().prepare(
    "INSERT OR IGNORE INTO artifacts (id,ownerId,sessionId,messageId,title,content,visibility,createdAt) VALUES (?,?,?,?,?,?,'private',?)"
  ).run(id, ownerId, sessionId, messageId, firstLine.slice(0, 60), content, Date.now());
  if (Number(r.changes) > 0) return id;
  // 幂等命中（同 messageId 已归档）：返回既有 id——回执 chip 指向的是真实存在的行。
  const row = db().prepare("SELECT id FROM artifacts WHERE messageId = ?").get(messageId);
  return row ? String(row.id) : null;
}
export function listArtifacts(ownerId: string): import("@/lib/types").ArtifactItem[] {
  return db().prepare("SELECT * FROM artifacts WHERE ownerId = ? ORDER BY createdAt DESC").all(ownerId).map(mapArtifact);
}
/** 只许删自己的：WHERE 双条件即 RBAC，非本人删除影响行数为 0。 */
export function deleteArtifact(ownerId: string, id: string): boolean {
  const r = db().prepare("DELETE FROM artifacts WHERE id = ? AND ownerId = ?").run(id, ownerId);
  return Number(r.changes) > 0;
}

function mapAudit(r: Row): AuditEntry {
  return { id: String(r.id), at: Number(r.at), userId: String(r.userId), role: String(r.role), path: String(r.path), action: String(r.action), result: String(r.result) as AuditEntry["result"] };
}
function mapTicket(r: Row): SafetyTicket {
  return { id: String(r.id), at: Number(r.at), userId: String(r.userId), type: String(r.type) as SafetyTicket["type"], status: String(r.status) as SafetyTicket["status"], detail: minimizeTicketDetail(r.detail == null ? undefined : String(r.detail)) };
}

function minimizeTicketDetail(detail?: string): string | undefined {
  const cleaned = (detail ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}/g, "[phone]")
    .replace(/\b\d{6,}\b/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TICKET_DETAIL_MAX);
  return cleaned || undefined;
}

// ── Users / auth ──
export async function findUserByCredentials(username: string, password: string): Promise<DbUser | null> {
  const r = db().prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!r) {
    await verifyPassword(password, "slt_missing_user_4f8d", "5a9e02f034f08f7f07ca2ea29ef4b458f903f837388653262191466e93ae3ea4");
    return null;
  }
  const u = mapUser(r);
  return (await verifyPassword(password, u.salt, u.passwordHash)) ? u : null;
}
export function findUserById(id: string): DbUser | null {
  const r = db().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return r ? mapUser(r) : null;
}
export function findUserByRole(role: string): DbUser | null {
  const r = db().prepare("SELECT * FROM users WHERE role = ? LIMIT 1").get(role);
  return r ? mapUser(r) : null;
}
export function toSessionUser(u: DbUser): SessionUser {
  const { salt: _s, passwordHash: _h, ...rest } = u; void _s; void _h;
  return rest;
}

// ── Class roster ──
export function listClassStudents(classId: string): DbStudent[] {
  return db().prepare("SELECT * FROM students WHERE classId = ?").all(classId).map(mapStudent);
}
export function listPending(classId: string): DbPending[] {
  return db().prepare("SELECT * FROM pending WHERE classId = ? ORDER BY submittedAt DESC").all(classId).map(mapPending);
}
export function classOverview(classId: string) {
  const students = listClassStudents(classId);
  const avg = students.length ? Math.round(students.reduce((a, s) => a + s.mastery, 0) / students.length) : 0;

  // 此处原有一个 `activeRate: 86` —— 一个从未测量过的常量，被 class 页与
  // dashboard 当作后端读数渲染成「本周活跃 86%」，而同一份快照的 honestStates
  // 还把它标成 status:"connected"，等于给这个数字盖了「已接入」的章。
  // 与 HourHeatmap 的假作息、ModelDonut 的满环是同一类铁律②违反。
  //
  // 为什么是删而不是改：students 表（见 initSchema）只有
  // id/name/classId/mastery/trend/weakest/needHelp 七列，**没有任何最后活跃时间**，
  // 「本周活跃率」在当前数据模型下算不出来。找个代理量（比如有提交的人数占比）
  // 凑一个近似值，只是换一种方式编造——那个数字仍然不是它标签所说的东西。
  // 要恢复这个指标，先加 students.lastActiveAt 并真实写入，再让 UI 读它。
  //
  // className 同理：原先无视传入的 classId 恒返回同一个班名。班名取自该班学生
  // 所属用户的 department 字段（seed 里就是这么存的），取不到就如实留空由 UI 兜。
  const named = db()
    .prepare("SELECT department FROM users WHERE classId = ? AND department IS NOT NULL AND department != '' LIMIT 1")
    .get(classId) as { department?: string } | undefined;

  return {
    className: named?.department ?? "",
    students: students.length,
    avgMastery: avg,
    pendingGrading: listPending(classId).length,
  };
}

// ── Mutations ──
export function addAudit(e: Omit<AuditEntry, "id" | "at">): AuditEntry {
  const entry: AuditEntry = { ...e, id: rid("aud"), at: Date.now() };
  db().prepare("INSERT INTO audit (id,at,userId,role,path,action,result) VALUES (?,?,?,?,?,?,?)")
    .run(entry.id, entry.at, entry.userId, entry.role, entry.path, entry.action, entry.result);
  maintainAuditRetention(entry.at);
  return entry;
}

let lastAuditMaintenanceAt = 0;
function maintainAuditRetention(now: number): void {
  if (now - lastAuditMaintenanceAt < 60 * 60 * 1000) return;
  lastAuditMaintenanceAt = now;
  const configuredDays = Number(process.env.EDUAI_AUDIT_RETENTION_DAYS ?? 365);
  const retentionDays = Number.isFinite(configuredDays) ? Math.min(3650, Math.max(30, Math.trunc(configuredDays))) : 365;
  const configuredRows = Number(process.env.EDUAI_AUDIT_MAX_ROWS ?? 250_000);
  const maxRows = Number.isFinite(configuredRows) ? Math.min(2_000_000, Math.max(10_000, Math.trunc(configuredRows))) : 250_000;
  db().prepare("DELETE FROM audit WHERE at < ?").run(now - retentionDays * 24 * 60 * 60 * 1000);
  db().prepare("DELETE FROM audit WHERE id IN (SELECT id FROM audit ORDER BY at DESC LIMIT -1 OFFSET ?)").run(maxRows);
}
export function listAudit(limit = 100): AuditEntry[] {
  return db().prepare("SELECT * FROM audit ORDER BY at DESC LIMIT ?").all(limit).map(mapAudit);
}
export function addTicket(e: Omit<SafetyTicket, "id" | "at" | "status">): SafetyTicket {
  const detail = minimizeTicketDetail(e.detail) ?? "";
  const tenMinutesAgo = Date.now() - 10 * 60_000;
  const existing = db().prepare(
    "SELECT * FROM tickets WHERE userId = ? AND type = ? AND COALESCE(detail,'') = ? AND status != 'resolved' AND at >= ? ORDER BY at DESC LIMIT 1"
  ).get(e.userId, e.type, detail, tenMinutesAgo);
  if (existing) return mapTicket(existing);

  const t: SafetyTicket = { ...e, detail: detail || undefined, id: rid("tkt"), at: Date.now(), status: "received" };
  db().prepare("INSERT INTO tickets (id,at,userId,type,status,detail) VALUES (?,?,?,?,?,?)")
    .run(t.id, t.at, t.userId, t.type, t.status, t.detail ?? null);
  return t;
}
// 工单可读路径（评审 P0：避免「只写不读」黑洞——让校内安全/心理团队真正看到求助）。
export function listTickets(limit = 100): SafetyTicket[] {
  return db().prepare("SELECT * FROM tickets ORDER BY at DESC LIMIT ?").all(limit).map(mapTicket);
}
export function updateTicketStatus(id: string, status: SafetyTicket["status"]): SafetyTicket | null {
  const res = db().prepare("UPDATE tickets SET status = ? WHERE id = ?").run(status, id);
  if (Number(res.changes) === 0) return null;
  const r = db().prepare("SELECT * FROM tickets WHERE id = ?").get(id);
  return r ? mapTicket(r) : null;
}
function epochDay(): number {
  return Math.floor(Date.now() / 86_400_000); // 天粒度桶键——只保留“哪一天”，不保留具体时刻
}
// 去标识化 upsert：按 (班级, 天, 类型) 累加计数；不接收也不存储 userId / 精确时间戳。
export function addIntegrity(e: { classId: string; kind: IntegrityBucket["kind"] }): void {
  db().prepare(
    "INSERT INTO integrity (id,classId,dayBucket,kind,count) VALUES (?,?,?,?,1) " +
    "ON CONFLICT(classId,dayBucket,kind) DO UPDATE SET count = count + 1"
  ).run(rid("int"), e.classId, epochDay(), e.kind);
}
export function integrityWeekly(classId: string): number {
  const since = epochDay() - 6; // 近 7 天（含今天）
  const r = db().prepare("SELECT COALESCE(SUM(count),0) AS n FROM integrity WHERE classId = ? AND dayBucket >= ?").get(classId, since);
  return Number(r?.n ?? 0);
}

// ── Phase B · 对话会话（归属 = userId；所有查询/改写都带 userId 作 RBAC 边界）──
export function createSession(userId: string, title: string, modelId: string, agentId?: string): ChatSession {
  const now = Date.now();
  const s: ChatSession = { id: rid("ses"), userId, title: (title || "新对话").slice(0, SESSION_TITLE_MAX), modelId, createdAt: now, updatedAt: now, pinned: false, agentId };
  db().prepare("INSERT INTO chat_sessions (id,userId,title,modelId,createdAt,updatedAt,pinned,agentId) VALUES (?,?,?,?,?,?,0,?)")
    .run(s.id, s.userId, s.title, s.modelId, s.createdAt, s.updatedAt, agentId ?? null);
  return s;
}
export function listSessions(userId: string, limit = 100): ChatSession[] {
  return db().prepare(
    "SELECT s.*, (SELECT content FROM chat_messages m WHERE m.sessionId = s.id ORDER BY m.createdAt DESC LIMIT 1) AS preview " +
    "FROM chat_sessions s WHERE s.userId = ? ORDER BY s.pinned DESC, s.updatedAt DESC LIMIT ?"
  ).all(userId, limit).map(mapSession);
}
/** M4/B5：真实会话总数（listSessions 有 LIMIT，成长页不能用列表长度冒充累计值）。 */
export function countSessions(userId: string): number {
  const r = db().prepare("SELECT COUNT(*) AS n FROM chat_sessions WHERE userId = ?").get(userId);
  return Number(r?.n ?? 0);
}
/** M4/B5：本人提问的学科分布（NULL → 未分类，如实呈现；只统计 user 角色消息）。 */
export function subjectDistribution(userId: string): Array<{ subject: string; count: number }> {
  return db().prepare(
    "SELECT COALESCE(m.subject,'未分类') AS subject, COUNT(*) AS count FROM chat_messages m " +
    "JOIN chat_sessions s ON s.id = m.sessionId WHERE s.userId = ? AND m.role = 'user' " +
    "GROUP BY COALESCE(m.subject,'未分类') ORDER BY count DESC"
  ).all(userId).map((r) => ({ subject: String(r.subject), count: Number(r.count) }));
}
/** M4/B5：近 N 日每日提问数（本地日期由调用方格式化；返回 epoch 毫秒便于按客户端时区分桶）。 */
export function recentQuestionTimes(userId: string, sinceMs: number): number[] {
  return db().prepare(
    "SELECT m.createdAt AS t FROM chat_messages m JOIN chat_sessions s ON s.id = m.sessionId " +
    "WHERE s.userId = ? AND m.role = 'user' AND m.createdAt >= ? ORDER BY m.createdAt ASC"
  ).all(userId, sinceMs).map((r) => Number(r.t));
}

export function getSession(userId: string, id: string): ChatSession | null {
  const r = db().prepare("SELECT * FROM chat_sessions WHERE id = ? AND userId = ?").get(id, userId);
  return r ? mapSession(r) : null;
}
export function deleteSession(userId: string, id: string): boolean {
  const res = db().prepare("DELETE FROM chat_sessions WHERE id = ? AND userId = ?").run(id, userId);
  if (Number(res.changes) === 0) return false;
  db().prepare("DELETE FROM chat_messages WHERE sessionId = ?").run(id);
  db().prepare("DELETE FROM favorites WHERE userId = ? AND kind = 'session' AND refId = ?").run(userId, id);
  return true;
}
export function renameSession(userId: string, id: string, title: string): ChatSession | null {
  const res = db().prepare("UPDATE chat_sessions SET title = ?, updatedAt = ? WHERE id = ? AND userId = ?")
    .run(title.slice(0, SESSION_TITLE_MAX), Date.now(), id, userId);
  if (Number(res.changes) === 0) return null;
  return getSession(userId, id);
}
export function setSessionPinned(userId: string, id: string, pinned: boolean): ChatSession | null {
  const res = db().prepare("UPDATE chat_sessions SET pinned = ? WHERE id = ? AND userId = ?").run(pinned ? 1 : 0, id, userId);
  if (Number(res.changes) === 0) return null;
  return getSession(userId, id);
}
export function clearSessionAgent(userId: string, id: string): ChatSession | null {
  const res = db().prepare("UPDATE chat_sessions SET agentId = NULL, updatedAt = ? WHERE id = ? AND userId = ?")
    .run(Date.now(), id, userId);
  if (Number(res.changes) === 0) return null;
  return getSession(userId, id);
}
// 发消息后 bump updatedAt；若会话仍是默认标题且传入首条用户消息，则用其摘要命名。
export function touchSession(userId: string, id: string, autoTitle?: string): void {
  if (autoTitle) {
    const cur = getSession(userId, id);
    if (cur && (!cur.title || cur.title === "新对话")) {
      db().prepare("UPDATE chat_sessions SET title = ?, updatedAt = ? WHERE id = ? AND userId = ?")
        .run(autoTitle.replace(/\s+/g, " ").trim().slice(0, SESSION_TITLE_MAX) || "新对话", Date.now(), id, userId);
      return;
    }
  }
  db().prepare("UPDATE chat_sessions SET updatedAt = ? WHERE id = ? AND userId = ?").run(Date.now(), id, userId);
}

// ── Phase B · 消息（归属经 sessionId → session.userId；调用方须先用 getSession 校验归属）──
export function addMessage(
  sessionId: string,
  role: ChatMessage["role"],
  content: string,
  modelId: string,
  meta: Pick<ChatMessage, "source" | "durationMs"> = {},
): ChatMessage {
  const m: ChatMessage = { id: rid("msg"), sessionId, role, content: content.slice(0, MESSAGE_CONTENT_MAX), modelId, createdAt: Date.now(), ...meta };
  // M4/B5：仅对学生提问（user 角色）做学科标注；识别不出写 NULL（统计如实归「未分类」）
  const subject = role === "user" ? detectSubject(m.content) : null;
  db().prepare("INSERT INTO chat_messages (id,sessionId,role,content,modelId,createdAt,source,durationMs,subject) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(m.id, m.sessionId, m.role, m.content, m.modelId, m.createdAt, m.source ?? null, m.durationMs ?? null, subject);
  return m;
}
export function listMessages(sessionId: string, limit = 500): ChatMessage[] {
  return db().prepare("SELECT * FROM chat_messages WHERE sessionId = ? ORDER BY createdAt ASC LIMIT ?").all(sessionId, limit).map(mapMessage);
}

export function messageBelongsToUser(userId: string, messageId: string): boolean {
  return !!db().prepare(
    "SELECT 1 FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.sessionId WHERE m.id = ? AND s.userId = ?"
  ).get(messageId, userId);
}

// ── Phase B · 收藏（UNIQUE(userId,kind,refId) 保证幂等）──
export function addFavorite(userId: string, kind: FavoriteKind, refId: string, meta?: string): Favorite {
  const existing = db().prepare("SELECT * FROM favorites WHERE userId = ? AND kind = ? AND refId = ?").get(userId, kind, refId);
  if (existing) return mapFavorite(existing);
  const f: Favorite = { id: rid("fav"), userId, kind, refId, meta: meta?.slice(0, 400), createdAt: Date.now() };
  db().prepare("INSERT INTO favorites (id,userId,kind,refId,meta,createdAt) VALUES (?,?,?,?,?,?)")
    .run(f.id, f.userId, f.kind, f.refId, f.meta ?? null, f.createdAt);
  return f;
}
export function removeFavorite(userId: string, kind: FavoriteKind, refId: string): boolean {
  const res = db().prepare("DELETE FROM favorites WHERE userId = ? AND kind = ? AND refId = ?").run(userId, kind, refId);
  return Number(res.changes) > 0;
}
export function listFavorites(userId: string, kind?: FavoriteKind): Favorite[] {
  if (kind) return db().prepare("SELECT * FROM favorites WHERE userId = ? AND kind = ? ORDER BY createdAt DESC").all(userId, kind).map(mapFavorite);
  return db().prepare("SELECT * FROM favorites WHERE userId = ? ORDER BY createdAt DESC").all(userId).map(mapFavorite);
}
export function isFavorite(userId: string, kind: FavoriteKind, refId: string): boolean {
  return !!db().prepare("SELECT 1 FROM favorites WHERE userId = ? AND kind = ? AND refId = ?").get(userId, kind, refId);
}

// ── Phase B · 反馈（👍/👎；UNIQUE(userId,messageId) → 每人每条消息一票，可切换/撤销）──
export function setFeedback(userId: string, messageId: string, sentiment: Sentiment | null): void {
  if (sentiment === null) {
    db().prepare("DELETE FROM feedback WHERE userId = ? AND messageId = ?").run(userId, messageId);
    return;
  }
  db().prepare(
    "INSERT INTO feedback (id,userId,messageId,sentiment,createdAt) VALUES (?,?,?,?,?) " +
    "ON CONFLICT(userId,messageId) DO UPDATE SET sentiment = excluded.sentiment, createdAt = excluded.createdAt"
  ).run(rid("fb"), userId, messageId, sentiment, Date.now());
}
export function getFeedback(userId: string, messageId: string): Sentiment | null {
  const r = db().prepare("SELECT sentiment FROM feedback WHERE userId = ? AND messageId = ?").get(userId, messageId);
  return r ? (String(r.sentiment) as Sentiment) : null;
}
// 载入某会话的交互状态（👍/👎 + 消息级收藏），供刷新后回显。以会话内消息 id 为过滤边界。
export function sessionInteractions(userId: string, sessionId: string): { feedback: Record<string, Sentiment>; favorites: string[] } {
  const msgIds = new Set(db().prepare("SELECT id FROM chat_messages WHERE sessionId = ?").all(sessionId).map((r) => String(r.id)));
  const feedback: Record<string, Sentiment> = {};
  for (const row of db().prepare("SELECT messageId, sentiment FROM feedback WHERE userId = ?").all(userId)) {
    const mid = String(row.messageId);
    if (msgIds.has(mid)) feedback[mid] = String(row.sentiment) as Sentiment;
  }
  const favorites = db().prepare("SELECT refId FROM favorites WHERE userId = ? AND kind = 'message'").all(userId)
    .map((r) => String(r.refId)).filter((id) => msgIds.has(id));
  return { feedback, favorites };
}

// ── Phase C · 提示词 CRUD（种子 ownerId=system 只读；用户创建可改删）──
export interface PromptInput {
  category: PromptItem["category"]; title: string; scene: string; role: string;
  recommendedModel: PromptItem["recommendedModel"]; level: PromptItem["level"];
  description: string; body?: string; icon?: string; gradient?: string;
  outputExample?: string;
  status?: "pub" | "draft";
  variables?: PromptItem["variables"];
}
export function listPrompts(viewerId?: string): DbPrompt[] {
  if (viewerId) {
    return db().prepare("SELECT * FROM prompts WHERE status = 'pub' OR ownerId = ? ORDER BY featured DESC, uses DESC, createdAt DESC")
      .all(viewerId).map(mapPrompt);
  }
  return db().prepare("SELECT * FROM prompts WHERE status = 'pub' ORDER BY featured DESC, uses DESC, createdAt DESC").all().map(mapPrompt);
}
export function getPrompt(id: string): DbPrompt | null {
  const r = db().prepare("SELECT * FROM prompts WHERE id = ?").get(id);
  return r ? mapPrompt(r) : null;
}
export function createPrompt(ownerId: string, input: PromptInput): DbPrompt {
  const p: DbPrompt = {
    id: rid("prm"), ownerId, category: input.category, icon: input.icon || "Sparkles",
    gradient: gradientCss(input.gradient), title: input.title, scene: input.scene,
    role: input.role, recommendedModel: input.recommendedModel, level: input.level, description: input.description,
    body: input.body, outputExample: input.outputExample, variables: input.variables, uses: 0, favorites: 0, score: 0, featured: false, status: input.status ?? "pub",
  };
  db().prepare(
    "INSERT INTO prompts (id,ownerId,category,icon,gradientKey,title,scene,role,recommendedModel,level,description,body,outputExample,variables,uses,favorites,score,featured,status,createdAt) " +
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,0,?,?)"
  ).run(p.id, p.ownerId, p.category, p.icon, isGradientKey(input.gradient) ? input.gradient : DEFAULT_GRADIENT_KEY, p.title, p.scene, p.role, p.recommendedModel, p.level,
    p.description, p.body ?? null, p.outputExample ?? null, p.variables ? JSON.stringify(p.variables) : null, p.status, Date.now());
  return p;
}
export function updatePrompt(ownerId: string, id: string, patch: Partial<PromptInput>): DbPrompt | null {
  const cur = getPrompt(id);
  if (!cur || cur.ownerId !== ownerId) return null; // 归属校验：仅自己创建的可改
  const next: PromptInput = {
    category: patch.category ?? cur.category, title: patch.title ?? cur.title, scene: patch.scene ?? cur.scene,
    role: patch.role ?? cur.role, recommendedModel: patch.recommendedModel ?? cur.recommendedModel,
    level: patch.level ?? cur.level, description: patch.description ?? cur.description,
    body: patch.body ?? cur.body, icon: patch.icon ?? cur.icon, gradient: patch.gradient ?? cur.gradient,
    outputExample: patch.outputExample ?? cur.outputExample,
    status: patch.status ?? cur.status,
    variables: patch.variables ?? cur.variables,
  };
  db().prepare(
    "UPDATE prompts SET category=?,title=?,scene=?,role=?,recommendedModel=?,level=?,description=?,body=?,outputExample=?,icon=?,gradientKey=?,variables=?,status=? WHERE id=? AND ownerId=?"
  ).run(next.category, next.title, next.scene, next.role, next.recommendedModel, next.level, next.description,
    next.body ?? null, next.outputExample ?? null, next.icon ?? null, isGradientKey(patch.gradient) ? patch.gradient : legacyGradientToKey(next.gradient), next.variables ? JSON.stringify(next.variables) : null, next.status ?? "pub", id, ownerId);
  return getPrompt(id);
}
export function deletePrompt(ownerId: string, id: string): boolean {
  const res = db().prepare("DELETE FROM prompts WHERE id = ? AND ownerId = ?").run(id, ownerId);
  if (Number(res.changes) === 0) return false;
  db().prepare("DELETE FROM favorites WHERE kind = 'prompt' AND refId = ?").run(id);
  return true;
}
export function incrementPromptUses(id: string): void {
  db().prepare("UPDATE prompts SET uses = uses + 1 WHERE id = ?").run(id);
}

// ── Phase C · 智能体 CRUD ──
export interface AgentInput {
  name: string; category: AgentItem["category"]; description: string;
  recommendedModel: AgentItem["recommendedModel"]; knowledgeBase: string;
  capabilities?: string[]; icon?: string; gradient?: string;
  systemPrompt?: string;
}
export function listAgents(): DbAgent[] {
  return db().prepare("SELECT * FROM agents ORDER BY calls DESC, createdAt DESC").all().map(mapAgent);
}
export function getAgent(id: string): DbAgent | null {
  const r = db().prepare("SELECT * FROM agents WHERE id = ?").get(id);
  return r ? mapAgent(r) : null;
}
export function createAgent(ownerId: string, creator: string, input: AgentInput): DbAgent {
  const a: DbAgent = {
    id: rid("agt"), ownerId, name: input.name, category: input.category, icon: input.icon || "Bot",
    gradient: gradientCss(input.gradient), description: input.description,
    systemPrompt: input.systemPrompt,
    capabilities: input.capabilities ?? [], recommendedModel: input.recommendedModel,
    // UI 自建的智能体恒为 teacher 级：school 级只能由校级管理流程授予（服务端权威），
    // 不存在「创建时自选校方认证」这条路径。
    knowledgeBase: input.knowledgeBase, calls: 0, score: 0, status: "draft", creator, origin: "teacher" as const,
  };
  db().prepare(
    "INSERT INTO agents (id,ownerId,name,category,icon,gradient,description,capabilities,recommendedModel,knowledgeBase,calls,score,status,creator,origin,createdAt,systemPrompt) " +
    "VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?)"
  ).run(a.id, a.ownerId, a.name, a.category, a.icon, isGradientKey(input.gradient) ? input.gradient : DEFAULT_GRADIENT_KEY, a.description, JSON.stringify(a.capabilities),
    a.recommendedModel, a.knowledgeBase, a.status, a.creator, "teacher", Date.now(), input.systemPrompt ?? null);
  return a;
}
export function updateAgent(ownerId: string, id: string, patch: Partial<AgentInput>): DbAgent | null {
  const cur = getAgent(id);
  if (!cur || cur.ownerId !== ownerId) return null;
  const next: AgentInput = {
    name: patch.name ?? cur.name, category: patch.category ?? cur.category, description: patch.description ?? cur.description,
    recommendedModel: patch.recommendedModel ?? cur.recommendedModel, knowledgeBase: patch.knowledgeBase ?? cur.knowledgeBase,
    capabilities: patch.capabilities ?? cur.capabilities, icon: patch.icon ?? cur.icon, gradient: patch.gradient ?? cur.gradient,
    systemPrompt: patch.systemPrompt ?? cur.systemPrompt,
  };
  db().prepare(
    "UPDATE agents SET name=?,category=?,description=?,recommendedModel=?,knowledgeBase=?,capabilities=?,icon=?,gradientKey=?,systemPrompt=? WHERE id=? AND ownerId=?"
  ).run(next.name, next.category, next.description, next.recommendedModel, next.knowledgeBase,
    JSON.stringify(next.capabilities ?? []), next.icon ?? null, isGradientKey(patch.gradient) ? patch.gradient : legacyGradientToKey(next.gradient), next.systemPrompt ?? null, id, ownerId);
  return getAgent(id);
}
export function deleteAgent(ownerId: string, id: string): boolean {
  const res = db().prepare("DELETE FROM agents WHERE id = ? AND ownerId = ?").run(id, ownerId);
  if (Number(res.changes) === 0) return false;
  db().prepare("DELETE FROM favorites WHERE kind = 'agent' AND refId = ?").run(id);
  return true;
}
// 状态流转：owner 可 draft→review（提交审核）；admin 可 review→pub / →disabled（发布审批）。API 层按角色门控。
export function setAgentStatus(id: string, status: AgentItem["status"]): DbAgent | null {
  const res = db().prepare("UPDATE agents SET status = ? WHERE id = ?").run(status, id);
  if (Number(res.changes) === 0) return null;
  return getAgent(id);
}
export function incrementAgentCalls(id: string): void {
  db().prepare("UPDATE agents SET calls = calls + 1 WHERE id = ?").run(id);
}

// ── Phase D · 用户偏好（服务端权威）──
function mapPrefs(r: Row): UserPrefs {
  return {
    density: String(r.density) === "compact" ? "compact" : "comfortable",
    fontScale: Number(r.fontScale) || 1,
    reduceMotion: Number(r.reduceMotion) === 1,
    showPeerComparison: Number(r.showPeerComparison) === 1,
    defaultModel: String(r.defaultModel || "chatgpt"),
    assistantRole: (["teacher", "student", "research", "admin"].includes(String(r.assistantRole)) ? String(r.assistantRole) : "teacher") as UserPrefs["assistantRole"],
    bio: String(r.bio ?? ""),
    socratic: Number(r.socratic) === 1,
    onboardingVersion: Math.max(0, Number(r.onboardingVersion) || 0),
    onboardingStep: Math.max(0, Number(r.onboardingStep) || 0),
    onboardingCompletedAt: r.onboardingCompletedAt == null ? null : Number(r.onboardingCompletedAt),
  };
}
export function getUserPrefs(userId: string): UserPrefs {
  const r = db().prepare("SELECT * FROM user_prefs WHERE userId = ?").get(userId);
  return r ? mapPrefs(r) : { ...DEFAULT_PREFS };
}
export function setUserPrefs(userId: string, patch: Partial<UserPrefs>): UserPrefs {
  const cur = getUserPrefs(userId);
  const next: UserPrefs = { ...cur, ...patch };
  db().prepare(
    "INSERT INTO user_prefs (userId,density,fontScale,reduceMotion,showPeerComparison,defaultModel,assistantRole,bio,socratic,onboardingVersion,onboardingStep,onboardingCompletedAt,updatedAt) " +
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(userId) DO UPDATE SET " +
    "density=excluded.density,fontScale=excluded.fontScale,reduceMotion=excluded.reduceMotion,showPeerComparison=excluded.showPeerComparison," +
    "defaultModel=excluded.defaultModel,assistantRole=excluded.assistantRole,bio=excluded.bio,socratic=excluded.socratic," +
    "onboardingVersion=excluded.onboardingVersion,onboardingStep=excluded.onboardingStep,onboardingCompletedAt=excluded.onboardingCompletedAt,updatedAt=excluded.updatedAt"
  ).run(userId, next.density, next.fontScale, next.reduceMotion ? 1 : 0, next.showPeerComparison ? 1 : 0,
    next.defaultModel, next.assistantRole, next.bio, next.socratic ? 1 : 0,
    next.onboardingVersion, next.onboardingStep, next.onboardingCompletedAt, Date.now());
  return next;
}

// ── M1/B1：班级苏格拉底锁定策略（服务端权威；教师写入带 audit，学生端只读生效态）──
export interface ClassPolicy { classId: string; socraticLock: boolean; updatedBy?: string; updatedAt?: number }
export function getClassPolicy(classId: string): ClassPolicy {
  if (!classId) return { classId, socraticLock: false };
  const r = db().prepare("SELECT * FROM class_policy WHERE classId = ?").get(classId);
  return r
    ? { classId, socraticLock: Number(r.socraticLock) === 1, updatedBy: r.updatedBy ? String(r.updatedBy) : undefined, updatedAt: r.updatedAt ? Number(r.updatedAt) : undefined }
    : { classId, socraticLock: false };
}
// ── M3/B2：守护策略 CRUD（生效配置 = global 行 ?? 默认值；范围校验在路由层 zod）──
export interface GuardianCfg { limitMin: number; curfewStart: number; curfewEnd: number }
export type GuardianSource = "class" | "global" | "default";

// 与 lib/guardian.ts GUARDIAN_DEFAULTS 同步：宵禁默认停用（start===end），管理端可重设
const GUARDIAN_FALLBACK: GuardianCfg = { limitMin: 40, curfewStart: 0, curfewEnd: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGuardian(r: any): GuardianCfg {
  return { limitMin: Number(r.limitMin), curfewStart: Number(r.curfewStart), curfewEnd: Number(r.curfewEnd) };
}
/** 读某一作用域的原始配置（不做回退）；scope='global' 或 classId。 */
export function getGuardianScope(scope: string): (GuardianCfg & { updatedBy?: string; updatedAt?: number }) | null {
  const r = db().prepare("SELECT * FROM guardian_settings WHERE scope = ?").get(scope);
  return r ? { ...mapGuardian(r), updatedBy: r.updatedBy ? String(r.updatedBy) : undefined, updatedAt: r.updatedAt ? Number(r.updatedAt) : undefined } : null;
}
/**
 * BL2 生效配置（优先级：班级行 → 全局行 → 内置默认）。
 * source 如实标注来源，学生端与管理端据此显示「班级/全校/默认」，不谎称已配置。
 */
export function getGuardianSettings(classId?: string): GuardianCfg & { source: GuardianSource } {
  if (classId && classId.trim()) {
    const c = getGuardianScope(classId);
    if (c) return { ...c, source: "class" };
  }
  const g = getGuardianScope("global");
  if (g) return { ...g, source: "global" };
  return { ...GUARDIAN_FALLBACK, source: "default" };
}
/** 写某一作用域（scope='global' 由管理员写；classId 由该班教师写，路由层校验归属）。 */
export function setGuardianSettings(cfg: GuardianCfg, updatedBy: string, scope = "global"): void {
  db().prepare(
    "INSERT INTO guardian_settings (scope,limitMin,curfewStart,curfewEnd,updatedBy,updatedAt) VALUES (?,?,?,?,?,?) " +
    "ON CONFLICT(scope) DO UPDATE SET limitMin=excluded.limitMin,curfewStart=excluded.curfewStart,curfewEnd=excluded.curfewEnd,updatedBy=excluded.updatedBy,updatedAt=excluded.updatedAt"
  ).run(scope, cfg.limitMin, cfg.curfewStart, cfg.curfewEnd, updatedBy, Date.now());
}
/** 清除班级覆盖 → 回落全校策略（教师可撤销自己的微调）。 */
export function clearGuardianScope(scope: string): boolean {
  if (scope === "global") return false; // 全局行不允许删除（删则全站回落内置默认，属误操作）
  return Number(db().prepare("DELETE FROM guardian_settings WHERE scope = ?").run(scope).changes) > 0;
}

export function setClassPolicy(classId: string, socraticLock: boolean, updatedBy: string): ClassPolicy {
  db().prepare(
    "INSERT INTO class_policy (classId,socraticLock,updatedBy,updatedAt) VALUES (?,?,?,?) " +
    "ON CONFLICT(classId) DO UPDATE SET socraticLock=excluded.socraticLock,updatedBy=excluded.updatedBy,updatedAt=excluded.updatedAt"
  ).run(classId, socraticLock ? 1 : 0, updatedBy, Date.now());
  return getClassPolicy(classId);
}

// ── Phase D · 个人资料（name 存 users；bio 存 user_prefs）──
export function updateUserProfile(userId: string, patch: { name?: string; bio?: string }): void {
  if (patch.name && patch.name.trim()) {
    const nm = patch.name.trim().slice(0, 40);
    db().prepare("UPDATE users SET name = ?, avatarLetter = ? WHERE id = ?").run(nm, nm.charAt(0), userId);
  }
  if (patch.bio !== undefined) setUserPrefs(userId, { bio: patch.bio.slice(0, 200) });
}

// ── Phase D · 改密（校验旧口令 → 新 salt+PBKDF2 写回 users）──
export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const u = findUserById(userId);
  if (!u) return { ok: false, error: "not_found" };
  const okOld = await verifyPassword(oldPassword, u.salt, u.passwordHash);
  if (!okOld) return { ok: false, error: "wrong_password" };
  const salt = genSalt();
  const hash = await hashPassword(newPassword, salt);
  db().prepare("UPDATE users SET salt = ?, passwordHash = ?, sessionVersion = sessionVersion + 1 WHERE id = ?").run(salt, hash, userId);
  return { ok: true };
}

export function revokeUserSessions(userId: string): void {
  db().prepare("UPDATE users SET sessionVersion = sessionVersion + 1 WHERE id = ?").run(userId);
}

// ── Phase D · 通知 ──
function mapNotification(r: Row): Notification {
  return { id: String(r.id), userId: String(r.userId), kind: String(r.kind), title: String(r.title ?? ""), body: String(r.body ?? ""), read: Number(r.read) === 1, createdAt: Number(r.createdAt) };
}
export function addNotification(userId: string, kind: string, title: string, body: string): Notification {
  const n: Notification = { id: rid("ntf"), userId, kind, title, body, read: false, createdAt: Date.now() };
  db().prepare("INSERT INTO notifications (id,userId,kind,title,body,read,createdAt) VALUES (?,?,?,?,?,0,?)")
    .run(n.id, n.userId, n.kind, n.title, n.body, n.createdAt);
  db().prepare("DELETE FROM notifications WHERE userId = ? AND id NOT IN (SELECT id FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50)").run(userId, userId);
  return n;
}
export function listNotifications(userId: string, limit = 30, seedWelcome = true): Notification[] {
  // 首次为该用户播种一条欢迎通知（真 DB 行，非编造），保证铃铛有真实内容且可标记已读。
  const cnt = db().prepare("SELECT COUNT(*) AS n FROM notifications WHERE userId = ?").get(userId);
  if (seedWelcome && cnt && Number(cnt.n) === 0 && demoSeedEnabled()) {
    addNotification(userId, "system", "欢迎使用「i-learning」", "对话、提示词、智能体均已接入校内后端。危机与学术诚信由服务端安全策略把关，未成年人安全优先。");
  }
  return db().prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ?").all(userId, limit).map(mapNotification);
}
export function unreadNotificationCount(userId: string): number {
  const r = db().prepare("SELECT COUNT(*) AS n FROM notifications WHERE userId = ? AND read = 0").get(userId);
  return Number(r?.n ?? 0);
}
export function markNotificationRead(userId: string, id: string): boolean {
  const res = db().prepare("UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?").run(id, userId);
  return Number(res.changes) > 0;
}
export function markAllNotificationsRead(userId: string): void {
  db().prepare("UPDATE notifications SET read = 1 WHERE userId = ?").run(userId);
}

// ── Phase D · 全局搜索（聚合当前用户的会话 + 全部提示词/智能体；仅关键词，非向量）──
export interface SearchResult { kind: "session" | "prompt" | "agent"; id: string; title: string; sub: string; }
export function searchAll(userId: string, q: string, perKind = 6): SearchResult[] {
  const term = q.trim();
  if (!term) return [];
  const like = `%${term}%`;
  const out: SearchResult[] = [];
  for (const r of db().prepare(
    "SELECT id,title, COALESCE((SELECT content FROM chat_messages m WHERE m.sessionId=s.id ORDER BY createdAt DESC LIMIT 1),'') AS preview " +
    "FROM chat_sessions s WHERE userId=? AND (title LIKE ? OR id IN (SELECT sessionId FROM chat_messages WHERE content LIKE ?)) ORDER BY updatedAt DESC LIMIT ?"
  ).all(userId, like, like, perKind)) {
    out.push({ kind: "session", id: String(r.id), title: String(r.title || "新对话"), sub: String(r.preview || "").slice(0, 50) });
  }
  for (const r of db().prepare(
    "SELECT id,title,description FROM prompts WHERE (status = 'pub' OR ownerId = ?) AND (title LIKE ? OR description LIKE ?) ORDER BY uses DESC LIMIT ?"
  ).all(userId, like, like, perKind)) {
    out.push({ kind: "prompt", id: String(r.id), title: String(r.title), sub: String(r.description || "").slice(0, 50) });
  }
  for (const r of db().prepare(
    "SELECT id,name,description FROM agents WHERE status = 'pub' AND (name LIKE ? OR description LIKE ?) ORDER BY calls DESC LIMIT ?"
  ).all(like, like, perKind)) {
    out.push({ kind: "agent", id: String(r.id), title: String(r.name), sub: String(r.description || "").slice(0, 50) });
  }
  return out;
}

// ── Phase E · 通知生成（真实事件驱动）──
function listAdminUserIds(): string[] {
  return db().prepare("SELECT id FROM users WHERE role IN ('admin','college-admin')").all().map((r) => String(r.id));
}
export function notifyAdmins(kind: string, title: string, body: string): void {
  for (const id of listAdminUserIds()) addNotification(id, kind, title, body);
}
export function notifyUser(userId: string, kind: string, title: string, body: string): void {
  addNotification(userId, kind, title, body);
}

// ── Phase E · 知识库文件（诚实关键词检索，非向量）──
function mapKbFile(r: Row): KbFile {
  const text = r.textContent == null ? "" : String(r.textContent);
  return {
    id: String(r.id), ownerId: String(r.ownerId), uploader: String(r.uploader ?? ""), name: String(r.name ?? ""),
    type: String(r.type ?? "TXT"), sizeBytes: Number(r.sizeBytes) || 0, scope: String(r.scope ?? "self"),
    chunkCount: Number(r.chunkCount) || 0, hasText: text.trim().length > 0, createdAt: Number(r.createdAt),
  };
}
function chunkCountOf(text: string): number {
  const t = (text || "").trim();
  if (!t) return 0;
  return Math.max(1, Math.ceil(t.length / 400)); // 诚实：按 ~400 字切段计数，无向量
}
export interface KbInput { name: string; type: string; sizeBytes: number; scope: string; textContent?: string; ownerClassId?: string; ownerStage?: string; }
export function addKbFile(ownerId: string, uploader: string, input: KbInput): KbFile {
  const text = (input.textContent ?? "").slice(0, 200_000);
  const f: KbFile = {
    id: rid("kb"), ownerId, uploader, name: input.name.slice(0, 160), type: input.type.slice(0, 8),
    sizeBytes: Math.max(0, Math.floor(input.sizeBytes)), scope: input.scope, chunkCount: chunkCountOf(text),
    hasText: text.trim().length > 0, createdAt: Date.now(),
  };
  db().prepare("INSERT INTO kb_files (id,ownerId,ownerClassId,ownerStage,uploader,name,type,sizeBytes,scope,textContent,chunkCount,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(f.id, f.ownerId, input.ownerClassId ?? "", input.ownerStage ?? "", f.uploader, f.name, f.type, f.sizeBytes, f.scope, text || null, f.chunkCount, f.createdAt);
  return f;
}
export function kbUsage(ownerId: string): { files: number; bytes: number; textChars: number } {
  const row = db().prepare(`SELECT COUNT(*) AS files, COALESCE(SUM(sizeBytes),0) AS bytes,
    COALESCE(SUM(LENGTH(COALESCE(textContent,''))),0) AS textChars FROM kb_files WHERE ownerId = ?`).get(ownerId) as Row;
  return { files: Number(row.files ?? 0), bytes: Number(row.bytes ?? 0), textChars: Number(row.textChars ?? 0) };
}
// 可见性：暴露「自己上传的」+「全校公开(all)」+「课程共享(course，且与上传者同班 classId)」+「学部共享(college，且与上传者同学段 stage)」；管理员可见全部。
// 课程/学部共享均用**真实成员关系**验证——course 用 users.classId、college 用 users.stage(学段=学部)：仅同班/同学部用户可见对应文件正文，跨班/跨学部不可见。
// 占位绑定顺序固定为 (userId, classId, stage)；isAdmin 以字面 OR 追加，保持绑定数量一致。
function kbVisibleClause(isAdmin: boolean): string {
  return `(ownerId = ? OR scope = 'all' OR (scope = 'course' AND ownerClassId != '' AND ownerClassId = ?) OR (scope = 'college' AND ownerStage != '' AND ownerStage = ?)${isAdmin ? " OR 1=1" : ""})`;
}
export function listKbFiles(userId: string, isAdmin: boolean, classId: string, stage: string, limit = 200): KbFile[] {
  return db().prepare(`SELECT * FROM kb_files WHERE ${kbVisibleClause(isAdmin)} ORDER BY createdAt DESC LIMIT ?`).all(userId, classId, stage, limit).map(mapKbFile);
}
export function getKbFile(userId: string, isAdmin: boolean, classId: string, stage: string, id: string): (KbFile & { textPreview: string }) | null {
  const r = db().prepare(`SELECT * FROM kb_files WHERE id = ? AND ${kbVisibleClause(isAdmin)}`).get(id, userId, classId, stage);
  if (!r) return null;
  const meta = mapKbFile(r);
  const text = r.textContent == null ? "" : String(r.textContent);
  return { ...meta, textPreview: text.slice(0, 600) };
}
export function deleteKbFile(userId: string, id: string): boolean {
  return Number(db().prepare("DELETE FROM kb_files WHERE id = ? AND ownerId = ?").run(id, userId).changes) > 0;
}
// 统计 needle 在 haystack 中出现次数（无重叠）。
function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i >= 0) { n += 1; i = haystack.indexOf(needle, i + needle.length); }
  return n;
}

// 分词：显式空白/标点切分 + 中文 2-gram。无神经/词典分词器时，让「滑动摩擦力实验」这类会话式中文问句
// 也能子串命中含「滑动摩擦力」的文档（否则整句 token 无法子串匹配 → 检索恒 0 命中）。英文/数字/编号按整词。
// ≤12 字的短块保留整体（精确短语命中时覆盖度更高、排序更靠前）；仍属关键词检索，非神经向量。
function buildSearchTerms(raw: string): string[] {
  const terms = new Set<string>();
  const chunks = raw.toLowerCase().split(/[\s,，、;；。.!！?？:：]+/).map((t) => t.trim()).filter(Boolean);
  for (const chunk of chunks) {
    if (!/[一-鿿]/.test(chunk)) { terms.add(chunk); continue; } // 纯英文/数字/编号：整词
    if (chunk.length <= 12) terms.add(chunk); // 短块保留整体；长句只靠 bigram，避免整句 token 空占
    for (const seg of chunk.match(/[一-鿿]+/g) ?? []) {
      if (seg.length === 1) { terms.add(seg); continue; }
      for (let i = 0; i + 2 <= seg.length; i += 1) terms.add(seg.slice(i, i + 2)); // 连续中文段 → 2-gram
    }
    for (const alnum of chunk.match(/[a-z0-9][a-z0-9_-]*/gi) ?? []) if (alnum.length >= 2) terms.add(alnum.toLowerCase()); // 中文中夹带的英文/编号
  }
  return Array.from(terms).slice(0, 20);
}

// 关键词检索（多词分词 + 中文 2-gram + 相关性排序，非神经向量）。
// 隐私铁律：kbVisibleClause（可见性）保持不变且优先绑定，只在其已过滤的可见行内做召回与重排。
export function searchKb(userId: string, isAdmin: boolean, classId: string, stage: string, q: string, limit = 12): KbSearchHit[] {
  const raw = q.trim();
  if (!raw) return [];
  const tokens = buildSearchTerms(raw);
  if (tokens.length === 0) return [];

  // 候选召回：可见性子句(不动，绑定 userId/classId/stage) AND 命中任一词元；多取候选后在 JS 重排。
  const perToken = tokens.map(() => "(name LIKE ? OR textContent LIKE ?)").join(" OR ");
  const likeBinds: string[] = [];
  for (const t of tokens) { const l = `%${t}%`; likeBinds.push(l, l); }
  const candidateCap = Math.min(200, Math.max(limit * 5, 40));
  const rows = db().prepare(
    `SELECT id,name,textContent,createdAt FROM kb_files WHERE ${kbVisibleClause(isAdmin)} AND (${perToken}) ORDER BY createdAt DESC LIMIT ?`
  ).all(userId, classId, stage, ...likeBinds, candidateCap);

  // 打分：覆盖词元数(主导) + 文件名命中加权 + 词频(阻尼，单词元最多计 5) + 轻微时新度 tiebreak。
  const now = Date.now();
  const scored = rows.map((r) => {
    const name = String(r.name);
    const text = r.textContent == null ? "" : String(r.textContent);
    const nameLower = name.toLowerCase();
    const textLower = text.toLowerCase();
    let covered = 0, nameHits = 0, freq = 0;
    for (const t of tokens) {
      const inName = nameLower.includes(t);
      const inText = textLower.includes(t);
      if (inName || inText) covered += 1;
      if (inName) nameHits += 1;
      if (inText) freq += Math.min(5, occurrences(textLower, t));
    }
    const ageMs = now - Number(r.createdAt);
    const recency = Math.max(0, 1 - ageMs / (365 * 24 * 3600 * 1000)); // 一年内 0..1 线性
    const score = covered * 1000 + nameHits * 120 + Math.log2(1 + freq) * 20 + recency * 2;
    return { r, name, text, textLower, score, covered };
  })
    // 丢弃「仅因 SQL LIKE 把 _/% 当通配符而过召回、实际不含任何词元」的行——避免返回零命中的假阳性。
    .filter((s) => s.covered > 0);
  scored.sort((a, b) => b.score - a.score || Number(b.r.createdAt) - Number(a.r.createdAt));

  return scored.slice(0, limit).map(({ r, name, text, textLower }) => {
    // 片段：围绕最早命中的词元。
    let idx = -1;
    let hitLen = 0;
    for (const t of tokens) {
      const p = textLower.indexOf(t);
      if (p >= 0 && (idx < 0 || p < idx)) { idx = p; hitLen = t.length; }
    }
    let snippet: string;
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      snippet = (start > 0 ? "…" : "") + text.slice(start, idx + hitLen + 60).replace(/\s+/g, " ").trim() + "…";
    } else {
      snippet = "（命中文件名）";
    }
    return { fileId: String(r.id), name, snippet };
  });
}

// ── W-B1 · 对话附件上传（服务端解析缓存）──
export interface UploadRow {
  id: string; userId: string; name: string; mime: string; sizeBytes: number;
  chars: number; status: "parsed" | "failed"; intent: string; createdAt: number;
}
export function addUpload(userId: string, input: {
  name: string; mime: string; sizeBytes: number; textContent: string;
  status: "parsed" | "failed"; intent: string;
}): UploadRow {
  const text = input.textContent.slice(0, 200_000);
  const row: UploadRow = {
    id: rid("up"), userId, name: input.name.slice(0, 160), mime: input.mime.slice(0, 80),
    sizeBytes: Math.max(0, Math.floor(input.sizeBytes)), chars: text.length,
    status: input.status, intent: input.intent.slice(0, 24), createdAt: Date.now(),
  };
  db().prepare("INSERT INTO uploads (id,userId,name,mime,sizeBytes,textContent,chars,status,intent,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(row.id, row.userId, row.name, row.mime, row.sizeBytes, text || null, row.chars, row.status, row.intent, row.createdAt);
  return row;
}
// 归属即权限：只取**当前用户自己的**已解析上传——uploadIds 是可伪造的请求体字段，
// 不做 userId 过滤等于把任意用户的文档内容注入任意人的对话（与 kb 可见性同一条纪律）。
export function getUploadsForUser(userId: string, ids: string[]): Array<UploadRow & { textContent: string }> {
  const take = ids.slice(0, 3);
  if (take.length === 0) return [];
  const qs = take.map(() => "?").join(",");
  return db()
    .prepare(`SELECT id,userId,name,mime,sizeBytes,COALESCE(textContent,'') AS textContent,chars,status,intent,createdAt FROM uploads WHERE userId = ? AND status = 'parsed' AND id IN (${qs})`)
    .all(userId, ...take) as unknown as Array<UploadRow & { textContent: string }>;
}

// ── W-B2 · 随堂小测（出题落盘 → 服务端确定性判分 → 错题回流）──
export interface QuizAttempt {
  id: string; userId: string; subject: string; knowledgePoint: string;
  question: string; options: string[]; answerIdx: number;
  studentIdx: number | null; correct: number | null; ruleVersion: string;
  createdAt: number; answeredAt: number | null;
}
export function addQuizQuestion(userId: string, q: {
  subject: string; knowledgePoint: string; question: string; options: string[]; answerIdx: number;
}): QuizAttempt {
  const row: QuizAttempt = {
    id: rid("qz"), userId, subject: q.subject.slice(0, 24), knowledgePoint: q.knowledgePoint.slice(0, 40),
    question: q.question.slice(0, 600), options: q.options.map((o) => o.slice(0, 160)).slice(0, 4),
    answerIdx: q.answerIdx, studentIdx: null, correct: null, ruleVersion: "v1-exact-index",
    createdAt: Date.now(), answeredAt: null,
  };
  db().prepare("INSERT INTO quiz_attempts (id,userId,subject,knowledgePoint,question,options,answerIdx,studentIdx,correct,ruleVersion,createdAt,answeredAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(row.id, row.userId, row.subject, row.knowledgePoint, row.question, JSON.stringify(row.options), row.answerIdx, null, null, row.ruleVersion, row.createdAt, null);
  return row;
}
export function gradeQuizAnswer(userId: string, id: string, studentIdx: number): { correct: boolean; answerIdx: number; attempt: QuizAttempt } | null {
  // 双条件取行：id 归属当前用户——判分接口的 id 是可伪造请求体字段
  const row = db().prepare("SELECT * FROM quiz_attempts WHERE id = ? AND userId = ?").get(id, userId) as Record<string, unknown> | undefined;
  if (!row || row.answeredAt != null) return null; // 不存在或已作答（一题一答，防刷正确率）
  const answerIdx = Number(row.answerIdx);
  const correct = studentIdx === answerIdx;
  db().prepare("UPDATE quiz_attempts SET studentIdx = ?, correct = ?, answeredAt = ? WHERE id = ?")
    .run(studentIdx, correct ? 1 : 0, Date.now(), id);
  const attempt: QuizAttempt = {
    id: String(row.id), userId: String(row.userId), subject: String(row.subject), knowledgePoint: String(row.knowledgePoint ?? ""),
    question: String(row.question), options: JSON.parse(String(row.options)) as string[], answerIdx,
    studentIdx, correct: correct ? 1 : 0, ruleVersion: String(row.ruleVersion), createdAt: Number(row.createdAt), answeredAt: Date.now(),
  };
  return { correct, answerIdx, attempt };
}
export function quizStats(userId: string, days = 30): { total: number; correct: number } {
  const since = Date.now() - days * 86_400_000;
  const r = db().prepare("SELECT COUNT(*) AS total, COALESCE(SUM(correct),0) AS ok FROM quiz_attempts WHERE userId = ? AND answeredAt IS NOT NULL AND answeredAt >= ?").get(userId, since) as { total: number; ok: number };
  return { total: Number(r.total), correct: Number(r.ok) };
}

// ── W-B2 · 教师快捷点评 ──
export const EVAL_TAGS = ["专注投入", "积极提问", "乐于互助", "明显进步", "课堂展示", "需要关注"] as const;
export interface EvaluationRow { id: string; studentId: string; teacherId: string; tag: string; score: number; note: string; createdAt: number }
export function addEvaluation(teacherId: string, studentId: string, tag: string, note?: string): EvaluationRow {
  // ClassDojo 零分反馈的启示：「需要关注」记 0 分而非负分——点评是反馈不是惩罚
  const score = tag === "需要关注" ? 0 : 1;
  const row: EvaluationRow = { id: rid("ev"), studentId, teacherId, tag, score, note: (note ?? "").slice(0, 200), createdAt: Date.now() };
  db().prepare("INSERT INTO evaluations (id,studentId,teacherId,tag,score,note,createdAt) VALUES (?,?,?,?,?,?,?)")
    .run(row.id, row.studentId, row.teacherId, row.tag, row.score, row.note || null, row.createdAt);
  return row;
}
export function listEvaluations(studentId: string, limit = 20): EvaluationRow[] {
  return db().prepare("SELECT * FROM evaluations WHERE studentId = ? ORDER BY createdAt DESC LIMIT ?").all(studentId, limit) as unknown as EvaluationRow[];
}
export function evalStats(studentId: string, days = 30): { total: number; positive: number } {
  const since = Date.now() - days * 86_400_000;
  const r = db().prepare("SELECT COUNT(*) AS total, COALESCE(SUM(score),0) AS pos FROM evaluations WHERE studentId = ? AND createdAt >= ?").get(studentId, since) as { total: number; pos: number };
  return { total: Number(r.total), positive: Number(r.pos) };
}

// ── W-B2 · 课堂雷达聚合（规格红线 R2/R6：每维独立真实数据流，无数据 = null 不编造）──
// 口径全部写死在此处便于复算审计：
//   正确率   = 近30天 quiz_attempts 已判分 correct/total（total=0 → null）
//   薄弱改善 = 错题清理率 = 已复习(reviewedAt 非空)/全部错题（无错题 → null）
//   学习参与 = 近7天 chat_usage 有使用记录的天数 / 7（0 天 → null）
//   教师评价 = 近30天 positive/min(total,8) 归一（无点评 → null）
//   知识覆盖 = (quiz∪错题) 涉及的 distinct 知识点数 / 所触学科词表容量之和（未触任何学科 → null）
export interface RadarDim { key: string; label: string; value: number | null; detail: string }
export function getRadarData(userId: string): RadarDim[] {
  const q = quizStats(userId, 30);
  const accuracy = q.total > 0 ? q.correct / q.total : null;

  const mAll = db().prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN reviewedAt IS NOT NULL THEN 1 ELSE 0 END) AS done FROM mistakes WHERE userId = ?").get(userId) as { n: number; done: number };
  const clearance = Number(mAll.n) > 0 ? Number(mAll.done) / Number(mAll.n) : null;

  const since7 = Math.floor((Date.now() - 7 * 86_400_000) / 86_400_000);
  const days = db().prepare("SELECT COUNT(DISTINCT day) AS d FROM chat_usage WHERE userId = ? AND day >= ?").get(userId, since7) as { d: number };
  const participation = Number(days.d) > 0 ? Number(days.d) / 7 : null;

  const ev = evalStats(userId, 30);
  const teacherDim = ev.total > 0 ? ev.positive / Math.max(ev.total, 1) : null;

  const pts = db().prepare(`
    SELECT DISTINCT subject, knowledgePoint FROM (
      SELECT subject, knowledgePoint FROM quiz_attempts WHERE userId = ? AND knowledgePoint IS NOT NULL AND knowledgePoint != ''
      UNION SELECT subject, knowledgePoint FROM mistakes WHERE userId = ? AND knowledgePoint IS NOT NULL AND knowledgePoint != ''
    )`).all(userId, userId) as { subject: string; knowledgePoint: string }[];
  let coverage: number | null = null;
  if (pts.length > 0) {
    const subjects = [...new Set(pts.map((p) => p.subject))];
    const vocabTotal = subjects.reduce((sum, s) => sum + (KNOWLEDGE_POINTS[s]?.length ?? 1), 0);
    coverage = Math.min(1, new Set(pts.map((p) => `${p.subject}:${p.knowledgePoint}`)).size / Math.max(vocabTotal, 1));
  }

  return [
    { key: "accuracy", label: "小测正确率", value: accuracy, detail: q.total > 0 ? `近30天 ${q.correct}/${q.total} 题` : "还没做过随堂小测" },
    { key: "clearance", label: "错题清理", value: clearance, detail: Number(mAll.n) > 0 ? `已复习 ${mAll.done}/${mAll.n} 条` : "错题本还是空的" },
    { key: "participation", label: "学习参与", value: participation, detail: Number(days.d) > 0 ? `近7天有 ${days.d} 天在学习` : "近7天暂无使用记录" },
    { key: "teacher", label: "教师评价", value: teacherDim, detail: ev.total > 0 ? `近30天获评 ${ev.total} 次` : "老师还没有点评" },
    { key: "coverage", label: "知识覆盖", value: coverage, detail: pts.length > 0 ? `已涉及 ${pts.length} 个知识点` : "暂无知识点记录" },
  ];
}

// ── Phase E-2 · 模型配置持久化 ──
export function getModelSettings(modelId: string): ModelSettings {
  const r = db().prepare("SELECT * FROM model_settings WHERE modelId = ?").get(modelId);
  if (!r) return { modelId, ...DEFAULT_MODEL_SETTINGS };
  return {
    modelId,
    openToStudents: Number(r.openToStudents) === 1,
    quotaTeacher: Number(r.quotaTeacher), quotaStudent: Number(r.quotaStudent),
    dataIsolation: Number(r.dataIsolation) === 1, allowUpload: Number(r.allowUpload) === 1,
    autoDowngrade: Number(r.autoDowngrade) === 1,
  };
}
export function setModelSettings(modelId: string, patch: Partial<Omit<ModelSettings, "modelId">>): ModelSettings {
  const cur = getModelSettings(modelId);
  const next: ModelSettings = { ...cur, ...patch, modelId };
  db().prepare(
    "INSERT INTO model_settings (modelId,openToStudents,quotaTeacher,quotaStudent,dataIsolation,allowUpload,autoDowngrade,updatedAt) " +
    "VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(modelId) DO UPDATE SET " +
    "openToStudents=excluded.openToStudents,quotaTeacher=excluded.quotaTeacher,quotaStudent=excluded.quotaStudent," +
    "dataIsolation=excluded.dataIsolation,allowUpload=excluded.allowUpload,autoDowngrade=excluded.autoDowngrade,updatedAt=excluded.updatedAt"
  ).run(modelId, next.openToStudents ? 1 : 0, next.quotaTeacher, next.quotaStudent,
    next.dataIsolation ? 1 : 0, next.allowUpload ? 1 : 0, next.autoDowngrade ? 1 : 0, Date.now());
  return next;
}

// ── Phase E-2 · 角色权限位持久化（perms 存 JSON map；null=用页面默认）──
export function getRolePerms(roleId: string): Record<string, boolean> | null {
  const r = db().prepare("SELECT perms FROM role_perms WHERE roleId = ?").get(roleId);
  return r ? safeJson<Record<string, boolean>>(r.perms, {}) : null;
}
export function setRolePerms(roleId: string, perms: Record<string, boolean>): void {
  db().prepare("INSERT INTO role_perms (roleId,perms,updatedAt) VALUES (?,?,?) ON CONFLICT(roleId) DO UPDATE SET perms=excluded.perms,updatedAt=excluded.updatedAt")
    .run(roleId, JSON.stringify(perms), Date.now());
}

// ── Phase E-2 · 每日配额执行（让 model_settings.quota 真正生效）──
export function chatUsageToday(userId: string, modelId: string): number {
  const r = db().prepare("SELECT count FROM chat_usage WHERE userId = ? AND modelId = ? AND day = ?").get(userId, modelId, epochDay());
  return Number(r?.count ?? 0);
}
export function incrementChatUsage(userId: string, modelId: string): void {
  db().prepare(
    "INSERT INTO chat_usage (userId,modelId,day,count) VALUES (?,?,?,1) ON CONFLICT(userId,modelId,day) DO UPDATE SET count = count + 1"
  ).run(userId, modelId, epochDay());
}

// ── S3：生图任务 CRUD（安全门/配额在路由层；此处仅数据）──
export interface ImageJob {
  id: string; userId: string; role: string; prompt: string; size: string;
  status: "pending" | "done" | "failed"; error?: string; filePath?: string;
  createdAt: number; finishedAt?: number;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapImageJob(r: any): ImageJob {
  return {
    id: String(r.id), userId: String(r.userId), role: String(r.role ?? ""), prompt: String(r.prompt),
    size: String(r.size ?? "1024x1024"), status: r.status as ImageJob["status"],
    error: r.error ? String(r.error) : undefined, filePath: r.filePath ? String(r.filePath) : undefined,
    createdAt: Number(r.createdAt), finishedAt: r.finishedAt ? Number(r.finishedAt) : undefined,
  };
}
export function createImageJob(userId: string, role: string, prompt: string, size: string): ImageJob {
  // M2/B4：加密熵主键（rid 的时间戳+弱随机可在时间窗内枚举，配合接口差异响应曾构成探测预言机）
  const j: ImageJob = { id: `img_${crypto.randomUUID()}`, userId, role, prompt, size, status: "pending", createdAt: Date.now() };
  db().prepare("INSERT INTO image_jobs (id,userId,role,prompt,size,status,createdAt) VALUES (?,?,?,?,?,?,?)")
    .run(j.id, j.userId, j.role, j.prompt, j.size, j.status, j.createdAt);
  return j;
}
export function finishImageJob(id: string, patch: { status: "done" | "failed"; error?: string; filePath?: string }): void {
  db().prepare("UPDATE image_jobs SET status = ?, error = ?, filePath = ?, finishedAt = ? WHERE id = ?")
    .run(patch.status, patch.error ?? null, patch.filePath ?? null, Date.now(), id);
}
export function getImageJob(id: string): ImageJob | null {
  const r = db().prepare("SELECT * FROM image_jobs WHERE id = ?").get(id);
  return r ? mapImageJob(r) : null;
}
export function listImageJobs(userId: string, limit = 30): ImageJob[] {
  return db().prepare("SELECT * FROM image_jobs WHERE userId = ? ORDER BY createdAt DESC LIMIT ?").all(userId, limit).map(mapImageJob);
}
// ── S4：错题本 CRUD ──
export interface Mistake {
  id: string; userId: string; subject: string; knowledgePoint?: string;
  content: string; reason?: string; createdAt: number; reviewedAt?: number;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMistake(r: any): Mistake {
  return {
    id: String(r.id), userId: String(r.userId), subject: String(r.subject),
    knowledgePoint: r.knowledgePoint ? String(r.knowledgePoint) : undefined,
    content: String(r.content), reason: r.reason ? String(r.reason) : undefined,
    createdAt: Number(r.createdAt), reviewedAt: r.reviewedAt ? Number(r.reviewedAt) : undefined,
  };
}
export function addMistake(userId: string, m: { subject: string; knowledgePoint?: string; content: string; reason?: string }): Mistake {
  const row: Mistake = { id: `mis_${crypto.randomUUID()}`, userId, subject: m.subject, knowledgePoint: m.knowledgePoint, content: m.content, reason: m.reason, createdAt: Date.now() };
  db().prepare("INSERT INTO mistakes (id,userId,subject,knowledgePoint,content,reason,createdAt) VALUES (?,?,?,?,?,?,?)")
    .run(row.id, row.userId, row.subject, row.knowledgePoint ?? null, row.content, row.reason ?? null, row.createdAt);
  return row;
}
export function listMistakes(userId: string, limit = 100): Mistake[] {
  return db().prepare("SELECT * FROM mistakes WHERE userId = ? ORDER BY createdAt DESC LIMIT ?").all(userId, limit).map(mapMistake);
}
export function deleteMistake(userId: string, id: string): boolean {
  const r = db().prepare("DELETE FROM mistakes WHERE id = ? AND userId = ?").run(id, userId);
  return Number(r.changes) > 0;
}
/**
 * 记一次复习，并由**服务端**判定是否该庆祝（方案 §5 P3）。
 *
 * 为什么判定必须在服务端：前端能拿到的只有「这次 PATCH 成功了」。若让前端自行判定，
 * 最省力的近似就是「reviewedAt 非空即庆祝」——点一次「已复习」就放烟花，
 * 诱导强度与被否掉的「删除即庆祝」几乎相同（只是从刷删除换成刷复习）。
 *
 * 合法触发条件只有一个：**同一知识点上存在跨自然日的两次复习**（间隔重复）。
 * 删除路径永不触发（见 DELETE 分支）。
 */
export function markMistakeReviewed(userId: string, id: string): { celebrate: boolean; reason: string } {
  const now = Date.now();
  const target = db().prepare("SELECT knowledgePoint FROM mistakes WHERE id = ? AND userId = ?").get(id, userId) as Row | undefined;
  if (!target) return { celebrate: false, reason: "not-found" };
  db().prepare("INSERT INTO mistake_reviews (id,mistakeId,userId,at) VALUES (?,?,?,?)")
    .run(`rev_${crypto.randomUUID()}`, id, userId, now);
  db().prepare("UPDATE mistakes SET reviewedAt = ? WHERE id = ? AND userId = ?").run(now, id, userId);

  const kp = target.knowledgePoint ? String(target.knowledgePoint) : null;
  if (!kp) return { celebrate: false, reason: "no-knowledge-point" };
  // 同一知识点下的全部复习时间戳（跨该知识点的所有错题）
  const rows = db().prepare(
    `SELECT r.at AS at FROM mistake_reviews r
     JOIN mistakes m ON m.id = r.mistakeId
     WHERE r.userId = ? AND m.knowledgePoint = ?`,
  ).all(userId, kp) as Row[];
  const days = new Set(rows.map((r) => new Date(Number(r.at)).toISOString().slice(0, 10)));
  const celebrate = rows.length >= 2 && days.size >= 2;
  return { celebrate, reason: celebrate ? "spaced-repetition" : `reviews=${rows.length} days=${days.size}` };
}
/** 教师端聚类：仅去标识计数（学科×知识点），不回传任何原文/userId——隐私最小化铁律。
 *  M2/B4 硬化：①classId 圈定（教师/科研只见本班，传 undefined=全库仅供管理员）；
 *  ②双阈值 k-匿名：行数 ≥3 且**独立学生数 ≥2**——防单个学生自建 3 条同名行把任意字符串注入教师视图。 */
export function clusterMistakes(classId?: string, limit = 12): Array<{ subject: string; knowledgePoint: string; count: number }> {
  // default-deny（审查修订）：undefined=管理员全库；空串/空白（未分班教师）→ 空结果，绝不静默升级为全库视图
  if (classId !== undefined && !classId.trim()) return [];
  const base =
    "SELECT m.subject AS subject, COALESCE(m.knowledgePoint,'未标注') AS knowledgePoint, COUNT(*) AS count " +
    "FROM mistakes m JOIN users u ON u.id = m.userId " +
    (classId ? "WHERE u.classId = ? " : "") +
    "GROUP BY m.subject, m.knowledgePoint HAVING COUNT(*) >= 3 AND COUNT(DISTINCT m.userId) >= 2 " +
    "ORDER BY count DESC LIMIT ?";
  const rows = classId ? db().prepare(base).all(classId, limit) : db().prepare(base).all(limit);
  return rows.map((r) => ({ subject: String(r.subject), knowledgePoint: String(r.knowledgePoint), count: Number(r.count) }));
}
/** M2/B4：AI 错因归因回写（仅当学生本人行且当前未归因时生效；归因失败保持「未归因」，fail-open 不编造）。 */
export function updateMistakeReason(userId: string, id: string, reason: string): void {
  db().prepare("UPDATE mistakes SET reason = ? WHERE id = ? AND userId = ? AND (reason IS NULL OR reason = '未归因')")
    .run(reason, id, userId);
}

/** M5/B6：生图保留策略——按用户清理 >30 天 或 超出最近 200 张的任务（行与文件同删，惰性触发）。
 *  返回被删除的文件路径，由调用方（有 fs 权限的路由）删除磁盘文件，保持 db 层无 IO 副作用。 */
export function pruneImageJobs(userId: string, maxAgeMs = 30 * 86_400_000, keepLatest = 200): string[] {
  const cutoff = Date.now() - maxAgeMs;
  const doomed = db().prepare(
    "SELECT id, filePath FROM image_jobs WHERE userId = ? AND (createdAt < ? OR id NOT IN " +
    "(SELECT id FROM image_jobs WHERE userId = ? ORDER BY createdAt DESC LIMIT ?))"
  ).all(userId, cutoff, userId, keepLatest);
  if (doomed.length === 0) return [];
  const del = db().prepare("DELETE FROM image_jobs WHERE id = ?");
  const files: string[] = [];
  for (const r of doomed) {
    del.run(String(r.id));
    if (r.filePath) files.push(String(r.filePath));
  }
  return files;
}

export function imageJobsToday(userId: string): number {
  // 失败任务不计配额（终审 P2：与前端「失败不额外扣次数」承诺保持一致）
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const r = db().prepare("SELECT COUNT(*) AS n FROM image_jobs WHERE userId = ? AND createdAt >= ? AND status != 'failed'").get(userId, start.getTime());
  return Number(r?.n ?? 0);
}

export interface AdminAnalyticsSnapshot {
  generatedAt: number;
  kpis: Array<{
    id: string;
    label: string;
    value: string;
    delta: string;
    icon: string;
    tone: "blue" | "violet" | "cyan" | "green" | "red" | "gold";
  }>;
  dailyUsage: Array<{ day: string; value: number; tokens: number }>;
  colleges: Array<{ name: string; value: number; color: string }>;
  adoptionFunnel: Array<{ stage: string; value: number; color: string }>;
  aiAccuracy: {
    value: number;
    feedbackCount: number;
    breakdown: Array<{ label: string; pct: number; color: string }>;
  };
  topAgents: Array<{ rank: number; name: string; category: string; calls: number; growth: number; color: string }>;
  costShare: Array<{ name: string; value: number; color: string }>;
  hourHeatmap: number[][];
  systemHealth: Array<{ name: string; state: "online" | "busy"; latency: string }>;
  sourceSummary: {
    users: number;
    chatSessions: number;
    chatMessages: number;
    agents: number;
    kbFiles: number;
    auditRows: number;
    tickets: number;
    feedbackRows: number;
  };
}

function scalarNumber(sql: string, ...params: Array<string | number>): number {
  const r = db().prepare(sql).get(...params) as Row | undefined;
  return Number(r?.n ?? 0);
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("zh-CN");
}

function formatWan(n: number, digits = 1): string {
  return (n / 10_000).toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function modelLabel(modelId: string): string {
  const labels: Record<string, string> = {
    chatgpt: "ChatGPT",
    claude: "Claude",
    gemini: "Gemini",
    minimax: "MiniMax",
    "gpt-image": "GPT-Image",
  };
  return labels[modelId] ?? (modelId || "未标记模型");
}

function labelForDay(day: number, today: number): string {
  if (day === today) return "今日";
  const date = new Date(day * 86_400_000);
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function heatLevel(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((count / max) * 4)));
}

export function getAdminAnalyticsSnapshot(): AdminAnalyticsSnapshot {
  const now = Date.now();
  const today = epochDay();
  const sevenDaysAgoMs = now - 6 * 86_400_000;
  const sevenDayStart = today - 6;

  const users = scalarNumber("SELECT COUNT(*) AS n FROM users");
  const chatSessions = scalarNumber("SELECT COUNT(*) AS n FROM chat_sessions");
  const chatMessages = scalarNumber("SELECT COUNT(*) AS n FROM chat_messages");
  const assistantMessages = scalarNumber("SELECT COUNT(*) AS n FROM chat_messages WHERE role = 'assistant'");
  const userMessages = scalarNumber("SELECT COUNT(*) AS n FROM chat_messages WHERE role = 'user'");
  const estimatedTokens = scalarNumber("SELECT COALESCE(SUM(LENGTH(content)),0) AS n FROM chat_messages WHERE role = 'assistant'");
  const todayEstimatedTokens = scalarNumber("SELECT COALESCE(SUM(LENGTH(content)),0) AS n FROM chat_messages WHERE role = 'assistant' AND createdAt >= ?", today * 86_400_000);
  const agents = scalarNumber("SELECT COUNT(*) AS n FROM agents");
  const publishedAgents = scalarNumber("SELECT COUNT(*) AS n FROM agents WHERE status = 'pub'");
  const reviewAgents = scalarNumber("SELECT COUNT(*) AS n FROM agents WHERE status = 'review'");
  const kbFiles = scalarNumber("SELECT COUNT(*) AS n FROM kb_files");
  const kbTextFiles = scalarNumber("SELECT COUNT(*) AS n FROM kb_files WHERE COALESCE(chunkCount,0) > 0");
  const auditRows = scalarNumber("SELECT COUNT(*) AS n FROM audit");
  const denyRows = scalarNumber("SELECT COUNT(*) AS n FROM audit WHERE result = 'deny'");
  const tickets = scalarNumber("SELECT COUNT(*) AS n FROM tickets");
  const pendingTickets = scalarNumber("SELECT COUNT(*) AS n FROM tickets WHERE status != 'resolved'");
  const feedbackRows = scalarNumber("SELECT COUNT(*) AS n FROM feedback");
  const upFeedback = scalarNumber("SELECT COUNT(*) AS n FROM feedback WHERE sentiment = 'up'");
  const downFeedback = scalarNumber("SELECT COUNT(*) AS n FROM feedback WHERE sentiment = 'down'");
  const favorites = scalarNumber("SELECT COUNT(*) AS n FROM favorites");
  const usageCalls = scalarNumber("SELECT COALESCE(SUM(count),0) AS n FROM chat_usage");
  const recentActiveUsers = scalarNumber(
    "SELECT COUNT(DISTINCT u.id) AS n FROM users u WHERE " +
    "EXISTS (SELECT 1 FROM chat_sessions s WHERE s.userId = u.id AND s.updatedAt >= ?) OR " +
    "EXISTS (SELECT 1 FROM audit a WHERE a.userId = u.id AND a.at >= ?) OR " +
    "EXISTS (SELECT 1 FROM agents g WHERE g.ownerId = u.id AND g.createdAt >= ?)",
    sevenDaysAgoMs,
    sevenDaysAgoMs,
    sevenDaysAgoMs,
  );

  const usageRows = db().prepare(
    "SELECT day, COALESCE(SUM(count),0) AS n FROM chat_usage WHERE day >= ? GROUP BY day"
  ).all(sevenDayStart) as Row[];
  const messageRows = db().prepare(
    "SELECT CAST(createdAt / 86400000 AS INTEGER) AS day, COUNT(*) AS n, COALESCE(SUM(LENGTH(content)),0) AS chars " +
    "FROM chat_messages WHERE role = 'assistant' AND createdAt >= ? GROUP BY CAST(createdAt / 86400000 AS INTEGER)"
  ).all(sevenDaysAgoMs) as Row[];
  const usageByDay = new Map<number, number>(usageRows.map((r) => [Number(r.day), Number(r.n)]));
  const messagesByDay = new Map<number, { n: number; chars: number }>(
    messageRows.map((r) => [Number(r.day), { n: Number(r.n), chars: Number(r.chars) }])
  );
  const dailyUsage = Array.from({ length: 7 }, (_, i) => {
    const day = today - (6 - i);
    const msg = messagesByDay.get(day) ?? { n: 0, chars: 0 };
    const value = usageByDay.get(day) ?? msg.n;
    return {
      day: labelForDay(day, today),
      value,
      tokens: Math.round((msg.chars / 3.2 / 10_000) * 10) / 10,
    };
  });

  const deptRows = db().prepare(
    "SELECT COALESCE(NULLIF(department,''),'未设置部门') AS name, COUNT(*) AS n FROM users GROUP BY COALESCE(NULLIF(department,''),'未设置部门') ORDER BY n DESC"
  ).all() as Row[];
  // 图表色一律取自 CHART_PALETTE（§3.1 R1 第四类：图表里颜色就是数据编码，
  // 但必须来自统一色板而非各处自造）。原来这里和 DASHBOARD_COLORS 各抄了一份同样的六色数组，
  // 是「同一色板存在三份副本」——改色板时必然漏改其中一份。
  const colleges = deptRows.map((r, i) => ({ name: String(r.name), value: Number(r.n), color: chartColor(i) }));

  const feedbackTotal = upFeedback + downFeedback;
  const aiAccuracyValue = feedbackTotal ? pct(upFeedback, feedbackTotal) : 0;
  const modelRows = db().prepare(
    "SELECT modelId, COUNT(*) AS n FROM chat_messages WHERE role = 'assistant' GROUP BY modelId ORDER BY n DESC"
  ).all() as Row[];
  const costShare = modelRows.length
    ? modelRows.map((r, i) => ({ name: modelLabel(String(r.modelId)), value: Number(r.n), color: chartColor(i) }))
    : [{ name: "暂无模型调用", value: 1, color: "var(--border-2)" }];

  const topAgents = listAgents().slice(0, 5).map((a, i) => ({
    rank: i + 1,
    name: a.name,
    category: a.category,
    calls: a.calls,
    growth: 0,
    color: chartColor(i),
  }));

  const hourRows = db().prepare(
    "SELECT CAST(((createdAt / 3600000) + 4) % 7 AS INTEGER) AS day, CAST((createdAt / 3600000) % 24 AS INTEGER) AS hour, COUNT(*) AS n " +
    "FROM chat_messages WHERE createdAt >= ? GROUP BY day, hour"
  ).all(sevenDaysAgoMs) as Row[];
  const maxHour = Math.max(0, ...hourRows.map((r) => Number(r.n)));
  const hourHeatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of hourRows) {
    const d = Number(r.day);
    const h = Number(r.hour);
    if (d >= 0 && d < 7 && h >= 0 && h < 24) hourHeatmap[d][h] = heatLevel(Number(r.n), maxHour);
  }

  const securityEvents = denyRows + tickets;
  const todayTokenWan = todayEstimatedTokens / 3.2 / 10_000;
  const costEstimate = Math.round(todayTokenWan * 0.18 * 100) / 100;

  return {
    generatedAt: now,
    kpis: [
      // 这里曾有一个 up 字段，生产者与消费者对它的语义完全不同：
      // 生产端写的是「好不好」（up: securityEvents === 0）或干脆恒 true；
      // 消费端（KpiCard / StatRow）把它当「涨还是跌」渲染成绿↑/红↓。
      // 于是「安全/越权事件 = 0」被画成一个**向上的绿色箭头**——一个在涨的安全事件读数。
      // 修法不是隐藏箭头：只要字段还叫 up，下一个人还会按字面意思重新接上。
      // 这里没有任何同比/环比数据源，趋势本就不存在，字段整个删掉。
      { id: "active", label: "近 7 日活跃账号", value: formatInt(recentActiveUsers), delta: `全量 ${formatInt(users)} 个账号`, icon: "Activity", tone: "green" },
      { id: "call", label: "模型调用", value: formatInt(usageCalls || assistantMessages), delta: `${formatInt(assistantMessages)} 条 AI 回复`, icon: "MessageCircle", tone: "violet" },
      { id: "tokenAll", label: "估算 Token (万)", value: formatWan(estimatedTokens / 3.2), delta: "按回复文本估算", icon: "Sparkles", tone: "cyan" },
      { id: "ratio", label: "知识库可检索率", value: `${pct(kbTextFiles, kbFiles)}%`, delta: `${formatInt(kbTextFiles)} / ${formatInt(kbFiles)} 文件`, icon: "Database", tone: "green" },
      { id: "alert", label: "安全/越权事件", value: formatInt(securityEvents), delta: `${formatInt(pendingTickets)} 待跟进`, icon: "ShieldAlert", tone: securityEvents ? "red" : "green" },
      { id: "cost", label: "今日成本估算 (元)", value: `¥ ${costEstimate.toFixed(2)}`, delta: "本地用量估算", icon: "Wallet", tone: "gold" },
    ],
    dailyUsage,
    colleges,
    // V-4 修复：删掉原第四段「安全工单 / 拦截」。
    //
    // 症状是它占比 293%（安全事件 44 > 首段用户提问 15）——一个 293% 的分段会让人
    // 以为图表坏了。但根因不是数字错，数字是真的：**安全事件根本不是漏斗的一级**。
    // 漏斗描述的是同一批请求逐级收窄（问 → 答 → 采纳）；安全拦截是把请求**引出**这条路径，
    // 是分流不是深入，两者本就不同口径（前者按当期消息计，后者含历史累计工单）。
    //
    // 而且它是**重复渲染**：同一个 securityEvents 在本页顶部已有一张 KPI 卡
    // 「安全/越权事件」。同一个数被画了两遍——一遍在讲得通的框架里，一遍在讲不通的里。
    // 因此删除它不丢任何信息（§7 铁律①要求安全信息可见，KPI 卡已经承担），只是消除重复。
    adoptionFunnel: [
      { stage: "用户提问", value: userMessages, color: chartColor(0) },
      { stage: "AI 完成回复", value: assistantMessages, color: chartColor(1) },
      { stage: "收藏 / 反馈", value: favorites + feedbackRows, color: chartColor(2) },
    ],
    aiAccuracy: {
      value: aiAccuracyValue,
      feedbackCount: feedbackTotal,
      breakdown: [
        // 三种是**状态**而非数据序列，因此走语义令牌而非图表色板。
        // 「待改进」原为错误红（err 那一档）——踩一下是用户的改进意见，不是系统错误；
        // 用告警红会把「有人不满意」渲染成「出故障了」。改 --warn。
        { label: "好评", pct: pct(upFeedback, feedbackTotal), color: "var(--ok)" },
        { label: "待改进", pct: pct(downFeedback, feedbackTotal), color: "var(--warn)" },
        { label: "暂无反馈", pct: feedbackTotal ? 0 : 100, color: "var(--border-2)" },
      ].filter((b) => b.pct > 0),
    },
    topAgents,
    costShare,
    hourHeatmap,
    systemHealth: [
      { name: "认证服务", state: "online", latency: `${formatInt(users)} 账号` },
      { name: "对话记录", state: "online", latency: `${formatInt(chatSessions)} 会话` },
      { name: "审计日志", state: "online", latency: `${formatInt(auditRows)} 条` },
      { name: "安全工单", state: pendingTickets > 0 ? "busy" : "online", latency: `${formatInt(pendingTickets)} 待跟进` },
      { name: "知识库文件", state: kbFiles > 0 ? "online" : "busy", latency: `${formatInt(kbFiles)} 个` },
      { name: "智能体库", state: reviewAgents > 0 ? "busy" : "online", latency: `${formatInt(publishedAgents)} 已发布 / ${formatInt(agents)} 总数` },
    ],
    sourceSummary: { users, chatSessions, chatMessages, agents, kbFiles, auditRows, tickets, feedbackRows },
  };
}

function compactText(value: string | undefined, fallback: string, limit = 72): string {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

function subjectFromText(value: string): string {
  const text = value.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/数学|函数|方程|几何|代数|math|quadratic/, "数学"],
    [/英语|作文|english|unit|grammar|essay/, "英语"],
    [/物理|电路|力学|physics/, "物理"],
    [/语文|阅读|写作|古诗|chinese/, "语文"],
    [/化学|方程式|chem/, "化学"],
    [/生物|细胞|biology/, "生物"],
    [/历史|地理|history|geo/, "人文"],
  ];
  return rules.find(([re]) => re.test(text))?.[1] ?? "综合";
}

export function getLearningSnapshot(user: SessionUser): LearningSnapshot {
  const now = Date.now();
  const today = epochDay();
  const todayStart = today * 86_400_000;
  const sevenDayStart = today - 6;
  const sevenDaysAgoMs = sevenDayStart * 86_400_000;
  const sessions = listSessions(user.id, 100);
  const recentSessions = sessions.slice(0, 5).map((s) => {
    const messageCount = scalarNumber("SELECT COUNT(*) AS n FROM chat_messages WHERE sessionId = ?", s.id);
    return {
      id: s.id,
      title: compactText(s.title, "未命名学习会话", 48),
      href: `/chat?session=${encodeURIComponent(s.id)}`,
      preview: compactText(s.preview, "暂无消息摘要", 96),
      updatedAt: s.updatedAt,
      messageCount,
      modelId: modelLabel(s.modelId),
    };
  });

  const userMessages = scalarNumber(
    "SELECT COUNT(*) AS n FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.sessionId WHERE s.userId = ? AND m.role = 'user'",
    user.id,
  );
  const assistantMessages = scalarNumber(
    "SELECT COUNT(*) AS n FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.sessionId WHERE s.userId = ? AND m.role = 'assistant'",
    user.id,
  );
  const todayUserMessages = scalarNumber(
    "SELECT COUNT(*) AS n FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.sessionId WHERE s.userId = ? AND m.role = 'user' AND m.createdAt >= ?",
    user.id,
    todayStart,
  );
  const todaySessions = scalarNumber("SELECT COUNT(*) AS n FROM chat_sessions WHERE userId = ? AND updatedAt >= ?", user.id, todayStart);
  const favorites = scalarNumber("SELECT COUNT(*) AS n FROM favorites WHERE userId = ?", user.id);
  const feedback = scalarNumber("SELECT COUNT(*) AS n FROM feedback WHERE userId = ?", user.id);
  const knowledgeFiles = scalarNumber("SELECT COUNT(*) AS n FROM kb_files WHERE ownerId = ?", user.id);
  const integrityCount = user.role === "student" ? integrityWeekly(user.classId) : 0;
  const estimatedMinutes = Math.max(0, Math.round(userMessages * 5 + assistantMessages * 3));
  const mastery = Math.min(100, Math.round(
    Math.min(sessions.length, 12) * 4 +
    Math.min(assistantMessages, 40) * 1.1 +
    Math.min(favorites + feedback, 10) * 3 +
    Math.min(knowledgeFiles, 5) * 2
  ));

  const weeklyRows = db().prepare(
    "SELECT CAST(m.createdAt / 86400000 AS INTEGER) AS day, " +
    "COUNT(DISTINCT s.id) AS sessions, COUNT(*) AS messages " +
    "FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.sessionId " +
    "WHERE s.userId = ? AND m.createdAt >= ? GROUP BY CAST(m.createdAt / 86400000 AS INTEGER)"
  ).all(user.id, sevenDaysAgoMs) as Row[];
  const weeklyByDay = new Map<number, { sessions: number; messages: number }>(
    weeklyRows.map((r) => [Number(r.day), { sessions: Number(r.sessions), messages: Number(r.messages) }])
  );
  const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
    const day = today - (6 - i);
    const date = new Date(day * 86_400_000);
    const row = weeklyByDay.get(day) ?? { sessions: 0, messages: 0 };
    return {
      day: day === today ? "今日" : `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`,
      sessions: row.sessions,
      messages: row.messages,
    };
  });

  const reviewItems = recentSessions.slice(0, 4).map((s) => ({
    id: `review-${s.id}`,
    subject: subjectFromText(`${s.title} ${s.preview}`),
    title: s.title,
    count: Math.max(1, Math.ceil(s.messageCount / 2)),
    href: s.href,
  }));

  return {
    generatedAt: now,
    user: { id: user.id, name: user.name, role: user.role, classId: user.classId },
    kpis: [
      { id: "sessions", label: "学习会话", value: formatInt(sessions.length), hint: `${formatInt(todaySessions)} 个今日活跃`, tone: "blue" },
      { id: "messages", label: "AI 学习轮次", value: formatInt(userMessages), hint: `${formatInt(assistantMessages)} 条 AI 回复`, tone: "violet" },
      { id: "mastery", label: "学习覆盖度", value: `${mastery}%`, hint: "按会话/反馈/知识库估算", tone: "green" },
      { id: "minutes", label: "估算学习时长", value: `${formatInt(estimatedMinutes)} 分钟`, hint: "按对话轮次估算", tone: "gold" },
    ],
    weeklyTrend,
    recentSessions,
    reviewItems,
    tasks: [
      { id: "chat-today", label: "完成 1 次 AI 对话学习", done: todayUserMessages > 0, evidence: `${formatInt(todayUserMessages)} 条今日提问` },
      { id: "review-feedback", label: "复盘并标记一个 AI 回答", done: favorites + feedback > 0, evidence: `${formatInt(favorites)} 个收藏 / ${formatInt(feedback)} 条反馈` },
      { id: "continue-session", label: "继续一个学习会话", done: todaySessions > 0, evidence: `${formatInt(todaySessions)} 个今日会话` },
    ],
    achievements: [
      { id: "first-chat", label: "首次 AI 学习", unlocked: sessions.length > 0 },
      { id: "ten-turns", label: "十轮对话", unlocked: userMessages >= 10 },
      { id: "reviewer", label: "会复盘的学习者", unlocked: favorites + feedback > 0 },
      { id: "knowledge", label: "知识库探索者", unlocked: knowledgeFiles > 0 },
    ],
    honestStates: [
      { id: "learning-snapshot", title: "学习快照", status: "connected", note: "已接入当前账号会话、消息、收藏、反馈与知识库。" },
      { id: "homework", title: "作业系统", status: "not_connected", note: "尚未接入教务作业表，本页不再伪造截止时间和批改状态。" },
      { id: "mistakes", title: "错题本", status: "not_connected", note: "尚未接入题目级错题表，复习项仅来自真实学习会话。" },
      { id: "peer-rank", title: "同伴排行", status: "not_connected", note: "未成年人场景默认不展示实名排行。" },
    ],
    sourceSummary: {
      sessions: sessions.length,
      userMessages,
      assistantMessages,
      favorites,
      feedback,
      knowledgeFiles,
      integrityWeekly: integrityCount,
    },
  };
}

const DASHBOARD_MODEL_IDS = ["chatgpt", "claude", "gpt-image", "gemini", "minimax", "deepseek", "glm"];

function daysAgoLabel(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function shareFromCounts(rows: Array<{ name: string; count: number; color?: string }>): DashboardModelShare[] {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.count), 0);
  if (total <= 0) return [];
  return rows.map((row, index) => ({
    name: row.name,
    count: row.count,
    value: Math.round((row.count / total) * 1000) / 10,
    color: row.color ?? chartColor(index),
  }));
}

function sourceSummaryZero(): DashboardSourceSummary {
  return {
    sessions: 0,
    userMessages: 0,
    assistantMessages: 0,
    favorites: 0,
    feedback: 0,
    knowledgeFiles: 0,
    integrityWeekly: 0,
    classStudents: 0,
    pendingGrading: 0,
    users: 0,
    agents: 0,
    auditRows: 0,
    tickets: 0,
  };
}

function dashboardTrendFromLearning(learning: LearningSnapshot) {
  return {
    data: learning.weeklyTrend.map((row) => ({ day: row.day, primary: row.messages, secondary: row.sessions })),
    primaryLabel: "真实消息数",
    secondaryLabel: "真实会话数",
  };
}

function modelShareForUser(userId: string): { rows: DashboardModelShare[]; total: number } {
  const rows = db().prepare(
    "SELECT COALESCE(NULLIF(m.modelId,''),'chatgpt') AS modelId, COUNT(*) AS n " +
    "FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.sessionId " +
    "WHERE s.userId = ? AND m.role = 'assistant' GROUP BY COALESCE(NULLIF(m.modelId,''),'chatgpt') ORDER BY n DESC"
  ).all(userId) as Row[];
  const source = rows.map((row, index) => ({
    name: modelLabel(String(row.modelId)),
    count: Number(row.n),
    color: chartColor(index),
  }));
  return { rows: shareFromCounts(source), total: source.reduce((sum, row) => sum + row.count, 0) };
}

function quotaForUser(user: SessionUser) {
  const used = DASHBOARD_MODEL_IDS.reduce((sum, id) => sum + chatUsageToday(user.id, id), 0);
  const total = DASHBOARD_MODEL_IDS.reduce((sum, id) => {
    const settings = getModelSettings(id);
    return sum + (user.role === "student" ? settings.quotaStudent : settings.quotaTeacher);
  }, 0);
  return {
    used,
    total,
    unit: "次",
    percent: total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0,
    footnote: "来自 chat_usage 与 model_settings 的当日配额读数",
    status: "connected" as const,
  };
}

// 快捷入口配色：**枚举键**而非自由 CSS（§4.2.1）。
// 这里此前是全站最后一处仍向 `DashboardQuickAction.gradient` 写裸渐变的地方，
// 而同字段的另一个生产者 lib/data/dashboard.ts 早已写键——同一字段两种取值形态，
// 渲染端只能二选一，另一种必然渲染错（详见 QuickActionGrid 的说明）。
function promptActionsForDashboard(learning: LearningSnapshot, className: string): DashboardQuickAction[] {
  const recentTitle = learning.recentSessions[0]?.title ?? "当前班级学习情况";
  return [
    { id: "lesson", title: "生成教案", desc: "用真实班级背景生成课案", gradient: "accent", icon: "FileText", href: "/chat", seed: `请基于 ${className} 的学习现状，生成一份可直接用于课堂的分层教学教案。` },
    { id: "quiz", title: "诊断练习", desc: "围绕最近学习主题出题", gradient: "info", icon: "ClipboardCheck", href: "/chat", seed: `请围绕「${recentTitle}」设计 5 道诊断题，并给出评分要点。` },
    { id: "feedback", title: "学习反馈", desc: "生成家校沟通草稿", gradient: "info", icon: "Bot", href: "/chat", seed: `请把 ${className} 的学习进展整理成一段家校沟通反馈，语气具体、温和、可执行。` },
    { id: "knowledge", title: "整理资料", desc: "进入知识库沉淀内容", gradient: "calm", icon: "BookOpen", href: "/knowledge", seed: "" },
    { id: "class", title: "班级诊断", desc: "查看后端班级数据", gradient: "warm", icon: "BarChart3", href: "/class", seed: "" },
    { id: "integrity", title: "诚信引导", desc: "生成学习支架", gradient: "warm", icon: "ShieldCheck", href: "/chat", seed: "请为学生生成一份学术诚信学习支架，强调如何提问、如何引用、如何避免代写。" },
  ];
}

function buildTeacherDashboard(user: SessionUser): DashboardTeacherWorkspace {
  const learning = getLearningSnapshot(user);
  const canReadClass = user.role === "teacher" || user.role === "researcher";
  const classData = canReadClass ? classOverview(user.classId) : null;
  const pending = canReadClass ? listPending(user.classId) : [];
  const classStudents = canReadClass ? listClassStudents(user.classId).length : 0;
  const classIntegrity = canReadClass ? integrityWeekly(user.classId) : 0;
  const todayStart = epochDay() * 86_400_000;
  const todayUserMessages = scalarNumber(
    "SELECT COUNT(*) AS n FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.sessionId WHERE s.userId = ? AND m.role = 'user' AND m.createdAt >= ?",
    user.id,
    todayStart,
  );
  const todaySessions = scalarNumber("SELECT COUNT(*) AS n FROM chat_sessions WHERE userId = ? AND updatedAt >= ?", user.id, todayStart);
  const model = modelShareForUser(user.id);
  const quota = quotaForUser(user);
  const sourceSummary: DashboardSourceSummary = {
    ...sourceSummaryZero(),
    sessions: learning.sourceSummary.sessions,
    userMessages: learning.sourceSummary.userMessages,
    assistantMessages: learning.sourceSummary.assistantMessages,
    favorites: learning.sourceSummary.favorites,
    feedback: learning.sourceSummary.feedback,
    knowledgeFiles: learning.sourceSummary.knowledgeFiles,
    integrityWeekly: learning.sourceSummary.integrityWeekly,
    classStudents,
    pendingGrading: pending.length,
  };
  const className = classData?.className ?? "当前账号";
  const classOverviewData = classData
    ? { status: "connected" as const, className: classData.className, avgMastery: classData.avgMastery, pendingGrading: classData.pendingGrading, students: classData.students, href: "/class" }
    : null;
  const stats: DashboardStat[] = [
    { id: "today-chat", label: "今日真实提问", value: formatInt(todayUserMessages), delta: `${formatInt(learning.sourceSummary.userMessages)} 条累计提问`, icon: "MessageCircle", tone: "blue" },
    { id: "assistant", label: "AI 已返回", value: formatInt(learning.sourceSummary.assistantMessages), delta: "来自持久化消息", icon: "Bot", tone: "violet" },
    { id: "class", label: canReadClass ? "班级平均掌握" : "班级数据", value: canReadClass ? `${classData?.avgMastery ?? 0}%` : "未接入", delta: canReadClass ? `${formatInt(classStudents)} 名学生` : "仅教师/科研可见", icon: "Users", tone: canReadClass ? "green" : "gold" },
    { id: "grading", label: "待批改", value: formatInt(pending.length), delta: canReadClass ? "来自班级后端" : "未读取班级后端", icon: "ClipboardCheck", tone: pending.length ? "red" : "green" },
    { id: "kb", label: "本人知识库", value: formatInt(learning.sourceSummary.knowledgeFiles), delta: "真实文件数", icon: "BookOpen", tone: "cyan" },
    { id: "quota", label: "今日配额使用", value: `${quota.percent}%`, delta: `${formatInt(quota.used)} / ${formatInt(quota.total)} 次`, icon: "Wallet", tone: quota.percent >= 90 ? "red" : "gold" },
  ];
  const recentChats: DashboardRecentChat[] = learning.recentSessions.map((session, index) => ({
    id: session.id,
    name: session.title,
    desc: `${session.modelId} · ${formatInt(session.messageCount)} 条真实消息 · ${session.preview}`,
    time: daysAgoLabel(session.updatedAt),
    color: chartColor(index),
    icon: session.title.slice(0, 1) || "会",
    href: session.href,
  }));
  const actions = promptActionsForDashboard(learning, className);
  const todos: DashboardTodo[] = [
    { id: "pending-grading", title: pending.length > 0 ? `处理 ${formatInt(pending.length)} 份班级待批改` : "班级待批改已清空", source: canReadClass ? "班级后端" : "班级后端未接入", urgent: pending.length > 0, due: pending.length > 0 ? "建议今日处理" : "当前无需处理", href: canReadClass ? "/class" : "/dashboard", status: canReadClass ? (pending.length > 0 ? "pending" : "done") : "not_connected" },
    { id: "continue-chat", title: recentChats.length > 0 ? "继续最近一条 AI 会话" : "创建第一条 AI 会话", source: "聊天后端", urgent: recentChats.length === 0, due: `${formatInt(todaySessions)} 个今日活跃会话`, href: recentChats[0]?.href ?? "/chat", status: recentChats.length > 0 ? "pending" : "not_connected" },
    { id: "review-feedback", title: "复盘并收藏/反馈一个 AI 回答", source: "收藏与反馈后端", urgent: learning.sourceSummary.favorites + learning.sourceSummary.feedback === 0, due: `${formatInt(learning.sourceSummary.favorites)} 收藏 / ${formatInt(learning.sourceSummary.feedback)} 反馈`, href: recentChats[0]?.href ?? "/chat", status: learning.sourceSummary.favorites + learning.sourceSummary.feedback > 0 ? "done" : "pending" },
  ];
  const courses: DashboardCourse[] = [
    { id: "class-snapshot", time: "当前", name: "班级学情诊断", room: canReadClass ? className : "仅教师/科研角色可用", roster: classStudents, status: canReadClass ? "current" : "not_connected" },
    { id: "schedule", time: "未接入", name: "正式课表系统", room: "教务系统", roster: 0, status: "not_connected" },
  ];
  const safetyItems: DashboardSafetyItem[] = [
    { id: "snapshot", name: "首页后端快照", value: "已读取", ok: true, status: "connected" },
    { id: "integrity", name: "班级诚信聚合", value: canReadClass ? `${formatInt(classIntegrity)} 次/7日` : "未授权", ok: true, status: canReadClass ? "connected" : "not_connected" },
    { id: "quota", name: "模型配额执行", value: `${formatInt(quota.used)} / ${formatInt(quota.total)} 次`, ok: quota.percent < 90, status: "connected" },
    { id: "schedule", name: "正式课表", value: "未接入", ok: false, status: "not_connected" },
  ];
  return {
    title: "教学工作台",
    subtitle: `${formatInt(learning.sourceSummary.sessions)} 个真实会话 · ${formatInt(learning.sourceSummary.assistantMessages)} 条 AI 返回 · ${canReadClass ? `${formatInt(pending.length)} 份待批改` : "班级明细未接入当前角色"}`,
    badge: "后端实时快照 · 无演示 KPI",
    stats,
    trend: dashboardTrendFromLearning(learning),
    modelShare: model.rows,
    modelTotal: model.total,
    quota,
    safetyItems,
    courses,
    todos,
    honestStates: [
      { id: "dashboard-api", title: "首页快照", status: "connected", note: "本页由 /api/dashboard 返回当前账号会话、消息、知识库、配额与可读班级聚合。" },
      { id: "schedule", title: "正式课表", status: "not_connected", note: "尚未接入教务课表表，不再用固定课程冒充今日安排。" },
      { id: "cost", title: "真实费用", status: "estimated", note: "仅能读取模型调用次数；没有接入真实账单，因此费用不展示金额。" },
    ],
    sourceSummary,
    classOverview: classOverviewData,
    recentChats,
    quickActions: actions,
    recommendedPrompts: actions.filter((action) => action.seed).map((action) => action.seed),
  };
}

function buildAdminDashboard(user: SessionUser): DashboardAdminWorkspace | null {
  if (user.role !== "admin" && user.role !== "college-admin") return null;
  const admin = getAdminAnalyticsSnapshot();
  const pendingTickets = scalarNumber("SELECT COUNT(*) AS n FROM tickets WHERE status != 'resolved'");
  const reviewAgents = listAgents().filter((agent) => agent.status === "review");
  const auditRows = listAudit(5);
  const modelSource = admin.costShare
    .filter((row) => row.value > 0)
    .map((row, index) => ({ name: row.name, count: row.value, color: row.color || chartColor(index) }));
  const modelShare = shareFromCounts(modelSource);
  const modelTotal = modelSource.reduce((sum, row) => sum + row.count, 0);
  const quota = {
    used: modelTotal,
    total: Math.max(modelTotal, admin.sourceSummary.users * 100),
    unit: "次",
    percent: admin.sourceSummary.users > 0 ? Math.min(100, Math.round((modelTotal / Math.max(modelTotal, admin.sourceSummary.users * 100)) * 100)) : 0,
    footnote: "平台聚合调用数；真实采购/账单额度未接入",
    status: "estimated" as const,
  };
  const sourceSummary: DashboardSourceSummary = { ...sourceSummaryZero(), sessions: admin.sourceSummary.chatSessions, assistantMessages: modelTotal, users: admin.sourceSummary.users, agents: admin.sourceSummary.agents, knowledgeFiles: admin.sourceSummary.kbFiles, auditRows: admin.sourceSummary.auditRows, tickets: admin.sourceSummary.tickets, feedback: admin.sourceSummary.feedbackRows };
  const queueItems = [
    ...reviewAgents.slice(0, 3).map((agent) => ({ id: `agent-${agent.id}`, name: agent.name, desc: `智能体待审核 · ${agent.category} · 创建者 ${agent.creator}`, time: "待审核", urgent: true, href: "/admin/agents" })),
    ...(pendingTickets > 0 ? [{ id: "tickets", name: "安全工单", desc: `${formatInt(pendingTickets)} 个未解决工单需要跟进`, time: "实时", urgent: true, href: "/admin/audit" }] : []),
  ];
  const auditPreview = auditRows.map((row) => ({ id: row.id, who: row.userId || "system", op: `${row.action} · ${row.path}`, risk: row.result === "deny" ? "high" as const : "mid" as const, time: daysAgoLabel(row.at), href: "/admin/audit" }));
  const safetyItems: DashboardSafetyItem[] = [
    { id: "audit", name: "审计日志", value: `${formatInt(admin.sourceSummary.auditRows)} 条`, ok: true, status: "connected" },
    { id: "tickets", name: "安全工单", value: `${formatInt(pendingTickets)} 待跟进`, ok: pendingTickets === 0, status: "connected" },
    { id: "models", name: "模型配置", value: `${formatInt(DASHBOARD_MODEL_IDS.length)} 个可读`, ok: true, status: "connected" },
    { id: "billing", name: "真实账单", value: "未接入", ok: false, status: "not_connected" },
  ];
  return {
    title: "管理工作台",
    subtitle: `${formatInt(admin.sourceSummary.users)} 个账号 · ${formatInt(admin.sourceSummary.chatSessions)} 个会话 · ${formatInt(pendingTickets)} 个工单待跟进`,
    badge: "管理端后端快照 · 不展示演示数字",
    stats: admin.kpis,
    trend: { data: admin.dailyUsage.map((row) => ({ day: row.day, primary: row.value, secondary: row.tokens })), primaryLabel: "模型调用", secondaryLabel: "估算 Token(万)" },
    modelShare,
    modelTotal,
    quota,
    safetyItems,
    courses: [
      { id: "tickets", time: "实时", name: "安全工单队列", room: "治理中心", roster: pendingTickets, status: pendingTickets > 0 ? "upcoming" : "done" },
      { id: "agents", time: "实时", name: "智能体审核", room: "智能体库", roster: reviewAgents.length, status: reviewAgents.length > 0 ? "upcoming" : "done" },
    ],
    todos: [
      { id: "ticket-todo", title: pendingTickets > 0 ? `跟进 ${formatInt(pendingTickets)} 个安全工单` : "安全工单已清空", source: "安全工单后端", urgent: pendingTickets > 0, due: "实时", href: "/admin/audit", status: pendingTickets > 0 ? "pending" : "done" },
      { id: "agent-review", title: reviewAgents.length > 0 ? `审核 ${formatInt(reviewAgents.length)} 个智能体` : "智能体审核队列为空", source: "智能体后端", urgent: reviewAgents.length > 0, due: "实时", href: "/admin/agents", status: reviewAgents.length > 0 ? "pending" : "done" },
      { id: "billing", title: "接入真实账单与采购额度", source: "未接入项", urgent: false, due: "产品缺口", href: "/dashboard", status: "not_connected" },
    ],
    honestStates: [
      { id: "admin-snapshot", title: "管理快照", status: "connected", note: "KPI、趋势、审计、工单、智能体和知识库数量来自当前 SQLite 后端。" },
      { id: "billing", title: "真实账单", status: "not_connected", note: "尚未接入采购/账单系统，因此本页只展示调用数，不再展示虚构金额。" },
      { id: "infra-health", title: "外部基础设施健康", status: "estimated", note: "系统健康基于本地表可读性与待处理队列，不代表外部云服务 SLA。" },
    ],
    sourceSummary,
    collegeDistribution: admin.colleges,
    systemHealth: admin.systemHealth,
    queueItems,
    auditPreview,
  };
}

export function getDashboardSnapshot(user: SessionUser): DashboardSnapshot {
  return {
    generatedAt: Date.now(),
    user: { id: user.id, name: user.name, role: user.role, classId: user.classId },
    teacher: buildTeacherDashboard(user),
    admin: buildAdminDashboard(user),
  };
}

function exploreIconForSubject(subject: string): ExploreQuest["icon"] {
  if (/数学|函数|方程|几何|代数|math/i.test(subject)) return "function";
  if (/英语|语文|阅读|写作|作文|grammar|essay|english|chinese/i.test(subject)) return "language";
  if (/物理|电路|力学|physics/i.test(subject)) return "atom";
  if (/化学|chem/i.test(subject)) return "flask";
  if (/生物|细胞|biology/i.test(subject)) return "dna";
  if (/历史|人文|history/i.test(subject)) return "scroll";
  if (/地理|geo/i.test(subject)) return "globe";
  if (/信息|代码|编程|code|program/i.test(subject)) return "code";
  return "globe";
}

function explorePalette(icon: ExploreQuest["icon"]): Pick<ExploreQuest, "accent" | "ink"> {
  // 原实现给八个学科各配一套色（数学蓝 / 语文玫 / 物理天蓝 / 历史金 …），
  // 是 §3.1 R1 明令禁止的**用颜色表达归属**——同一条禁令已在 lib/data/prompts.ts 执行过一次
  // （9 个按类别着色的 hex → 统一 --accent-focus）。这里是同一个错误的第二处。
  //
  // 删掉不损失信息：学科由 `quest.subject` 文字 + `icon` 图形两条通道承载，
  // 颜色是第三次编码同一件事；而八个色相恰好是全站色族数最大的单一来源。
  // 保留 icon 差异，因此卡片仍然可区分——变的是「不再用色相当索引」。
  void icon;
  return { accent: "var(--accent-tint)", ink: "var(--accent-focus)" };
}

function exploreModelColor(model: string): string {
  // 同 explorePalette：模型身份已由**名称文字**承载（`model.name` 与色点同处一行），
  // 再用五个厂牌色相编码一次，既违反 R1，也把不受本项目色板约束的外来色引进来
  // （见 gradientKeys.ts CHART_PALETTE 的同一条说明）。
  void model;
  return "var(--accent-focus)";
}

/**
 * 本周「来过」的天数（方案 §3.3 禁机制）。
 *
 * 原实现是 streakFromWeekly：从最近一天倒着数，**遇到第一个零就 break**——中断即归零，
 * 这正是 Duolingo 式的损失厌恶。方案把红线从「禁形态」改成了「禁机制」，所以换掉火焰图标
 * 是不够的，必须换掉这条计算本身：现在按**天数计数**，不要求连续、缺席不清零。
 * 对 K-12 尤其重要——来自学校平台的负债感比来自消费 App 的更重，它带着校方权威。
 */
function activeDaysFromWeekly(rows: LearningSnapshot["weeklyTrend"]): number {
  return rows.reduce((n, row) => n + (row.messages > 0 ? 1 : 0), 0);
}

function normalizeWeekly(rows: LearningSnapshot["weeklyTrend"], mastery: number): number[] {
  const counts = rows.map((r) => r.messages);
  const max = Math.max(1, ...counts);
  const floor = counts.some((n) => n > 0) ? Math.max(18, Math.min(60, mastery)) : 0;
  return counts.map((count) => count === 0 ? 0 : Math.min(100, Math.max(floor, Math.round((count / max) * 100))));
}

export function getExploreSnapshot(user: SessionUser): ExploreSnapshot {
  const learning = getLearningSnapshot(user);
  const masteryKpi = learning.kpis.find((k) => k.id === "mastery");
  const masteryCoverage = Math.max(0, Math.min(100, Number.parseInt(masteryKpi?.value ?? "0", 10) || 0));
  const weeklyTrend = normalizeWeekly(learning.weeklyTrend, masteryCoverage);
  const yesterday = weeklyTrend.at(-2) ?? 0;
  const today = weeklyTrend.at(-1) ?? 0;
  const activeDays = activeDaysFromWeekly(learning.weeklyTrend);

  const sessionQuests: ExploreQuest[] = learning.recentSessions.slice(0, 5).map((session, index) => {
    const subject = subjectFromText(`${session.title} ${session.preview}`);
    const icon = exploreIconForSubject(subject);
    const progress = Math.min(100, Math.max(12, Math.round(session.messageCount * 9)));
    const status: ExploreQuest["status"] = progress >= 100 ? "done" : session.messageCount >= 4 ? "continue" : index === 0 ? "hot" : "new";
    return {
      id: `session-${session.id}`,
      title: progress >= 100 ? `回顾：${session.title}` : `继续探索：${session.title}`,
      subject,
      icon,
      ...explorePalette(icon),
      durationMin: Math.max(8, Math.min(45, Math.round(session.messageCount * 3 + 8))),
      progress,
      model: { name: session.modelId, color: exploreModelColor(session.modelId) },
      status,
      href: session.href,
      evidence: `${formatInt(session.messageCount)} 条真实会话消息，更新时间 ${new Date(session.updatedAt).toLocaleDateString("zh-CN")}`,
    };
  });

  const firstSessionHref = learning.recentSessions[0]?.href ?? "/chat";
  const tasks = [
    {
      id: "chat",
      label: "完成 1 次 AI 探索对话",
      done: learning.sourceSummary.userMessages > 0,
      evidence: `${formatInt(learning.sourceSummary.userMessages)} 条真实提问`,
      href: firstSessionHref,
    },
    {
      id: "review",
      label: "收藏或反馈 1 个 AI 回复",
      done: learning.sourceSummary.favorites + learning.sourceSummary.feedback > 0,
      evidence: `${formatInt(learning.sourceSummary.favorites)} 个收藏 / ${formatInt(learning.sourceSummary.feedback)} 条反馈`,
      href: firstSessionHref,
    },
    {
      id: "knowledge",
      label: "打开知识库并沉淀资料",
      done: learning.sourceSummary.knowledgeFiles > 0,
      evidence: `${formatInt(learning.sourceSummary.knowledgeFiles)} 个本人知识库文件`,
      href: "/knowledge",
    },
  ];

  const achievements: ExploreAchievement[] = [
    { id: "first-chat", label: "首次 AI 探索", icon: "rocket", unlocked: learning.sourceSummary.sessions > 0 },
    { id: "ten-turns", label: "十轮主动提问", icon: "rocket", unlocked: learning.sourceSummary.userMessages >= 10 },
    { id: "reviewer", label: "会复盘的学习者", icon: "star", unlocked: learning.sourceSummary.favorites + learning.sourceSummary.feedback > 0 },
    { id: "knowledge", label: "知识库探索者", icon: "brain", unlocked: learning.sourceSummary.knowledgeFiles > 0 },
    { id: "integrity", label: "学术诚信守护者", icon: "medal", unlocked: learning.sourceSummary.integrityWeekly > 0 },
    { id: "active-days", label: "本周多次学习", icon: "trophy", unlocked: activeDays >= 2 },
  ];

  const starterIcon: ExploreQuest["icon"] = "globe";
  const starterQuest: ExploreQuest = {
    id: "start-ai-explore",
    title: learning.sourceSummary.sessions > 0 ? "开启一个新的 AI 探索主题" : "开始第一次 AI 探索学习",
    subject: "综合",
    icon: starterIcon,
    ...explorePalette(starterIcon),
    durationMin: 12,
    progress: 0,
    model: { name: "EduAI 引导入口", color: "var(--accent-focus)" },
    status: "new",
    href: "/chat",
    evidence: "系统入口，不表示已完成记录；点击后会创建真实学习对话。",
  };
  const knowledgeIcon: ExploreQuest["icon"] = "code";
  const knowledgeQuest: ExploreQuest = {
    id: "knowledge-explore",
    title: learning.sourceSummary.knowledgeFiles > 0 ? "回到知识库继续整理资料" : "把课堂资料沉淀到知识库",
    subject: "资料",
    icon: knowledgeIcon,
    ...explorePalette(knowledgeIcon),
    durationMin: 10,
    progress: Math.min(100, learning.sourceSummary.knowledgeFiles * 25),
    model: { name: "知识库", color: "var(--accent-focus)" },
    status: learning.sourceSummary.knowledgeFiles > 0 ? "continue" : "new",
    href: "/knowledge",
    evidence: `${formatInt(learning.sourceSummary.knowledgeFiles)} 个本人知识库文件，未用示例资料冒充。`,
  };
  const quests: ExploreQuest[] = [...sessionQuests, starterQuest, knowledgeQuest].slice(0, 7);

  const taskDone = tasks.filter((task) => task.done).length;
  const achievementDone = achievements.filter((item) => item.unlocked).length;
  const questDone = quests.filter((quest) => quest.status === "done").length;
  const questsDone = taskDone + achievementDone + questDone;
  const questsTotal = tasks.length + achievements.length + quests.length;
  const weeklyPercent = Math.min(100, Math.round(masteryCoverage * 0.58 + (taskDone / tasks.length) * 26 + Math.min(activeDays, 7) * 2));
  const progress: ExploreProgress = {
    activeDays,
    weeklyPercent,
    masteryCoverage,
    vsYesterday: Math.max(-100, Math.min(100, today - yesterday)),
    weeklyTrend,
    questsDone,
    questsTotal,
    peerBand: null,
    peerComparisonStatus: "not_connected",
  };

  return {
    generatedAt: learning.generatedAt,
    user: learning.user,
    progress,
    quests,
    tasks,
    achievements,
    honestStates: [
      { id: "explore-snapshot", title: "探索页数据", status: "connected", note: "来自当前账号的会话、消息、收藏、反馈、知识库与诚信聚合。" },
      { id: "task-state", title: "今日任务状态", status: "connected", note: "由真实记录自动推导，不再用前端本地打勾冒充完成。" },
      { id: "peer-comparison", title: "同伴对比", status: "not_connected", note: "尚未接入匿名班级分位数据；页面只展示自我成长，不显示虚构排行。" },
    ],
    sourceSummary: learning.sourceSummary,
  };
}


// ── W-B3 · 班级成员统一判定 ──
// 历史包袱：名册表 students（s1-s6 演示名册，无登录账号）与 users 里的真实登录学生
// （u-student 等，有 classId）是两套数据。只查名册会把真实登录学生 403 在门外——
// 「有门没人跑」在数据层的重演。所有「是否本班学生」判定一律走本函数（两表并集）。
export function isStudentInClass(classId: string, studentId: string): boolean {
  if (db().prepare("SELECT 1 FROM students WHERE id = ? AND classId = ?").get(studentId, classId)) return true;
  return Boolean(db().prepare("SELECT 1 FROM users WHERE id = ? AND role = 'student' AND classId = ?").get(studentId, classId));
}
/** 名册 + 登录学生并集（状态面板/点评面板的完整学生列表）。 */
export function classStudentsUnion(classId: string): Array<{ id: string; name: string }> {
  const roster = listClassStudents(classId).map((s) => ({ id: s.id, name: s.name }));
  const logins = db().prepare("SELECT id, name FROM users WHERE role = 'student' AND classId = ?").all(classId) as unknown as Array<{ id: string; name: string }>;
  const seen = new Set(roster.map((r) => r.id));
  return [...roster, ...logins.filter((l) => !seen.has(l.id))];
}

// ── W-B3 · 学科项目活动（状态机：draft → submitted → approved/returned；approved 即档案袋条目，单一真相源不复制）──
export type SubmissionStatus = "draft" | "submitted" | "approved" | "returned";
export interface ActivityRow {
  id: string; classId: string; teacherId: string; subject: string;
  title: string; brief: string; dueAt: number | null; status: "open" | "closed"; createdAt: number;
}
export interface SubmissionRow {
  id: string; activityId: string; studentId: string; content: string; status: SubmissionStatus;
  teacherFeedback: string | null; submittedAt: number | null; reviewedAt: number | null; updatedAt: number;
  artifactRef: string | null;
}
export function addActivity(teacherId: string, classId: string, a: { subject: string; title: string; brief: string; dueAt?: number | null }): ActivityRow {
  const row: ActivityRow = {
    id: rid("act"), classId, teacherId, subject: a.subject.slice(0, 24),
    title: a.title.slice(0, 80), brief: a.brief.slice(0, 2000),
    dueAt: a.dueAt ?? null, status: "open", createdAt: Date.now(),
  };
  db().prepare("INSERT INTO activities (id,classId,teacherId,subject,title,brief,dueAt,status,createdAt) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(row.id, row.classId, row.teacherId, row.subject, row.title, row.brief, row.dueAt, row.status, row.createdAt);
  return row;
}
export function getActivity(id: string): ActivityRow | null {
  return (db().prepare("SELECT * FROM activities WHERE id = ?").get(id) as unknown as ActivityRow) ?? null;
}
export function listActivitiesForClass(classId: string): ActivityRow[] {
  return db().prepare("SELECT * FROM activities WHERE classId = ? ORDER BY createdAt DESC LIMIT 50").all(classId) as unknown as ActivityRow[];
}
export function getSubmission(activityId: string, studentId: string): SubmissionRow | null {
  return (db().prepare("SELECT * FROM activity_submissions WHERE activityId = ? AND studentId = ?").get(activityId, studentId) as unknown as SubmissionRow) ?? null;
}
/** 学生存草稿/提交。approved 为终态（入册即锁定）；returned 可改后再提交。返回 null = 状态机拒绝。 */
export function upsertSubmission(activityId: string, studentId: string, content: string, action: "draft" | "submit", artifactRef?: string | null): SubmissionRow | null {
  const existing = getSubmission(activityId, studentId);
  if (existing?.status === "approved") return null;
  // 批阅目标冻结（对抗审查修复：原实现只拦 draft 回改，submitted+submit 可在教师
  // 预览后整体调包正文与佐证材料——TOCTOU）。submitted 期间一律锁死，退回后才可再改。
  if (existing?.status === "submitted") return null;
  const now = Date.now();
  const status: SubmissionStatus = action === "submit" ? "submitted" : "draft";
  const submittedAt = action === "submit" ? now : null;
  // artifactRef 语义：undefined=不动现值；null=显式移除；字符串=替换
  const nextRef = artifactRef === undefined ? (existing?.artifactRef ?? null) : artifactRef;
  if (existing) {
    db().prepare("UPDATE activity_submissions SET content = ?, status = ?, submittedAt = ?, updatedAt = ?, artifactRef = ? WHERE id = ?")
      .run(content.slice(0, 4000), status, submittedAt, now, nextRef, existing.id);
    return getSubmission(activityId, studentId);
  }
  const row: SubmissionRow = { id: rid("sub"), activityId, studentId, content: content.slice(0, 4000), status, teacherFeedback: null, submittedAt, reviewedAt: null, updatedAt: now, artifactRef: nextRef };
  db().prepare("INSERT INTO activity_submissions (id,activityId,studentId,content,status,teacherFeedback,submittedAt,reviewedAt,updatedAt,artifactRef) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(row.id, row.activityId, row.studentId, row.content, row.status, null, row.submittedAt, null, row.updatedAt, nextRef);
  return row;
}

/** 佐证材料读取（批阅域）：按 uploadId+归属学生取，供「教师批阅自己班学生的提交」这一条已鉴权路径使用。 */
export function getUploadForReview(uploadId: string, ownerId: string): { name: string; chars: number; textContent: string } | null {
  const r = db().prepare("SELECT name, chars, textContent FROM uploads WHERE id = ? AND userId = ? AND status = 'parsed'").get(uploadId, ownerId) as { name: string; chars: number; textContent: string } | undefined;
  return r ?? null;
}
/** 教师批阅：只允许 submitted → approved/returned。approved = 通过入册（档案袋直接读 approved 行）。 */
export function reviewSubmission(submissionId: string, verdict: "approve" | "return", feedback: string): SubmissionRow | null {
  const row = db().prepare("SELECT * FROM activity_submissions WHERE id = ?").get(submissionId) as unknown as SubmissionRow | undefined;
  if (!row || row.status !== "submitted") return null;
  const status: SubmissionStatus = verdict === "approve" ? "approved" : "returned";
  db().prepare("UPDATE activity_submissions SET status = ?, teacherFeedback = ?, reviewedAt = ?, updatedAt = ? WHERE id = ?")
    .run(status, feedback.slice(0, 500) || null, Date.now(), Date.now(), submissionId);
  return db().prepare("SELECT * FROM activity_submissions WHERE id = ?").get(submissionId) as unknown as SubmissionRow;
}
/** 完成状态面板（规格⑥-3「有门没人跑」的业务层堵法）：按学生列出 未开始/草稿/已提交/已批。 */
export function activityStatusBoard(activityId: string, classId: string): Array<{ studentId: string; name: string; status: SubmissionStatus | "none" }> {
  const students = classStudentsUnion(classId);
  const subs = db().prepare("SELECT studentId, status FROM activity_submissions WHERE activityId = ?").all(activityId) as unknown as Array<{ studentId: string; status: SubmissionStatus }>;
  const map = new Map(subs.map((s) => [s.studentId, s.status]));
  return students.map((s) => ({ studentId: s.id, name: s.name, status: map.get(s.id) ?? "none" }));
}
export function listSubmissionsForStudent(studentId: string): SubmissionRow[] {
  return db().prepare("SELECT * FROM activity_submissions WHERE studentId = ? ORDER BY updatedAt DESC LIMIT 100").all(studentId) as unknown as SubmissionRow[];
}

// ── W-B3 · 档案袋聚合（规格⑦：双版=两种产物；客观数据自动导入不可编辑，主观材料只收教师已批通过项）──
export interface PortfolioEntry {
  kind: "activity" | "evaluation"; at: number; subject?: string; title?: string;
  studentText?: string; teacherText?: string; tag?: string; artifactName?: string;
}
export function portfolioSummary(userId: string, mode: "simple" | "full"): {
  mode: "simple" | "full";
  objective: { quiz: { total: number; correct: number }; mistakes: { total: number; reviewed: number }; activeDays7: number };
  entries: PortfolioEntry[];
  manorArtifacts: ReturnType<typeof publicManorArtifact>[];
  evaluations: EvaluationRow[];
  truncated: boolean;
} {
  const quiz = quizStats(userId, 30);
  const m = db().prepare("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN reviewedAt IS NOT NULL THEN 1 ELSE 0 END),0) AS rev FROM mistakes WHERE userId = ?").get(userId) as { total: number; rev: number };
  const days = db().prepare("SELECT COUNT(DISTINCT day) AS d FROM chat_usage WHERE userId = ? AND day >= ?").get(userId, Math.floor((Date.now() - 7 * 86_400_000) / 86_400_000)) as { d: number };
  const approved = db().prepare(
    `SELECT s.reviewedAt AS at, a.subject, a.title, s.content, s.teacherFeedback, u.name AS artifactName
     FROM activity_submissions s JOIN activities a ON a.id = s.activityId
     LEFT JOIN uploads u ON u.id = s.artifactRef
     WHERE s.studentId = ? AND s.status = 'approved' ORDER BY s.reviewedAt DESC LIMIT 100`
  ).all(userId) as unknown as Array<{ at: number; subject: string; title: string; content: string; teacherFeedback: string | null; artifactName: string | null }>;
  const evals = listEvaluations(userId, mode === "simple" ? 6 : 50);
  const manorArtifacts = (db().prepare(MANOR_ARTIFACT_SELECT).all(userId) as unknown as ManorArtifactRecord[])
    .map(publicManorArtifact).filter((artifact) => artifact.status === "archived");
  const activityEntries: PortfolioEntry[] = approved.map((r) => ({
    kind: "activity", at: r.at, subject: r.subject, title: r.title,
    studentText: r.content, teacherText: r.teacherFeedback ?? undefined,
    artifactName: r.artifactName ?? undefined,
  }));
  // Only the exact teacher-accepted expression enters the approved timeline; drafts remain explicitly separate.
  activityEntries.push(...manorArtifacts.map((artifact) => ({
    kind: "activity" as const, at: artifact.updatedAt, title: artifact.title, subject: artifact.subject ?? undefined,
    studentText: artifact.content, teacherText: artifact.teacherFeedback ?? undefined, artifactName: artifact.title,
    source: artifact.source, sourceUrl: artifact.sourceUrl, artifactId: artifact.id, evidenceId: artifact.evidenceId,
    revision: artifact.revision, evidenceRevision: artifact.evidenceRevision, status: artifact.status,
  })));
  activityEntries.sort((left, right) => right.at - left.at);
  // 简约版=遴选产物：每类精选 ≤6 条（综评「整理遴选」）；详细版=全量时间线（活动入册 + 教师点评合流按时间倒序）
  let entries: PortfolioEntry[];
  let truncated = false;
  if (mode === "simple") {
    truncated = activityEntries.length > 6;
    entries = activityEntries.slice(0, 6);
  } else {
    const evalEntries: PortfolioEntry[] = evals.map((e) => ({ kind: "evaluation", at: e.createdAt, tag: e.tag, teacherText: e.note || undefined }));
    entries = [...activityEntries, ...evalEntries].sort((x, y) => y.at - x.at);
  }
  return {
    mode,
    objective: { quiz, mistakes: { total: Number(m.total), reviewed: Number(m.rev) }, activeDays7: Number(days.d) },
    entries, evaluations: evals, truncated, manorArtifacts,
  };
}

// ── W-B3 · AI 成长建议（规格红线 R5：AI 草稿 → 教师审改 → 发布才对学生可见；署名双归因；可撤回）──
export interface AdviceRow {
  id: string; studentId: string; teacherId: string; draftText: string; finalText: string | null;
  source: string; status: "draft" | "published" | "withdrawn"; createdAt: number; publishedAt: number | null;
}
export function createAdviceDraft(studentId: string, teacherId: string, draftText: string, source: string): AdviceRow {
  const row: AdviceRow = { id: rid("adv"), studentId, teacherId, draftText: draftText.slice(0, 2000), finalText: null, source, status: "draft", createdAt: Date.now(), publishedAt: null };
  db().prepare("INSERT INTO portfolio_advice (id,studentId,teacherId,draftText,finalText,source,status,createdAt,publishedAt) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(row.id, row.studentId, row.teacherId, row.draftText, null, row.source, row.status, row.createdAt, null);
  return row;
}
export function listAdvice(studentId: string, includeDrafts: boolean): AdviceRow[] {
  const sql = includeDrafts
    ? "SELECT * FROM portfolio_advice WHERE studentId = ? AND status != 'withdrawn' ORDER BY createdAt DESC LIMIT 10"
    : "SELECT * FROM portfolio_advice WHERE studentId = ? AND status = 'published' ORDER BY publishedAt DESC LIMIT 5";
  return db().prepare(sql).all(studentId) as unknown as AdviceRow[];
}
/** 发布：finalText 是教师改定稿——学生端只展示 finalText，AI 原稿仅教师侧留档可比对。 */
export function publishAdvice(id: string, teacherId: string, finalText: string): AdviceRow | null {
  const row = db().prepare("SELECT * FROM portfolio_advice WHERE id = ? AND teacherId = ?").get(id, teacherId) as unknown as AdviceRow | undefined;
  if (!row || row.status !== "draft") return null;
  db().prepare("UPDATE portfolio_advice SET finalText = ?, status = 'published', publishedAt = ? WHERE id = ?")
    .run(finalText.slice(0, 2000), Date.now(), id);
  return db().prepare("SELECT * FROM portfolio_advice WHERE id = ?").get(id) as unknown as AdviceRow;
}
export function withdrawAdvice(id: string, teacherId: string): boolean {
  const r = db().prepare("UPDATE portfolio_advice SET status = 'withdrawn' WHERE id = ? AND teacherId = ? AND status = 'published'").run(id, teacherId);
  return Number(r.changes) > 0;
}


// ── W-B4 · 徽章/积分/庄园（规格⑧⑨）──
// 判据确定性：所有计数直接来自真实事件表（quiz_attempts/mistake_reviews/activity_submissions/
// evaluations/chat_usage），没有任何「手工发放」入口——伪事件在源头就不存在（验收：注入不触发）。
import {
  BADGES, POINT_RULES, MANOR_PARTS, MANOR_GRID, LANDMARK_BADGE_GATE, STARTER_PARTS,
  WEEKLY_QUESTS, WEEKLY_BONUS, WEEK_MS, MONTH_CHAPTERS, CHAPTER_BONUS, CLASS_BUILDS,
  MANOR_CROPS, MANOR_PLOT_COUNT, MANOR_CROP_STAGE_MAX, MANOR_STARTER_GROWTH_ENERGY,
  type BadgeEvent, type ManorCrop,
} from "@/lib/gamify";

export function badgeEventCounts(userId: string): Record<BadgeEvent, number> {
  const d = db();
  const n = (sql: string) => Number((d.prepare(sql).get(userId) as { c: number }).c);
  return {
    quiz_answered: n("SELECT COUNT(*) AS c FROM quiz_attempts WHERE userId = ? AND answeredAt IS NOT NULL"),
    mistake_reviewed: n("SELECT COUNT(*) AS c FROM mistake_reviews WHERE userId = ?"),
    activity_approved: n("SELECT COUNT(*) AS c FROM activity_submissions WHERE studentId = ? AND status = 'approved'"),
    eval_positive: n("SELECT COUNT(*) AS c FROM evaluations WHERE studentId = ? AND score > 0"),
    active_days: n("SELECT COUNT(DISTINCT day) AS c FROM chat_usage WHERE userId = ?"),
    ai_question: n("SELECT COUNT(*) AS c FROM chat_messages m JOIN chat_sessions s ON m.sessionId = s.id WHERE s.userId = ? AND m.role = 'user'"),
    image_created: n("SELECT COUNT(*) AS c FROM image_jobs WHERE userId = ? AND status = 'done'"),
    peer_like: n("SELECT COUNT(*) AS c FROM manor_likes WHERE visitorId = ?"),
    class_contrib: n("SELECT COUNT(*) AS c FROM class_build_contrib WHERE userId = ?"),
  };
}

export interface BadgeWallItem {
  id: string; name: string; desc: string; tier: number; event: BadgeEvent; threshold: number;
  earned: boolean; awardedAt: number | null; current: number;
  /** H10：已授予但尚未向本人播放过解锁庆祝（读到即待庆祝，ack 后翻false）。 */
  fresh: boolean;
}
function badgeWall(userId: string, materialize: boolean): BadgeWallItem[] {
  const counts = badgeEventCounts(userId);
  const d = db();
  if (materialize) {
    const ins = d.prepare("INSERT OR IGNORE INTO user_badges (userId, badgeId, awardedAt) VALUES (?,?,?)");
    for (const b of BADGES) {
      if (counts[b.event] >= b.threshold) ins.run(userId, b.id, Date.now());
    }
  }
  const owned = new Map((d.prepare("SELECT badgeId, awardedAt, celebratedAt FROM user_badges WHERE userId = ?").all(userId) as unknown as Array<{ badgeId: string; awardedAt: number; celebratedAt: number | null }>).map((r) => [r.badgeId, r]));
  return BADGES.map((b) => {
    const row = owned.get(b.id);
    const projected = !materialize && counts[b.event] >= b.threshold;
    return {
      ...b, earned: Boolean(row) || projected, awardedAt: row?.awardedAt ?? null,
      fresh: Boolean(row) && row?.celebratedAt == null,
      current: Math.min(counts[b.event], b.threshold),
    };
  });
}

/** 同步 + 返回徽章墙：真实计数过线即授予（INSERT OR IGNORE 幂等），详情自带「凭什么获得」。 */
export function syncBadges(userId: string): BadgeWallItem[] {
  return badgeWall(userId, true);
}

/** 演示会话只读投影：展示已达成状态，但不授予徽章、积分或其他真实权益。 */
export function readBadgeWall(userId: string): BadgeWallItem[] {
  return badgeWall(userId, false);
}

/** H10：确认「解锁庆祝已播放」（只动本人、只动未庆祝行；目录外 id 直接丢弃）。 */
export function ackBadges(userId: string, ids: string[]): number {
  const valid = new Set(BADGES.map((b) => b.id));
  const list = ids.filter((i) => valid.has(i));
  if (list.length === 0) return 0;
  const upd = db().prepare("UPDATE user_badges SET celebratedAt = ? WHERE userId = ? AND badgeId = ? AND celebratedAt IS NULL");
  let n = 0;
  for (const id of list) n += Number(upd.run(Date.now(), userId, id).changes);
  return n;
}

/**
 * 积分台账物化（幂等）：把真实事件逐条转成 earn 行，eventKey 唯一防重；
 * 每类行为按事件发生日限额（POINT_RULES.dayCap），超出部分不产分（防刷）。
 */
export function syncPoints(userId: string): void {
  const d = db();
  const events: Array<{ key: string; kind: BadgeEvent; at: number }> = [];
  for (const r of d.prepare("SELECT id, answeredAt FROM quiz_attempts WHERE userId = ? AND answeredAt IS NOT NULL ORDER BY answeredAt").all(userId) as unknown as Array<{ id: string; answeredAt: number }>) {
    events.push({ key: `quiz:${r.id}`, kind: "quiz_answered", at: r.answeredAt });
  }
  for (const r of d.prepare("SELECT id, at FROM mistake_reviews WHERE userId = ? ORDER BY at").all(userId) as unknown as Array<{ id: string; at: number }>) {
    events.push({ key: `fix:${r.id}`, kind: "mistake_reviewed", at: r.at });
  }
  for (const r of d.prepare("SELECT id, reviewedAt FROM activity_submissions WHERE studentId = ? AND status = 'approved' ORDER BY reviewedAt").all(userId) as unknown as Array<{ id: string; reviewedAt: number }>) {
    events.push({ key: `proj:${r.id}`, kind: "activity_approved", at: r.reviewedAt });
  }
  for (const r of d.prepare("SELECT id, createdAt FROM evaluations WHERE studentId = ? AND score > 0 ORDER BY createdAt").all(userId) as unknown as Array<{ id: string; createdAt: number }>) {
    events.push({ key: `eval:${r.id}`, kind: "eval_positive", at: r.createdAt });
  }
  const perDay = new Map<string, number>(); // `${kind}:${day}` → 该日已入账条数（含历史）
  for (const row of d.prepare("SELECT kind, createdAt FROM points_ledger WHERE userId = ? AND delta > 0").all(userId) as unknown as Array<{ kind: string; createdAt: number }>) {
    const k = `${row.kind}:${bjDay(row.createdAt)}`;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const seen = new Set((d.prepare("SELECT eventKey FROM points_ledger WHERE userId = ? AND eventKey IS NOT NULL").all(userId) as unknown as Array<{ eventKey: string }>).map((r) => r.eventKey));
  const ins = d.prepare("INSERT OR IGNORE INTO points_ledger (id,userId,kind,delta,reason,eventKey,createdAt) VALUES (?,?,?,?,?,?,?)");
  for (const e of events) {
    if (seen.has(e.key)) continue;
    const rule = POINT_RULES[e.kind];
    if (rule.per <= 0) continue;
    const dk = `${e.kind}:${bjDay(e.at)}`;
    const used = perDay.get(dk) ?? 0;
    if (used >= rule.dayCap) continue; // 超日限额：事件保留（徽章仍计数），只是不产分
    perDay.set(dk, used + 1);
    ins.run(rid("pt"), userId, e.kind, rule.per, rule.reason, e.key, e.at);
  }
}

export function pointsBalance(userId: string): number {
  return Number((db().prepare("SELECT COALESCE(SUM(delta),0) AS s FROM points_ledger WHERE userId = ?").get(userId) as { s: number }).s);
}
export function pointsLedger(userId: string, limit = 30): Array<{ delta: number; reason: string; createdAt: number }> {
  return db().prepare("SELECT delta, reason, createdAt FROM points_ledger WHERE userId = ? ORDER BY createdAt DESC, rowid DESC LIMIT ?").all(userId, limit) as unknown as Array<{ delta: number; reason: string; createdAt: number }>;
}

export interface ManorItem { id: string; partId: string; x: number | null; y: number | null; acquiredAt: number }
export interface ManorVisitItem { partId: string; x: number; y: number }

function starterManorItems(): ManorItem[] {
  return STARTER_PARTS.map((partId, index) => ({
    id: `starter-preview-${index}`,
    partId,
    x: index + 2,
    y: 3,
    acquiredAt: 0,
  }));
}

/** 庄园状态；首次进入即赠 3 件起步部件（禁空地块冷启动，规格⑨-4）。 */
export function manorState(userId: string): { items: ManorItem[]; balance: number } {
  syncPoints(userId);
  const d = db();
  const has = d.prepare("SELECT COUNT(*) AS c FROM manor_items WHERE userId = ?").get(userId) as { c: number };
  if (Number(has.c) === 0) {
    const ins = d.prepare("INSERT INTO manor_items (id,userId,partId,x,y,acquiredAt) VALUES (?,?,?,?,?,?)");
    STARTER_PARTS.forEach((partId, i) => ins.run(rid("mi"), userId, partId, i + 2, 3, Date.now()));
  }
  const items = d.prepare("SELECT id, partId, x, y, acquiredAt FROM manor_items WHERE userId = ? ORDER BY acquiredAt").all(userId) as unknown as ManorItem[];
  return { items, balance: pointsBalance(userId) };
}

/** 演示会话只读投影：展示起步庄园，但不同步积分、不写入任何种子数据。 */
export function manorStateReadOnly(userId: string): { items: ManorItem[]; balance: number } {
  const items = db().prepare("SELECT id, partId, x, y, acquiredAt FROM manor_items WHERE userId = ? ORDER BY acquiredAt").all(userId) as unknown as ManorItem[];
  return { items: items.length > 0 ? items : starterManorItems(), balance: pointsBalance(userId) };
}

export function manorEarnedBadgeCount(userId: string, materialize = true): number {
  if (materialize) return syncBadges(userId).filter((badge) => badge.earned).length;
  return Number((db().prepare("SELECT COUNT(*) AS c FROM user_badges WHERE userId = ?").get(userId) as { c: number }).c);
}

export interface ManorPlotState {
  plot: number;
  cropId: string | null;
  stage: number;
  plantedAt: number | null;
  updatedAt: number | null;
}

export interface ManorCropAccess {
  id: string;
  unlocked: boolean;
  source: ManorCrop["unlock"]["kind"];
  progress: number;
  need: number;
}

export interface ManorFarmState {
  plots: ManorPlotState[];
  cropAccess: ManorCropAccess[];
  growthEnergy: number;
  harvests: Record<string, number>;
  harvestedTotal: number;
}

function emptyManorPlots(): ManorPlotState[] {
  return Array.from({ length: MANOR_PLOT_COUNT }, (_, plot) => ({
    plot,
    cropId: plot === 0 ? "wheat" : null,
    stage: plot === 0 ? 1 : 0,
    plantedAt: plot === 0 ? Date.now() : null,
    updatedAt: plot === 0 ? Date.now() : null,
  }));
}

function ensureManorPlots(userId: string): void {
  const d = db();
  const has = Number((d.prepare("SELECT COUNT(*) AS c FROM manor_plots WHERE userId = ?").get(userId) as { c: number }).c);
  const seed = emptyManorPlots();
  const ins = d.prepare("INSERT OR IGNORE INTO manor_plots (userId,plot,cropId,stage,plantedAt,updatedAt) VALUES (?,?,?,?,?,?)");
  for (const row of seed) {
    const firstVisitCrop = has === 0 ? row.cropId : null;
    const firstVisitStage = has === 0 ? row.stage : 0;
    const firstVisitAt = has === 0 ? row.plantedAt : null;
    ins.run(userId, row.plot, firstVisitCrop, firstVisitStage, firstVisitAt, firstVisitAt);
  }
}

function cropAccessRows(userId: string, materialize = true): ManorCropAccess[] {
  const d = db();
  const counts = badgeEventCounts(userId);
  const badgeCount = manorEarnedBadgeCount(userId, materialize);
  const harvestedTotal = Number((d.prepare("SELECT COUNT(*) AS c FROM manor_harvests WHERE userId = ?").get(userId) as { c: number }).c);
  const permanent = new Set((d.prepare("SELECT cropId FROM manor_crop_unlocks WHERE userId = ?").all(userId) as unknown as Array<{ cropId: string }>).map((r) => r.cropId));
  const balance = pointsBalance(userId);
  return MANOR_CROPS.map((crop) => {
    const unlock = crop.unlock;
    if (unlock.kind === "starter") return { id: crop.id, unlocked: true, source: unlock.kind, progress: 1, need: 1 };
    if (unlock.kind === "points") return { id: crop.id, unlocked: permanent.has(crop.id), source: unlock.kind, progress: balance, need: unlock.cost };
    const progress = unlock.kind === "teacher" ? counts.eval_positive
      : unlock.kind === "quest" ? counts.activity_approved
      : unlock.kind === "badge" ? badgeCount
      : harvestedTotal;
    if (materialize && progress >= unlock.need && !permanent.has(crop.id)) {
      d.prepare("INSERT OR IGNORE INTO manor_crop_unlocks (userId,cropId,source,unlockedAt) VALUES (?,?,?,?)")
        .run(userId, crop.id, unlock.kind, Date.now());
      permanent.add(crop.id);
    }
    return { id: crop.id, unlocked: permanent.has(crop.id) || progress >= unlock.need, source: unlock.kind, progress, need: unlock.need };
  });
}

function manorGrowthEnergyRaw(userId: string): number {
  const d = db();
  const earned = Number((d.prepare("SELECT COUNT(*) AS c FROM points_ledger WHERE userId = ? AND delta > 0").get(userId) as { c: number }).c);
  const spent = Number((d.prepare("SELECT COUNT(*) AS c FROM manor_growth_spend WHERE userId = ?").get(userId) as { c: number }).c);
  return Math.max(0, MANOR_STARTER_GROWTH_ENERGY + earned - spent);
}

/** 学习事件驱动的庄园状态：没有等待时钟，成长雨露只来自已验证学习事件。 */
export function manorFarmState(userId: string): ManorFarmState {
  syncPoints(userId);
  ensureManorPlots(userId);
  const d = db();
  const plots = d.prepare("SELECT plot,cropId,stage,plantedAt,updatedAt FROM manor_plots WHERE userId = ? ORDER BY plot").all(userId) as unknown as ManorPlotState[];
  const rows = d.prepare("SELECT cropId, COUNT(*) AS c FROM manor_harvests WHERE userId = ? GROUP BY cropId").all(userId) as unknown as Array<{ cropId: string; c: number }>;
  const harvests = Object.fromEntries(rows.map((r) => [r.cropId, Number(r.c)]));
  return {
    plots,
    cropAccess: cropAccessRows(userId),
    growthEnergy: manorGrowthEnergyRaw(userId),
    harvests,
    harvestedTotal: rows.reduce((sum, row) => sum + Number(row.c), 0),
  };
}

/** 演示会话只读投影：不补地块、不产分、不授徽章、不物化解锁。 */
export function manorFarmStateReadOnly(userId: string): ManorFarmState {
  const d = db();
  const stored = d.prepare("SELECT plot,cropId,stage,plantedAt,updatedAt FROM manor_plots WHERE userId = ? ORDER BY plot").all(userId) as unknown as ManorPlotState[];
  const rows = d.prepare("SELECT cropId, COUNT(*) AS c FROM manor_harvests WHERE userId = ? GROUP BY cropId").all(userId) as unknown as Array<{ cropId: string; c: number }>;
  const harvests = Object.fromEntries(rows.map((row) => [row.cropId, Number(row.c)]));
  return {
    plots: stored.length === MANOR_PLOT_COUNT ? stored : emptyManorPlots(),
    cropAccess: cropAccessRows(userId, false),
    growthEnergy: manorGrowthEnergyRaw(userId),
    harvests,
    harvestedTotal: rows.reduce((sum, row) => sum + Number(row.c), 0),
  };
}

/** 同伴参观只展示场景结果，不下发解锁条件、积分或学习事件。 */
export function manorFarmVisitState(userId: string): { plots: Array<Pick<ManorPlotState, "plot" | "cropId" | "stage">> } {
  const d = db();
  const stored = d.prepare("SELECT plot,cropId,stage,plantedAt,updatedAt FROM manor_plots WHERE userId = ? ORDER BY plot").all(userId) as unknown as ManorPlotState[];
  const plots = stored.length === MANOR_PLOT_COUNT ? stored : emptyManorPlots();
  return { plots: plots.map(({ plot, cropId, stage }) => ({ plot, cropId, stage })) };
}

type ManorOperationReplay<T> = T | "conflict" | null;

function manorOperationReplay<T>(d: DatabaseSync, userId: string, operationId: string, actionKey: string): ManorOperationReplay<T> {
  const row = d.prepare("SELECT actionKey,resultJson FROM manor_operations WHERE userId = ? AND operationId = ?")
    .get(userId, operationId) as { actionKey: string; resultJson: string } | undefined;
  if (!row) return null;
  if (row.actionKey !== actionKey) return "conflict";
  return JSON.parse(row.resultJson) as T;
}

function recordManorOperation(d: DatabaseSync, userId: string, operationId: string, actionKey: string, result: unknown): void {
  d.prepare("INSERT INTO manor_operations (userId,operationId,actionKey,resultJson,createdAt) VALUES (?,?,?,?,?)")
    .run(userId, operationId, actionKey, JSON.stringify(result), Date.now());
}

export function manorPlant(userId: string, plot: number, cropId: string, operationId: string): { ok: true } | { ok: false; error: string } {
  ensureManorPlots(userId);
  const access = cropAccessRows(userId).find((row) => row.id === cropId);
  if (!access) return { ok: false, error: "unknown_crop" };
  if (!access.unlocked) return { ok: false, error: "crop_locked" };
  const d = db();
  const actionKey = `plant:${plot}:${cropId}`;
  d.exec("BEGIN IMMEDIATE");
  try {
    const replay = manorOperationReplay<{ ok: true }>(d, userId, operationId, actionKey);
    if (replay === "conflict") { d.exec("ROLLBACK"); return { ok: false, error: "operation_conflict" }; }
    if (replay) { d.exec("ROLLBACK"); return replay; }
    const now = Date.now();
    const changed = d.prepare("UPDATE manor_plots SET cropId = ?, stage = 0, plantedAt = ?, updatedAt = ? WHERE userId = ? AND plot = ? AND cropId IS NULL")
      .run(cropId, now, now, userId, plot);
    if (Number(changed.changes) === 0) { d.exec("ROLLBACK"); return { ok: false, error: "plot_unavailable" }; }
    const result = { ok: true } as const;
    recordManorOperation(d, userId, operationId, actionKey, result);
    d.exec("COMMIT");
    return result;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}

export function manorNurture(userId: string, plot: number, operationId: string): { ok: true; stage: number; growthEnergy: number } | { ok: false; error: string } {
  syncPoints(userId);
  ensureManorPlots(userId);
  const d = db();
  const actionKey = `nurture:${plot}`;
  d.exec("BEGIN IMMEDIATE");
  try {
    const replay = manorOperationReplay<{ ok: true; stage: number; growthEnergy: number }>(d, userId, operationId, actionKey);
    if (replay === "conflict") { d.exec("ROLLBACK"); return { ok: false, error: "operation_conflict" }; }
    if (replay) { d.exec("ROLLBACK"); return replay; }
    const row = d.prepare("SELECT cropId,stage FROM manor_plots WHERE userId = ? AND plot = ?").get(userId, plot) as { cropId: string | null; stage: number } | undefined;
    if (!row?.cropId) { d.exec("ROLLBACK"); return { ok: false, error: "empty_plot" }; }
    if (row.stage >= MANOR_CROP_STAGE_MAX) { d.exec("ROLLBACK"); return { ok: false, error: "already_mature" }; }
    const available = manorGrowthEnergyRaw(userId);
    if (available < 1) { d.exec("ROLLBACK"); return { ok: false, error: "no_growth_energy" }; }
    const next = row.stage + 1;
    d.prepare("INSERT INTO manor_growth_spend (id,userId,plot,cropId,createdAt) VALUES (?,?,?,?,?)")
      .run(rid("mgs"), userId, plot, row.cropId, Date.now());
    d.prepare("UPDATE manor_plots SET stage = ?, updatedAt = ? WHERE userId = ? AND plot = ?")
      .run(next, Date.now(), userId, plot);
    const result = { ok: true, stage: next, growthEnergy: available - 1 } as const;
    recordManorOperation(d, userId, operationId, actionKey, result);
    d.exec("COMMIT");
    return result;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}

export function manorHarvest(userId: string, plot: number, operationId: string): { ok: true; cropId: string } | { ok: false; error: string } {
  ensureManorPlots(userId);
  const d = db();
  const actionKey = `harvest:${plot}`;
  d.exec("BEGIN IMMEDIATE");
  try {
    const replay = manorOperationReplay<{ ok: true; cropId: string }>(d, userId, operationId, actionKey);
    if (replay === "conflict") { d.exec("ROLLBACK"); return { ok: false, error: "operation_conflict" }; }
    if (replay) { d.exec("ROLLBACK"); return replay; }
    const row = d.prepare("SELECT cropId,stage FROM manor_plots WHERE userId = ? AND plot = ?").get(userId, plot) as { cropId: string | null; stage: number } | undefined;
    if (!row?.cropId || row.stage < MANOR_CROP_STAGE_MAX) { d.exec("ROLLBACK"); return { ok: false, error: "not_mature" }; }
    d.prepare("INSERT INTO manor_harvests (id,userId,cropId,plot,harvestedAt) VALUES (?,?,?,?,?)")
      .run(rid("mh"), userId, row.cropId, plot, Date.now());
    d.prepare("UPDATE manor_plots SET cropId = NULL, stage = 0, plantedAt = NULL, updatedAt = ? WHERE userId = ? AND plot = ?")
      .run(Date.now(), userId, plot);
    const result = { ok: true, cropId: row.cropId } as const;
    recordManorOperation(d, userId, operationId, actionKey, result);
    d.exec("COMMIT");
    return result;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}

export function manorUnlockCrop(userId: string, cropId: string, operationId: string): { ok: true; balance: number } | { ok: false; error: string } {
  const crop = MANOR_CROPS.find((row) => row.id === cropId);
  if (!crop) return { ok: false, error: "unknown_crop" };
  if (crop.unlock.kind !== "points") return { ok: false, error: "not_exchangeable" };
  syncPoints(userId);
  const d = db();
  const actionKey = `unlock:${cropId}`;
  d.exec("BEGIN IMMEDIATE");
  try {
    const replay = manorOperationReplay<{ ok: true; balance: number }>(d, userId, operationId, actionKey);
    if (replay === "conflict") { d.exec("ROLLBACK"); return { ok: false, error: "operation_conflict" }; }
    if (replay) { d.exec("ROLLBACK"); return replay; }
    const owned = d.prepare("SELECT 1 FROM manor_crop_unlocks WHERE userId = ? AND cropId = ?").get(userId, cropId);
    if (owned) { d.exec("ROLLBACK"); return { ok: false, error: "already_unlocked" }; }
    const balance = pointsBalance(userId);
    if (balance < crop.unlock.cost) { d.exec("ROLLBACK"); return { ok: false, error: "insufficient" }; }
    d.prepare("INSERT INTO points_ledger (id,userId,kind,delta,reason,eventKey,createdAt) VALUES (?,?,?,?,?,?,?)")
      .run(rid("pt"), userId, "manor_crop_unlock", -crop.unlock.cost, `永久解锁「${crop.name}」`, `crop-unlock:${userId}:${crop.id}`, Date.now());
    d.prepare("INSERT INTO manor_crop_unlocks (userId,cropId,source,unlockedAt) VALUES (?,?,?,?)")
      .run(userId, crop.id, "points", Date.now());
    const result = { ok: true, balance: pointsBalance(userId) } as const;
    recordManorOperation(d, userId, operationId, actionKey, result);
    d.exec("COMMIT");
    return result;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}

/** 兑换：服务端事务内扣减（负余额拒绝——验收硬项）；地标另有徽章数门槛（分轨不消费荣誉）。 */
export function manorBuy(userId: string, partId: string, operationId: string): { ok: true; item: ManorItem; balance: number } | { ok: false; error: string } {
  const part = MANOR_PARTS.find((p) => p.id === partId);
  if (!part) return { ok: false, error: "unknown_part" };
  const gate = LANDMARK_BADGE_GATE[partId];
  if (gate) {
    const owned = Number((db().prepare("SELECT COUNT(*) AS c FROM user_badges WHERE userId = ?").get(userId) as { c: number }).c);
    if (owned < gate) return { ok: false, error: "badge_gate" };
  }
  const d = db();
  const actionKey = `buy:${partId}`;
  d.exec("BEGIN IMMEDIATE");
  try {
    const replay = manorOperationReplay<{ ok: true; item: ManorItem; balance: number }>(d, userId, operationId, actionKey);
    if (replay === "conflict") { d.exec("ROLLBACK"); return { ok: false, error: "operation_conflict" }; }
    if (replay) { d.exec("ROLLBACK"); return replay; }
    const bal = pointsBalance(userId);
    if (bal < part.price) { d.exec("ROLLBACK"); return { ok: false, error: "insufficient" }; }
    d.prepare("INSERT INTO points_ledger (id,userId,kind,delta,reason,eventKey,createdAt) VALUES (?,?,?,?,?,?,?)")
      .run(rid("pt"), userId, "manor_buy", -part.price, `兑换「${part.name}」`, null, Date.now());
    const item: ManorItem = { id: rid("mi"), partId, x: null, y: null, acquiredAt: Date.now() };
    d.prepare("INSERT INTO manor_items (id,userId,partId,x,y,acquiredAt) VALUES (?,?,?,?,?,?)")
      .run(item.id, userId, partId, null, null, item.acquiredAt);
    const result = { ok: true, item, balance: pointsBalance(userId) } as const;
    recordManorOperation(d, userId, operationId, actionKey, result);
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

/** 摆放/挪动：网格边界校验；x=null 表示收进仓库。 */
export function manorPlace(userId: string, itemId: string, x: number | null, y: number | null): boolean {
  if ((x === null) !== (y === null)) return false;
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const item = d.prepare("SELECT partId FROM manor_items WHERE id = ? AND userId = ?").get(itemId, userId) as { partId: string } | undefined;
    if (!item) { d.exec("ROLLBACK"); return false; }
    const part = MANOR_PARTS.find((p) => p.id === item.partId);
    if (!part) { d.exec("ROLLBACK"); return false; }
    if (x !== null && y !== null) {
      if (x < 0 || y < 0 || x + part.w > MANOR_GRID.w || y + part.h > MANOR_GRID.h) { d.exec("ROLLBACK"); return false; }
      const others = d.prepare("SELECT id,partId,x,y FROM manor_items WHERE userId = ? AND id != ? AND x IS NOT NULL AND y IS NOT NULL")
        .all(userId, itemId) as unknown as Array<{ id: string; partId: string; x: number; y: number }>;
      for (const other of others) {
        const otherPart = MANOR_PARTS.find((p) => p.id === other.partId);
        if (!otherPart) continue;
        const overlaps = x < other.x + otherPart.w && x + part.w > other.x && y < other.y + otherPart.h && y + part.h > other.y;
        if (overlaps) { d.exec("ROLLBACK"); return false; }
      }
    }
    const result = d.prepare("UPDATE manor_items SET x = ?, y = ? WHERE id = ? AND userId = ?").run(x, y, itemId, userId);
    d.exec("COMMIT");
    return Number(result.changes) > 0;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}

/** 日任务（≤3 条，锚定学习产出非登录时长，规格⑧-3）：从当日真实事件推导完成态，不做前端打勾。 */
export function dailyTasks(userId: string): Array<{ id: string; label: string; done: boolean }> {
  const d = db();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  const n = (sql: string) => Number((d.prepare(sql).get(userId, t0) as { c: number }).c);
  return [
    { id: "quiz", label: "完成 1 道随堂小测", done: n("SELECT COUNT(*) AS c FROM quiz_attempts WHERE userId = ? AND answeredAt >= ?") > 0 },
    { id: "fix", label: "清理 1 道错题", done: n("SELECT COUNT(*) AS c FROM mistake_reviews WHERE userId = ? AND at >= ?") > 0 },
    { id: "ask", label: "向 AI 学伴提 1 个问题", done: Number((d.prepare("SELECT COALESCE(SUM(count),0) AS c FROM chat_usage WHERE userId = ? AND day >= ?").get(userId, Math.floor(t0 / 86_400_000)) as { c: number }).c) > 0 },
  ];
}

// ── F4 · 时间窗口统一走业务时区 UTC+8（对抗审查修复：原实现 UTC 日 / 纪元周四周 /
// 服务器本地月三种口径并存，「每天一赞」在北京 08:00 换日、「本周」在周四早 8 点换题）──
const BJ_OFFSET = 8 * 3_600_000;
/** 北京自然日序号。 */
export function bjDay(t = Date.now()): number { return Math.floor((t + BJ_OFFSET) / 86_400_000); }
/** 北京自然周序号（周一 00:00 为界；1970-01-01 是周四，偏移 4 天对齐周一）。 */
export function bjWeekNo(t = Date.now()): number { return Math.floor((bjDay(t) - 4) / 7); }
/** 该周序号的起点时间戳（北京周一 00:00）。 */
export function bjWeekStart(weekNo: number): number { return (weekNo * 7 + 4) * 86_400_000 - BJ_OFFSET; }
/** 北京自然月窗口。 */
export function bjMonthRange(t = Date.now()): { from: number; to: number; monthIndex: number; ym: string } {
  const d = new Date(t + BJ_OFFSET);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  return { from: Date.UTC(y, m, 1) - BJ_OFFSET, to: Date.UTC(y, m + 1, 1) - BJ_OFFSET, monthIndex: m, ym: `${y}-${m + 1}` };
}

// ── F4 · 周协作副本 + 月度剧情副本（规格⑧-3；全部真实事件供数，发奖幂等）──
const EVENT_COUNT_SQL: Record<string, { sql: string; timeCol: "range" }> = {
  quiz_answered: { sql: "SELECT COUNT(*) AS c FROM quiz_attempts WHERE userId = ? AND answeredAt IS NOT NULL AND answeredAt >= ? AND answeredAt < ?", timeCol: "range" },
  mistake_reviewed: { sql: "SELECT COUNT(*) AS c FROM mistake_reviews WHERE userId = ? AND at >= ? AND at < ?", timeCol: "range" },
  activity_approved: { sql: "SELECT COUNT(*) AS c FROM activity_submissions WHERE studentId = ? AND status = 'approved' AND reviewedAt >= ? AND reviewedAt < ?", timeCol: "range" },
};
function countEventInRange(userId: string, event: string, from: number, to: number): number {
  const q = EVENT_COUNT_SQL[event];
  if (!q) return 0;
  return Number((db().prepare(q.sql).get(userId, from, to) as { c: number }).c);
}

export interface WeeklyQuestState { label: string; target: number; current: number; done: boolean; bonus: number; endsAt: number }
/** 班级周副本：共享进度条（调用方**不得**下发个人分解——R1）；达标后为当前用户幂等发 +20。 */
export function classWeeklyQuest(classId: string, userId: string, award = true): WeeklyQuestState {
  const weekNo = bjWeekNo();
  const from = bjWeekStart(weekNo), to = from + WEEK_MS;
  const quest = WEEKLY_QUESTS[weekNo % WEEKLY_QUESTS.length];
  const members = classStudentsUnion(classId);
  const target = Math.max(quest.perStudent, quest.perStudent * members.length);
  let current = 0;
  for (const m of members) current += countEventInRange(m.id, quest.event, from, to);
  const done = current >= target;
  // 对抗审查修复 ×2：①「达标全员 +20」原实现只发给窗口内亲自访问徽章页的人——
  // 现在达标即为**全班成员**逐人幂等发放，文案才是真话；②演示身份只算不发（award=false）。
  if (done && award) {
    const ins = db().prepare("INSERT OR IGNORE INTO points_ledger (id,userId,kind,delta,reason,eventKey,createdAt) VALUES (?,?,?,?,?,?,?)");
    for (const m of members) {
      ins.run(rid("pt"), m.id, "weekly_bonus", WEEKLY_BONUS, `周协作副本达成「${quest.label}」 = +${WEEKLY_BONUS}`, `weekly:${m.id}:${weekNo}`, Date.now());
    }
  }
  return { label: quest.label, target, current: Math.min(current, target), done, bonus: WEEKLY_BONUS, endsAt: to };
}

export interface ChapterState {
  id: string; name: string; story: string; giftPart: string; bonus: number;
  goals: Array<{ label: string; need: number; current: number; done: boolean }>;
  completed: boolean;
}
/** 月度剧情副本：当月真实事件计数；三目标齐 → 幂等发 +50 并赠一件庄园建材。 */
export function monthChapter(userId: string, award = true): ChapterState {
  const { from, to, monthIndex, ym } = bjMonthRange();
  const chapter = MONTH_CHAPTERS[monthIndex % MONTH_CHAPTERS.length];
  const goals = chapter.goals.map((g) => {
    const current = countEventInRange(userId, g.event, from, to);
    return { label: g.label, need: g.need, current: Math.min(current, g.need), done: current >= g.need };
  });
  const completed = goals.every((g) => g.done);
  if (completed && award) {
    const key = `chapter:${userId}:${ym}`;
    const r = db().prepare("INSERT OR IGNORE INTO points_ledger (id,userId,kind,delta,reason,eventKey,createdAt) VALUES (?,?,?,?,?,?,?)")
      .run(rid("pt"), userId, "chapter_bonus", CHAPTER_BONUS, `月度剧情「${chapter.name}」完成 = +${CHAPTER_BONUS}`, key, Date.now());
    if (Number(r.changes) > 0) {
      // 首次完成才赠建材（发奖行插入成功 = 首次），收藏产出直接进仓库
      db().prepare("INSERT INTO manor_items (id,userId,partId,x,y,acquiredAt) VALUES (?,?,?,?,?,?)")
        .run(rid("mi"), userId, chapter.giftPart, null, null, Date.now());
    }
  }
  return { id: chapter.id, name: chapter.name, story: chapter.story, giftPart: chapter.giftPart, bonus: CHAPTER_BONUS, goals, completed };
}

// ── F5 · 庄园参观 + 班级共建（规格⑨-3(a)/⑨-4；正和博弈，无名次无占比）──
/** 可参观名单：本班有已摆放部件的学生（不含本人）；固定按名字排序，非任何成绩/积分序。 */
export function manorNeighbors(classId: string, selfId: string): Array<{ id: string; name: string }> {
  const members = classStudentsUnion(classId).filter((m) => m.id !== selfId);
  const has = db().prepare("SELECT DISTINCT userId FROM manor_items WHERE x IS NOT NULL").all() as unknown as Array<{ userId: string }>;
  const set = new Set(has.map((h) => h.userId));
  return members.filter((m) => set.has(m.id)).sort((a, b) => a.name.localeCompare(b.name, "zh"));
}
/** 参观视图：只读部件与布局 + 我今天是否已赞。**不含**积分/台账等经济数据，也不含
 * 他人累计收赞数——对抗审查确认逐园遍历可拼出班内点赞榜（R1 的同类通道）；
 * 收赞总数只在园主本人视图（manorLikesReceived）出现。 */
export function manorVisitView(ownerId: string, visitorId: string): { items: ManorVisitItem[]; likedToday: boolean } {
  const items = db().prepare("SELECT partId, x, y FROM manor_items WHERE userId = ? AND x IS NOT NULL AND y IS NOT NULL ORDER BY acquiredAt").all(ownerId) as unknown as ManorVisitItem[];
  const liked = db().prepare("SELECT 1 FROM manor_likes WHERE visitorId = ? AND ownerId = ? AND day = ?").get(visitorId, ownerId, bjDay());
  return { items, likedToday: Boolean(liked) };
}
/** 点赞：每人每天对每座庄园至多一次（主键幂等）；返回是否新增。 */
export function manorLike(visitorId: string, ownerId: string): boolean {
  const r = db().prepare("INSERT OR IGNORE INTO manor_likes (visitorId, ownerId, day) VALUES (?,?,?)")
    .run(visitorId, ownerId, bjDay()); // 北京自然日（文案承诺「每天一次」按学生的日历算）
  return Number(r.changes) > 0;
}
export function manorLikesReceived(ownerId: string): number {
  return Number((db().prepare("SELECT COUNT(*) AS c FROM manor_likes WHERE ownerId = ?").get(ownerId) as { c: number }).c);
}

export interface ClassBuildState {
  id: string; name: string; desc: string; kind: string; cost: number; raised: number; done: boolean;
  litCount: number; // 已点亮座数（含当前若已完成）
}
/** 班级共建状态：顺序解锁，只报集体总进度（无认捐名单——R1）。 */
export function classBuildState(classId: string): ClassBuildState {
  const total = Number((db().prepare("SELECT COALESCE(SUM(amount),0) AS s FROM class_build_contrib WHERE classId = ?").get(classId) as { s: number }).s);
  let spent = 0;
  let lit = 0;
  for (const b of CLASS_BUILDS) {
    if (total - spent >= b.cost) { spent += b.cost; lit += 1; continue; }
    return { id: b.id, name: b.name, desc: b.desc, kind: b.kind, cost: b.cost, raised: total - spent, done: false, litCount: lit };
  }
  const last = CLASS_BUILDS[CLASS_BUILDS.length - 1];
  return { id: last.id, name: last.name, desc: last.desc, kind: last.kind, cost: last.cost, raised: last.cost, done: true, litCount: lit };
}
/** 认捐：事务内扣个人积分入公共池；余额不足拒绝。自愿、正和——积分进公共建筑不进任何人口袋。 */
export function classBuildContribute(userId: string, classId: string, amount: number, operationId: string): { ok: true; balance: number; accepted: number } | { ok: false; error: string } {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500) return { ok: false, error: "invalid_amount" };
  const d = db();
  const actionKey = `contribute:${classId}:${amount}`;
  d.exec("BEGIN IMMEDIATE");
  try {
    const replay = manorOperationReplay<{ ok: true; balance: number; accepted: number }>(d, userId, operationId, actionKey);
    if (replay === "conflict") { d.exec("ROLLBACK"); return { ok: false, error: "operation_conflict" }; }
    if (replay) { d.exec("ROLLBACK"); return replay; }
    // 状态和剩余额度必须在同一个写锁内重算，否则并发认捐可能共同看见旧缺口并超募。
    const state = classBuildState(classId);
    if (state.done) { d.exec("ROLLBACK"); return { ok: false, error: "all_built" }; }
    const accepted = Math.min(amount, state.cost - state.raised);
    const bal = pointsBalance(userId);
    if (bal < accepted) { d.exec("ROLLBACK"); return { ok: false, error: "insufficient" }; }
    d.prepare("INSERT INTO points_ledger (id,userId,kind,delta,reason,eventKey,createdAt) VALUES (?,?,?,?,?,?,?)")
      .run(rid("pt"), userId, "class_build", -accepted, `认捐班级共建 ${accepted} 分`, null, Date.now());
    d.prepare("INSERT INTO class_build_contrib (id,classId,userId,amount,createdAt) VALUES (?,?,?,?,?)")
      .run(rid("cb"), classId, userId, accepted, Date.now());
    const result = { ok: true, balance: pointsBalance(userId), accepted } as const;
    recordManorOperation(d, userId, operationId, actionKey, result);
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

// ── G3 · 档案袋学期归档（规格⑦-2）：快照=冻结的遴选产物，建后不可改不可删（版本化）──
export interface SnapshotMeta { id: string; term: string; createdAt: number }
export function createPortfolioSnapshot(userId: string, term: string): { ok: true; id: string } | { ok: false; error: string } {
  const t = term.trim().slice(0, 40);
  if (t.length < 2) return { ok: false, error: "invalid_term" };
  const summary = portfolioSummary(userId, "simple");
  const owner = findUserById(userId);
  const payload = JSON.stringify({ term: t, studentName: owner?.name ?? "", lockedAt: Date.now(), summary });
  try {
    const id = rid("ps");
    db().prepare("INSERT INTO portfolio_snapshots (id,userId,term,payload,createdAt) VALUES (?,?,?,?,?)")
      .run(id, userId, t, payload, Date.now());
    return { ok: true, id };
  } catch {
    return { ok: false, error: "term_exists" }; // UNIQUE(userId,term)：一学期一册，锁定不可覆盖
  }
}
export function listPortfolioSnapshots(userId: string): SnapshotMeta[] {
  return db().prepare("SELECT id, term, createdAt FROM portfolio_snapshots WHERE userId = ? ORDER BY createdAt DESC LIMIT 20").all(userId) as unknown as SnapshotMeta[];
}
export function getPortfolioSnapshot(userId: string, id: string): { term: string; createdAt: number; payload: unknown } | null {
  const r = db().prepare("SELECT term, createdAt, payload FROM portfolio_snapshots WHERE id = ? AND userId = ?").get(id, userId) as { term: string; createdAt: number; payload: string } | undefined;
  if (!r) return null;
  return { term: r.term, createdAt: r.createdAt, payload: JSON.parse(r.payload) };
}
