# 学校内部专用 AI 大模型平台 Web 前端设计方案（模型广场增强版）

> 版本说明：本版在原「学校内部专用 AI 大模型平台」Web UI/UX 设计方案基础上，重点增强了 **模型广场 Model Hub** 模块，明确新增 `chatgpt`、`claude`、`gpt-image 生图`、`gemini`、`minimax` 五类模型卡片，并为每个模型配置对应图标、能力标签、状态提示与「选择模型」按钮，方便后续直接交付 UI 设计与前端开发。

---

## 一、参考材料深度分析

### 1.「后台面板数据」参考图分析

#### 布局结构

- 采用典型的 Dashboard 管理后台三栏结构：
  - 左侧：深紫色垂直侧边栏，用于一级导航。
  - 中间：主要数据展示区，包括搜索栏、统计图、数据卡片、表格列表。
  - 右侧：用户信息与辅助功能区，包括日历、提醒、状态卡片。
- 页面整体以 **大圆角卡片 + 柔和阴影 + 高留白** 为主要视觉语言，降低传统后台系统的压迫感。
- 中间区域视觉权重最大，适合作为学校 AI 平台的「平台概览」「模型使用情况」「教学应用数据」「知识库命中率」等展示区。

#### 配色风格

- 主色为深紫蓝色，接近 `#312E81`，具备专业、科技、可信赖的视觉感受。
- 辅助色使用暖黄色、浅蓝、珊瑚红，增强亲和力。
- 背景为浅灰白，卡片为纯白或近白，整体清爽。
- 部分浅灰文字对比度偏弱，最终设计中应提升可读性。

#### 可迁移价值

| 参考组件 | 观察特点 | 迁移到学校 AI 平台的方式 |
|---|---|---|
| 左侧侧边栏 | 深色背景、图标导航、结构稳定 | 首页、AI 对话、模型广场、知识库、数据看板、权限管理 |
| 顶部搜索栏 | 大圆角、轻量化 | 搜索课程、智能体、知识库、历史对话 |
| 数据图表 | 卡片化折线图 | 展示模型调用趋势、师生活跃度、Token 使用量 |
| 统计卡片 | 图标 + 数字 + 简短说明 | 今日问答数、活跃用户、上传文档数、安全拦截数 |
| 右侧栏 | 用户信息与辅助功能 | 改为「今日课程」「待办事项」「平台安全状态」 |

#### 可改进点

- 原参考图偏医疗后台，需转换为教育与 AI 平台语境。
- 缺少 AI 平台核心信息，如模型状态、知识库接入、智能体入口、调用监控。
- 右侧信息密度偏高，最终设计中应减少干扰。
- 需要强化学校内部平台的安全感与权限感。

---

### 2.「对话」参考图分析

#### 布局结构

- 采用 **顶部横栏 + 左侧图标导航 + 三栏聊天区**：
  - 左侧：联系人 / 会话列表。
  - 中间：主要聊天窗口。
  - 右侧：用户资料卡片与媒体信息。
- 对话区采用即时通讯产品常见布局，交流效率较高。
- 紫色主视觉统一，白色卡片承载主要内容，整体干净。

#### 可迁移价值

| 参考组件 | 观察特点 | 在 AI 大模型平台中的升级方向 |
|---|---|---|
| 左侧会话列表 | 类似 IM 历史会话 | 历史对话、最近使用智能体、课程助手列表 |
| 中间聊天区 | 气泡式问答 | AI 流式输出、Markdown、代码块、表格、引用来源 |
| 顶部聊天头 | 用户头像与状态 | 模型名称、模型切换、上下文长度、知识库状态 |
| 输入区 | 表情、附件、发送按钮 | 文件上传、提示词增强、语音输入、知识库引用 |
| 右侧资料卡 | 用户信息 | 当前模型信息、推荐提示词、引用资料、安全状态 |

#### 可改进点

- 原图更像普通社交聊天工具，缺少 AI 专业能力。
- 右侧用户资料价值有限，应改为「智能上下文面板」。
- 输入框功能不足，需要支持文件问答、课程资料分析、论文润色、导出等。
- 缺少引用溯源、回答质量反馈、重新生成、复制、导出 Word/PPT 等 AI 功能。

---

### 3. 登录视频参考分析

#### 视觉布局

- 登录页采用 **居中白色面板 + 左右分栏结构**：
  - 左侧为动态产品插画区；
  - 右侧为登录 / 注册表单区。
- 背景为浅灰蓝色，界面轻盈、干净、专业。
- 左侧插画通过浮动卡片、环形装饰、图标淡入淡出表达产品能力。
- 右侧表单保持稳定，降低用户登录操作负担。

#### 动效风格

- 左侧插画具有淡入淡出、轻微缩放、滑动、漂浮等效果。
- 图标和卡片存在轻微悬浮感。
- 表单切换自然，没有强烈跳变。
- 整体动效克制，适合专业系统。

#### 可改进点

- 原视频偏企业 SaaS 风格，需要增强学校身份与教育科技感。
- 登录入口需要加入学校统一身份认证、工号 / 学号登录、管理员入口。
- 动效可以加入校园轮廓、知识星轨、AI 节点、数据流光等元素。
- 需要考虑无障碍访问与低性能设备，提供减少动效策略。

---

## 二、整体设计语言 Design System

### 1. 设计定位

本平台建议采用：

> **EduAI Prism Design：学术蓝紫基调 + 玻璃拟态 + 微光粒子 + 柔和卡片 + 教育温度**

核心气质：

- **可信**：适合学校内部系统，不浮夸；
- **专业**：具备高校、科研、教学平台属性；
- **智能**：体现 AI 大模型能力；
- **温暖**：避免纯技术平台的冰冷感；
- **高端**：具备大厂级内部平台质感。

---

### 2. 色彩系统

| 类型 | 色值 | 使用场景 |
|---|---:|---|
| 主色 Primary Indigo | `#312E81` | 侧边栏、主按钮、重点导航、登录主视觉 |
| 教育蓝 Edu Blue | `#2563EB` | 链接、模型状态、教学功能入口 |
| 智能青 AI Cyan | `#06B6D4` | AI 高亮、流式输出状态、科技线条 |
| 学术紫 Academic Violet | `#7C3AED` | 高级功能、智能体、模型广场标签 |
| 成长绿 Growth Green | `#10B981` | 成功状态、知识库命中、审核通过 |
| 温暖金 Warm Gold | `#F59E0B` | 重点提醒、推荐提示词、优秀案例 |
| 风险红 Alert Red | `#EF4444` | 安全拦截、权限异常、敏感数据提醒 |
| 背景浅灰 Background | `#F7F8FC` | 页面主背景 |
| 卡片白 Card White | `#FFFFFF` | 内容卡片、表单、对话容器 |
| 深文本 Text Primary | `#111827` | 标题、正文主文字 |
| 次级文本 Text Secondary | `#6B7280` | 描述、辅助信息 |
| 边框 Border | `#E5E7EB` | 卡片边界、输入框、分割线 |

推荐主渐变：

```css
linear-gradient(135deg, #312E81 0%, #2563EB 48%, #06B6D4 100%)
```

---

### 3. 字体体系

| 场景 | 推荐字体 |
|---|---|
| 中文界面 | HarmonyOS Sans SC、思源黑体、微软雅黑 |
| 英文与数字 | Inter、SF Pro Display、Roboto |
| 代码与提示词 | JetBrains Mono、Fira Code |
| 数据看板数字 | DIN Alternate、Inter Tight |

---

### 4. 风格关键词

- **Glassmorphism**：登录页、模型卡片、快捷入口使用半透明玻璃效果。
- **Soft Neumorphism**：卡片边缘使用柔和阴影，形成轻微浮起感。
- **Minimalism**：减少无效装饰，强化信息效率。
- **Micro Glow**：AI 状态、按钮、关键节点使用微光效。
- **Edu-Tech Warmth**：科技感中保留教育温度，避免过冷、过暗、过炫。

---

## 三、完整前端设计方案

---

## 1. 全局布局与导航

### 桌面端布局

```text
┌──────────────────────────────────────────────────────────────┐
│ 顶栏：学校 Logo / 全局搜索 / 通知 / 帮助 / 用户身份             │
├──────────────┬──────────────────────────────┬────────────────┤
│ 左侧导航      │ 主内容区                       │ 右侧智能面板     │
│ 首页          │ Dashboard / Chat / Model Hub   │ 快捷提示词       │
│ AI 对话       │                              │ 当前模型状态     │
│ 模型广场      │                              │ 知识库来源       │
│ 知识库        │                              │ 安全提醒         │
│ 数据看板      │                              │                │
│ 权限管理      │                              │                │
└──────────────┴──────────────────────────────┴────────────────┘
```

### 一级导航建议

| 一级菜单 | 功能说明 |
|---|---|
| 首页 Dashboard | 平台总览、使用数据、待办事项 |
| AI 对话 | 通用大模型问答、文件问答、课程辅助 |
| 模型广场 | 不同模型、智能体、教学工具入口 |
| 提示词库 | 教案生成、试题生成、论文润色、学情分析模板 |
| 知识库 | 学校制度、课程资料、科研资料、部门文档 |
| 智能体工作台 | 班主任助手、教研助手、行政助手、科研助手 |
| 数据看板 | 使用量、活跃度、模型成本、安全审计 |
| 权限管理 | 教师、学生、管理员、学院权限 |
| 个人中心 | 账户、安全、偏好、历史记录 |

---

## 2. 登录页设计

### 页面定位

登录页是学校内部 AI 平台的第一印象，应体现：

- 学校可信身份；
- AI 科技感；
- 数据安全感；
- 操作简洁；
- 动效高级但不喧宾夺主。

### 页面结构

左侧为动态科技插画区：

- 背景为浅蓝紫渐变；
- 中心展示「校园建筑轮廓 + AI 节点网络 + 数据流光」；
- 浮动卡片展示：
  - 统一身份认证；
  - 校内知识库已加密；
  - 教师 AI 助手；
  - 学生学习助手；
  - 科研问答引擎。

右侧为登录表单区：

- 学校 LOGO + 平台名称；
- 标题：`学校内部 AI 大模型平台`；
- 副标题：`安全、可信、面向教学科研的智能助手`；
- 登录方式：
  - 学校统一身份认证 SSO；
  - 学工号 / 工号登录；
  - 企业微信 / 钉钉 / Microsoft 登录；
  - 管理员入口。

---

## 3. 后台面板 Dashboard

### 教师视角 Dashboard

| 模块 | 内容 |
|---|---|
| 今日概览 | 今日 AI 对话数、课程助手调用数、待批改任务、知识库命中率 |
| 快捷入口 | 生成教案、生成课件大纲、试题设计、作业反馈、课堂活动设计 |
| 使用趋势 | 近 7 日模型调用量、学生使用量、热门智能体 |
| 教学资源 | 最近上传课程资料、知识库更新、推荐提示词 |
| 安全与合规 | 敏感信息提醒、未授权上传拦截、模型响应风险提示 |
| 待办事项 | 待审核学生提问、待处理知识库文件、待审批智能体 |

### 管理员视角 Dashboard

| 模块 | 内容 |
|---|---|
| 平台运行状态 | 模型在线状态、响应延迟、服务可用率 |
| 用户数据 | 活跃教师、活跃学生、学院使用分布 |
| 成本监控 | Token 使用量、各模型调用成本、部门配额 |
| 内容安全 | 敏感词拦截、违规上传、异常访问 |
| 权限审批 | 新用户申请、知识库权限、模型开通申请 |
| 日志审计 | 最近登录、文件上传、模型调用记录 |

---

## 4. AI 对话聊天页

### 页面结构

```text
┌─────────────────────────────────────────────────────────────┐
│ 顶栏：模型选择 / 知识库状态 / 深度思考 / 联网 / 导出           │
├──────────────┬──────────────────────────────┬───────────────┤
│ 历史对话      │ AI 对话主区域                  │ 智能上下文面板   │
│ 最近会话      │ 消息流                         │ 模型信息         │
│ 收藏会话      │ 文件分析结果                    │ 引用来源         │
│ 智能体列表    │ 输入框                         │ 提示词推荐       │
└──────────────┴──────────────────────────────┴───────────────┘
```

### 核心功能

| 功能 | 设计说明 |
|---|---|
| 模型切换 | 支持通用模型、教学模型、科研模型、校内知识库模型 |
| 历史记录 | 按课程、日期、智能体、收藏状态筛选 |
| 提示词库 | 教案设计、试题生成、学情分析、论文润色、会议纪要 |
| 文件上传 | 支持 PDF、Word、PPT、Excel、图片，上传后自动生成摘要 |
| 实时流式输出 | AI 回答逐字生成，并显示「正在检索知识库 / 正在生成回答」 |
| 引用溯源 | 回答下方显示引用文档、页码、段落 |
| 回答操作 | 复制、重新生成、继续追问、导出 Word、生成 PPT |
| 安全提示 | 检测敏感信息上传，显示校内合规提醒 |
| 角色切换 | 教师助手、学生助手、科研助手、行政助手 |

---

# 四、模型广场 Model Hub 增强设计

> 本模块为本次新增与重点强化内容。建议将「模型广场」放在左侧一级导航中，并在 Dashboard 快捷入口、AI 对话页模型切换器中同步出现。

---

## 1. 模型广场页面定位

模型广场不是简单的模型列表，而是学校内部 AI 能力的统一入口。它需要让师生快速理解：

- 当前学校接入了哪些模型；
- 每个模型适合完成什么任务；
- 哪些模型已开通、哪些需要申请权限；
- 当前正在使用哪个模型；
- 生图模型与文本模型如何区分；
- 管理员如何进行模型权限、配额、成本与安全策略管理。

---

## 2. 模型广场推荐布局

```text
┌──────────────────────────────────────────────────────────────┐
│ 顶部：模型广场标题 / 搜索模型 / 类型筛选 / 权限筛选             │
├──────────────────────────────────────────────────────────────┤
│ 精选推荐区：当前推荐模型 + 适合教学 / 科研 / 管理的模型          │
├──────────────────────────────────────────────────────────────┤
│ 模型卡片网格：ChatGPT / Claude / GPT-Image / Gemini / MiniMax │
├──────────────────────────────────────────────────────────────┤
│ 底部说明：模型使用规范 / 数据安全提示 / 申请开通入口             │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 模型卡片设计规范

每个模型卡片建议包含以下元素：

| 元素 | 说明 |
|---|---|
| 模型图标 | 使用官方品牌图标或抽象图标，保持一致尺寸与圆角容器 |
| 模型名称 | 如 ChatGPT、Claude、GPT-Image 生图、Gemini、MiniMax |
| 类型标签 | 文本对话、多模态、生图、长文本、中文优化等 |
| 适用场景 | 教案生成、论文润色、文献分析、课件生图、代码辅助等 |
| 状态提示 | 已开通、需申请、维护中、管理员可见 |
| 选择按钮 | 「选择模型」「已选用」「申请开通」「进入生图」 |
| 安全提示 | 是否接入校内知识库、是否允许上传文件、是否可导出 |

---

## 4. 五类模型卡片内容设计

> 注：以下「能力标签」用于 UI 信息架构展示，实际模型能力、权限与可用范围应以后端接入、学校采购和安全策略配置为准。

| 模型 | 图标建议 | 主色 | 类型标签 | 适合场景 | 按钮文案 |
|---|---|---:|---|---|---|
| chatgpt | 结环 / 智能节点图标 | `#10A37F` | 通用问答、长文本、代码辅助 | 教案生成、课堂活动设计、论文润色、代码解释、长文档总结 | 选择模型 |
| claude | 文档思考 / 长文本图标 | `#D97757` | 长文本、学术写作、严谨推理 | 长文档分析、论文逻辑优化、课程方案润色、材料归纳 | 选择模型 |
| gpt-image 生图 | 图片生成 / 画笔闪光图标 | `#7C3AED` + `#06B6D4` | AI 生图、课件视觉、海报设计 | 教学插图、课件页面图、科研示意图、活动海报、视觉素材生成 | 进入生图 |
| gemini | 双星 / 菱形多模态图标 | `#4285F4` + `#A855F7` | 多模态、图文理解、综合分析 | 图片理解、资料分析、多模态学习辅助、跨格式内容整理 | 选择模型 |
| minimax | 多节点 / 对话波形图标 | `#2563EB` + `#F59E0B` | 中文场景、对话生成、应用接入 | 中文问答、校园服务助手、角色化问答、轻量化应用集成 | 选择模型 |

---

## 5. 模型广场卡片视觉方案

### 卡片默认态

- 白色或半透明玻璃卡片；
- 圆角 24px；
- 轻微阴影；
- 顶部左侧为模型图标；
- 顶部右侧为状态 Badge；
- 中部展示模型名称、简介和标签；
- 底部为「选择模型」主按钮。

### 卡片 Hover 态

- 卡片轻微上浮 `translateY(-4px)`；
- 边框出现模型主色微光；
- 图标容器出现轻微渐变光晕；
- 按钮从浅色变为主渐变色。

### 已选择态

- 卡片边框变为主色 `#2563EB`；
- 右上角 Badge 显示「当前使用」；
- 按钮显示「已选用」；
- 卡片背景出现极浅蓝色渐变。

### 未开通态

- 卡片透明度降低到 70%；
- 状态 Badge 显示「需申请」；
- 按钮显示「申请开通」；
- 点击后弹出权限申请弹窗。

---

## 6. 模型广场在全平台中的出现位置

| 出现位置 | 展示方式 | 交互目的 |
|---|---|---|
| 左侧一级导航 | 菜单项「模型广场」 | 进入完整模型管理页 |
| Dashboard 快捷入口 | 3–5 个推荐模型小卡片 | 快速选择常用模型 |
| AI 对话页顶部 | 模型下拉选择器 | 在对话中快速切换模型 |
| AI 对话页右侧面板 | 当前模型详情卡 | 查看能力、权限、知识库状态 |
| 管理员后台 | 模型权限与成本配置表 | 管理可用范围、配额与安全策略 |

---

## 7. 模型广场页面文案建议

页面标题：

```text
模型广场
选择适合教学、科研与管理任务的 AI 能力
```

页面副标题：

```text
学校已接入多类 AI 模型，可根据任务类型选择通用问答、长文本分析、多模态理解或图像生成能力。所有模型调用均受校内权限与数据安全策略保护。
```

顶部筛选项：

- 全部模型
- 文本对话
- 长文本分析
- 多模态理解
- AI 生图
- 校内知识库
- 已开通
- 需申请

安全提示：

```text
请根据任务选择合适模型。涉及学生隐私、考试数据、未公开科研资料等内容时，应优先使用已接入校内安全策略的模型，并遵守学校数据安全规范。
```

---

## 8. 模型广场核心组件数据结构

```ts
export type ModelProvider =
  | "chatgpt"
  | "claude"
  | "gpt-image"
  | "gemini"
  | "minimax";

export type ModelStatus = "available" | "selected" | "request" | "disabled";

export interface ModelCardItem {
  id: ModelProvider;
  name: string;
  displayName: string;
  description: string;
  iconType: "node" | "document" | "image" | "spark" | "workflow";
  color: string;
  gradient: string;
  tags: string[];
  scenarios: string[];
  status: ModelStatus;
  actionText: string;
}
```

---

## 9. 模型广场核心前端代码示例

```tsx
"use client";

import {
  Sparkles,
  FileText,
  ImagePlus,
  Gem,
  Network,
  CheckCircle2,
  LockKeyhole,
  ArrowRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const models = [
  {
    id: "chatgpt",
    name: "chatgpt",
    displayName: "ChatGPT",
    description: "适合通用问答、教学设计、论文润色、代码解释与长文本总结。",
    icon: Sparkles,
    color: "#10A37F",
    gradient: "from-emerald-500 to-teal-400",
    tags: ["通用问答", "长文本", "代码辅助"],
    scenarios: ["教案生成", "课堂活动", "论文润色"],
    status: "selected",
    actionText: "已选用",
  },
  {
    id: "claude",
    name: "claude",
    displayName: "Claude",
    description: "适合长文档分析、学术写作、逻辑梳理与高质量文本润色。",
    icon: FileText,
    color: "#D97757",
    gradient: "from-orange-500 to-amber-400",
    tags: ["长文本", "学术写作", "严谨推理"],
    scenarios: ["论文优化", "方案润色", "材料归纳"],
    status: "available",
    actionText: "选择模型",
  },
  {
    id: "gpt-image",
    name: "gpt-image 生图",
    displayName: "GPT-Image 生图",
    description: "适合生成课件图像、教学插图、科研示意图、活动海报等视觉素材。",
    icon: ImagePlus,
    color: "#7C3AED",
    gradient: "from-violet-600 to-cyan-400",
    tags: ["AI 生图", "课件视觉", "海报设计"],
    scenarios: ["教学插图", "科研图示", "活动海报"],
    status: "available",
    actionText: "进入生图",
  },
  {
    id: "gemini",
    name: "gemini",
    displayName: "Gemini",
    description: "适合图文理解、多模态分析、跨格式资料整理与综合学习辅助。",
    icon: Gem,
    color: "#4285F4",
    gradient: "from-blue-500 to-purple-500",
    tags: ["多模态", "图文理解", "综合分析"],
    scenarios: ["图片理解", "资料分析", "学习辅助"],
    status: "available",
    actionText: "选择模型",
  },
  {
    id: "minimax",
    name: "minimax",
    displayName: "MiniMax",
    description: "适合中文场景问答、校园服务助手、角色化对话与轻量化应用接入。",
    icon: Network,
    color: "#2563EB",
    gradient: "from-blue-600 to-amber-400",
    tags: ["中文场景", "对话生成", "应用接入"],
    scenarios: ["校园问答", "角色助手", "服务咨询"],
    status: "request",
    actionText: "申请开通",
  },
];

export default function ModelHubPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FC] p-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
              <Sparkles className="h-4 w-4" />
              EduAI Model Hub
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-gray-950">
              模型广场
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500">
              选择适合教学、科研与管理任务的 AI 能力。所有模型调用均受校内权限与数据安全策略保护。
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex h-11 w-72 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm text-gray-500 shadow-sm">
              <Search className="h-4 w-4" />
              搜索模型或能力
            </div>
            <Button variant="outline" className="h-11 rounded-2xl">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              筛选
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {["全部模型", "文本对话", "长文本分析", "多模态理解", "AI 生图", "已开通", "需申请"].map(
            (filter, index) => (
              <button
                key={filter}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  index === 0
                    ? "bg-[#312E81] text-white shadow-lg"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-700"
                }`}
              >
                {filter}
              </button>
            )
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {models.map((model, index) => {
            const Icon = model.icon;
            const selected = model.status === "selected";
            const request = model.status === "request";

            return (
              <motion.article
                key={model.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                whileHover={{ y: -4 }}
                className={`group relative overflow-hidden rounded-[28px] border bg-white p-6 shadow-sm transition-all hover:shadow-xl ${
                  selected
                    ? "border-blue-400 bg-gradient-to-br from-blue-50 to-white"
                    : "border-gray-200"
                } ${request ? "opacity-90" : ""}`}
              >
                <div
                  className={`absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br ${model.gradient} opacity-10 blur-2xl transition group-hover:opacity-20`}
                />

                <div className="relative z-10 mb-5 flex items-start justify-between">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${model.gradient} text-white shadow-lg`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      selected
                        ? "bg-blue-100 text-blue-700"
                        : request
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {selected ? "当前使用" : request ? "需申请" : "已开通"}
                  </span>
                </div>

                <div className="relative z-10">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    {model.name}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-950">
                    {model.displayName}
                  </h2>
                  <p className="mt-3 min-h-[52px] text-sm leading-7 text-gray-500">
                    {model.description}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {model.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                    <p className="mb-2 text-xs font-medium text-gray-400">
                      推荐场景
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {model.scenarios.map((scenario) => (
                        <span key={scenario}>#{scenario}</span>
                      ))}
                    </div>
                  </div>

                  <Button
                    className={`mt-6 h-11 w-full rounded-2xl ${
                      selected
                        ? "bg-blue-600 hover:bg-blue-600"
                        : request
                        ? "bg-amber-500 hover:bg-amber-600"
                        : `bg-gradient-to-r ${model.gradient}`
                    }`}
                  >
                    {selected ? (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    ) : request ? (
                      <LockKeyhole className="mr-2 h-4 w-4" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    {model.actionText}
                  </Button>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-8 rounded-[24px] border border-blue-100 bg-blue-50/70 p-5 text-sm leading-7 text-blue-900">
          <strong>安全提示：</strong>
          请根据任务选择合适模型。涉及学生隐私、考试数据、未公开科研资料等内容时，应优先使用已接入校内安全策略的模型，并遵守学校数据安全规范。
        </div>
      </section>
    </main>
  );
}
```

---

## 10. AI 对话页中的模型选择下拉设计

为了让「模型广场」与「AI 对话页」形成闭环，建议在对话页顶部增加模型选择器：

```text
当前模型：ChatGPT  ▼
状态：已连接校内知识库
能力：长文本 / 文件问答 / 教学设计
```

点击后弹出迷你模型选择面板：

```text
┌──────────────────────────────┐
│ 选择模型                      │
├──────────────────────────────┤
│ ChatGPT        已选用         │
│ Claude         选择           │
│ GPT-Image 生图  进入生图       │
│ Gemini         选择           │
│ MiniMax        申请开通       │
└──────────────────────────────┘
```

交互建议：

- 选择文本模型后，当前对话继续进行；
- 选择 `gpt-image 生图` 后，输入框占位符变为「描述你想生成的教学图像、课件页面或海报」；
- 未开通模型点击后弹出「申请开通」弹窗；
- 管理员可在权限管理中配置模型是否对学生、教师、学院管理员开放。

---

# 五、其他必要页面

| 页面 | 功能定位 |
|---|---|
| 提示词中心 | 按教学、科研、管理、学习四类沉淀高质量 Prompt |
| 知识库管理 | 上传课程资料、制度文件、学院文档，并设置权限 |
| 智能体工作台 | 创建专属智能体，例如「高数助教」「论文润色助手」「教案生成助手」 |
| 历史对话 | 检索、收藏、导出、归档所有 AI 对话 |
| 权限管理 | 分配教师、学生、学院管理员、系统管理员权限 |
| 数据分析 | 查看模型调用、知识库命中、用户活跃、成本消耗 |
| 安全审计 | 查看敏感数据检测、异常访问、违规内容拦截 |
| 个人中心 | 账户资料、登录设备、偏好设置、常用模型、快捷提示词 |

---

# 六、关键组件库规范

| 组件 | 设计规范 |
|---|---|
| Button 按钮 | 主按钮使用蓝紫渐变，圆角 12px；次级按钮白底描边；危险按钮红色 |
| Model Card 模型卡片 | 图标容器 + 状态 Badge + 标签 + 推荐场景 + 选择按钮 |
| Card 卡片 | 白底、16–28px 圆角、柔和阴影、边框 `#E5E7EB` |
| Sidebar 侧栏 | 深紫蓝渐变背景，支持展开 / 收起，当前项有微光高亮 |
| Topbar 顶栏 | 半透明白色玻璃效果，支持全局搜索与通知 |
| Chat Bubble 对话气泡 | 用户气泡用主色渐变，AI 气泡白底卡片，支持 Markdown |
| Input 输入框 | 大圆角、浅灰背景、聚焦时蓝色描边与微光 |
| Stats Card 数据卡 | 图标 + 数字 + 趋势标签，适合 Dashboard |
| Tag 标签 | 用于模型能力、权限、状态，例如「校内知识库」「教师可用」 |
| Modal 弹窗 | 玻璃拟态背景遮罩，弹窗卡片轻微缩放进入 |
| Table 表格 | 高行距、悬浮高亮、支持筛选与批量操作 |

---

# 七、交互与动效设计

## 1. 登录页动效

```text
校园轮廓线稿 → AI 节点点亮 → 教学/科研/管理卡片浮现 → 数据流进入平台 → 登录成功进入 Dashboard
```

动效细节：

- 粒子以低透明度漂浮，不抢占表单注意力；
- 卡片采用错层出现，延迟 100ms–200ms；
- 登录按钮 hover 时出现蓝青色外发光；
- 登录成功时，按钮变为「正在进入平台...」，随后页面整体向上淡出。

---

## 2. Dashboard 动效

- 数据卡片进入页面时从下方 12px 淡入；
- 图表加载时采用渐进绘制；
- 表格行 hover 时轻微抬升；
- 重要提醒卡片使用极弱呼吸光效，不闪烁。

---

## 3. 对话页动效

- AI 回答采用流式输出；
- 正在生成时显示「正在理解问题」「正在检索校内知识库」「正在生成回答」；
- 上传文件时显示拖拽高亮与解析进度；
- 引用来源卡片点击后右侧面板滑出详情；
- 模型切换使用下拉菜单淡入，不打断当前对话。

---

## 4. 模型广场动效

| 动效对象 | 动效说明 |
|---|---|
| 模型卡片进入 | 依次淡入，形成高级的展示节奏 |
| 模型卡片 Hover | 轻微上浮 + 图标光晕增强 |
| 选择按钮 Hover | 渐变光效从左向右流动 |
| 当前模型卡片 | 边框微光常亮，不闪烁 |
| 申请开通弹窗 | 背景轻微模糊，弹窗缩放进入 |
| gpt-image 生图入口 | 点击后可进入生图工作台，页面顶部出现画布式输入区 |

---

# 八、技术实现建议

## 推荐技术栈

| 技术 | 用途 | 推荐原因 |
|---|---|---|
| Next.js 15 | 前端框架 | 适合企业级平台、路由清晰、SSR/ISR 能力强 |
| TypeScript | 类型系统 | 提升大型项目可维护性 |
| Tailwind CSS | 样式系统 | 快速实现高质量 UI，便于统一设计规范 |
| shadcn/ui | 组件基础 | 组件现代、可定制、适合后台与 AI 产品 |
| Framer Motion | 动效 | 登录页、卡片、对话流式动效表现优秀 |
| Zustand | 前端状态管理 | 适合模型选择、用户偏好、对话状态 |
| TanStack Query | 数据请求 | 管理接口缓存、重试、加载状态 |
| TanStack Table | 表格 | 权限管理、日志审计、用户管理 |
| Recharts / ECharts | 图表 | Dashboard 数据可视化 |
| React Hook Form + Zod | 表单校验 | 登录、权限配置、智能体创建 |
| Auth.js / NextAuth | 登录认证 | 适配 SSO、OAuth、学校统一身份认证 |
| PostgreSQL + Prisma | 数据层 | 适合用户、权限、知识库、日志管理 |
| SSE / WebSocket | 流式输出 | 支持 AI 实时生成回答 |
| MinIO / S3 | 文件存储 | 存储课程资料、知识库文件、上传附件 |

---

## 模型选择状态管理建议

建议使用 Zustand 管理当前模型状态：

```ts
import { create } from "zustand";

type ModelId = "chatgpt" | "claude" | "gpt-image" | "gemini" | "minimax";

interface ModelStore {
  currentModel: ModelId;
  setCurrentModel: (model: ModelId) => void;
}

export const useModelStore = create<ModelStore>((set) => ({
  currentModel: "chatgpt",
  setCurrentModel: (model) => set({ currentModel: model }),
}));
```

---

# 九、Figma 设计规范建议

建议在 Figma 中建立以下页面：

| 页面 | 内容 |
|---|---|
| 00 Design Tokens | 色彩、字体、圆角、阴影、间距 |
| 01 Components | Button、Card、Input、Sidebar、Chat Bubble、Model Card、Modal |
| 02 Login | 登录页默认态、加载态、错误态、成功态 |
| 03 Dashboard | 教师版、管理员版、学生版 |
| 04 Chat | 默认对话、文件问答、知识库问答、流式输出 |
| 05 Model Hub | 模型广场、模型卡片、选择态、申请态、生图入口 |
| 06 Knowledge Base | 文件上传、权限设置、知识库详情 |
| 07 Admin | 用户管理、权限管理、模型权限、日志审计 |
| 08 Mobile | 移动端关键页面 |

### 模型广场 Figma 组件命名

```text
ModelCard/Default
ModelCard/Selected
ModelCard/RequestAccess
ModelCard/Disabled
ModelIcon/ChatGPT
ModelIcon/Claude
ModelIcon/GPTImage
ModelIcon/Gemini
ModelIcon/MiniMax
ModelFilter/Chip
ModelSelector/Dropdown
```

---

# 十、最终设计总结

本增强版方案将「模型广场」从一个普通列表升级为学校内部 AI 平台的核心能力入口，重点完成了以下优化：

- 新增 `chatgpt`、`claude`、`gpt-image 生图`、`gemini`、`minimax` 五类模型；
- 每个模型均配置对应图标、主色、能力标签、适用场景和选择按钮；
- 将模型选择能力贯穿 Dashboard、AI 对话页、模型广场与权限管理；
- 明确区分文本模型、多模态模型与生图模型；
- 增加「已开通」「当前使用」「需申请」等状态设计；
- 补充前端数据结构与可直接使用的 React/Tailwind 代码示例；
- 保留学校内部平台所需的安全、隐私、权限、合规设计。

最终呈现效果应是：

> 一个既有高校专业气质，又有 AI 科技未来感，同时支持多模型选择、权限控制、教学科研应用和安全合规管理的学校内部 AI 大模型平台。

