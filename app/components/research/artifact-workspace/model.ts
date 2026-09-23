export type ArtName = "water" | "plant" | "math" | "reading" | "worksheet";
export type ReviewChecks = [boolean, boolean, boolean];
export interface MaterialVersion {
  id: string;
  label: string;
  title: string;
  student: string;
  notes: string;
  createdAt: number;
  checks: ReviewChecks;
  reviewedAt?: number;
}
export interface DemoMaterial {
  id: string;
  type: string;
  subject: string;
  grade: string;
  art: ArtName;
  source: string;
  sourceId?: string;
  sourceVersion?: string;
  conditions: string;
  folder: string;
  unorganized: boolean;
  versions: MaterialVersion[];
  shared?: { versionId: string; label: string; title: string; student: string; at: number };
}
export const MAX_TEXT = 30000;
export const MAX_MATERIALS = 100;
export const MAX_VERSIONS = 20;
export const MAX_TOTAL_TEXT = 1000000;
export const REVIEW_LABELS = ["学习目标与任务一致", "数据、概念与引用已核对", "学生版不含答案与内部备注"];
const stamp = Date.UTC(2026, 8, 5, 9);
function sample(id: string, title: string, type: string, subject: string, grade: string, art: ArtName, student: string, notes: string, folder: string, unorganized = false): DemoMaterial {
  return { id, type, subject, grade, art, folder, unorganized, source: unorganized ? "AI 对话 · 示例归档" : id === "water" ? "校园节水共备" : "个人备课 · 示例材料", sourceVersion: id === "water" ? "共同底稿 v1.0" : undefined,
    conditions: id === "water" ? "需先统一记录时段与单位；适用于能够开展校园观察的班级。" : "请结合本班教学进度核对任务、材料与适用条件。", versions: [{ id: `${id}-v1`, label: id === "water" ? "v1.1" : "v1.0", title, student, notes, createdAt: stamp - (id === "water" ? 0 : 86400000), checks: [false, false, false] }] };
}
export const INITIAL_MATERIALS: DemoMaterial[] = [
  sample("water", "校园节水调查学习单", "学习单", "信息科技", "八年级", "water", `# 校园节水调查学习单\n\n小组：____________　日期：____________\n\n## 01 提出问题\n我们准备观察哪里？记录什么？\n\n________________________________________________\n\n## 02 记录与比较\n| 地点 | 记录时段 | 用水记录 | 单位 | 备注 |\n| --- | --- | --- | --- | --- |\n| | | | | |\n| | | | | |\n| | | | | |\n\n## 03 用证据提出建议\n我们的建议：________________________________\n\n支持建议的记录：____________________________\n\n还需要确认：________________________________\f# 校园节水调查 · 小组交流\n\n## 比较前先检查\n- 各组是否使用同一单位？\n- 记录时长是否一致？\n- 哪些数据还不能直接比较？\n\n## 提出改进方案\n| 建议 | 依据 | 如何再次观察 |\n| --- | --- | --- |\n| | | |\n| | | |\n\n## 保留不同意见\n我们暂时无法判断的是：________________________\n\n下次需要补充的记录：__________________________`, "# 教师备注\n\n本材料为演示学习任务，不含真实学生数据。\n\n- 先讨论记录时间和单位，避免直接比较不同条件下的数据。\n- 校园观察须由教师安排，注意活动安全。\n- 不预设哪一处最浪费水，结论应来自实际记录。", "校园节水"),
  sample("plant", "光合作用实验观察表", "观察工具", "生物", "七年级", "plant", "# 光合作用实验观察表\n\n## 观察问题\n不同光照条件下，叶片的表现有什么差异？\n\n## 记录条件\n| 植物编号 | 光照条件 | 观察时间 | 观察到的现象 |\n| --- | --- | --- | --- |\n| A | | | |\n| B | | | |\n\n## 区分观察与解释\n我直接观察到：________________________\n\n我的解释：____________________________\n\n还需要控制的条件：____________________", "# 教师备注\n\n实验操作由教师指导。单次观察不能独立证明因果关系；讨论光照之外的条件。", "科学探究"),
  sample("geography", "亚洲的自然与人文特征", "课件大纲", "地理", "七年级", "worksheet", "# 亚洲的自然与人文特征\n\n## 位置与范围\n在地图上标出亚洲主要纬度范围，描述相邻大洲和海洋。\n\n## 地形与河流\n- 找到主要高原、山脉和平原。\n- 选择两条河流，比较流向与地形的关系。\n\n## 人地关系\n选择一处聚落，说明自然环境可能怎样影响生产与生活。\f# 地图阅读任务\n\n| 地图证据 | 我的描述 | 尚待核实 |\n| --- | --- | --- |\n| 地形图 | | |\n| 气候图 | | |\n\n## 课堂交流\n同一地区内部是否存在差异？请用具体地图信息支持表述。", "# 教师备注\n\n这是文本课件大纲，不是 PPTX。实际教学需补充获得授权、标明来源的地图。", "科学探究"),
  sample("math", "一元一次方程 · 分层练习", "练习", "数学", "七年级", "math", "# 一元一次方程 · 分层练习\n\n## 基础练习\n1. 解方程：3x + 5 = 20。\n2. 解方程：2(x - 3) = 8。\n\n## 说明思路\n为什么等式两边同时加上同一个数，等式仍成立？\n\n## 应用问题\n一本练习本与一支笔共 11 元，练习本比笔贵 3 元。分别多少钱？\n\n## 自我检查\n将所得结果代回原式，记录检查过程。", "# 教师参考答案\n\n1. x = 5。\n2. x = 7。\n3. 练习本 7 元，笔 4 元。\n\n不同题目用于提供练习选择，不据此给学生贴能力标签。", "数学练习", true),
  sample("reading", "说明文阅读 · 教学设计", "教案", "语文", "八年级", "reading", "# 说明文阅读任务\n\n## 读前问题\n这篇文章主要向读者解释什么？\n\n## 寻找依据\n| 段落 | 关键信息 | 说明方法 | 表达作用 |\n| --- | --- | --- | --- |\n| | | | |\n| | | | |\n\n## 比较表达\n选择一句包含数据的句子，尝试删去数据并比较表达效果。\n\n## 交流与修订\n保留原文依据，再修改自己的概括。", "# 教师教学设计\n\n导入 5 分钟；自主阅读 10 分钟；小组交流 15 分钟；修订反馈 10 分钟。\n\n请补充本班正在使用的合法课文，不虚构篇目引用。", "阅读与表达", true),
];
export function latest(item: DemoMaterial) { return item.versions[item.versions.length - 1]; }
export function makeId() { return crypto.randomUUID(); }
export function totalText(items: DemoMaterial[]) { return items.reduce((sum, item) => sum + item.versions.reduce((s, v) => s + v.student.length + v.notes.length, 0) + (item.shared?.student.length ?? 0), 0); }
export function validateMaterials(value: unknown): value is DemoMaterial[] {
  if (!Array.isArray(value) || value.length > MAX_MATERIALS) return false;
  const ids = new Set<string>();
  return value.every((raw: unknown) => {
    if (!raw || typeof raw !== "object") return false;
    const a = raw as DemoMaterial;
    if (typeof a.id !== "string" || !a.id || ids.has(a.id)) return false;
    ids.add(a.id);
    if (!["water", "plant", "math", "reading", "worksheet"].includes(a.art) || typeof a.unorganized !== "boolean") return false;
    if (![a.type, a.subject, a.grade, a.source, a.conditions, a.folder].every(x => typeof x === "string" && x.length <= 2000)) return false;
    if ([a.sourceId, a.sourceVersion].some(x => x !== undefined && (typeof x !== "string" || x.length > 2000))) return false;
    if (!Array.isArray(a.versions) || !a.versions.length || a.versions.length > MAX_VERSIONS) return false;
    if (new Set(a.versions.map(v => v?.id)).size !== a.versions.length) return false;
    if (!a.versions.every(v => v && typeof v.id === "string" && !!v.id && typeof v.label === "string" && v.label.length <= 40 && typeof v.title === "string" && !!v.title.trim() && v.title.length <= 120 && typeof v.student === "string" && v.student.length <= MAX_TEXT && typeof v.notes === "string" && v.notes.length <= MAX_TEXT && Number.isFinite(v.createdAt) && Array.isArray(v.checks) && v.checks.length === 3 && v.checks.every(x => typeof x === "boolean") && (v.reviewedAt === undefined || Number.isFinite(v.reviewedAt) && v.checks.every(Boolean)))) return false;
    return !a.shared || (Number.isFinite(a.shared.at) && a.versions.some(v => v.id === a.shared?.versionId && v.label === a.shared.label && v.title === a.shared.title && v.student === a.shared.student));
  }) && totalText(value as DemoMaterial[]) <= MAX_TOTAL_TEXT;
}
export function pagesOf(content: string) {
  if (content.includes("\f")) return content.split("\f");
  const blocks = content.split(/\n\s*\n/);
  const pages: string[] = [];
  let page = "";
  for (const block of blocks) { if (page.length + block.length > 2200 && page) { pages.push(page); page = ""; } page += (page ? "\n\n" : "") + block; }
  return [...pages, page || "（暂无正文）"];
}
export function exportFiles(items: DemoMaterial[]) {
  return items.flatMap(item => {
    const v = latest(item);
    const name = v.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80);
    const source = `\n\n---\n来源：${item.source}${item.sourceVersion ? ` · ${item.sourceVersion}` : ""}\n版本：${v.label}\n本机演示材料，未向班级发布。`;
    return [{ id: `${item.id}-${v.id}-student`, name: `${name}-${v.label}-学生版.md`, content: v.student.replace(/\f/g, "\n\n---\n\n") + source }, ...(v.notes.trim() ? [{ id: `${item.id}-${v.id}-notes`, name: `${name}-${v.label}-教师备注.md`, content: v.notes + source }] : [])];
  });
}
