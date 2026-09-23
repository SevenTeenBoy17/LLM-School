import { z } from "zod";

export const CoursewareStyleSchema = z.enum(["clear", "warm", "academic", "project"]);
export type CoursewareStyle = z.infer<typeof CoursewareStyleSchema>;

export const CoursewareBriefSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9._:-]{8,80}$/),
  subject: z.string().trim().min(1).max(24),
  grade: z.string().trim().min(2).max(24),
  topic: z.string().trim().min(2).max(80),
  slideCount: z.number().int().min(4).max(12),
  objectives: z.array(z.string().trim().min(2).max(120)).max(4).default([]),
  style: CoursewareStyleSchema.default("clear"),
  sourceSummary: z.string().trim().max(6000).default(""),
  uploadIds: z.array(z.string().min(1).max(64)).max(3).default([]),
}).strict();

export type CoursewareBrief = z.infer<typeof CoursewareBriefSchema>;

export const CoursewareSlideKindSchema = z.enum([
  "cover", "goals", "context", "concept", "example", "activity",
  "practice", "assessment", "transfer", "summary", "extension", "reflection",
]);

export const CoursewareLayoutSchema = z.enum([
  "cover", "split", "cards", "timeline", "practice", "summary",
  "map-focus", "comparison", "process", "experiment", "data-story", "formula",
]);

export const CoursewareVisualKindSchema = z.enum([
  "hero", "cards", "map", "comparison", "process", "timeline",
  "experiment", "data", "formula", "evidence", "reflection",
]);

export const CoursewarePaletteSchema = z.enum(["ocean", "forest", "sunrise", "ink"]);

export const CoursewareThemeSchema = z.object({
  palette: CoursewarePaletteSchema.default("ocean"),
  mood: z.string().trim().min(2).max(60).default("清晰、可信、适合课堂投屏"),
  visualSystem: z.string().trim().min(2).max(80).default("信息图、证据卡与可编辑示意图"),
}).default({
  palette: "ocean",
  mood: "清晰、可信、适合课堂投屏",
  visualSystem: "信息图、证据卡与可编辑示意图",
});

export const CoursewareVisualSchema = z.object({
  kind: CoursewareVisualKindSchema.default("cards"),
  title: z.string().trim().max(80).default(""),
  labels: z.array(z.string().trim().min(1).max(56)).max(6).default([]),
  values: z.array(z.number().min(0).max(100)).max(6).default([]),
  caption: z.string().trim().max(180).default(""),
  emphasis: z.string().trim().max(100).default(""),
}).default({ kind: "cards", title: "", labels: [], values: [], caption: "", emphasis: "" });

export const CoursewareSlideSchema = z.object({
  id: z.string().min(2).max(40),
  index: z.number().int().min(1).max(12),
  kind: CoursewareSlideKindSchema,
  title: z.string().trim().min(2).max(80),
  purpose: z.string().trim().min(2).max(160),
  bullets: z.array(z.string().trim().min(2).max(160)).min(1).max(5),
  layout: CoursewareLayoutSchema,
  eyebrow: z.string().trim().max(48).default(""),
  subtitle: z.string().trim().max(140).default(""),
  takeaway: z.string().trim().max(140).default(""),
  visual: CoursewareVisualSchema,
  visualHint: z.string().trim().max(200).default(""),
  teacherNote: z.string().trim().max(400).default(""),
  sourceRefs: z.array(z.string().trim().min(1).max(120)).max(4).default([]),
});

export type CoursewareSlide = z.infer<typeof CoursewareSlideSchema>;
export type CoursewareTheme = z.infer<typeof CoursewareThemeSchema>;
export type CoursewareVisual = z.infer<typeof CoursewareVisualSchema>;

export const CoursewarePlanSchema = z.object({
  schemaVersion: z.enum(["courseware.v1", "courseware.v2"]).default("courseware.v2"),
  title: z.string().trim().min(2).max(100),
  subject: z.string().trim().min(1).max(24),
  grade: z.string().trim().min(2).max(24),
  designIntent: z.string().trim().min(2).max(500),
  objectives: z.array(z.string().trim().min(2).max(120)).min(1).max(4),
  theme: CoursewareThemeSchema,
  slides: z.array(CoursewareSlideSchema).min(4).max(12),
  reviewNotes: z.array(z.string().trim().min(2).max(240)).max(8).default([]),
});

export type CoursewarePlan = z.infer<typeof CoursewarePlanSchema>;

export const COURSEWARE_PALETTES = {
  ocean: { ink: "13233F", accent: "176B87", secondary: "2EA7A0", warm: "E9A23B", canvas: "F4F8F7", surface: "FFFFFF", tint: "DCEFEB" },
  forest: { ink: "17352C", accent: "2C7A5A", secondary: "69A76F", warm: "D9A441", canvas: "F4F7F1", surface: "FFFFFF", tint: "DDECDD" },
  sunrise: { ink: "3C2940", accent: "C85C49", secondary: "E29462", warm: "E6B646", canvas: "FFF8F1", surface: "FFFFFF", tint: "F8DFD3" },
  ink: { ink: "15243B", accent: "345A8A", secondary: "647B98", warm: "B78945", canvas: "F4F5F7", surface: "FFFFFF", tint: "E1E7EE" },
} as const;

const STYLE_LABEL: Record<CoursewareStyle, string> = {
  clear: "清晰课堂：高对比、强层级、适合投屏",
  warm: "温暖启发：柔和配色、鼓励式课堂语言",
  academic: "学术简洁：克制配色、概念与证据优先",
  project: "项目学习：任务板、过程证据与展示优先",
};

const STYLE_THEME: Record<CoursewareStyle, CoursewareTheme> = {
  clear: { palette: "ocean", mood: "清晰、可信、适合课堂投屏", visualSystem: "学科插图、知识关系与证据链" },
  warm: { palette: "sunrise", mood: "温暖、亲和、鼓励学生表达", visualSystem: "情境插图、圆角色卡与行动提示" },
  academic: { palette: "ink", mood: "克制、严谨、突出概念关系", visualSystem: "论证结构、时间线与引用证据" },
  project: { palette: "forest", mood: "任务驱动、强调过程与成果", visualSystem: "流程图、任务板与评价量规" },
};

const DEFAULT_OBJECTIVES = [
  "说出本课的核心问题与关键概念",
  "用课堂证据解释自己的判断",
  "完成一次可观察、可反馈的课堂输出",
];

type SubjectProfile = "geography" | "science" | "math" | "humanities" | "language" | "general";
type MiddleKind = Exclude<CoursewareSlide["kind"], "cover" | "summary">;
type Template = {
  kind: CoursewareSlide["kind"];
  title: string;
  purpose: string;
  layout: CoursewareSlide["layout"];
  visualKind: CoursewareVisual["kind"];
  eyebrow: string;
};

const MIDDLE_SEQUENCE: Array<Pick<Template, "kind" | "eyebrow">> = [
  { kind: "goals", eyebrow: "学习导航" },
  { kind: "context", eyebrow: "问题提出" },
  { kind: "concept", eyebrow: "概念建构" },
  { kind: "example", eyebrow: "方法示范" },
  { kind: "activity", eyebrow: "课堂探究" },
  { kind: "practice", eyebrow: "分层练习" },
  { kind: "assessment", eyebrow: "形成性评价" },
  { kind: "transfer", eyebrow: "方法迁移" },
  { kind: "extension", eyebrow: "课后拓展" },
  { kind: "reflection", eyebrow: "教学复盘" },
];

const GENERIC_COPY: Record<MiddleKind, [string, string]> = {
  goals: ["学习目标与成功标准", "把目标改写成学生可观察的表现"],
  context: ["真实情境与驱动问题", "激活已有经验并提出本课核心问题"],
  concept: ["关键概念与关系", "解释必须理解的概念及其关系"],
  example: ["示例探究与证据", "用一个可核对的例子把概念变成方法"],
  activity: ["课堂任务与成果", "通过合作、表达或操作产生学习证据"],
  practice: ["分层练习与迁移", "由理解到迁移检查不同层次的掌握"],
  assessment: ["即时反馈与改进", "依据成功标准收集证据并给出下一步"],
  transfer: ["新情境中的应用", "把本课方法用于一个新的相关情境"],
  extension: ["课后拓展与选择", "为不同需要的学生提供可选择的延伸任务"],
  reflection: ["教师复盘与调整", "记录课堂证据、偏差与下一课调整"],
};

const PROFILE_COPY: Record<SubjectProfile, Partial<Record<MiddleKind, [string, string]>>> = {
  geography: {
    goals: ["本课路线｜读图、比较、解释", "把空间认知目标转化为可观察的读图表现"],
    context: ["空间定位｜主题在哪里发生", "先建立区域位置与空间范围，再进入现象解释"],
    concept: ["分布规律｜从哪里走向为什么", "从图例、方向与疏密关系中提取分布特征"],
    example: ["区域对比｜自然条件与人类活动", "用同一组维度比较区域差异并形成解释"],
    activity: ["证据链｜图表如何支持结论", "组织观察、证据、解释与结论的完整表达"],
    practice: ["读图任务｜由观察走向解释", "检查定位、描述与解释能力"],
    transfer: ["迁移应用｜换一幅地图再判断", "把读图与区域比较方法迁移到新情境"],
  },
  science: {
    goals: ["本课路线｜现象、规律、应用", "明确可观察、可解释、可迁移的科学目标"],
    context: ["现象引入｜从一个矛盾开始", "用可观察现象提出能够验证的科学问题"],
    concept: ["模型建构｜变量之间怎样联系", "用概念、符号和关系图建立可解释模型"],
    example: ["实验探究｜证据从哪里来", "明确变量、操作、记录与证据解释"],
    activity: ["推理过程｜由证据得出结论", "经历观察、比较、推理和表达的完整过程"],
    transfer: ["迁移应用｜解释新的现象", "把规律用于新的生活或工程情境"],
  },
  math: {
    goals: ["本课路线｜理解、表示、应用", "把数学目标落实为可观察的表示与推理"],
    context: ["问题情境｜数量关系在哪里", "从真实问题中提取条件、未知量与关系"],
    concept: ["核心模型｜式与图怎样互译", "用符号、图形和语言表示同一关系"],
    example: ["例题拆解｜每一步为何成立", "把审题、建模、求解与检验变成可复用方法"],
    activity: ["变式探究｜条件改变会怎样", "通过比较变式发现不变结构与适用条件"],
    transfer: ["迁移应用｜把模型带走", "在新情境中选择并检验合适的数学模型"],
  },
  humanities: {
    goals: ["本课路线｜时空、证据、解释", "明确历史或社会学习中的证据表现"],
    context: ["时空定位｜事件发生在哪里", "建立时间、空间与关键背景的坐标"],
    concept: ["核心线索｜变化如何发生", "梳理人物、制度、事件与影响之间的联系"],
    example: ["材料研读｜证据说明了什么", "区分材料信息、观点与可支持的结论"],
    activity: ["观点比较｜解释为何不同", "比较证据、立场与解释"],
    transfer: ["联系当下｜从历史看现实", "在边界清晰的前提下迁移历史理解"],
  },
  language: {
    goals: ["本课路线｜阅读、品味、表达", "明确文本证据、理解与表达的学习目标"],
    context: ["初读感受｜文本带来什么", "形成值得回到文本验证的问题"],
    concept: ["结构梳理｜内容怎样展开", "识别段落关系、线索与表达层次"],
    example: ["细读证据｜词句为何有力量", "从词句、语境和表达效果形成解释"],
    activity: ["对话文本｜观点如何生长", "通过批注、追问与交流修正理解"],
    transfer: ["迁移阅读｜换一段文本再试", "把细读方法迁移到新的语段或作品"],
  },
  general: {},
};

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function profileFor(subject: string, topic: string): SubjectProfile {
  const value = `${subject} ${topic}`.toLowerCase();
  if (/地理|区域|气候|地形|河流|人口|城市|地图/.test(value)) return "geography";
  if (/物理|化学|生物|科学|实验|电路|力学|生态/.test(value)) return "science";
  if (/数学|代数|几何|函数|统计|概率|方程/.test(value)) return "math";
  if (/历史|道德|法治|政治|社会|经济|制度/.test(value)) return "humanities";
  if (/语文|英语|语言|文学|阅读|写作|诗|小说/.test(value)) return "language";
  return "general";
}

function layoutFor(profile: SubjectProfile, kind: CoursewareSlide["kind"]): [CoursewareSlide["layout"], CoursewareVisual["kind"]] {
  if (kind === "goals") return ["cards", "cards"];
  if (kind === "practice") return ["practice", "evidence"];
  if (kind === "assessment") return ["cards", "reflection"];
  if (kind === "reflection") return ["summary", "reflection"];
  if (kind === "extension") return ["timeline", "timeline"];
  if (profile === "geography") {
    if (["context", "transfer"].includes(kind)) return ["map-focus", "map"];
    if (kind === "concept") return ["data-story", "data"];
    if (kind === "example") return ["comparison", "comparison"];
    return ["process", "process"];
  }
  if (profile === "science") {
    if (kind === "concept") return ["formula", "formula"];
    if (kind === "example") return ["experiment", "experiment"];
    if (kind === "transfer") return ["data-story", "data"];
    return kind === "activity" ? ["process", "process"] : ["split", "hero"];
  }
  if (profile === "math") {
    if (kind === "concept") return ["formula", "formula"];
    if (kind === "example") return ["process", "process"];
    if (kind === "activity") return ["comparison", "comparison"];
    if (kind === "transfer") return ["data-story", "data"];
  }
  if (profile === "humanities") {
    if (kind === "context") return ["timeline", "timeline"];
    if (kind === "concept") return ["process", "process"];
    if (kind === "activity") return ["comparison", "comparison"];
  }
  if (profile === "language") {
    if (kind === "concept") return ["process", "process"];
    if (kind === "example") return ["comparison", "comparison"];
    if (kind === "activity") return ["timeline", "timeline"];
  }
  return kind === "example" ? ["comparison", "comparison"] : ["split", "evidence"];
}

function referenceBullets(referenceFacts: string[]): string[] {
  return referenceFacts.map((value) => clean(value, 120)).filter((value) => value.length >= 2).slice(0, 4);
}

function topicParts(topic: string): string[] {
  return topic.split(/[、，,；;\/]|与|和|及|vs\.?/i).map((part) => clean(part, 24)).filter((part) => part.length >= 2).slice(0, 3);
}

function visualLabels(template: Template, brief: CoursewareBrief, objectives: string[]): string[] {
  const parts = topicParts(brief.topic);
  if (template.kind === "goals") return objectives.slice(0, 3);
  if (template.layout === "comparison") return parts.length >= 2 ? parts : ["对象 A", "对象 B", "综合判断"];
  if (template.layout === "map-focus") return parts.length >= 2 ? parts : ["位置", "分布", "联系"];
  if (template.layout === "formula") return ["已知条件", "核心关系", "适用边界"];
  if (template.layout === "experiment") return ["提出问题", "控制变量", "记录证据", "解释现象"];
  if (["timeline", "process"].includes(template.layout)) return ["观察", "提取证据", "形成解释", "迁移应用"];
  if (template.layout === "practice") return ["基础理解", "进阶解释", "挑战迁移"];
  if (template.kind === "assessment") return ["目标达成", "证据充分", "表达清晰"];
  return ["核心问题", "关键证据", "学习结论"];
}

function slideBullets(template: Template, brief: CoursewareBrief, objectives: string[], references: string[], profile: SubjectProfile): string[] {
  if (template.kind === "goals") return objectives;
  if (template.kind === "context" && references.length) return references.slice(0, 4);
  if (template.kind === "context") return [
    `从“${brief.topic}”中的真实现象提出一个可验证问题`,
    "先说观察到什么，再区分事实、推测与待核对信息",
    "把已有经验转化为本课需要解释的矛盾",
  ];
  if (template.kind === "concept") {
    const byProfile: Record<SubjectProfile, string[]> = {
      geography: ["先定位，再描述分布，最后解释区域联系", "同时关注图名、图例、方向与空间尺度", "结论必须能够回到地图或资料找到证据"],
      science: ["明确研究对象、条件与变量之间的关系", "用图示、符号或语言表示核心模型", "区分规律本身与规律成立的条件"],
      math: ["把文字条件翻译为式、图或表", "说明符号含义以及关系为何成立", "求解后回到原情境检验结果"],
      humanities: ["把事件放回具体时空与背景中理解", "区分原因、过程、结果与长期影响", "解释必须引用可核对的材料证据"],
      language: ["先梳理内容与结构，再进入重点词句", "联系语言形式、语境和表达效果", "阅读判断必须引用文本证据"],
      general: ["识别本课必须理解的关键概念", "用关系图说明概念之间的联系", "用一个例子检验自己的理解"],
    };
    return byProfile[profile];
  }
  if (template.kind === "example") return [
    ...(references.length ? references.slice(0, 2) : [`选择一个与“${brief.topic}”直接相关的典型材料`, "[待教师核对] 补充教材中的准确事实、数据或例题"]),
    "按“观察或条件—证据—解释—结论”完整呈现思路",
    "指出方法可以迁移的条件与不能直接套用的边界",
  ].slice(0, 5);
  if (template.kind === "activity") return [
    "个人先独立标注信息与初步判断",
    "小组交换证据，修正不充分或矛盾的解释",
    "用一张图、一段话或一次演示形成可观察成果",
    "依据成功标准进行同伴反馈并保留修改痕迹",
  ];
  if (template.kind === "practice") return [
    "基础：准确识别概念、条件或图表信息",
    "进阶：用证据解释关系、过程或结果",
    "挑战：在新情境中迁移方法并说明边界",
  ];
  if (template.kind === "assessment") return [
    "我能用一句话回答本课核心问题",
    "我的结论至少有一条可核对证据",
    "我能指出仍不确定或需要验证的地方",
  ];
  if (template.kind === "transfer") return [
    `把“${brief.topic}”中学到的方法用于新的相关情境`,
    "判断哪些条件相同、哪些条件已经改变",
    "用新证据检验原有结论是否仍然成立",
  ];
  if (template.kind === "extension") return [
    "选择校园、家庭或社区中的真实问题继续调查",
    "记录资料来源，区分原始证据与自己的解释",
    "用课堂标准制作一页图文成果并准备说明",
  ];
  return [
    `围绕“${brief.topic}”回收本课核心结论`,
    "指出支撑结论的一条关键证据或完整步骤",
    "写下仍需核对的问题与下一步行动",
  ];
}

function visualFor(template: Template, brief: CoursewareBrief, objectives: string[]): CoursewareVisual {
  const labels = visualLabels(template, brief, objectives).map((label) => clean(label, 56));
  return {
    kind: template.visualKind,
    title: template.kind === "cover" ? brief.topic : template.eyebrow,
    labels,
    values: [],
    caption: template.layout === "map-focus"
      ? "概念地图用于组织读图路径；具体边界与数据以教材或原始资料为准。"
      : "文本、卡片、箭头和示意图均作为可编辑对象写入 PPTX。",
    emphasis: template.kind === "assessment" ? "先证据，后判断" : brief.topic,
  };
}

function selectMiddleSequence(count: number): Array<Pick<Template, "kind" | "eyebrow">> {
  const compactIndexes: Record<number, number[]> = {
    2: [0, 5],
    3: [0, 2, 5],
    4: [0, 1, 2, 5],
    5: [0, 1, 2, 4, 5],
  };
  const indexes = compactIndexes[count];
  if (indexes) return indexes.map((index) => MIDDLE_SEQUENCE[index]);
  return MIDDLE_SEQUENCE.slice(0, count);
}

export function buildFallbackCoursewarePlan(briefInput: CoursewareBrief, referenceFacts: string[] = []): CoursewarePlan {
  const brief = CoursewareBriefSchema.parse(briefInput);
  const objectives = brief.objectives.length ? brief.objectives : DEFAULT_OBJECTIVES;
  const references = referenceBullets(referenceFacts);
  const profile = profileFor(brief.subject, brief.topic);
  const middle = selectMiddleSequence(brief.slideCount - 2).map<Template>((base) => {
    const [title, purpose] = PROFILE_COPY[profile][base.kind as MiddleKind] ?? GENERIC_COPY[base.kind as MiddleKind];
    const [layout, visualKind] = layoutFor(profile, base.kind);
    return { ...base, title, purpose, layout, visualKind };
  });
  const selected: Template[] = [
    { kind: "cover", title: brief.topic, purpose: `${brief.grade}${brief.subject}课堂课件`, layout: "cover", visualKind: "hero", eyebrow: `${brief.subject} · ${brief.grade}` },
    ...middle,
    { kind: "summary", title: "总结｜证据与下一步", purpose: "回收核心问题、学习证据与后续行动", layout: "summary", visualKind: "reflection", eyebrow: "课堂闭环" },
  ];
  const theme = STYLE_THEME[brief.style];
  const slides = selected.map<CoursewareSlide>((template, position) => {
    const index = position + 1;
    const bullets = template.kind === "cover"
      ? [brief.subject, brief.grade, STYLE_LABEL[brief.style]]
      : slideBullets(template, brief, objectives, references, profile);
    return {
      id: `slide-${String(index).padStart(2, "0")}`,
      index,
      kind: template.kind,
      title: template.title,
      purpose: template.purpose,
      bullets: bullets.slice(0, 5),
      layout: template.layout,
      eyebrow: template.eyebrow,
      subtitle: template.kind === "cover" ? `${brief.grade} · ${brief.subject}` : template.purpose,
      takeaway: template.kind === "cover" ? "带着问题进入课堂" : bullets[0] ?? "",
      visual: visualFor(template, brief, objectives),
      visualHint: `${theme.visualSystem}；${template.visualKind} 版式`,
      teacherNote: index === 1
        ? "开场只呈现学习挑战与主问题，邀请学生先说已有判断，不急于给出结论。"
        : "先让学生观察和表达，再追问证据。涉及事实、数据、地图边界、引用或例题时，回到教材和原始资料核对。",
      sourceRefs: references.length && ["context", "example"].includes(template.kind) ? ["教师提供的参考资料"] : ["教师简报"],
    };
  });
  return CoursewarePlanSchema.parse({
    schemaVersion: "courseware.v2",
    title: `${brief.topic}课堂课件`,
    subject: brief.subject,
    grade: brief.grade,
    designIntent: `${STYLE_LABEL[brief.style]}。围绕“问题提出—概念建构—证据表达—迁移反馈”组织课堂，视觉对象保持原生可编辑。`,
    objectives,
    theme,
    slides,
    reviewNotes: [
      "生成方案已包含可编辑视觉结构；事实、数据、例题、地图边界和引用仍需教师复核，并以教材与原始资料为准。",
      references.length ? "教师材料已进入情境与示例页，请检查摘录语境和来源标注。" : "尚未附参考资料，带有“待教师核对”的位置必须补充权威材料。",
    ],
  });
}

function extractJsonObject(text: string): unknown {
  const stripped = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try { return JSON.parse(stripped.slice(first, last + 1)) as unknown; } catch { return null; }
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedText(value: unknown, fallback: string, max: number, min = 2): string {
  const normalized = clean(typeof value === "string" ? value : "", max);
  return normalized.length >= min ? normalized : clean(fallback, max);
}

function boundedList(value: unknown, maxItems: number, maxLength: number, minLength = 2): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string")
    .map((item) => clean(item, maxLength)).filter((item) => item.length >= minLength).slice(0, maxItems);
}

function boundedValues(value: unknown, maxItems: number): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    .map((item) => Math.max(0, Math.min(100, item))).slice(0, maxItems);
}

export function parsePlannerReply(text: string, briefInput: CoursewareBrief): CoursewarePlan | null {
  const brief = CoursewareBriefSchema.parse(briefInput);
  const raw = recordOf(extractJsonObject(text));
  if (!raw || !Array.isArray(raw.slides) || raw.slides.length !== brief.slideCount) return null;
  const fallback = buildFallbackCoursewarePlan(brief);
  const slides: CoursewareSlide[] = [];
  for (let position = 0; position < raw.slides.length; position += 1) {
    const candidate = recordOf(raw.slides[position]);
    if (!candidate) return null;
    const seed = fallback.slides[position];
    const bullets = boundedList(candidate.bullets, 5, 160);
    if (!bullets.length) return null;
    const kind = CoursewareSlideKindSchema.safeParse(candidate.kind);
    const layout = CoursewareLayoutSchema.safeParse(candidate.layout);
    const visualCandidate = recordOf(candidate.visual);
    const visualKind = CoursewareVisualKindSchema.safeParse(visualCandidate?.kind);
    const labels = boundedList(visualCandidate?.labels, 6, 56, 1);
    slides.push({
      id: `slide-${String(position + 1).padStart(2, "0")}`,
      index: position + 1,
      kind: kind.success ? kind.data : seed.kind,
      title: boundedText(candidate.title, seed.title, 80),
      purpose: boundedText(candidate.purpose, seed.purpose, 160),
      bullets,
      layout: layout.success ? layout.data : seed.layout,
      eyebrow: boundedText(candidate.eyebrow, seed.eyebrow, 48, 0),
      subtitle: boundedText(candidate.subtitle, seed.subtitle, 140, 0),
      takeaway: boundedText(candidate.takeaway, seed.takeaway, 140, 0),
      visual: {
        kind: visualKind.success ? visualKind.data : seed.visual.kind,
        title: boundedText(visualCandidate?.title, seed.visual.title, 80, 0),
        labels: labels.length ? labels : seed.visual.labels,
        values: boundedValues(visualCandidate?.values, 6),
        caption: boundedText(visualCandidate?.caption, seed.visual.caption, 180, 0),
        emphasis: boundedText(visualCandidate?.emphasis, seed.visual.emphasis, 100, 0),
      },
      visualHint: boundedText(candidate.visualHint, seed.visualHint, 200, 0),
      teacherNote: boundedText(candidate.teacherNote, seed.teacherNote, 400, 0),
      sourceRefs: boundedList(candidate.sourceRefs, 4, 120, 1),
    });
  }
  const reviewNotes = boundedList(raw.reviewNotes, 8, 240);
  if (!reviewNotes.some((note) => /复核|核对|确认/.test(note))) reviewNotes.push("在线生成内容需由教师复核事实、数据、引用和学段适配后再用于课堂。");
  const theme = CoursewareThemeSchema.safeParse(raw.theme);
  const checked = CoursewarePlanSchema.safeParse({
    schemaVersion: "courseware.v2",
    title: boundedText(raw.title, `${brief.topic}课堂课件`, 100),
    subject: brief.subject,
    grade: brief.grade,
    designIntent: boundedText(raw.designIntent, fallback.designIntent, 500),
    objectives: boundedList(raw.objectives, 4, 120).length ? boundedList(raw.objectives, 4, 120) : fallback.objectives,
    theme: theme.success ? theme.data : fallback.theme,
    slides,
    reviewNotes: reviewNotes.slice(0, 8),
  });
  if (!checked.success || assessCoursewarePlan(checked.data).issues.length) return null;
  return checked.data;
}

export interface CoursewareQualityCheck { id: string; label: string; passed: boolean; detail: string }
export interface CoursewareQualityReport {
  score: number;
  grade: "A" | "B" | "C" | "需复核";
  issues: string[];
  warnings: string[];
  checks: CoursewareQualityCheck[];
  visualCoverage: number;
  layoutVariety: number;
  editableObjectEstimate: number;
  factualReviewRequired: true;
}

const OBJECT_ESTIMATE: Record<CoursewareSlide["layout"], number> = {
  cover: 12, split: 16, cards: 18, timeline: 20, practice: 19, summary: 17,
  "map-focus": 24, comparison: 22, process: 21, experiment: 23, "data-story": 22, formula: 18,
};

export function assessCoursewarePlan(planInput: CoursewarePlan): CoursewareQualityReport {
  const parsed = CoursewarePlanSchema.safeParse(planInput);
  if (!parsed.success) return { score: 0, grade: "需复核", issues: ["编辑中的方案尚不完整"], warnings: [], checks: [], visualCoverage: 0, layoutVariety: 0, editableObjectEstimate: 0, factualReviewRequired: true };
  const plan = parsed.data;
  const issues: string[] = [];
  if (plan.slides.length < 4 || plan.slides.length > 12) issues.push("页数必须在 4-12 页之间");
  if (plan.slides.some((slide, index) => slide.index !== index + 1)) issues.push("页码不连续");
  if (new Set(plan.slides.map((slide) => slide.id)).size !== plan.slides.length) issues.push("页面 ID 重复");
  if (new Set(plan.slides.map((slide) => slide.title.trim())).size !== plan.slides.length) issues.push("页面标题重复");
  if (plan.slides.some((slide) => slide.bullets.length < 1 || slide.bullets.length > 5)) issues.push("页面要点数量不合规");
  if (!plan.objectives.length) issues.push("缺少学习目标");
  const visualCoverage = Math.round((plan.slides.filter((slide) => slide.visual.labels.length >= 2 || slide.visual.kind === "hero").length / plan.slides.length) * 100);
  const layoutVariety = new Set(plan.slides.map((slide) => slide.layout)).size;
  const editableObjectEstimate = plan.slides.reduce((total, slide) => total + OBJECT_ESTIMATE[slide.layout], 0);
  const generic = plan.slides.flatMap((slide) => slide.bullets).filter((bullet) => /教师根据教材|完成本页任务/.test(bullet)).length;
  const unchecked = plan.slides.flatMap((slide) => slide.bullets).filter((bullet) => /待教师核对/.test(bullet)).length;
  const notesCoverage = Math.round((plan.slides.filter((slide) => slide.teacherNote.length >= 12).length / plan.slides.length) * 100);
  const hasArc = plan.slides.some((slide) => slide.kind === "goals")
    && plan.slides.some((slide) => ["activity", "practice"].includes(slide.kind))
    && plan.slides.some((slide) => slide.kind === "summary");
  const warnings: string[] = [];
  if (!hasArc) warnings.push("缺少完整的目标、活动/练习与总结闭环");
  if (visualCoverage < 80) warnings.push("可视化覆盖不足 80%");
  if (layoutVariety < Math.min(5, plan.slides.length - 1)) warnings.push("版式变化不足");
  if (notesCoverage < 90) warnings.push("部分页面缺少教师讲解提示");
  if (generic) warnings.push("仍有通用占位表述");
  if (unchecked > 2) warnings.push("多处事实等待教师核对");
  const checks: CoursewareQualityCheck[] = [
    { id: "structure", label: "教学闭环", passed: hasArc, detail: hasArc ? "目标、活动/练习与总结齐全" : "需要补齐教学闭环" },
    { id: "visual", label: "视觉覆盖", passed: visualCoverage >= 80, detail: `${visualCoverage}% 页面含结构化视觉` },
    { id: "layout", label: "版式变化", passed: layoutVariety >= Math.min(5, plan.slides.length - 1), detail: `${layoutVariety} 种原生可编辑版式` },
    { id: "notes", label: "讲解提示", passed: notesCoverage >= 90, detail: `${notesCoverage}% 页面含教师提示` },
    { id: "specificity", label: "内容具体", passed: generic === 0, detail: generic ? `${generic} 处通用占位` : "未发现通用模板占位" },
    { id: "editable", label: "可编辑对象", passed: editableObjectEstimate >= plan.slides.length * 12, detail: `预计 ${editableObjectEstimate} 个文本、卡片与图示对象` },
  ];
  const score = Math.max(0, Math.min(100, 100 - issues.length * 22 - warnings.length * 5));
  const grade = issues.length ? "需复核" : score >= 92 ? "A" : score >= 82 ? "B" : "C";
  return { score, grade, issues, warnings, checks, visualCoverage, layoutVariety, editableObjectEstimate, factualReviewRequired: true };
}

export function buildCoursewarePlannerPrompt(briefInput: CoursewareBrief, sourceMaterial: string): string {
  const brief = CoursewareBriefSchema.parse(briefInput);
  const source = clean(sourceMaterial, 12_000);
  return [
    "请为中小学教师生成一份可逐页审阅、可渲染为原生可编辑 PPTX 的课堂课件蓝图。只输出 JSON。",
    "不得编造教材事实、统计数字、引用或校内信息；资料不足时写“[待教师核对]”。",
    `学科：${brief.subject}`, `年级：${brief.grade}`, `主题：${brief.topic}`, `页数：${brief.slideCount}`,
    `风格：${STYLE_LABEL[brief.style]}`,
    `学习目标：${brief.objectives.length ? brief.objectives.join("；") : DEFAULT_OBJECTIVES.join("；")}`,
    brief.sourceSummary ? `教师补充：${brief.sourceSummary}` : "",
    source ? `可引用资料（只允许据此提取事实）：\n${source}` : "可引用资料：无",
    "顶层字段：schemaVersion、title、subject、grade、designIntent、objectives、theme、slides、reviewNotes；schemaVersion 写 courseware.v2。",
    "theme 包含 palette、mood、visualSystem；palette 只能是 ocean/forest/sunrise/ink。",
    "每页包含 id、index、kind、title、purpose、bullets、layout、eyebrow、subtitle、takeaway、visual、visualHint、teacherNote、sourceRefs。",
    "visual 包含 kind、title、labels、values、caption、emphasis。values 仅用于资料明确提供的百分比数据；没有数据时必须为空数组，不得编造进度或示例统计。",
    "kind 只能是 cover/goals/context/concept/example/activity/practice/assessment/transfer/summary/extension/reflection。",
    "layout 只能是 cover/split/cards/timeline/practice/summary/map-focus/comparison/process/experiment/data-story/formula。每页 1-5 条要点，标题不得重复。",
    "地理优先地图与区域对比；理科优先实验、模型与数据；数学优先公式、步骤与变式；人文优先时间线与证据链；语言优先文本结构与对照细读。",
    "顺序必须覆盖目标、概念建构、活动或练习、可观察证据、反馈与总结；教师提示不能重复正文。",
    "正文必须是学生能直接学习的具体知识、问题和解题内容，不是‘呈现概念’‘结合材料分析’等设计指令。仅使用可信学科常识和教师材料，不确定的事实保留核验提示。",
  ].filter(Boolean).join("\n");
}
