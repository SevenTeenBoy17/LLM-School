import type { ModelCardItem } from "@/lib/types";
import { MODEL_PALETTE, tonalPair } from "@/lib/data/gradientKeys";

/**
 * 模型 → 色板槽位。**按 id 映射，不按数组下标**——下标会随 MODELS 的排序变动，
 * 一次重排就会让所有模型换色，而用户是靠颜色记住「哪个是哪个」的。
 */
const MODEL_SLOT: Record<ModelCardItem["id"], number> = {
  chatgpt: 0,
  claude: 1,
  "gpt-image": 2,
  gemini: 3, // gemini id 转指真 Gemini 后槽位不动——「色随 id 不随厂牌」正是槽位制的设计目标
  minimax: 4,
  deepseek: 2, // 蓄意共享 violet：6 色板 7 卡必有一撞，与唯一的图像工具卡相撞歧义最小（图标/名称/CTA 全不同）
  glm: 5, // GLM 从借用的 gemini 槽迁至 slate——id 归位的必然代价，记录在案
};

const slotGradient = (id: ModelCardItem["id"]) => tonalPair(MODEL_PALETTE[MODEL_SLOT[id]]);

// 卡片显示名与网关真实路由的模型一致（见 lib/server/llm.ts MODEL_MAP），不编造。
export const MODELS: ModelCardItem[] = [
  {
    id: "chatgpt",
    key: "gpt-5.4",
    name: "GPT-5.4",
    description: "通用稳健的多面手；知识库检索（grounding）表现好，适合需引用校内资料的备课与问答。响应约 20s。",
    gradient: slotGradient("chatgpt"),
    tags: ["通用问答", "长文本", "代码辅助", "中文优化"],
    scenarios: ["教案生成", "课堂活动", "论文润色", "代码解释"],
    status: "available",
    actionText: "选择模型",
    contextWindow: "128K",
    capabilities: ["text", "long-text", "code", "chinese"],
  },
  {
    id: "claude",
    key: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    description: "长文档分析、学术写作、严谨推理与高质量润色；内测教案质量最高、擅长学情分层与控时，备课/教研/长文首选（响应较慢约 24s）。",
    gradient: slotGradient("claude"),
    tags: ["长文本", "学术写作", "严谨推理"],
    scenarios: ["论文优化", "方案润色", "材料归纳", "文献分析"],
    status: "available",
    actionText: "选择模型",
    contextWindow: "200K",
    capabilities: ["text", "long-text", "code"],
  },
  {
    id: "gpt-image",
    key: "gpt-image-2",
    name: "GPT-Image-2 · 视觉方案",
    description: "真实生图已接入（约 1 分钟/张，校内安全审核先于生成）：学生入口在「AI 工具 → AI 生图」，教师入口在「模型广场 → /hub/image 生图工作台」。本卡片对话可生成图像提示词方案。",
    gradient: slotGradient("gpt-image"),
    tags: ["图像提示词", "课件视觉", "海报设计", "风格控制"],
    scenarios: ["教学插图", "科研图示", "活动海报", "章节封面"],
    status: "available",
    actionText: "生成图像提示词",
    contextWindow: "—",
    capabilities: ["image-gen", "chinese"],
  },
  {
    id: "gemini",
    key: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    description: "多语言与长文本见长；2026-08-20 复测通过恢复开放：六场景 6/6 完成（质量 4.3 / 学段适配 4.5 / 诚实 4.0）、流式浸泡 8/8。延迟偏高（平均约 20s、首包约 5s），赶时间的课堂即时问答建议改用 GLM。",
    gradient: slotGradient("gemini"),
    tags: ["多语言", "长文本"],
    scenarios: ["教学问答", "资料整理", "翻译润色", "跨格式归纳"],
    status: "available",
    actionText: "开始对话",
    contextWindow: "1M tokens",
    capabilities: ["text", "long-text", "chinese"],
  },
  {
    id: "glm",
    key: "glm-5.1",
    name: "GLM-5.1 · 智谱",
    description: "智谱 GLM，中文理解强、响应最快（约 7s），适合课堂即时生成与资料整理；复杂概念开掘偏浅，深度教研与严谨引用建议改用 Claude。",
    gradient: slotGradient("glm"),
    tags: ["中文优化", "综合分析", "学习辅助"],
    scenarios: ["教学问答", "资料整理", "学习辅助", "跨格式归纳"],
    status: "available",
    actionText: "选择模型",
    contextWindow: "128K",
    capabilities: ["text", "long-text", "chinese"],
  },
  {
    id: "deepseek",
    key: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    description: "内测质量最高分（质量 4.6/学段适配 4.8）且响应快（约 8s）：教案、讲解、代码解释表现俱佳。注意：推理型模型偶发把长斟酌耗在思考里导致空回复（内测 1/6 场景），遇到空回复换个问法或换模型即可。",
    gradient: slotGradient("deepseek"),
    tags: ["推理", "代码辅助", "响应快"],
    scenarios: ["解题思路", "代码解释", "教学问答", "资料整理"],
    status: "available",
    actionText: "选择模型",
    contextWindow: "128K",
    capabilities: ["text", "code", "chinese"],
  },
  {
    id: "minimax",
    key: "minimax-m2.7",
    name: "MiniMax M2.7",
    description: "响应快（约 11s）、质量接近最优，内测性价比最高——日常高频备课与问答的均衡首选（平台默认）。",
    gradient: slotGradient("minimax"),
    tags: ["中文场景", "对话生成", "应用接入"],
    scenarios: ["校园问答", "角色助手", "服务咨询", "快速集成"],
    status: "available",
    actionText: "选择模型",
    contextWindow: "200K",
    capabilities: ["text", "chinese"],
  },
];

export function modelById(id?: string) {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}

export const MODEL_IDS = MODELS.map((m) => m.id);

export function isModelId(value: unknown): value is ModelCardItem["id"] {
  return typeof value === "string" && MODEL_IDS.includes(value as ModelCardItem["id"]);
}

/** G1：维护态模型（网关通道不可用等）。UI 禁选 + 服务端 /api/chat 拒绝双保险。 */
export function isModelInMaintenance(id: string): boolean {
  return MODELS.find((m) => m.id === id)?.status === "maintain";
}

export const MODEL_GRADIENT_CSS = (m: ModelCardItem) =>
  `linear-gradient(135deg, ${m.gradient[0]}, ${m.gradient[1]})`;
