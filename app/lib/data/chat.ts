import type { ChatSession, ChatMessage } from "@/lib/types";

export const DEMO_NOW = 1782582000000;

export const SESSIONS: ChatSession[] = [
  { id: "s1", title: "高数（下）·教案大纲",  preview: "已生成第 5 章教案与课堂活动", timestamp: DEMO_NOW-2*60_000,    modelId: "chatgpt", rounds: 28, pinned: true },
  { id: "s2", title: "《操作系统》期末试题", preview: "12 轮 · 待审核",                timestamp: DEMO_NOW-15*60_000,   modelId: "claude", rounds: 12 },
  { id: "s3", title: "论文摘要润色",         preview: "已导出 Word · 引用 8 篇",      timestamp: DEMO_NOW-2*3600_000,  modelId: "claude", rounds: 14 },
  { id: "s4", title: "实验数据可视化",       preview: "Gemini · 表格解析中",          timestamp: DEMO_NOW-86_400_000,  modelId: "gemini", rounds: 6 },
  { id: "s5", title: "学情分析周报",         preview: "已发送至教研组",                timestamp: DEMO_NOW-3*86_400_000, modelId: "chatgpt", rounds: 18 },
  { id: "s6", title: "科研项目宣传海报",     preview: "GPT-Image · 4 张已生成",       timestamp: DEMO_NOW-6*3600_000,  modelId: "gpt-image", rounds: 4 },
];

// ⚠️ 演示种子数据：仅用于首次进入对话页时的示例会话。其中的 references / durationMs 等仅为样例，
// 真实回复来自 /api/chat（不返回伪造引用）。MessageBubble 的引用徽章只会对带 references 的种子消息显示。
export const SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "帮我基于上传的《高等数学（下）》教学大纲，生成第 5 章「重积分」的教学方案，包括 3 个课堂活动和 5 道课后练习。",
    timestamp: DEMO_NOW - 30_000,
  },
  {
    id: "m2",
    role: "assistant",
    modelId: "chatgpt",
    timestamp: DEMO_NOW - 25_000,
    durationMs: 2400,
    references: [
      { name: "高等数学（下）·大纲.pdf", meta: "第 12 页 · 教研组 2026" },
      { name: "重积分典型例题集.docx",   meta: "第 3-7 页 · 数学学院" },
      { name: "教学方案模板.pptx",        meta: "通用模板 v3.1" },
      { name: "校历 2026 秋.xlsx",        meta: "教务处发布" },
    ],
    content: `已为您生成第 5 章「重积分」教学方案，重点突出概念建构与几何直觉，适合 90 分钟课时。

## 一、教学目标
- 理解二重积分与三重积分的定义，区分被积函数与积分区域
- 掌握 \`直角坐标 / 极坐标 / 柱面坐标 / 球面坐标\` 的转换
- 能运用重积分求解面积、体积、质量与质心问题

## 二、课堂活动建议
- **活动 1 · 切片游戏**：用 Geogebra 切片演示二重积分的几何意义（10 分钟）
- **活动 2 · 小组讨论**：选择合适坐标系求解 4 个非标准区域（20 分钟）
- **活动 3 · 即时反馈**：通过雨课堂推送 3 道概念题，统计选择分布

## 三、课后练习（5 道）
1. 求 $\\iint_D xy\\,dA$，$D=\\{(x,y)|0\\le x\\le 1, 0\\le y\\le x\\}$
2. 用极坐标计算 $\\iint_D e^{-x^2-y^2}\\,dA$，$D$ 为单位圆
3. 立体 $V$ 由 $z=x^2+y^2$ 与 $z=4$ 围成，求其体积
4. 求密度 $\\rho=x+y$ 的薄片在三角形区域内的质量
5. 综合：用柱面坐标推导环形区域转动惯量公式`,
  },
  {
    id: "m3",
    role: "user",
    content: "能不能把活动 3 改成「小组分组对抗」？另外课后练习增加 2 道开放性问题。",
    timestamp: DEMO_NOW - 5_000,
  },
  {
    id: "m4",
    role: "assistant",
    modelId: "chatgpt",
    timestamp: DEMO_NOW - 1_500,
    streaming: true,
    content: "已将原即时反馈改为「小组分组对抗」，并补充开放性练习题。继续生成中…",
  },
];
