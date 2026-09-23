// 管理端**界面示例**数据（渲染处均有「界面示例」常驻声明，不冒充真实统计）。
//
// 色彩第五批的处置顺序是「**先判生死，再谈迁移**」——本文件原有 29 处裸 hex，
// 其中 15 处属于 COLLEGES / DAILY_USAGE / AI_ACCURACY / TOP_AGENTS 四个
// **零外部引用**的导出。给不该存在的代码改颜色是白费力气，直接整块删除。
// 剩下的按用途分流：图表色走 CHART_PALETTE，表达归属的色收敛为强调色令牌。

import type { AuditRow, FunnelStage } from "@/lib/types";
import { chartColor } from "@/lib/data/gradientKeys";

export const SYSTEM_HEALTH = [
  { name: "ChatGPT",     state: "online" as const,  latency: "1.2s" },
  { name: "Claude",      state: "online" as const,  latency: "1.6s" },
  { name: "Gemini",      state: "online" as const,  latency: "1.4s" },
  { name: "MiniMax",     state: "online" as const,  latency: "0.9s" },
  { name: "GPT-Image",   state: "busy" as const,    latency: "6.8s" },
  { name: "知识库检索",  state: "online" as const,  latency: "0.3s" },
  { name: "文件解析队列", state: "busy" as const,   latency: "积压 12" },
  { name: "向量存储",     state: "online" as const, latency: "—" },
];

export const AUDIT_LOG: AuditRow[] = [
  { when: "14:32:18", who: "王思远", role: "教师·计算机", op: "调用模型 Claude", resource: "信息科技教案助手", risk: "low", state: "handled" },
  { when: "14:30:42", who: "未知IP", role: "异地登录尝试", op: "账号登录失败",   resource: "账号 zh-yiming@xidian.edu.cn", risk: "high", state: "pending" },
  { when: "14:28:11", who: "李欣然", role: "教师·外语",    op: "上传文件",       resource: "《大学英语期末试题草稿》", risk: "mid", state: "pending" },
  { when: "14:26:03", who: "张悦",   role: "学生·研究生",  op: "导出对话记录",   resource: "论文润色助手会话 · 12 页", risk: "low", state: "handled" },
  { when: "14:23:55", who: "系统",   role: "敏感词拦截",   op: "AI 输出内容审查", resource: "被拦截：包含学生隐私信息", risk: "high", state: "handled" },
  { when: "14:21:09", who: "陈教授", role: "教师·物光",    op: "修改知识库权限", resource: "科研文献库 → 学院共享", risk: "mid", state: "pending" },
  { when: "14:18:34", who: "admin", role: "系统管理员",    op: "停用智能体",     resource: "老旧课程问答助手 v1", risk: "low", state: "handled" },
  { when: "14:15:22", who: "刘子涵", role: "学生·本科",    op: "超额调用模型",   resource: "今日已达 100 次上限", risk: "mid", state: "pending" },
  { when: "14:12:08", who: "周明",   role: "教师·机电",    op: "新建智能体",     resource: "实验报告评阅助手 v2", risk: "low", state: "handled" },
  { when: "14:08:55", who: "教务处", role: "学院管理员",   op: "调整学院额度",   resource: "外国语学院 Token 配额 +20%", risk: "low", state: "handled" },
];

// color 字段已删：全站只读 .value（admin/models「本月调用占比」），5 个厂牌色 hex 从未被渲染过。
export const USAGE_SHARE = [
  { name: "Claude Sonnet", value: 38 },
  { name: "ChatGPT",       value: 28 },
  { name: "Gemini",        value: 14 },
  { name: "MiniMax",       value: 12 },
  { name: "GPT-Image",     value:  8 },
];

export const QUOTA_ALERTS = [
  { name: "经济管理学院", type: "学院月度额度",   percent: 92, value: "3,680 / 4,000 次" },
  { name: "刘子涵",      type: "学生·每日 100 次", percent: 87, value: "87 / 100" },
  { name: "科研处",      type: "GPT-Image 月度",   percent: 78, value: "234 / 300" },
  { name: "外国语学院",   type: "Claude Token 配额", percent: 64, value: "32.1M / 50M" },
];

// AI 回答采纳漏斗（对标 AIRecruit360 Candidate Conversion）
export const ADOPTION_FUNNEL: FunnelStage[] = ([
  { stage: "学生/教师提问", value: 8412 },
  { stage: "AI 有效回答",   value: 7960 },
  { stage: "采纳并应用",     value: 6231 },
  { stage: "收藏 / 分享",    value: 2870 },
] as const).map((s, i) => ({ ...s, color: chartColor(i) }));

// Permission management mock
export type RoleId = "sysadmin" | "college-admin" | "teacher" | "student" | "guest";

// 角色徽标配色。原本是五个色相（红/琥珀/蓝/青/灰）一一对应五个角色——
// 这是 §3.1 R1 明令禁止的**用颜色表达归属**，且角色名就印在同一行、选中态另有边框+ring，
// 颜色是第三次编码同一件事。同一条禁令已在 prompts.ts 与 db.ts 执行过两次，这是第三处。
//
// ⚠️ 顺带拆掉一个隐藏耦合：渲染处写的是 `background: r.color + "22"`，
// 用**字符串拼接**给 hex 补一段 13% 透明度。这意味着「`color` 必须是 6 位 hex」这个约束
// 只存在于渲染点、不在类型里；一旦这里改成 `var(--x)`，就会拼出 `var(--x)22` 这种非法值，
// 背景**静默消失**而没有任何报错。所以字段一分为二：`tint`（底）与 `ink`（字），
// 两者各自完整、渲染处不再做任何字符串运算。
export const ROLES: { id: RoleId; name: string; description: string; userCount: number; tint: string; ink: string }[] = [
  { id: "sysadmin", name: "系统管理员",   description: "全平台管理 + 模型配置 + 日志审计", userCount: 4, tint: "var(--accent-tint)", ink: "var(--accent-focus)" },
  { id: "college-admin", name: "学院管理员", description: "本学院用户 + 知识库 + 智能体管理", userCount: 18, tint: "var(--accent-tint)", ink: "var(--accent-focus)" },
  { id: "teacher", name: "教师",         description: "AI 对话 + 课程知识库 + 智能体创建", userCount: 412, tint: "var(--accent-tint)", ink: "var(--accent-focus)" },
  { id: "student", name: "学生",         description: "AI 对话 + 学习助手 + 指定知识库", userCount: 3284, tint: "var(--accent-tint)", ink: "var(--accent-focus)" },
  { id: "guest",   name: "访客",         description: "仅可访问公开资源或试用功能", userCount: 26, tint: "var(--accent-tint)", ink: "var(--accent-focus)" },
];

export const ROLE_USERS: { name: string; id: string; college: string; role: RoleId; status: "active" | "disabled" }[] = [
  { name: "王思远", id: "T2018042", college: "计算机学院", role: "teacher", status: "active" },
  { name: "李欣然", id: "T2019118", college: "外国语学院", role: "teacher", status: "active" },
  { name: "陈教授", id: "T2015007", college: "物理与光电学院", role: "teacher", status: "active" },
  { name: "张悦",  id: "S2024031", college: "经济管理学院", role: "student", status: "active" },
  { name: "刘子涵", id: "S2025102", college: "信息工程学院", role: "student", status: "disabled" },
  { name: "教务处", id: "ADM0042", college: "教务处",      role: "college-admin", status: "active" },
  { name: "周明",   id: "T2020220", college: "机电工程学院", role: "teacher", status: "active" },
  { name: "admin", id: "SYS0001", college: "信息中心",     role: "sysadmin", status: "active" },
];
