# EduAI Prism「鲁班 7 号」登录后界面前端 UI 开发文档 v1.2

> 面向：校内 AI 大模型平台登录后的用户端、教师端、科研端、管理端全界面  
> 目标：在现有 EduAI Prism 设计 token 和 Next 16 前端工程基础上，形成高保真、高复原、可验收、可持续迭代的 UI 实施契约  
> 版本：v1.2，基于 v1.1 深化为执行版  
> 关键决策：新文档不覆盖 v1.1；学生端默认落地 `/explore`；本轮文档先行，不实际生成图片资产；产品不做付费版本，不出现订阅、价格墙、升级诱导  
> 适用代码库：`D:/VB/LLM-School/app`，Next 16 + React 19 + Tailwind 4 + Radix/shadcn + motion + recharts + three/@react-three

---

## 0. 执行摘要

EduAI Prism 登录后界面的核心不是“做一套漂亮后台”，而是建立一套能同时服务学生、教师、科研人员和管理员的校园 AI 工作台。它要在严肃可信和活泼留存之间保持统一：管理端必须像控制台一样克制、密集、可靠；学生端和 AI 探索场景必须更有温度、更有鼓励感、更有持续使用的理由。

最终设计策略命名为 **Dual-Register Unity，双调统一**：

- **Console 控制台调**：用于 `/admin/*`、权限、审计、模型运行、数据看板。关键词是可信、低噪、表格优先、状态明确、零玩具感。
- **Campus 校园调**：用于 `/explore`、`/chat`、`/hub`、`/profile` 成就区、智能体探索等场景。关键词是温暖、鼓励、轻游戏化、角色陪伴、真实产出绑定。
- 两调不是两套 UI。它们共用品牌色、字体栈、图标库、动效曲线、明暗机制、8pt 栅格，只通过容器级 `data-register="console|campus"` 改变圆角、内边距、饱和度、动效幅度、插画密度和微文案语气。

本产品不做付费版本，因此留存不靠价格墙，而靠：

- 首登 60 秒内完成第一次有价值 AI 输出。
- 学生从 `/explore` 进入，看到任务、进度、成就和同伴排行。
- 教师从 `/dashboard` 进入，直接处理教案、试题、学情、知识库和近期会话。
- 管理员从 `/admin/analytics` 进入，直达运行态势、审计、权限和模型健康。
- 所有 AI 输出都显式呈现校内安全策略、引用来源和数据存校内的信任信号。

---

## 1. 当前工程事实和 v1.2 落地边界

### 1.1 已确认工程事实

从 `D:/VB/LLM-School/app/package.json` 与实际路由读取到：

- 技术栈已存在：Next `16.2.6`、React `19.2.4`、Tailwind 4、Radix/shadcn、`motion`、`recharts`、`three`、`@react-three/fiber`、`zustand`、`cmdk`、`sonner`。
- 已有登录后路由：`/dashboard`、`/explore`、`/chat`、`/hub`、`/prompts`、`/knowledge`、`/agent`、`/profile`、`/admin/analytics`、`/admin/agents`、`/admin/audit`、`/admin/models`、`/admin/permissions`。
- 已有 3D 模型资源：`app/public/3d/chatgpt.glb`、`claude.glb`、`gemini.glb`、`deepseek.glb`、`glm.glb`、`shude.glb`、`globe.glb`。
- `app/app/globals.css` 已有品牌色、模型色、pastel tokens、`@custom-variant campus`、动效 token、`surface-card`、`surface-card-lg`、`.glass`、reduced-motion CSS。
- `/explore` 已实现 `data-register="campus"`，适合作为学生端默认落地页。

### 1.2 本文档不是从零设计

v1.2 的原则是 **只增不改、贴合现状、补齐契约**：

- 不新起设计系统。
- 不推翻现有组件目录和路由。
- 不将参考图逐像素照搬。
- 不新增付费、订阅、价格对比、升级诱导相关 UI。
- 不要求本轮生成图片资产，但给出可直接用于 GPT 生图/Nano-Banana/Gemini 的 prompt 与验收标准。

### 1.3 当前差距矩阵

| 范围 | 现状 | v1.2 要求 | 优先级 |
|---|---|---|---|
| `data-register` | 主要在 `/explore` 使用 | Shell 按路由或页面容器明确落 `console/campus`，避免组件各自猜调性 | P0 |
| 语义 token | `globals.css` 有品牌/pastel，语义状态色不完整 | 补齐 `--ok-*`、`--warn-*`、`--err-*`、`--info-*`、`--proc-*`，文字使用 `-ink` | P0 |
| 硬编码色值 | Dashboard、Hub、Chat、Admin 多处 `#EEF2FF`、`#F8FAFF`、渐变 | 常用色抽象到 token 或组件 variant，保留必要模型品牌色 | P1 |
| reduced motion | CSS 层存在，部分 3D 手动处理 | 所有 JS `motion` 动画使用 `useReducedMotion()` 或等效逻辑 | P0 |
| 卡片层级 | 多页面大量同款白卡 | 建立主卡、内容卡、信息卡三档，避免“一屏等大白卡” | P1 |
| 管理端调性 | 部分 KPI 使用大渐变 | Console 下减少大面积渐变，表格/数据/状态优先 | P1 |
| 学生留存 | `/explore` 已有任务、成就、排行雏形 | 将 `/explore` 固化为学生首屏，补首登引导与 first value 目标 | P0 |
| 无障碍契约 | 部分组件已有 `role="meter"` 等 | 为 Chat、Table、CommandPalette、Toast、Tabs、Tree、Kanban 补完整键盘/ARIA 契约 | P0 |
| 视觉资产 | 已有 GLB，无统一位图角色体系 | 文档先行，先做鲁班基因板，再批量输出角色/徽章/空状态 | P2 |
| 审阅机制 | v1.1 已有三方审阅文字 | 执行阶段用截图、lint/build、a11y、手动 review gate 形成证据 | P0 |

---

## 2. 参考图深度解析与取舍

参考图位于 `D:/VB/LLM-School/开发材料/UI界面/`：

- `AI界面全面板.png`，1905x1429
- `后台对用户管理界面.png`，1316x888
- `对话.png`，1071x705
- `用户画像.png`，1176x822
- `后台面板数据.png`，1314x924

抽样主色事实：五张图都以白底/浅灰底卡片为主体；深紫/靛蓝出现在导航或对话气泡；蓝色常做主按钮和选中态；琥珀、粉、青、绿只作为小面积状态或分类点缀。这与 EduAI Prism 的 `#312E81` 深靛蓝、`#2563EB` 教育蓝、`#06B6D4` 青色和 `#F59E0B` 琥珀金天然吻合。

### 2.1 AIRecruit360：管理端骨架

可借鉴：

- 左侧固定导航、顶部标题/主操作、主内容卡片网格。
- KPI、面积图、柱图、甜甜圈、gauge 的数据层级。
- 右侧会话历史/筛选栏与主区并列的 SaaS 工作台结构。
- 单一蓝色主强调，状态色只用于 badge 和小面积反馈。

不照搬：

- 招聘语义。
- 过度冷淡的企业 SaaS 白底风。
- 管理端所有卡片都使用大渐变、头像、插图。

落地到 EduAI：

- `/admin/analytics`、`/admin/models`、`/admin/audit` 采用 AIRecruit360 的信息密度和数据组织。
- `/chat` 的右栏借鉴“会话/上下文/推荐动作”结构，但内容改为模型状态、引用来源、推荐提示词、安全状态。

### 2.2 Medita：首页友好专业中点

可借鉴：

- 深靛蓝导航与琥珀金暖强调的 duotone。
- 主图表 + 侧栏信息密集区。
- 大圆角、柔和阴影、渐隐面积图。
- 日历、课程、提醒类信息的分区方式。

不照搬：

- 医疗语义。
- 琥珀金作为唯一主色。
- 过大的侧栏圆角和信用卡式装饰泛用。

落地到 EduAI：

- `/dashboard` 教师视角采用 Medita 的“友好专业”中点：比 admin 温暖，比 student 克制。
- KPI 可增加 sparkline，但不可为了装饰牺牲可读性。

### 2.3 Hawk：状态流转和分类色

可借鉴：

- 看板列、状态流转、类别色丸标签。
- 头像堆叠、进度条、虚线空位。
- 明暗切换入口。

不照搬：

- 管理端默认拖拽看板。
- 通用项目管理语言。
- 过多彩色列导致后台玩具化。

落地到 EduAI：

- `/admin/agents` 和 `/prompts` 可提供“审核流转”视图，但默认应是表格或列表。
- 状态流转采用按钮/菜单驱动的状态机，不用拖拽作为审批主路径。

### 2.4 Purple Chat：对话三栏和输入体验

可借鉴：

- 会话列表/消息流/右侧资料卡的三栏结构。
- 气泡、反应、附件、语音、发送按钮。
- 在线状态和资料上下文。

不照搬：

- 满屏高饱和紫。
- 社交 IM 语义。
- 人物资料卡作为右栏主体。

落地到 EduAI：

- `/chat` 三栏结构成立：左侧会话史、中间消息流、右侧 AI 上下文。
- 右侧栏不展示“联系人”，而展示当前模型、引用来源、推荐提示词、安全状态和导出动作。

### 2.5 Dei：学生端留存与角色感

可借鉴：

- 深色顶导航与浅色内容面板的对比。
- 3D 角色卡、排行榜、完成度、成就徽章。
- pastel 分类色和大圆角卡片。

不照搬：

- 3D 角色铺满全部页面。
- 空洞积分或焦虑式打卡。
- 管理端使用可爱角色。

落地到 EduAI：

- `/explore` 和 `/profile` 成就区承接 Dei 的游戏化结构。
- 鲁班机器人只出现在 Campus 高光位、空状态、首登引导和成就庆祝。
- 成就必须绑定真实学习/教学产出，例如完成探索任务、生成教案、解决问题、整理知识库。

### 2.6 统一提炼

| 参考方向 | EduAI 吸收 | EduAI 克制 |
|---|---|---|
| AIRecruit360 | 管理端框架、KPI、gauge、AI Chat 三件套 | 不把学生端做冷 |
| Medita | Dashboard 的 navy + 暖强调 + 圆润专业感 | 不医疗化，不让金色抢品牌 |
| Hawk | 状态流转、类别色、明暗切换 | 审批不用拖拽主路径 |
| Purple Chat | 三栏对话、输入工具条、反应操作 | 不做社交 IM |
| Dei | 学生探索、成就、排行、3D 角色 | 不让游戏化侵入管理端 |

---

## 3. 设计哲学：Dual-Register Unity

### 3.1 产品世界

EduAI Prism 的物理隐喻不是“普通 SaaS 后台”，而是一所学校里的 AI 能力中心：

- 教研室：教师备课、生成试题、复盘学情。
- 图书馆：知识库、引用、资料检索、可信来源。
- 实验室：模型广场、智能体、科研问答、多模态探索。
- 控制室：权限、审计、模型健康、用量与风险。
- 学习乐园：学生任务、进度、徽章、排行榜、探索任务。
- 安全办公室：未成年人保护、内容审核、数据留存、校内合规。

### 3.2 色彩世界

色彩必须像从校园 AI 场景里长出来：

- 深靛蓝：学校系统、安全、身份认证、夜间控制室。
- 教育蓝：主操作、链接、AI 连接状态、可信科技感。
- 青色：智能、检索、流式生成、在线状态。
- 琥珀金：成就、提醒、课程节点、温暖激励。
- Pastel 天蓝/薄荷/薰衣草/蜜桃/玫瑰/柠檬：学生任务、学科标签、徽章底、空状态。
- 低饱和灰蓝底：长时间使用不刺眼，适合教师和管理员连续工作。

### 3.3 签名元素

v1.2 的签名元素是 **“鲁班 Prism 状态层”**：

- 在 Campus 中，鲁班机器人与模型角色承担情绪反馈、空状态、首登引导和成就庆祝。
- 在 Console 中，同一套 Prism 语言变成状态胶囊、审计标记、gauge、引用来源和安全徽标。
- 这让学生觉得有陪伴，管理员仍觉得可信。

必须能在以下 5 个位置看到签名：

1. `/explore` 的探索任务和本周完成度。
2. `/chat` 的当前模型/引用来源/安全状态右栏。
3. `/hub` 的模型角色或模型品牌 glyph。
4. `/profile` 的成就徽章与真实产出绑定。
5. `/admin/analytics` 的模型健康、用量、审计状态和数据可视化锁色。

### 3.4 要主动拒绝的默认方案

- 默认后台模板：左侧栏 + 一堆等大白卡。替代方案：按角色和任务优先级组织信息，使用三档卡片层级。
- 默认教育可爱风：满屏插画、emoji、圆角和彩虹。替代方案：Campus 只在高光位使用角色和 pastel，Console 零 3D。
- 默认 AI 科技风：霓虹、玻璃、渐变文字、光晕堆叠。替代方案：品牌渐变只用于主操作、品牌位和少数 hero，高频内容使用安静表面。

---

## 4. 设计系统契约

### 4.1 基础品牌 token

保留现有骨架：

```css
:root {
  --c-primary: #312E81;
  --c-primary-2: #4338CA;
  --c-edu: #2563EB;
  --c-cyan: #06B6D4;
  --c-violet: #7C3AED;
  --c-growth: #10B981;
  --c-gold: #F59E0B;
  --c-alert: #EF4444;
}
```

这些颜色永远是产品骨架，不因页面调性改变。

### 4.2 必补语义状态 token

语义色不可直接拿原色做普通文字。普通文字必须使用 `-ink`：

```css
:root {
  --ok:#10B981;   --ok-bg:#ECFDF5;   --ok-ink:#047857;
  --warn:#F59E0B; --warn-bg:#FFFBEB; --warn-ink:#A16207;
  --err:#EF4444;  --err-bg:#FEF2F2;  --err-ink:#B91C1C;
  --info:#2563EB; --info-bg:#EFF6FF; --info-ink:#1D4ED8;
  --proc:#7C3AED; --proc-bg:#F5F3FF; --proc-ink:#6D28D9;
}

.dark {
  --ok-bg:#06281C;   --ok-ink:#34D399;
  --warn-bg:#2A1F05; --warn-ink:#FBBF24;
  --err-bg:#2A0E0E;  --err-ink:#F87171;
  --info-bg:#0C1B33; --info-ink:#60A5FA;
  --proc-bg:#1A1133; --proc-ink:#A78BFA;
}
```

要求：

- 成功、警告、错误、信息、处理中全部使用 token。
- 状态不只靠颜色，至少加文字或图标。
- 小色点/细线在白底上对比不足时，要加深、加描边或加标签。

### 4.3 双调 `--rg-*` token

在现有 `@custom-variant campus` 基础上补双调令牌：

```css
:root,
[data-register="console"] {
  --rg-pad: 16px;
  --rg-card-radius: var(--r-md);
  --rg-panel-radius: var(--r-lg);
  --rg-shadow: var(--shadow-sm);
  --rg-lift: 2px;
  --rg-motion: var(--t-fast);
  --rg-type-scale: 1;
  --rg-saturation: .85;
}

[data-register="campus"] {
  --rg-pad: 24px;
  --rg-card-radius: var(--r-lg);
  --rg-panel-radius: var(--r-xl);
  --rg-shadow: var(--shadow-md);
  --rg-lift: 4px;
  --rg-motion: var(--t-base);
  --rg-type-scale: 1.08;
  --rg-saturation: 1;
}
```

实现要求：

- `Card`、`surface-card`、业务卡片统一读取 `--rg-*`。
- `/admin/*` 默认 console。
- `/explore`、`/hub`、`/chat`、成就区默认 campus。
- `/dashboard` 是桥接页：教师视角偏 campus 3 档，管理员视角偏 console 2 档。

### 4.4 Typography

正文保持现有字体栈：

- 英文/数字：Inter、Inter Tight。
- 中文：HarmonyOS Sans SC、PingFang SC、Microsoft YaHei fallback。
- 数据：`--font-num` + `font-feature-settings:"tnum"`。

建议新增展示字体层：

- Campus hero、欢迎语、成就标题可用更有表情的 display 字体。
- 但正文、表格、后台标题不要换花哨字体。
- 中文展示字体若落地，必须本地子集化，避免 CJK 全量字体拖慢首屏。

Type scale：

| Token | 桌面规格 | 用途 |
|---|---|---|
| display | 40-48 / 1.12 / 800 | Campus 欢迎、探索 hero、成就 |
| page-title | 26-34 / 1.2 / 700 | 页面 H1 |
| section-title | 18-22 / 1.35 / 650 | 主要区块 |
| card-title | 14-16 / 1.45 / 600 | 卡片标题 |
| body | 14 / 1.6 / 400 | 正文 |
| caption | 12 / 1.35 / 500 | 标签、单位、时间 |
| metric | 28-40 / 1 / 750 | KPI、完成度 |

### 4.5 卡片三档

避免所有内容都是等大的白卡。

| 档位 | 视觉 | 用途 |
|---|---|---|
| 主卡 HeroCard | 大尺寸、可用渐变或插画、强焦点 | `/explore` hero、Dashboard 顶部、模型广场引导 |
| 内容卡 ContentCard | 白底、轻描边、统一圆角 | 图表、列表、会话、知识库、表格容器 |
| 信息卡 InfoTile | 底色块或无边框、小尺寸 | KPI 小块、状态项、课程项、引用来源 |

硬规则：

- 不做卡里套同款卡。
- 不用粗彩色侧边条表达强调。
- 玻璃拟态只给侧栏、右栏、浮层，不给正文内容卡。
- 管理端不使用 3D 插画。

### 4.6 数据可视化锁色

基础顺序：

```text
#2563EB -> #06B6D4 -> #7C3AED -> #10B981 -> #F59E0B -> #EC4899
```

固定实体必须跨图同色：

- ChatGPT：`#10A37F`
- Claude：`#D97757`
- GPT-Image：`#7C3AED -> #06B6D4`
- Gemini：`#4285F4 -> #A855F7`
- MiniMax：`#2563EB -> #F59E0B`
- 在线：ok，繁忙：warn，风险：err，处理中：proc。

图表要求：

- 图例或直接标签必须出现。
- 不能只靠颜色区分。
- 轴线和网格用 `--border` 或 `--border-2`，不要黑色硬轴。
- 管理端图表不要使用大面积装饰渐变；单序列面积图可用轻填充。

### 4.7 明暗与护眼

暗色不是反色：

- 背景用带品牌靛蓝倾向的深色，不用纯黑。
- 高层 surface 用轻微亮度差或 overlay，而不是强阴影。
- 深品牌色不可做暗色前景，前景使用亮化变体。
- 护眼模式可降低蓝光和动效，但仍要保证 AA 对比，不得把文字压到不可读。

---

## 5. Shell 与导航契约

### 5.1 全局结构

建议结构：

```tsx
<div className="app-shell">
  <Sidebar />
  <div className="app-main">
    <Topbar />
    <main data-register={registerByRouteAndRole}>
      {children}
    </main>
  </div>
  <MobileNav />
</div>
```

要求：

- `<nav>`、`<main>`、`<aside>` landmark 明确。
- 每页唯一 `<h1>`。
- 提供 skip-link。
- Sidebar 只负责导航，不承载过多装饰。
- 移动端侧栏转 Sheet，命中目标不少于 44x44。

### 5.2 角色入口

| 角色 | 默认落地 | 导航策略 | 调性 |
|---|---|---|---|
| student | `/explore` | 隐藏管理组，突出探索、对话、模型广场、成就 | Campus 5 |
| teacher | `/dashboard` | 教学快捷入口、知识库、提示词、对话优先 | 3 |
| researcher | `/chat` 或 `/knowledge` | 长文模型、知识库、科研问答、导出 | 3-4 |
| admin | `/admin/analytics` | 管理组置顶或明显可达 | Console 1-2 |
| college-admin | `/admin/analytics` | 数据按学院 scope 过滤 | Console 2 |

权限不足入口隐藏优先于禁用。如果必须展示禁用状态，必须说明原因和申请路径。

### 5.3 全局信任信号

在登录后 Shell、Chat 右栏和管理端页头中保持一致的信任语言：

- 数据存校内
- 校内 SSO 已验证
- AI 输出经过安全策略
- 引用来源可追溯
- 敏感内容拦截可申诉

不要把信任信息藏在设置页。教育产品需要把可信作为可见资产。

---

## 6. 页面级蓝图

### 6.1 `/explore` 学习探索，学生默认入口，调档 5

目标用户：学生，刚登录，想知道今天能用 AI 做什么。

核心任务：

- 继续一个学习探索。
- 完成今日任务。
- 看到进度、成就和同伴参照。
- 60 秒内进入第一次有价值 AI 输出。

布局：

- Hero：问候、连续学习、今日任务、本周完成度环。
- 筛选：全部、继续学习、全新任务、热门、已完成。
- 任务网格：每张卡包括学科、任务标题、预计时长、难度、进度、开始按钮。
- 右栏：我的成就、班级学习榜、每周挑战。

视觉：

- Campus 最高调档。
- 大圆角、pastel 分类、小面积品牌渐变。
- 可出现鲁班机器人或模型角色，但一屏只设一个主视觉焦点。

交互：

- 首登时出现 3 步 coachmark：选兴趣/身份 -> 认识鲁班和模型 -> 发起第一问。
- 任务卡 hover 轻上浮；reduced-motion 下只变色。
- 完成任务后可触发一次成就点亮，庆祝级动画每屏最多一处。

验收：

- 学生登录默认 `/explore`。
- 空状态不空白：给“换筛选/开始新任务/问鲁班”的行动。
- 成就与真实产出绑定，不显示空洞积分。

### 6.2 `/dashboard` 首页，调档 2-3

目标用户：教师和管理员。

教师视角：

- 今日教学任务。
- 模型调用趋势。
- 最近会话。
- 推荐提示词。
- 平台安全状态。

管理员视角：

- 系统运行状态。
- 学院使用分布。
- 模型调用趋势。
- 权限审批。
- 安全审计预览。

视觉：

- 介于 Medita 和 AIRecruit360。
- 教师视角允许暖强调和柔和卡片。
- 管理员视角降低饱和度，减少大渐变。

验收：

- 角色切换不能改变整体信息架构，只改变默认视图和内容优先级。
- KPI 必须有解释或趋势，不只摆数字。
- 数据区必须有 loading、empty、error、success。

### 6.3 `/chat` AI 对话，调档 4

目标用户：教师、学生、科研人员。

布局：

- 左：会话历史、搜索、模型/场景筛选。
- 中：消息流、引用、工具动作。
- 下：Composer，支持附件、图片、语音、提示词库、发送。
- 右：当前模型、引用来源、推荐提示词、安全状态、导出动作。

消息契约：

- 用户气泡使用暖强调或品牌渐变，但面积要克制。
- AI 气泡白底/暗色 surface，带模型标识、耗时、引用数。
- streaming 使用 `aria-live="polite"`，屏幕阅读器在完成时整段播报，不逐字刷屏。
- 工具按钮必须有可访问名称；纯图标按钮必须加 `aria-label`。

Composer 契约：

- Enter 发送，Shift+Enter 换行。
- 文件拖放时有可见提示和非视觉提示。
- 发送按钮 disabled 状态清晰。
- 输入区最大高度限制，长文本滚动。

验收：

- 右栏不做人物资料卡，而是 AI 上下文。
- 引用来源可点击或可展开。
- 安全提示不只在底部小字出现，风险时要在右栏或气泡内显性提示。

### 6.4 `/hub` 模型广场，调档 4

目标用户：需要选择合适模型的人。

布局：

- Hero：模型广场说明、搜索、筛选。
- 推荐场景：教案与试题、论文润色、课件配图等。
- 模型卡网格：模型角色/glyph、能力、上下文窗口、状态、适用场景、进入对话。
- 安全提示：调用审计、校内策略、隐私提醒。

视觉：

- 可使用模型 3D 角色或 GLB，但不要把全部模型卡做成视觉噪音。
- 模型色必须锁色。
- 申请状态明确：已开通、需申请、繁忙、维护。

验收：

- 搜索和筛选可键盘使用。
- 模型状态不只靠颜色。
- “需申请”不写成付费升级。

### 6.5 `/prompts` 提示词中心，调档 3-4

目标用户：教师、学生、科研人员。

布局：

- 搜索与分类。
- 推荐提示词。
- 使用量/收藏/适用模型。
- 新建提示词入口。
- 管理或审核入口按权限展示。

视觉：

- Campus 可使用轻渐变和 pastel 标签。
- Console 审核视图用表格或状态列表。

审核流：

```text
草稿 -> 待审核 -> 已发布 -> 已下线
```

要求：

- 状态流转用按钮/菜单，不用拖拽主路径。
- 每个状态都有权限说明和确认弹窗。

### 6.6 `/knowledge` 知识库，调档 3

目标用户：教师、科研人员、管理员。

布局：

- 左侧或顶部：知识库树、学院/课程/项目。
- 主区：文件列表或卡片。
- 右侧：选中文档详情、权限、向量化状态、引用历史。

组件契约：

- Tree 使用 `role=tree/treeitem/group`、`aria-expanded`、roving tabindex、Home/End。
- 文件表格使用 `aria-sort`、分页可达、批量选择播报。
- 上传对话框使用 Radix Dialog，焦点陷阱与归还。

验收：

- 文件状态必须包括：上传中、解析中、已向量化、失败、权限不足。
- AI 引用知识库时，必须显示来源和页码/段落。

### 6.7 `/agent` 智能体工作台，调档 4

目标用户：教师、教研、管理员。

布局：

- 智能体卡片网格。
- 能力标签、使用量、最近运行、状态。
- 新建智能体流程。
- 管理员可见监控与审核。

视觉：

- 用户端卡片可更活泼。
- 管理端监控页回到 Console。

验收：

- 新建流程必须有保存草稿、校验错误、权限提示。
- 智能体状态明确：草稿、审核中、可用、停用、异常。

### 6.8 `/profile` 个人中心与成就，调档 3-5

账户资料、偏好、安全、API Token 属于 Console 2-3。

成就、活动、学习榜属于 Campus 5：

- 成就墙：已解锁/未解锁清晰。
- 连续学习：温和提醒，不制造焦虑。
- 真实产出：已完成任务、生成教案、解决问题、整理资料。
- 外观偏好：暗色、密度、字号、减少动效、护眼模式。

验收：

- API Token 文案严肃，不使用游戏化。
- 手机、邮箱等敏感信息脱敏。
- 安全操作有确认和审计提示。

### 6.9 `/admin/analytics` 数据看板，调档 2

目标用户：管理员。

布局：

- 页头：范围、日期、导出。
- KPI：用户、调用、Token、模型健康、风险、知识库。
- 趋势图：近 7/30 日调用。
- 学院分布。
- 热力图。
- 热门智能体。
- 成本/资源占比，如展示成本也必须是内部资源视角，不是付费商业化。

视觉：

- 低饱和、少渐变。
- 表格和图表优先。
- 状态 badge 语义化。

验收：

- 图表锁色。
- Tooltip 可读。
- 导出按钮有权限控制和审计提示。

### 6.10 `/admin/audit` 安全审计，调档 1

目标用户：安全/系统管理员。

布局：

- 过滤器：时间、风险、用户、模型、学院、事件类型。
- 表格：时间、主体、操作、对象、风险、处理状态、详情。
- 详情抽屉：请求上下文、命中规则、处理记录、申诉/备注。

视觉：

- 零 3D。
- 零装饰渐变。
- 风险色克制但明确。

验收：

- 表格支持排序、筛选、分页、键盘可达。
- 风险等级不只靠颜色。
- 敏感内容默认折叠或脱敏。

### 6.11 `/admin/permissions` 权限管理，调档 1

目标用户：管理员、学院管理员。

布局：

- 角色列表。
- 权限矩阵。
- 申请队列。
- 审批记录。

交互：

- 危险操作二次确认。
- 权限变更说明影响范围。
- 批量操作有计数和撤销路径。

验收：

- 学院管理员只能看到 scope 内数据。
- 权限不足不展示不可操作入口。

### 6.12 `/admin/models` 模型管理，调档 2

布局：

- 模型列表。
- 健康状态、延迟、错误率、配额。
- 开关、维护、优先级、默认模型。
- 使用趋势。

验收：

- 状态：在线、繁忙、维护、停用、异常。
- 开关模型属于高风险操作，必须确认并写审计。
- 不使用“升级付费模型”语言。

### 6.13 `/admin/agents` 智能体监控，调档 2-3

布局：

- 表格默认。
- 可选看板视图仅用于状态概览。
- 审核流转按钮明确。

验收：

- 不把审核流转做成拖拽唯一入口。
- 每个智能体有负责人、权限范围、最近运行和异常提示。

---

## 7. 组件契约

### 7.1 Card

要求：

- 读取 `--rg-card-radius`、`--rg-pad`、`--rg-shadow`。
- `CardHeader` 标题区不能过高。
- 内容密集页使用 Console 较小内边距。
- Campus hero 使用 HeroCard，不滥用普通 Card 放大。

### 7.2 Badge

要求：

- variant 对应语义 token。
- 文案必须短，优先 2-4 字。
- 状态 badge 必须有可读文本，不只用圆点。

### 7.3 Button

要求：

- 主操作每屏 1 个优先。
- 危险操作红色但不大面积。
- 纯图标按钮必须有 `aria-label` 和 tooltip。
- 高风险操作需要确认弹窗或撤销。

### 7.4 DataTable

必备：

- `<th scope="col">`
- `aria-sort`
- 行选择 `aria-label`
- 批量选择 live region
- 分页键盘可达
- loading/empty/error/success
- 长列表使用虚拟化或分页

### 7.5 CommandPalette

必备：

- `dialog`
- `combobox/listbox/option`
- `aria-activedescendant`
- 上下键、Enter、Esc
- 焦点陷阱与归还
- 搜索结果数 `aria-live`

### 7.6 ProgressRing / Gauge

必备：

```tsx
role="meter"
aria-valuemin={0}
aria-valuemax={100}
aria-valuenow={value}
aria-label="本周完成度 76%"
```

视觉：

- 数字居中。
- 颜色不能是唯一语义。
- reduced-motion 下不做 count-up。

### 7.7 ChatBubble

必备：

- streaming 使用 `aria-live="polite"`。
- 完成时整段播报。
- 引用来源是可访问列表。
- 工具按钮有名称。
- 支持复制、重试、导出、反馈。

### 7.8 Composer

必备：

- Enter 发送，Shift+Enter 换行。
- 附件 chip 可删除，删除按钮有名称。
- 拖拽文件状态可视化。
- disabled 发送状态明确。
- 安全提示常驻，但风险提示需更显性。

### 7.9 Toast

必备：

- 普通 `role="status"`。
- 错误 `role="alert"`。
- hover/focus 暂停。
- 可撤销时提供明确撤销按钮。

### 7.10 Kanban 状态流转

审批类状态流转不以拖拽作为主入口。采用：

- 主按钮：提交审核、通过、驳回、上线、下线。
- 更多菜单：移动到、归档、复制。
- 状态变化后 toast + live region。
- 如需排序，可使用 `motion` 的 Reorder 或普通上移/下移按钮，不新增 `@dnd-kit`。

### 7.11 Form / Input / Select

所有表单控件必须提供完整状态，而不是只做默认态：

- default：边框低对比，文本清晰。
- hover：边框或底色轻微变化。
- focus：使用全站统一 focus ring。
- disabled：降低透明度但文字仍可读，说明禁用原因。
- invalid：错误色使用 `--err-bg` + `--err-ink`，错误文案紧贴字段下方。
- loading：按钮内置 spinner 或文字状态，例如“保存中…”，不要只禁用无反馈。
- required/optional：必填和选填规则清晰，避免只靠星号。

实现要求：

- Select、Date、Command 等复杂控件优先使用 Radix/shadcn 或自定义可访问组件，不依赖不可控的原生样式。
- 表单提交失败时，焦点移动到第一个错误字段或错误摘要。
- 长中文、英文邮箱、文件名和模型名都要验证不会撑破容器。

---

## 8. 动效与微交互

### 8.1 基本原则

- 动效解释状态，不炫技。
- Console 动效短、轻、少。
- Campus 动效更有温度，但每屏最多一处庆祝级动画。
- 所有动画遵守 reduced-motion。

### 8.2 统一令牌

保留现有：

```css
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--t-fast: 120ms;
--t-base: 200ms;
--t-slow: 360ms;
--t-cinematic: 600ms;
```

`motion` 统一弹簧：

```ts
{ type: "spring", stiffness: 280, damping: 24 }
```

### 8.3 reduced-motion 要求

CSS 媒体查询无法覆盖所有 JS 动画。所有 `motion` 入场、hover、count-up、3D 视差必须读取用户偏好。

降级策略：

- 粒子不播放。
- 脉冲变静态色。
- 逐字 streaming 变分段。
- count-up 直显终值。
- 3D 自动旋转停止，保留静态视图。

### 8.4 场景规格

| 场景 | 规格 |
|---|---|
| 页面入场 | opacity + Y 8-12px，160-220ms |
| 卡片 hover | `translateY(var(--rg-lift))`，阴影升一级 |
| KPI 数字 | 800ms count-up，reduced 下直显 |
| 流式回答 | 逐段优先，逐字只用于视觉，不刷屏 SR |
| 成就解锁 | 缩放回弹 + 一次性粒子，Campus only |
| Toast | 右下进入，错误可保持更久 |
| 3D 视差 | 桌面 ≤6px，移动端关闭 |

---

## 9. AI 生图资产规范

本轮不实际生成图片。执行阶段先产出基因板，再批量生成。

### 9.1 总体风格基因

统一 prompt 片段：

```text
soft 3D clay / Pixar-style render, rounded friendly forms, smooth matte surfaces,
soft studio lighting, gentle rim light, subtle ambient occlusion, high detail,
centered, transparent background, brand palette indigo #312E81, edu-blue #2563EB,
cyan #06B6D4, warm accent amber #F59E0B, no text
```

统一负面：

```text
no text, no watermark, no logo letters, no harsh shadows, no busy background,
not photorealistic skin, no clutter, no horror, no weapon, no commercial pricing symbol
```

### 9.2 鲁班机器人，最高优先

用途：

- 首登引导
- `/explore` hero 或空状态
- `/chat` 空对话
- 错误页
- 成就庆祝
- loading/maintenance

关键要求：

- 必须有鲁班锁、榫卯、木作工具或古代工匠元素作为记忆点。
- 不能只是泛化机器人。
- 不出现文字。
- 透明背景。
- 同一视角和光照。

首张基因板 prompt：

```text
A friendly 3D mascot robot named Luban for a K-12 school AI learning platform,
soft clay/Pixar-style render, rounded chubby body, small wooden-tech hybrid details,
recognizable Luban lock and mortise-tenon craft elements on the chest and joints,
glowing cyan visor face with two simple friendly eyes, indigo #312E81 and edu-blue
#2563EB body, amber #F59E0B craft accents, waving one hand, cheerful but not childish,
soft studio lighting, gentle rim light, smooth matte surfaces, subtle ambient occlusion,
centered, transparent background, high detail, no text
```

姿态变体：

- waving welcome
- thinking
- reading glowing book
- pointing to next step
- celebrating achievement
- sleeping/maintenance

尺寸：

- 1024x1024 master
- 512x512 UI
- 256x256 small empty state
- WebP/AVIF 导出

### 9.3 五大模型角色

用途：

- `/hub` 卡片
- `/chat` 助手头像
- 模型切换反馈
- OG 图

Prompt 模板：

```text
A 3D clay/Pixar-style spherical character representing the AI model "<NAME>",
smooth matte sphere with a subtle friendly face, color palette <C1> to <C2> gradient,
soft studio lighting, gentle rim light, floating slightly, subtle ambient occlusion,
centered, transparent background, no text, high detail
```

颜色：

- ChatGPT：`#10A37F -> #2DD4BF`
- Claude：`#D97757 -> #F59E0B`
- GPT-Image：`#7C3AED -> #06B6D4`
- Gemini：`#4285F4 -> #A855F7`
- MiniMax：`#2563EB -> #F59E0B`

### 9.4 成就徽章

主题建议：

- 首次有效提问
- 连续 7 天探索
- 完成 10 个学习任务
- 生成第一份教案
- 知识库整理达人
- 科研摘要助手
- 班级协作之星
- 安全使用标兵

Prompt 模板：

```text
A 3D achievement badge medal, soft clay/Pixar style, rounded shield or circular medal,
theme: "<THEME>", brand palette indigo and edu-blue with amber gold rim,
glossy enamel finish, soft studio lighting, centered, transparent background,
no text, high detail
```

未获得态不单独生成，用 CSS grayscale + opacity。

### 9.5 Console 空状态

管理端不用 3D。使用：

- lucide 线性图标组合
- 单色线稿
- `--text-3`
- 简短操作文案

例：

```text
No audit events found. Try broadening the date range or clearing filters.
```

中文：

```text
暂无审计事件。可以扩大时间范围，或清除筛选条件。
```

### 9.6 资产验收

每批资产必须检查：

- 视角一致。
- 光照一致。
- 材质一致。
- 没有文字、水印、乱手、畸形。
- 透明背景干净。
- 文件体积符合预算。
- 装饰图 `aria-hidden`，有意义图有 `alt` 或 `aria-label`。

---

## 10. 留存、激活与非付费增长

### 10.1 首登引导

目标：60 秒内让用户获得第一次有价值 AI 输出。

学生：

1. 选择年级/兴趣学科。
2. 看到鲁班说明“今天可以探索什么”。
3. 从 `/explore` 点一个任务。
4. 自动带入提示词进入 `/chat`。

教师：

1. 选择教学任务：教案、试题、学情、课件。
2. 上传或选择课程资料。
3. 生成第一份可编辑草稿。

管理员：

1. 查看模型健康。
2. 查看待处理审计/权限。
3. 完成第一个审批或导出报告。

### 10.2 成就系统

必须绑定真实产出：

- 生成 N 份教案。
- 解决 N 个学习问题。
- 完成 N 个探索任务。
- 整理 N 份知识库资料。
- 通过 N 次安全使用检查。

禁止：

- 付费激励。
- 连续打卡焦虑。
- 虚假稀缺。
- 排行羞辱。

### 10.3 班级/学院排行

排行需要温和：

- 默认展示前 5-10 名和自己的相对位置。
- 支持匿名或昵称。
- 强调“本周进步”“完成度”而不是绝对分数。
- 管理端展示学院趋势，不做学生个人公开羞辱。

### 10.4 任务机制

每周 AI 探索任务：

- 学科任务
- 创作任务
- 复习任务
- 安全使用任务
- 协作任务

任务卡必须写清：

- 预计时间。
- 适合模型。
- 完成产出。
- 难度。
- 开始动作。

---

## 11. 未成年人保护与合规

### 11.1 会话和数据留存告知

登录后首次使用 AI 时，需要清楚说明：

- 会话可能被保存多久。
- 谁可以看到。
- 用于什么目的。
- 如何删除或申请删除。
- 未成年人数据处理采用最小化原则。

文案要温和，不吓人。

### 11.2 教师/家长监管视图

建议提供：

- 学生 AI 使用概况。
- 常用场景。
- 安全拦截次数。
- 学习任务完成度。
- 需要关注的异常。

监管视图不展示不必要的完整私密对话，除非有明确合规授权和安全事件需要。

### 11.3 内容安全闭环

所有拦截都要给出：

- 为什么被拦截的温和解释。
- 可以如何修改问题。
- 求助/举报/申诉入口。
- 管理端审计记录。

### 11.4 数据安全可视化

在关键位置显示：

- 校内 SSO 已验证。
- 数据存校内。
- 引用来源可追溯。
- 敏感信息未检出/已拦截。
- 导出会写入审计日志。

---

## 12. 性能与工程预算

目标：

- LCP < 2.5s
- INP < 200ms
- CLS < 0.1
- 交互动画不阻塞输入
- 移动端可用，不只是“能打开”

要求：

- 3D 和大图懒加载。
- `next/image` 使用明确尺寸。
- WebP/AVIF 优先。
- 角色位图单张 UI 用图尽量 ≤150KB。
- 路由级 code split。
- 长表格/长会话虚拟化。
- `motion`、`recharts`、3D 组件放在叶子级 `"use client"`，不要整页 client 化。
- 修改 `next/image`、`next/font`、metadata、viewport 前，读取本项目 `node_modules/next/dist/docs/` 对应文档，因为当前项目使用 Next 16。

依赖策略：

- 不新增 `@dnd-kit`。
- 如长列表性能成为问题，再引入 `@tanstack/react-virtual`。
- 确认 `lucide-react@1.14.0` 的图标导入和 tree-shaking。

---

## 13. 实施路线图

### S1：设计系统地基

产物：

- 补齐语义 token。
- 接入 `data-register` 路由调档。
- Card/Badge/Button/ProgressRing 读取 token。
- 明暗和 reduced-motion 基础检查。

验收：

- `/admin/*`、`/explore`、`/chat`、`/hub` 能明确显示对应调档。
- 无新增随机 hex，或所有新增 hex 有记录理由。

### S2：Console 管理端

页面：

- `/admin/analytics`
- `/admin/audit`
- `/admin/permissions`
- `/admin/models`
- `/admin/agents`

产物：

- 表格、KPI、图表、筛选、详情抽屉统一。
- 审计和权限操作有确认/撤销/审计提示。

验收：

- 管理端零 3D。
- 图表锁色。
- 表格键盘可达。

### S3：核心用户链路

页面：

- `/dashboard`
- `/chat`
- `/hub`

产物：

- 教师 dashboard 可完成教学快捷任务。
- Chat 三栏完整。
- 模型广场可选择模型并进入对话。

验收：

- 60 秒内完成一次有价值输出。
- 引用来源和安全状态显性。

### S4：内容与创作区

页面：

- `/prompts`
- `/prompts/new`
- `/knowledge`
- `/agent`
- `/agent/new`

产物：

- 提示词审核流。
- 知识库树/列表/上传。
- 智能体新建与监控。

验收：

- 四态齐全。
- 权限不足有清楚路径。

### S5：留存层

页面：

- `/explore`
- `/profile` 成就区
- 首登引导

产物：

- 学习任务、成就、排行、首登 coachmark。
- 鲁班资产基因板。

验收：

- 学生默认 `/explore`。
- 成就绑定真实产出。

### S6：打磨与上线 QA

产物：

- 全路由截图检查。
- 暗色和护眼模式。
- reduced-motion。
- 性能预算。
- a11y 检查。
- 资产批量生产。

验收：

- lint/build 通过。
- 控制台零错误。
- 主流桌面/移动断点无破版。

---

## 14. 页面验收清单

每页必须通过：

- [ ] 页面唯一 `<h1>`。
- [ ] `data-register` 正确。
- [ ] loading/empty/error/success 四态齐全。
- [ ] 主操作明确，且每屏不超过 1 个最高强调按钮。
- [ ] 状态不只靠颜色。
- [ ] 键盘可达，焦点可见。
- [ ] 暗色可读。
- [ ] reduced-motion 生效。
- [ ] 移动端 390px 无横向溢出。
- [ ] 1024px 平板布局不挤压。
- [ ] 1440px 桌面信息密度合理。
- [ ] 无嵌套同款卡。
- [ ] 无滥用玻璃。
- [ ] 无正文渐变字。
- [ ] 无付费/订阅/升级诱导。
- [ ] 管理端无 3D 角色。
- [ ] Campus 角色不铺满全屏。
- [ ] 所有图片有 `alt` 或 `aria-hidden`。
- [ ] 控制台无错误。

---

## 15. 反 AI-slop 黑名单

截图验收时逐条检查：

- [ ] 无彩色侧边竖条做卡片强调。
- [ ] 无一屏等大白卡。
- [ ] 无卡里套同款卡。
- [ ] 无全站霓虹光晕堆叠。
- [ ] 无大面积紫蓝渐变背景统治所有页面。
- [ ] 无正文渐变文字。
- [ ] 无 emoji 滥用，Campus 单个文案点最多 1 个。
- [ ] pastel 面积 ≤15%，且文字用对应 `-ink`。
- [ ] 3D 角色只在 Campus 高光位、空状态、引导和成就出现。
- [ ] Console 无可爱插画。
- [ ] 图表有标签、图例或形状辅助。
- [ ] 按钮文字不挤压、不溢出。
- [ ] 不用“现代化、智能化、高大上”这类空洞文案替代真实任务。

---

## 16. 验证流程

### 16.1 文档阶段

本 v1.2 文档交付时检查：

- 文件存在。
- 不覆盖 v1.1。
- 包含参考图解析、工程事实、差距矩阵、设计系统、页面蓝图、组件契约、资产规范、留存、合规、路线图、验收清单。
- 明确学生默认 `/explore`。
- 明确本轮不生成实际资产。
- 明确不做付费版本。

### 16.2 实现阶段

每个 Sprint 完成后：

```powershell
cd D:\VB\LLM-School\app
npm run lint
npm run build
```

UI 验证：

- 浏览器检查 `/dashboard`、`/explore`、`/chat`、`/hub`、`/profile`、`/admin/analytics`、`/admin/audit`。
- 截图断点：390、768、1024、1440。
- 检查控制台。
- 检查暗色。
- 检查 reduced-motion。
- 检查键盘导航。

### 16.3 审阅门

实现阶段必须进行：

- 设计审阅：swap test、squint test、signature test、token test。
- 前端 QA：响应式、a11y、性能、图像、表单、错误状态。
- 工程审阅：impact radius、依赖、重复抽象、未验证状态。
- 如仓库可用，运行 code-review-graph；若不可用，做手动 fallback review。

---

## 17. 附录：文件与实现映射

| 关注点 | 当前文件 |
|---|---|
| 全局 token | `app/app/globals.css` |
| Shell | `app/app/(shell)/layout.tsx` |
| Sidebar | `app/components/shell/Sidebar.tsx` |
| Topbar | `app/components/shell/Topbar.tsx` |
| RightRail | `app/components/shell/RightRail.tsx` |
| Dashboard | `app/app/(shell)/dashboard/page.tsx` |
| Explore | `app/app/(shell)/explore/page.tsx` |
| Chat | `app/app/(shell)/chat/page.tsx` |
| Chat bubble | `app/components/chat/MessageBubble.tsx` |
| Composer | `app/components/chat/Composer.tsx` |
| Hub | `app/app/(shell)/hub/page.tsx` |
| Profile | `app/app/(shell)/profile/page.tsx` |
| Admin analytics | `app/app/(shell)/admin/analytics/page.tsx` |
| Admin audit | `app/app/(shell)/admin/audit/page.tsx` |
| Admin permissions | `app/app/(shell)/admin/permissions/page.tsx` |
| Admin models | `app/app/(shell)/admin/models/page.tsx` |
| Admin agents | `app/app/(shell)/admin/agents/page.tsx` |
| 3D assets | `app/public/3d/` |

---

## 18. 结论

EduAI Prism 登录后界面的高保真目标不是“把五张参考图混合起来”，而是把它们各自最有效的结构吸收到同一个校园 AI 产品语言里：

- AIRecruit360 给管理端骨架。
- Medita 给教师首页的友好专业中点。
- Hawk 给状态流转和类别编码。
- Purple Chat 给对话三栏。
- Dei 给学生探索和留存。

最终统一在 EduAI 自己的签名系统里：深靛蓝和教育蓝作为可信骨架，Campus 用鲁班和模型角色创造参与感，Console 用清晰状态和审计可见性建立信任。这样既高级、实用、好用，也不会因为过度商业化或过度游戏化损害校园产品的长期留存和可信度。
