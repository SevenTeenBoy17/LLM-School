import type { AgentItem } from "@/lib/types";

// V2：智能体卡片配色 gradient 已迁为**枚举键**（accent|info|warm|calm，见 lib/data/gradientKeys.ts）。
// 原先这里存的是自由 CSS 字符串，既让数据层渐变躲过源码色彩守卫，又是一个 style 注入面。
// 种子入库时经 legacyGradientToKey 归一（对已是键的值原样透传），渲染端由键查 token 得 CSS。

export const AGENTS: AgentItem[] = [
  {
    id: "a1", name: "信息科技教案助手", category: "教学", icon: "BookOpen",
    gradient: "accent",
    description: "为信息科技教师量身定制教案、活动设计、评价方案，自动调用课程资料库。",
    capabilities: ["知识库", "文件解析", "Word 导出"],
    recommendedModel: "claude", knowledgeBase: "信息科技课程库",
    calls: 1268, score: 4.8, status: "pub", creator: "王思远", origin: "teacher",
  },
  {
    id: "a2", name: "论文润色与翻译助手", category: "科研", icon: "FileText",
    gradient: "calm",
    description: "中英文学术论文润色、摘要翻译、术语保持一致，符合 SCI/SSCI 写作风格。",
    capabilities: ["长文档", "双语", "术语库"],
    recommendedModel: "claude", knowledgeBase: "科研文献库",
    calls: 894, score: 4.9, status: "pub", creator: "李欣然", origin: "teacher", unread: 2,
  },
  {
    id: "a3", name: "学情分析助手", category: "教学", icon: "BarChart3",
    gradient: "info",
    description: "基于课堂数据与作业表现，自动生成个性化学情分析报告与教学建议。",
    capabilities: ["数据分析", "Excel 解析", "图表"],
    recommendedModel: "chatgpt", knowledgeBase: "学情数据库",
    calls: 642, score: 4.7, status: "review", creator: "教务处", origin: "school", unread: 4,
  },
  {
    id: "a4", name: "班主任事务助手", category: "行政", icon: "Users",
    gradient: "warm",
    description: "协助处理家长沟通、班会主题、学生评语撰写等日常班主任事务。",
    capabilities: ["公文模板", "知识库", "导出"],
    recommendedModel: "chatgpt", knowledgeBase: "班级管理库",
    calls: 486, score: 4.6, status: "draft", creator: "张悦", origin: "teacher", unread: 3,
  },
  {
    id: "a5", name: "新生问答助手", category: "行政", icon: "MessageCircle",
    gradient: "info",
    description: "覆盖新生入学、选课、住宿、校园生活等常见问题，自动检索学校制度库。",
    capabilities: ["学校制度", "多轮对话", "转人工"],
    recommendedModel: "minimax", knowledgeBase: "学校制度库",
    calls: 2104, score: 4.9, status: "pub", creator: "信息中心", origin: "school", unread: 1,
  },
  {
    id: "a6", name: "学校制度咨询助手", category: "行政", icon: "ShieldCheck",
    gradient: "warm",
    description: "准确解答学校规章、办事流程、教师人事政策等问题，并标注引用条款。",
    capabilities: ["制度库", "引用溯源", "审计"],
    recommendedModel: "claude", knowledgeBase: "学校制度库",
    calls: 738, score: 4.8, status: "review", creator: "校办", origin: "school", unread: 3,
  },
  {
    id: "a7", name: "实验报告评阅助手", category: "教学", icon: "CheckSquare",
    gradient: "accent",
    description: "按评分量规自动评阅学生实验报告，给出分项打分与改进建议。",
    capabilities: ["评分量规", "批改", "反馈"],
    recommendedModel: "chatgpt", knowledgeBase: "实验课程库",
    calls: 312, score: 4.5, status: "draft", creator: "陈教授", origin: "teacher", unread: 2,
  },
  {
    id: "a8", name: "PPT 大纲生成助手", category: "教学", icon: "Presentation",
    gradient: "warm",
    description: "快速生成教学课件大纲与逐页文案，可一键导出为 PPT 草稿。",
    capabilities: ["PPT 导出", "大纲", "讲稿"],
    recommendedModel: "gemini", knowledgeBase: "教学资源库",
    calls: 1024, score: 4.7, status: "disabled", creator: "刘老师", origin: "teacher", unread: 5,
  },
];
