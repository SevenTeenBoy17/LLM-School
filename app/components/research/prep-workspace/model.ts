export type PrepKind = "日常共备" | "研究课";
export type PrepArt = "water" | "plant" | "math" | "reading" | "worksheet";
export type PrepStage = "草稿" | "待讨论" | "共同修订" | "已形成共识";
export type PrepEntry = "document" | "discussion" | "observation" | "adapt";
export interface LessonRow { id: string; phase: string; task: string; support: string; observe: string }
export interface Evidence { id: string; observation: string; interpretation: string; adjustment: string; source: string }
export interface Discussion { id: string; author: string; text: string; section: string; replies: string[]; reason: string }
export interface Revision { version: number; at: number; note: string; goal: string; question: string }
export interface PrepProject {
  id: string; title: string; grade: string; subject: string; kind: PrepKind; art: PrepArt;
  lead: string; members: string; stage: PrepStage; next: string; updatedAt: number; archived: boolean;
  example: boolean; version: number; goal: string; question: string; conditions: string;
  studentMaterial: string; observationPlan: string; rows: LessonRow[]; evidence: Evidence[];
  discussions: Discussion[]; revisions: Revision[]; source?: { id: string; title: string; version: number };
}
export const uid = () => globalThis.crypto.randomUUID();
export const PREP_LIMITS = { projects: 24, rows: 40, evidence: 40, discussions: 40, replies: 20, revisions: 40, bytes: 1500000 } as const;
export function newProject(input: Pick<PrepProject, "title" | "grade" | "subject" | "kind" | "question" | "conditions" | "members">): PrepProject {
  return { ...input, id: uid(), title: input.title.trim(), art: "worksheet", lead: "我", stage: "草稿", next: "补充学习目标", updatedAt: Date.now(), archived: false, example: false, version: 1, goal: "", studentMaterial: "", observationPlan: "", rows: [], evidence: [], discussions: [], revisions: [] };
}
export function adaptProject(source: PrepProject): PrepProject {
  return { ...structuredClone(source), id: uid(), title: `${source.title.slice(0, 170)} · 个人改编`, lead: "我", members: "", stage: "草稿", next: "核对本班适用条件", example: false, archived: false, version: 1, updatedAt: Date.now(), evidence: [], discussions: [], revisions: [], source: { id: source.id, title: source.title, version: source.version } };
}
const seed = (id: string, title: string, subject: string, art: PrepArt, lead: string, stage: PrepStage, next: string, kind: PrepKind = "日常共备"): PrepProject => ({
  id, title, subject, art, lead, stage, next, kind, grade: art === "water" || art === "reading" ? "八年级" : "七年级", members: "王老师、林老师、陈老师（示例成员）", updatedAt: 1788657600000, archived: false, example: true, version: 3,
  goal: art === "water" ? "比较不同场景的用水记录，说明建议的依据与局限。" : "结合本课任务，说明自己的思考过程和依据。",
  question: art === "water" ? "怎样用证据提出节水建议？" : `围绕「${title}」，学生需要解决什么问题？`,
  conditions: "示例方案，实际课时、教材与班级条件需重新核对。", studentMaterial: "记录自己的问题、观察和解释，保留不能支持原有想法的材料。", observationPlan: "学生能否说明不同记录为什么可以比较？只记录实际表达，不由单次表现判断能力。",
  rows: [{ id: `${id}-1`, phase: "发现问题", task: "提出一个可调查的问题", support: "提供校园情境", observe: "问题是否可观察" }, { id: `${id}-2`, phase: "采集记录", task: "比较两组记录方法", support: "检查单位与记录条件", observe: "是否说明比较条件" }, { id: `${id}-3`, phase: "形成建议", task: "用记录支持建议", support: "追问其他可能解释", observe: "能否区分事实与推测" }],
  discussions: [{ id: `${id}-d1`, author: "林老师（示例）", section: "课堂任务", text: "先确认记录单位，再比较不同地点。", replies: [], reason: "" }, { id: `${id}-d2`, author: "陈老师（示例）", section: "观察计划", text: "保留无法支持建议的记录，避免只挑有利样本。", replies: [], reason: "" }],
  evidence: art === "water" ? [{ id: `${id}-e1`, observation: "示例样本 A：只比较总用水量，未说明记录时段。", interpretation: "可能忽略了比较条件；不能由此判断学生能力。", adjustment: "先让学生核对时段与单位，再解释比较依据。", source: "匿名观察示例 A，非真实学生材料" }, { id: `${id}-e2`, observation: "示例样本 B：提出地点差异，但缺少重复记录。", interpretation: "地点与日期可能同时变化，暂不能判断主要原因。", adjustment: "增加第二次记录，保留不符合预期的材料。", source: "匿名观察示例 B，非真实学生材料" }] : [], revisions: []
});
export const SAMPLE_PROJECTS: PrepProject[] = [seed("sample-water", "校园节水 · 跨学科项目", "信息科技", "water", "王老师", "待讨论", "确认观察问题", "研究课"), seed("sample-plant", "用证据解释光合作用", "生物", "plant", "林老师", "共同修订", "回应实验方案意见"), seed("sample-math", "从生活问题走向方程", "数学", "math", "陈老师", "已形成共识", "创建本班改编版"), seed("sample-reading", "校园里的说明文", "语文", "reading", "周老师", "草稿", "补充学习难点")];

export function validProjects(value: unknown, enforceCapacity = true): value is PrepProject[] {
  const obj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
  const text = (x: unknown, max: number) => typeof x === "string" && x.length <= max;
  const positive = (x: unknown) => typeof x === "number" && Number.isSafeInteger(x) && x > 0;
  const timestamp = (x: unknown) => positive(x) && (x as number) <= 8640000000000000;
  const fields = (x: Record<string, unknown>, limits: Record<string, number>) => Object.entries(limits).every(([key, max]) => text(x[key], max));
  const keys = (x: Record<string, unknown>, allowed: string[]) => Object.keys(x).every(k => allowed.includes(k));
  const list = (x: unknown, max: number, check: (item: Record<string, unknown>) => boolean, ids = true) => Array.isArray(x) && x.length <= max && x.every(item => obj(item) && (!ids || (text(item.id, 100) && !!item.id)) && check(item)) && (!ids || new Set(x.map(item => item.id)).size === x.length);
  const valid = list(value, PREP_LIMITS.projects, p => fields(p, { title: 180, grade: 100, subject: 100, lead: 100, members: 200, next: 300, goal: 12000, question: 12000, conditions: 12000, studentMaterial: 12000, observationPlan: 12000 }) && typeof p.title === "string" && !!p.title.trim() && !!p.grade && !!p.subject
    && keys(p, ["id", "title", "grade", "subject", "kind", "art", "lead", "members", "stage", "next", "updatedAt", "archived", "example", "version", "goal", "question", "conditions", "studentMaterial", "observationPlan", "rows", "evidence", "discussions", "revisions", "source"])
    && typeof p.kind === "string" && ["日常共备", "研究课"].includes(p.kind) && typeof p.art === "string" && ["water", "plant", "math", "reading", "worksheet"].includes(p.art)
    && typeof p.stage === "string" && ["草稿", "待讨论", "共同修订", "已形成共识"].includes(p.stage) && typeof p.example === "boolean" && typeof p.archived === "boolean" && timestamp(p.updatedAt) && positive(p.version)
    && list(p.rows, PREP_LIMITS.rows, r => fields(r, { phase: 2000, task: 2000, support: 2000, observe: 2000 }) && keys(r, ["id", "phase", "task", "support", "observe"]))
    && list(p.evidence, PREP_LIMITS.evidence, e => fields(e, { observation: 4000, interpretation: 4000, adjustment: 4000, source: 1000 }) && keys(e, ["id", "observation", "interpretation", "adjustment", "source"]))
    && list(p.discussions, PREP_LIMITS.discussions, d => fields(d, { author: 100, text: 2000, section: 100, reason: 2000 }) && Array.isArray(d.replies) && d.replies.length <= PREP_LIMITS.replies && d.replies.every(r => text(r, 2000)) && keys(d, ["id", "author", "text", "section", "reason", "replies"]))
    && list(p.revisions, PREP_LIMITS.revisions, r => timestamp(r.at) && positive(r.version) && fields(r, { note: 300, goal: 12000, question: 12000 }) && keys(r, ["version", "at", "note", "goal", "question"]), false)
    && (p.source === undefined || (obj(p.source) && fields(p.source, { id: 100, title: 180 }) && !!p.source.id && positive(p.source.version) && keys(p.source, ["id", "title", "version"]))));
  return valid && (!enforceCapacity || !capacityError(value as PrepProject[]));
}

export function samePrepContent(a: PrepProject, b: PrepProject) {
  const keys = ["id", "title", "grade", "subject", "kind", "art", "lead", "members", "stage", "next", "archived", "example", "goal", "question", "conditions", "studentMaterial", "observationPlan", "rows", "evidence", "discussions", "source"] as const;
  return JSON.stringify(keys.map(key => a[key])) === JSON.stringify(keys.map(key => b[key]));
}

export function preparePrepSave(saved: PrepProject, draft: PrepProject, stage = draft.stage, now = Date.now()): { project: PrepProject; changed: boolean; error?: never } | { error: string; project?: never; changed?: never } {
  const candidate = { ...draft, stage };
  if (samePrepContent(saved, candidate)) return { project: saved, changed: false };
  if (saved.revisions.length >= PREP_LIMITS.revisions) return { error: `已达 ${PREP_LIMITS.revisions} 条修订摘要上限，当前输入仍保留。可导出完整备份并恢复编辑；不会覆盖或删除历史。` };
  return { changed: true, project: { ...candidate, updatedAt: now, version: saved.version + 1, revisions: [...saved.revisions, { version: saved.version, at: now, note: stage !== saved.stage ? `本机状态：${stage}` : "保存本机修订", goal: saved.goal, question: saved.question }] } };
}

export function capacityError(projects: PrepProject[]): string | null {
  if (projects.length > PREP_LIMITS.projects) return `本机演示最多保留 ${PREP_LIMITS.projects} 个项目（含归档）。请继续编辑已有草稿，当前输入未丢弃。`;
  try {
    if (new TextEncoder().encode(JSON.stringify(projects)).byteLength > PREP_LIMITS.bytes) return "本机演示已达到材料容量上限（1.5 MB）。请缩短本次新增内容；未覆盖已保存记录。";
  } catch { return "材料格式无法保存，当前输入仍保留。"; }
  return null;
}
