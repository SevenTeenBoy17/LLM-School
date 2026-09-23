export const SOURCE_REVIEW_DATE = "2026-09-05";

export const PHASES = [
  { id: "topic", title: "选题聚焦", hint: "把课堂困惑转成可研究的问题", tone: "blue" },
  { id: "literature", title: "文献梳理", hint: "先检索原文，再组织论证", tone: "green" },
  { id: "methods", title: "研究设计", hint: "让方法与问题、条件相匹配", tone: "blue" },
  { id: "proposal", title: "开题申报", hint: "对照通知，逐项补齐论证", tone: "amber" },
  { id: "writing", title: "学术表达", hint: "保留证据，改善结构与表达", tone: "green" },
  { id: "review", title: "评审修改", hint: "保留分歧，逐项回应质疑", tone: "amber" },
] as const;
export type PhaseId = (typeof PHASES)[number]["id"];

export interface ResearchSkill {
  id: string;
  name: string;
  title: string;
  kind: "GitHub Skill" | "提示词参考库" | "本地 Skill 提炼";
  owner: string;
  summary: string;
  sourceUrl?: string;
  installUrl?: string;
  dependency: string;
  steps: string[];
  caution: string;
}
const SCIENCE = "https://github.com/K-Dense-AI/scientific-agent-skills";
export const RESEARCH_SKILLS: ResearchSkill[] = [
  { id: "k12", name: "k12-research-proposal-cn", title: "中小学课题申报", kind: "本地 Skill 提炼", owner: "本机技能库", summary: "从真实教学问题出发，组织问题、方法、证据与成果。", dependency: "本地已有参考技能；尚未核实公开分发地址。页面模板为适配提炼，并非该技能运行环境。", steps: ["准备申报通知、栏目要求、学校情境与已有材料。", "先检查课题范围、可用时间和证据，再逐节论证。", "由教师复核研究基础、政策依据及可执行性。"], caution: "没有公开安装链接。勿将本机已有误认为每位教师已安装；可先使用本站的提炼模板。" },
  { id: "pipeline", name: "academic-pipeline", title: "分阶段研究与审阅", kind: "本地 Skill 提炼", owner: "本机技能库", summary: "依据已有材料从选题、提纲、初稿或评审意见切入。", dependency: "原工作流依赖多个本地技能；本页只提炼阶段与审阅逻辑，没有运行多智能体研究。", steps: ["明确当前已有什么，不必从零重写。", "每阶段先核对所需材料，再产出一项可审阅结果。", "把未解决问题和修改理由带入下一阶段。"], caution: "未核实公开安装地址。自动评审意见只作辅助，不能替代学术专家判断。" },
  { id: "literature", name: "literature-review", title: "文献综述工作流", kind: "GitHub Skill", owner: "K-Dense-AI", summary: "明确检索范围、筛选标准，记录来源并综合研究发现。", sourceUrl: `${SCIENCE}/blob/main/skills/literature-review/SKILL.md`, installUrl: `${SCIENCE}#-getting-started`, dependency: "外部 Agent 宿主；搜索服务、Python 与文档工具依具体流程而定，可能需单独账号或费用。", steps: ["先读 SKILL.md 的范围与依赖，按仓库安装文档选取所需技能。", "给出研究问题、数据库、时间范围与纳入排除标准。", "保留检索记录、排除理由及原文核验，最后综合证据。"], caution: "该库偏科学与技术研究；教育研究应补充 ERIC 等学科来源。普通综述不能冒充系统综述。" },
  { id: "citation", name: "citation-management", title: "引文与元数据核验", kind: "GitHub Skill", owner: "K-Dense-AI", summary: "整理 DOI、作者、年份及题名，核对引文信息。", sourceUrl: `${SCIENCE}/blob/main/skills/citation-management/SKILL.md`, installUrl: `${SCIENCE}#-getting-started`, dependency: "相关 Python 依赖与网络访问；检索服务要求以当前源码文档为准。", steps: ["准备已有的 DOI 或完整书目信息，不让模型补造。", "按上游说明安装单项技能，检查它将访问的服务。", "逐条对照出版方与原文，区分书目信息正确和论断被支持。"], caution: "DOI 能打开不等于研究可靠，也不等于能支持你的论断。" },
  { id: "writing", name: "awesome-ai-research-writing", title: "学术表达参考", kind: "提示词参考库", owner: "Leey21", summary: "语言、逻辑、术语与修改说明的写作提示词案例。", sourceUrl: "https://github.com/Leey21/awesome-ai-research-writing", installUrl: "https://github.com/Leey21/awesome-ai-research-writing#skills-的配置", dependency: "提示词本身无需安装；仓库介绍的第三方技能各有独立依赖及许可。", steps: ["从 README 选择语言润色或逻辑检查场景。", "提供原文、目标读者与必须保留的术语、数据和引用。", "逐条审查修改理由，并按学校或期刊要求披露 AI 使用。"], caution: "参考库并非单一可执行 Skill。不承诺规避 AI 检测，不改变研究结果或作者责任。" },
  { id: "coauthor", name: "doc-coauthoring", title: "结构化文档协作", kind: "GitHub Skill", owner: "Anthropic", summary: "上下文澄清、分节精修、读者测试三阶段协作。", sourceUrl: "https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md", installUrl: "https://github.com/anthropics/skills#using-these-skills", dependency: "需支持 Agent Skills 的外部工具；按官方仓库选择对应宿主的使用方式。", steps: ["阅读源码与仓库使用说明，确认宿主支持及权限。", "提供目标文档、读者、现有材料与必须遵循的模板。", "分节修改，再用不了解背景的读者视角检查遗漏。"], caution: "源技能面向通用文档，课题申报仍以实际通知为准。" },
  { id: "peer", name: "peer-review", title: "证据约束的审稿", kind: "GitHub Skill", owner: "K-Dense-AI", summary: "检查问题、方法、可重复性、引文与结论边界。", sourceUrl: `${SCIENCE}/blob/main/skills/peer-review/SKILL.md`, installUrl: `${SCIENCE}#-getting-started`, dependency: "原技能带本地工具；按源码确认 Python 要求与保密处理方式。", steps: ["先确认材料所有者授权、期刊政策与利益冲突。", "只检查授权范围，用原文位置说明每一项质疑。", "区分关键缺陷、可修改问题和证据不足，不冒充正式审稿人。"], caution: "未经授权的未发表稿件或审稿材料不得交给外部模型；本页模型建议不等于独立同行评审。" },
];

export interface ResearchTemplate {
  id: string; phase: PhaseId; title: string; deliverable: string; input: string; skill: string; task: string;
}
export const TEMPLATES: ResearchTemplate[] = [
  { id: "question", phase: "topic", title: "从课堂问题到课题", deliverable: "问题陈述与 3 个候选研究问题", input: "具体课堂现象、已有作品或观察、希望理解的问题", skill: "k12", task: "先区分已观察事实、解释与假设，再给出3个边界清晰的研究问题。用表格说明对象、情境、可收集证据与可反驳条件；不要给出未经文献核实的创新性结论。最后列出最少需要补充的3项信息。" },
  { id: "feasibility", phase: "topic", title: "选题可行性检查", deliverable: "条件缺口与缩小范围建议", input: "研究周期、样本来源、教师时间、工具与权限", skill: "k12", task: "逐项检查范围、周期、人员、数据获取与材料授权。按已知条件/未知条件/风险/调整建议列出可行性清单；缺少数据、周期或授权依据时不得标为可实施。给出一个最小可执行版本。" },
  { id: "search", phase: "literature", title: "文献检索策略", deliverable: "中英文检索词与筛选记录表", input: "研究问题、关键词、年份范围、文献类型", skill: "literature", task: "仅设计检索方案，不声称已检索。生成中英文概念词组、同义词与布尔检索式，建议合适数据库及纳入排除条件。给出日期/数据库/检索式/结果数量/排除理由的空白记录表，数量留空。教育主题优先考虑ERIC并补充中文来源。" },
  { id: "synthesis", phase: "literature", title: "文献综述框架", deliverable: "主题矩阵、分歧与待验证缺口", input: "已阅读文献的出处、方法、发现、局限与原文位置", skill: "literature", task: "只根据提供的文献，按主题/研究设计/对象/发现/局限/原文位置组织证据矩阵。区分共识、冲突与尚不清楚的问题，给出综述结构。没有材料时只给空框架及检索建议，不补造作者、结论或所谓研究空白。" },
  { id: "citations", phase: "literature", title: "引文核验清单", deliverable: "书目信息、原文位置与待核对项", input: "已有参考文献、DOI、原文摘录及对应论断", skill: "citation", task: "整理已有引文，列出题名、作者、年份、DOI、原文位置与所支持论断，缺失字段留待核验。只指出材料内可见的不一致，不声称已联网验证。把来源存在、元数据正确和支持论断分开检查，提供教师逐条核对清单。" },
  { id: "design", phase: "methods", title: "研究方法与证据计划", deliverable: "问题、方法、证据对应表", input: "研究问题、周期、对象、可获得的数据和约束", skill: "k12", task: "为每个研究问题匹配方法、取样、证据来源、收集时点、分析方式及限制。比较行动研究、访谈或观察等可行选择，不机械指定实验。单班前后比较不能排除成熟、测量与情境影响；不得由相关或满意度推断因果效果。" },
  { id: "instrument", phase: "methods", title: "访谈与观察工具", deliverable: "工具初稿与试用检查项", input: "待研究概念、研究对象、观察场景与收集方式", skill: "pipeline", task: "把研究概念转成可观察线索。给出开放且非诱导的访谈问题或观察记录表，并写清使用情境、试测、修订与编码建议。不得声称初稿已有信效度；提醒儿童意愿、退出、师生权力关系及再识别风险，伦理要求待机构确认。" },
  { id: "proposal", phase: "proposal", title: "开题报告结构", deliverable: "栏目大纲、论证链与待补材料", input: "申报或开题通知、栏目、字数、研究基础与进度", skill: "k12", task: "优先对照所给通知，组织选题依据、概念界定、目标内容、方法路线、进度、成果及条件保障。每节注明回答的问题、需要的证据和字数建议；没有通知时明确为通用参考。不得补造政策文件、已有成果、经费与伦理批准。" },
  { id: "milestones", phase: "proposal", title: "实施进度与成果清单", deliverable: "时间、任务、证据与成果里程碑", input: "起止时间、学校日程、团队职责、拟交付成果", skill: "coauthor", task: "根据可用周期制作阶段/具体任务/责任角色/证据/交付物/检查点表。预留试测、修订与教师审阅时间，区分预期成果与已完成成果。周期未提供则用相对阶段，不能捏造日期或已完成工作。" },
  { id: "polish", phase: "writing", title: "论文润色", deliverable: "修订稿与逐项修改理由", input: "原文片段、目标读者、术语与字数要求", skill: "writing", task: "逐段修改语言与逻辑衔接，用原句/建议/理由表保留修改依据。保持原意、术语、引文、公式及数据，不提升结论强度。对无出处的判断标注待核验；未提供原文则先要材料，不从零代写。" },
  { id: "abstract", phase: "writing", title: "摘要打磨", deliverable: "结构化中文摘要与关键词", input: "已完成研究的问题、实际方法、真实发现与局限", skill: "writing", task: "从已有内容提炼300字以内中文摘要及3至5个关键词，覆盖问题、方法、发现与边界。没有实际发现时只提供带待补充标记的框架，不能把研究计划写成已完成研究。英文翻译仅在要求时附上，保留结论的不确定性。" },
  { id: "argument", phase: "writing", title: "论证与学术表达", deliverable: "论断、依据、推理与限定条件表", input: "一个论证段落及其可核验出处", skill: "coauthor", task: "拆解主张、支持证据、推理和限定条件，检查偷换概念、逻辑跳跃、过度概括。指出读者需要但尚未提供的上下文；给出保留原意的表达版本。语言流畅不代表论据成立，不以去AI痕迹或通过检测为目标。" },
  { id: "audit", phase: "review", title: "多视角课题预审", deliverable: "质疑、证据要求与修改优先级", input: "本人或已授权的草稿、评审标准与材料范围", skill: "peer", task: "分别从一线教师、方法审查者、怀疑论者与语言读者视角提出反问：该结论何以成立？什么证据会推翻它？方案是否可执行？每项给出原文位置、问题、影响与修改建议；缺少材料不得编造缺陷。标明这是AI辅助预审，不是独立同行评审。" },
  { id: "response", phase: "review", title: "评审意见回应", deliverable: "意见、回应、改动与位置对照表", input: "真实评审意见、稿件版本和已做的改动", skill: "pipeline", task: "逐条整理评审意见，以意见/拟回应/依据/修改位置/待办表输出。区分接受、需澄清和有依据的分歧，未修改的内容用拟修改表述；不得谎称新增实验、补充数据或已完成修订。" },
];

export const SEARCH_PORTALS = [
  { id: "eric", title: "ERIC", description: "教育研究 · 主题词与筛选", url: "https://eric.ed.gov/", searchPrefix: "https://eric.ed.gov/?q=" },
  { id: "semantic", title: "Semantic Scholar", description: "跨学科论文 · 引文线索", url: "https://www.semanticscholar.org/", searchPrefix: "https://www.semanticscholar.org/search?q=" },
  { id: "crossref", title: "Crossref", description: "题名与 DOI · 书目信息", url: "https://search.crossref.org/", searchPrefix: "https://search.crossref.org/?q=" },
  { id: "cnki", title: "中国知网", description: "中文文献 · 权限依机构账号", url: "https://www.cnki.net/" },
];

export const METHOD_REFERENCES = [
  { title: "EEF · 研究证据与学校实践", url: "https://educationendowmentfoundation.org.uk/education-evidence/more-resources-and-support/using-research-evidence" },
  { title: "Zotero · 记录导入与核对", url: "https://www.zotero.org/support/adding_items_to_zotero" },
  { title: "PRISMA 2020 · 系统综述报告", url: "https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1003583" },
  { title: "BERA · 教育研究伦理参考", url: "https://www.bera.ac.uk/publication/ethical-guidelines-for-educational-research-fifth-edition-2024-online" },
];
