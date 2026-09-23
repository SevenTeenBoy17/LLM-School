# EduAI Prism「鲁班 7 号」· 登录后界面 — 前端 UI 高保真开发文档

> 版本 v1.1（经三 agent 审阅折叠）｜ 面向：校内 AI 大模型平台（K‑12 / 中小学）登录后的「用户端 + 管理端」全部界面
> 定位：在**现有 EduAI Prism 设计 token 体系**之上扩展统一，指导高保真、高复原实现
> 本产品**不做付费版本** —— 不含任何价格墙、订阅卡点、升级诱导组件
> 审阅结论：UI 设计 8/10 · 无障碍 7/10 · 技术可行性 8/10；必改项已折叠入 §3.1C/§3.1D/§3.6 与 §11

---

## 0. 给实现者的 TL;DR（先读这一段）

1. **不要新起设计系统**。`app/app/globals.css` 已有成熟 token（深靛蓝 `#312E81` / 教育蓝 `#2563EB` / 5 模型渐变 / 完整明暗 / 圆角阴影字体动画）。本文是它的**扩展规范**，所有新值都给出对应 CSS 变量增量。
2. **核心心法 = 双调统一（Dual‑Register Unity）**：管理端走 **Console（克制·严肃·数据密）**，学生/学习/对话走 **Campus（温暖·活泼·游戏化）**。两调**共用同一套 token、字体、品牌色、圆角语言、动效曲线**，只在「圆角档/阴影档/动效幅度/插画密度/微文案语气」上分档，绝不分裂成两个产品。
3. **技术栈已定**：Next 16 + React 19 + Tailwind 4(`@theme inline`) + Radix/shadcn + `motion`(Framer 后继) + `recharts` + `three/@react-three`。新组件一律复用 `components/ui/*`，动画用 `motion`，图表用 `recharts`，3D 用 `@react-three/fiber`。
4. **需要插画/角色/徽章等位图资产** → 见 §7「AI 生图资产清单」，每个资产附**可直接粘贴的中英文 prompt**（GPT 生图 / Nano‑Banana / Gemini）、尺寸、透明背景、暗色版本、落盘路径。
5. **留存优先**（用户明确诉求）：§8 给出游戏化、首登引导、成就、空状态激活的完整方案。

---

## 1. 参考图深度解析（逐张）

> 5 张参考图位于 `开发材料/UI界面/`。每张拆解「布局 / 配色 / 样式 / 风格 / 排版」，并明确**可借鉴**与**不可照搬**（避免水土不服）。

### 1.1 `AI界面全面板.png` — AIRecruit360（严肃·企业 SaaS 套件）

九屏一图（Dashboard / AI Chat / Job Mgmt / AI Interview / Candidate Pipeline / Interview Calendar / Offer Mgmt / Hiring Analytics）。

| 维度 | 解析 |
|---|---|
| **布局** | 经典三段：**窄固定左侧栏（图标+文字导航，单一选中态高亮）** + 顶部标题区（大标题 + 一句副标题 + 右上主操作按钮）+ 主区**卡片网格**。AI Chat 与列表页右侧另挂**会话/筛选副栏**。信息密度高但**留白充足**，靠卡片分组而非分割线。 |
| **配色** | 近白底（`#F7F8FC` 级）+ 纯白卡片 + **单一蓝主调 `#2563EB`** 承担所有强调（按钮/选中/链接/图表主色）。状态色克制：绿=Active、琥珀=Pending、红=Rejected，仅用于 badge 小面积。 |
| **样式** | 中等圆角（卡片 ~16–20px，按钮 ~10–12px）；**极轻阴影**（几乎只靠 1px 描边 + 微投影）；图表为 recharts 级面积图/柱图/甜甜圈 + 一个**仪表盘 gauge（92.67% AI 匹配准确率）**。 |
| **风格** | 冷静、可信、数据驱动。无插画、无 3D、无大渐变面。典型「enterprise admin」。 |
| **排版** | 强层级：H1 大而粗、副标题灰小、卡片标题中粗、数值用等宽数字突出（KPI `32 / 232 / 35` 带 `+3% / -13%` 涨跌色）。 |
| ✅ **借鉴** | 管理端与数据看板的**框架、KPI 行、表格、gauge、单主色克制**；AI Chat 的「欢迎语 + 建议卡 + 输入框 + 右侧会话史」三件套。 |
| ⛔ **不照搬** | 招聘业务语义；过度冷淡（学生端需要更暖）；纯白到底（我们保留浅蓝灰底 + 品牌靛蓝点缀）。 |

### 1.2 `后台面板数据.png` — Medita（友好专业·navy+amber 圆润 duotone 仪表盘）

| 维度 | 解析 |
|---|---|
| **布局** | 左**深色圆角侧栏**（顶圆角凸出，悬浮感）+ 中部主图表卡 + 右**信息密集副栏**（体征卡 2×2、治疗日历、用药行、支付卡）。 |
| **配色** | **双色 duotone**：深靛蓝 `#312E81` 侧栏/重点块 + **琥珀金 `#F59E0B` 作为唯一暖强调**（面积图填充、选中日期、信用卡）。多色仅出现在「Checkup 甜甜圈」做分类编码。 |
| **样式** | **大圆角（卡片 ~20–28px）**、柔和长阴影、面积图带渐隐填充、迷你波形/心率折线作「数据装饰」。整体「软」。 |
| **风格** | 友好但专业，医疗信任感 + 亲和力，是「严肃 ↔ 活泼」的**黄金中点**。 |
| **排版** | 数值大而醒目（`114 bpm` / `36°`），单位小灰；标题中粗，留白慷慨。 |
| ✅ **借鉴** | **首页 Dashboard 的整体调性**（navy + 单暖强调 + 大圆角 + 软阴影）；体征卡 → 我们的「用量/额度/活跃」KPI；治疗日历 → 课程表；渐变信用卡 → 我们的「今日 AI 额度卡」。 |
| ⛔ **不照搬** | 把琥珀金当唯一强调（我们的暖强调用品牌青/金双轨）；医疗语义。 |

### 1.3 `后台对用户管理界面.png` — Hawk（清爽彩色分类看板）

| 维度 | 解析 |
|---|---|
| **布局** | 浏览器壳 + 左侧栏（搜索/活动/更新/设置 + 项目树）+ 主区**四列看板**（TODO/IN WORK/IN PROGRESS/COMPLETED），列头**彩色下划线**区分（黑/蓝/橙/绿）。底部 **Dark/Light 切换**。 |
| **配色** | 浅底 + 白卡 + **类别色丸标签**（Design 蓝 / Dev 橙 / Planning 粉 / Research 紫 / Content 粉）+ 进度条彩色 + 优先级标签（High 红 / Mid 绿 / Low 灰）。**用颜色编码语义**而非装饰。 |
| **样式** | 干净白卡、细描边、彩色进度条、头像堆叠（`+7`）、列内「+ Add Card」虚线占位。 |
| **风格** | 轻快、组织感强、可拖拽心智。介于严肃与活泼。 |
| ✅ **借鉴** | **智能体/提示词的管理与审核**（看板列：草稿 → 待审 → 已发布 → 已下线）；**类别色编码系统**；进度条 + 头像堆叠 + 空列占位；显式明暗切换入口。 |
| ⛔ **不照搬** | 通用项目管理语义；列过多导致管理端过「玩具化」（管理端默认表格视图，看板为可选视图）。 |

### 1.4 `对话.png` — Purple Chat（饱和紫·社交对话）

| 维度 | 解析 |
|---|---|
| **布局** | **全出血深紫顶栏 + 左icon栏** 包裹白色内容；主体**三栏：联系人列表 / 会话流 / 资料卡**。底部输入区带 emoji 行、附件、语音、发送圆钮。 |
| **配色** | **饱和深紫 `#4C1D95`～`#5B21B6`** 主调，对方气泡浅灰、己方气泡深紫，强对比。 |
| **样式** | 大圆角气泡、圆形头像带在线绿点、resource「Media」缩略图、社交图标。资料卡用 **3D/Pixar 风头像**。 |
| **风格** | 偏活泼、社交、年轻。 |
| ✅ **借鉴** | **Chat 页三栏结构**（会话史 / 消息流 / 右侧「当前模型 + 引用来源 + 推荐提示词」）；emoji/反应、在线态、附件输入条、资料卡。 |
| ⛔ **不照搬** | 满屏高饱和紫（会压过品牌靛蓝；我们仅在 Campus 局部用紫做点缀）；社交 IM 语义。我们的右栏是「AI 上下文」不是「人物资料」。 |

### 1.5 `用户画像.png` — Dei（活泼·3D 角色·游戏化排行）

| 维度 | 解析 |
|---|---|
| **布局** | **深色顶导航**（近黑，凸显内容）+ 浅色大圆角内容区；左主区「My Peers」**3D 角色卡网格** + 右「Leaderboard」排行榜（头戴皇冠的 3D 第一名 + 排名列表 + 完成度%）。 |
| **配色** | 黑导航 + 白/浅底 + **柔和 pastel 点缀**（青/黄/薰衣草色条；一张整粉「Circulatory System」播放卡）。低饱和但有活力。 |
| **样式** | **3D 黏土/Pixar 角色是绝对主角**；卡片大圆角、彩色顶条编码、时长 + 波形图标、播放按钮、皇冠/奖杯 emoji 游戏化。 |
| **风格** | 活泼、亲和、游戏化、强留存。 |
| ✅ **借鉴** | **学生端 / 学习探索 / 成就排行**的活泼调；**3D 角色资产**（→ §7 用 AI 生图复刻「鲁班机器人 + 5 模型角色」）；排行榜/完成度/连续打卡等留存机制；深导航 + 浅内容的对比手法。 |
| ⛔ **不照搬** | 把 3D 角色铺满所有页（仅用于 Campus 高光位与空状态，管理端零 3D）；过度游戏化冲淡教育严肃性（成就需与「学习/教学产出」绑定，不做空洞积分）。 |

### 1.6 横向提炼 —— 我们取什么、舍什么

```
严肃 ←———————————————————————————————————————→ 活泼
AIRecruit360   Hawk        Medita        Purple Chat     Dei
(企业蓝)      (彩色看板)   (navy+amber)   (饱和紫)        (3D 游戏化)
   │            │            │              │              │
   ▼            ▼            ▼              ▼              ▼
管理端/审计   智能体管理   首页/KPI/日历   对话三栏        学生学习/成就
数据看板     提示词审核                   反应/输入条      3D 角色/排行/留存
```

**5 张图的共性（→ 我们的统一锚点）**：① 卡片化、靠分组而非分割线；② 中—大圆角；③ 单一主强调色克制使用；④ 高层级排版（大标题 + 灰副标题 + 等宽数值）；⑤ 头像堆叠/进度/状态丸等通用零件。

**5 张图的张力（→ 我们用「双调」化解）**：冷静企业蓝（严肃）↔ 3D pastel 游戏化（活泼）。直接混用会精神分裂；用**同源 token + 分调档位**统一。

---

## 2. 设计哲学：双调统一（Dual‑Register Unity）

### 2.1 两种调性

| | **Console 控制台调（严肃）** | **Campus 校园调（活泼）** |
|---|---|---|
| 适用 | 管理端：数据看板 / 审计 / 权限 / 模型管理 / 智能体监控；以及任何「表格、配置、合规」场景 | 用户端：首页、对话、模型广场、提示词、知识库、智能体工作台、个人成就、学习探索 |
| 气质 | 克制、可信、信息优先、零噪音 | 温暖、鼓励、有惊喜、强参与 |
| 圆角 | 偏小档（`--r-sm/md` 10–14px） | 偏大档（`--r-lg/xl` 20–28px） |
| 阴影 | `shadow-sm`（近乎描边） | `shadow-md/lg`（柔和悬浮） |
| 色彩用法 | 靛蓝/教育蓝为主，状态色仅 badge；**禁大面积渐变面** | 品牌渐变 + pastel 点缀 + 3D 角色允许 |
| 动效幅度 | 小（120–180ms，位移 ≤4px，仅状态反馈） | 中（200–420ms，spring、stagger、庆祝动画） |
| 插画/3D | 无（最多线性图标 + 图表） | 鲁班机器人 + 模型角色 + 空状态插画 |
| 微文案 | 专业、陈述（"已处理 12 条审计事件"） | 鼓励、第二人称（"今天又解锁了一个新技能 ✨"） |
| 数据密度 | 高（表格、多 KPI、密集） | 中（卡片、留白、视觉锚点） |

### 2.2 统一锚点（两调绝不分裂的硬约束）

无论哪一调，**以下完全一致**：① 同一份 `globals.css` token；② 同一字体栈（Inter + HarmonyOS/PingFang，数值用 Inter Tight）；③ 同一品牌色（靛蓝 `#312E81` / 教育蓝 `#2563EB` 永远是骨架）；④ 同一图标库（lucide-react）；⑤ 同一动效缓动曲线令牌（见 §6）；⑥ 同一焦点环、同一明暗切换机制（next-themes）；⑦ 同一栅格基线（8pt）。

> 一句话：**Campus 是 Console「把圆角调大、阴影调软、加一点角色与庆祝」的同一个家族成员**，不是另一套皮肤。

### 2.3 调性光谱表（每页落档：1 最严肃 → 5 最活泼）

| 页面 | 调档 | 说明 |
|---|---|---|
| 管理·安全审计 `/admin/audit` | **1** | 纯表格、零渐变、零动画装饰 |
| 管理·权限 `/admin/permissions` | 1 | 权限矩阵、表格、确认弹窗 |
| 管理·模型管理 `/admin/models` | 2 | 状态卡 + 健康曲线，轻强调 |
| 管理·数据看板 `/admin/analytics` | 2 | KPI + recharts + gauge（AIRecruit 风） |
| 管理·智能体监控 `/admin/agents` | 2–3 | 表格为主，可切看板（Hawk 风） |
| 首页 Dashboard `/dashboard` | **3** | navy+暖强调（Medita 风），双视角自适应 |
| 知识库 `/knowledge` | 3 | 树 + 表格/卡片切换，专业但友好 |
| 提示词 `/prompts` | 3–4 | 渐变卡片库，使用计数，校园精选 |
| 对话 Chat `/chat` | 4 | 三栏（Purple Chat 结构）+ 流式动效 |
| 模型广场 `/hub` | 4 | 5 模型 3D 角色/星球，品牌渐变 |
| 智能体工作台 `/agent` | 4 | 角色卡网格 + 能力标签 |
| 个人·成就/活动 `/profile`(成就 Tab) | **5** | 徽章、连续打卡、排行（Dei 风游戏化） |
| （建议新增）学习探索 `/explore` | 5 | 3D 角色、任务、引导，最活泼 |

> 实现提示：把「调档」做成一个**容器级 data 属性**（如 `<main data-register="campus">`），让组件按 `[data-register]` 取不同的圆角/阴影/动效令牌，**组件代码只有一套**。详见 §3.6。

---

## 3. 设计系统规范（在现有 token 上扩展）

> 原则：**只增不改**。下列均为 `globals.css` 的增量；已存在的变量（`--c-primary`/`--c-edu`/`--m-*`/`--r-*`/`--shadow-*`/字体）原样保留。

### 3.1 色彩

**A. 保留（骨架，勿动）**：`--c-primary #312E81`、`--c-primary-2 #4338CA`、`--c-edu #2563EB`、`--c-cyan #06B6D4`、`--c-violet #7C3AED`、`--c-growth #10B981`、`--c-gold #F59E0B`、`--c-alert #EF4444`，以及 5 模型双色渐变 `--m-*`。

**B. 新增 · Campus 活泼子板（pastel pops，仅活泼区点缀，面积 ≤ 15%）**
```css
:root{
  --p-sky:    #E0F2FE;  --p-sky-ink:    #0369A1;
  --p-mint:   #DCFCE7;  --p-mint-ink:   #047857;
  --p-lilac:  #EDE9FE;  --p-lilac-ink:  #6D28D9;
  --p-peach:  #FFEDD5;  --p-peach-ink:  #C2410C;
  --p-rose:   #FCE7F3;  --p-rose-ink:   #BE185D;
  --p-lemon:  #FEF9C3;  --p-lemon-ink:  #A16207;
}
```
> 用途：学习卡顶条、学科/分类编码、成就徽章底、空状态插画背景。**文字必须用对应 `-ink` 深色**保证对比度 ≥ 4.5:1。

**C. 新增 · 语义状态色（统一 badge/toast/状态点）**
> ⚠️ a11y 实测修正：`--ok #10B981`/`--warn #F59E0B`/`--err #EF4444` 作为**文字色**（无论配浅底还是当白字底）在普通字号下对比度 < 4.5:1（warn 仅 2.1:1）。因此**纯语义色只用作背景/图标/状态点，文字一律用下方 `-ink` 深变体**；填充按钮用白字时仅限 info/proc，其余用 ink 文字。
```css
:root{
  --ok:#10B981;  --ok-bg:#ECFDF5;  --ok-ink:#047857;   /* 文字用 ink，实测 4.99:1 */
  --warn:#F59E0B; --warn-bg:#FFFBEB; --warn-ink:#A16207; /* 文字用 ink，实测 4.58:1 */
  --err:#EF4444; --err-bg:#FEF2F2; --err-ink:#B91C1C;   /* 文字用 ink */
  --info:#2563EB; --info-bg:#EFF6FF; --info-ink:#1D4ED8; /* info 主色已达标，ink 备用 */
  --proc:#7C3AED; --proc-bg:#F5F3FF; --proc-ink:#6D28D9; /* 处理中/流式 */
}
.dark{
  --ok-bg:#06281C; --warn-bg:#2A1F05; --err-bg:#2A0E0E; --info-bg:#0C1B33; --proc-bg:#1A1133;
  /* 暗色前景：深品牌/语义色不可读 → 一律用亮化变体作文字/细线 */
  --ok-ink:#34D399; --warn-ink:#FBBF24; --err-ink:#F87171; --info-ink:#60A5FA; --proc-ink:#A78BFA;
}
```
**铁律（色盲安全）**：任何状态/类别/风险等级/优先级/难度，必须「颜色 + 文字标签 +（图标或形状）」**至少其二**，绝不只靠颜色。成功 ✓ / 警告 ⚠ / 错误 ✕ / 处理中 ◐。

**D. 新增 · 数据可视化色阶（recharts 统一取色，避免每图乱配）**
- **分类序列（≤6 类，给甜甜圈/柱/多线）**：`#2563EB → #06B6D4 → #7C3AED → #10B981 → #F59E0B → #EC4899`（始终按此序，保证跨图一致）。
- **5 模型固定取各自 `--m-*` 主色**（模型相关图表必须用品牌色，强化记忆）。
- **单序列面积图**：主色 `--c-edu`，填充 `linear-gradient(180deg, rgba(37,99,235,.18), rgba(37,99,235,0))`（Medita 渐隐手法）。
- **网格/轴**：用 `--border`，**不要黑色轴线**；标签用 `--text-3`。
- ⚠️ **非文本对比 (WCAG 1.4.11) + 色盲**：cyan `#06B6D4`(2.4:1)、growth `#10B981`(2.5:1)、gold `#F59E0B`(2.2:1) 在白底上作为细线/薄环/小色点 < 3:1 看不清。修正：① 这三色用于「线/小色块」时**加深或描 1px 深色描边**；② 图表序列**绝不只靠颜色**——必须叠加 直接数据标注 / 不同 marker 形状 / pattern 填充 / 直接标签。
- **语义锁色**：固定实体（角色/学科/模型/状态）在**全站任何图表**中颜色恒定（如"教师"恒蓝），色阶序仅用于无固定语义的临时分类，避免跨图同名不同色。

**E. 暗色**：B/C 已给暗映射；pastel 在暗色降为「深底 + 亮 ink 文字」，禁止把浅 pastel 直接铺到暗背景。

### 3.2 字体与排版

**字体栈保留**（`--font-sans` Inter+HarmonyOS/PingFang、`--font-num` Inter Tight、`--font-mono`）。建议 `next/font` 自托管 Inter + 思源黑体子集，避免 CDN 抖动。

**Type scale（8pt 节奏，桌面基准；移动端整体 ×0.92）**
| Token | size / line-height / weight | 用途 |
|---|---|---|
| `display` | 34 / 40 / 800 | 页面 H1、欢迎语 |
| `h2` | 26 / 32 / 700 | 区块大标题 |
| `h3` | 20 / 28 / 650 | 卡片标题 |
| `title` | 16 / 24 / 600 | 列表项标题、表头 |
| `body` | 14 / 22 / 400 | 正文（与现有 body 一致） |
| `small` | 13 / 20 / 400 | 副文本 |
| `caption` | 12 / 16 / 500 | 标签、时间戳、单位 |
| `metric` | 28–40 / 1.0 / 700 · `--font-num` · `tnum` | KPI 数值 |

**中英混排规则**：中英之间留 `0.25em`（用 `text-spacing` 或排版时注意）；数字/单位用 `--font-num` + `font-feature-settings:"tnum"`（已有 `.text-num`）；正文行长 ≤ 40 汉字 / 75 西文字符。**禁止**正文使用渐变文字（仅「鲁班 7 号」品牌字与首页欢迎语 H1 可用品牌渐变，且全站 ≤2 处）。

### 3.3 间距与栅格

- **基线 8pt**；间距令牌沿用 Tailwind（`gap-2=8`、`gap-3=12`、`gap-4=16`、`gap-6=24`、`gap-8=32`）。卡片内边距：Console `16–20`，Campus `20–24`。
- **栅格**：主内容 `max-width` 分场景——表格/看板页 `1240–1440`，阅读/对话页 `820–960`，仪表盘 `1240`。两侧自适应留白。
- **断点**（沿用现有 Shell）：`<768` 移动（侧栏转 MobileNav Sheet、右栏折叠为顶部抽屉）；`768–1024` 平板（侧栏图标化或保留，右栏隐藏）；`1024–1280` 桌面（显侧栏，右栏按需）；`≥1280` 宽屏（三栏全开）。
- **密度模式**：沿用 `html[data-density="compact"]`（已实现 13px + 16px 圆角），管理端默认可启用 compact。

### 3.4 圆角 / 阴影 / 描边 / 玻璃（使用边界）

| 场景 | Console | Campus |
|---|---|---|
| 按钮/输入 | `--r-sm` 10 | `--r-md` 14 |
| 卡片 | `--r-md` 14 | `--r-lg` 20 |
| 大面板/Hero | `--r-lg` 20 | `--r-xl` 28 |
| 阴影 | `shadow-sm` | `shadow-md`，hover→`shadow-lg` |
| 分隔 | 优先 **1px 描边** `--border-2` | 优先 **留白/底色块**，少用线 |

**硬规则**（避免 AI 味/廉价感）：① **禁止彩色侧边竖条**（`border-left` 粗彩条做卡片强调）——改用整边描边、底色 tint、或前置图标/数字；② 玻璃拟态 `.glass` **仅用于侧栏/右栏/浮层**，内容卡不滥用；③ **不做嵌套卡**（卡里再套同款卡）；④ 阴影只表达 elevation 层级，不当装饰堆叠。

### 3.5 图标与图形系统

- **线性图标**：lucide-react 全站统一，描边 1.5–2px，尺寸档 16/18/20/24。
- **模型 glyph**：复用 `components/common/ModelGlyph.tsx`（5 模型 SVG）+ `login/PlanetGlyph.tsx`（品牌行星）。模型相关位置一律配各自品牌色。
- **3D / 位图资产**：仅 Campus 高光位（首页 Hero、模型广场、空状态、成就、学习探索）。统一由 §7 的 AI 生图产出，**透明 PNG + WebP**，提供 `@1x/@2x` 与暗色版。**严肃区零位图插画**。
- **品牌吉祥物**：「鲁班机器人」（呼应登录页 logo），作为空状态、引导、加载、成就的情感载体（§7.1）。

### 3.6 双调组件令牌（一套组件，按 `data-register` 取值）

在 `globals.css` 增加：
```css
/* 默认 = console（严肃）；活泼区在容器上加 data-register="campus" */
:root, [data-register="console"]{
  --rg-radius: var(--r-md);      /* 14 */
  --rg-radius-lg: var(--r-lg);   /* 20 */
  --rg-shadow: var(--shadow-sm);
  --rg-shadow-hover: var(--shadow-md);
  --rg-motion: 150ms;            /* 状态反馈时长 */
  --rg-lift: -2px;               /* hover 上浮 */
}
[data-register="campus"]{
  --rg-radius: var(--r-lg);      /* 20 */
  --rg-radius-lg: var(--r-xl);   /* 28 */
  --rg-shadow: var(--shadow-md);
  --rg-shadow-hover: var(--shadow-lg);
  --rg-motion: 240ms;
  --rg-lift: -4px;
}
```
组件（如 Card/Button）一律消费 `--rg-*` 而非写死，则**同一组件**在 `<main data-register="campus">` 下自动变「软、圆、动效大」。

> ⚠️ **技术铁律（架构师审阅 P0）**：`--rg-*` **绝不能放进 `@theme inline`**。`@theme inline` 是 Tailwind 4 的**编译期**机制（把变量展开成 utility class，运行时无法被 data 属性回溯覆盖）；而 `data-register` 是**运行时级联**。正确两法：
> - **方案 A（基础件首选）**：`--rg-*` 只放 `:root` + `[data-register]`，组件用 arbitrary value 直接消费：`className="rounded-[var(--rg-radius)] shadow-[var(--rg-shadow)]"`。
> - **方案 B（业务件可选，与现有 `@custom-variant dark` 同源）**：`@custom-variant campus (&:is([data-register="campus"] *));` 然后 `className="rounded-md campus:rounded-xl"`。
>
> **`data-register` 必须由服务端 layout 注入**（`(shell)/layout.tsx` 按路由 `/admin/*`→console 否则 campus 直出到 DOM），**禁止 useEffect 设置**，否则首帧布局抖动。
>
> 📌 **落地工作量提示**：现有 `card.tsx`/`button.tsx` 等**写死了** `rounded-[12px]`/`shadow-md`，全库仅 2 处消费 token。S1 须把基础件硬编码圆角/阴影/位移**统一改为消费 `--rg-*`**——这是一次**横切重构**，非"补充"，须列为独立 DoD。

布局层在 Shell 里按当前路由设置 `data-register`：管理路由 = console，其余 = campus。

---

## 4. 组件规范

> 标注：🟢 已存在（`components/`，本文补齐状态/动效/a11y）｜🟡 强化｜🔵 新建。每个组件给：变体 / 状态 / 尺寸 / 动效 / 可访问性 / 复用映射。

### 4.1 基础层（`components/ui/*`，多数已存在 → 补规范）

**Button 🟢**（已有 7 变体/4 尺寸）
- 变体：`primary`(实心靛蓝) / `grad`(品牌渐变，仅主操作) / `soft`(浅底) / `outline` / `ghost` / `danger` / `warning` / `link`。
- 状态：default / hover(`translateY(var(--rg-lift))` + `--rg-shadow-hover`) / active(下压 1px) / focus-visible(2px 教育蓝环) / disabled(opacity .5, 禁 hover) / **loading（左侧 spinner + 文案"处理中"，禁重复点击）**。
- a11y：最小命中 40×40；图标按钮必带 `aria-label`；`grad` 文字对比度已达标。
- 动效：`transition: transform/box-shadow var(--rg-motion) ease-out`。

**Card 🟢 → 🟡**：消费 `--rg-radius/-shadow`；新增 `interactive` 态（hover 上浮 + 边框提亮）；禁嵌套；禁彩色侧条。

**Badge 🟢**：状态 badge 统一用 §3.1C 语义色（`ok/warn/err/info/proc`）+ 对应 `-bg`。类别 badge（Hawk 风）用 pastel `-bg` + `-ink`。

**Input / Textarea / Select / Checkbox / Switch / Slider / Tabs / Dialog / Dropdown / Tooltip / ScrollArea / Separator / Avatar / Progress 🟢**：均 Radix 基座，补：统一 focus 环、错误态（`--err` 边框 + 下方 `caption` 错误文案 + `aria-invalid`）、disabled 态、暗色适配。

**新建基础件**
- **Skeleton 🔵**：用 `.animate-shimmer`，骨架形状贴合目标布局（卡片/行/头像/图表占位）。所有异步区首屏必有骨架。
- **EmptyState 🔵**：插画（§7 鲁班机器人）+ 一句标题 + 一句说明 + 主操作按钮。Console 用线性图标版，Campus 用 3D 插画版。
- **Toast 🟢(sonner)**：四语义色 + 图标 + 可选撤销；右下；自动消失 4s，错误不自动消失。
- **CommandPalette 🔵(cmdk)**：`⌘K/Ctrl+K` 全局搜索（页面/模型/提示词/智能体/知识库 + 快捷动作）。是「高级感 + 效率」关键件。
- **DataTable 🔵(@tanstack/react-table)**：管理端统一表格——排序/筛选/分页/列显隐/行选/批量操作/空态/加载骨架/粘性表头/数字右对齐 `--font-num`。
- **Gauge 🔵**：半环仪表（AIRecruit 92.67% 风），用于「AI 准确率/健康分」。
- **ProgressRing 🔵**：环形进度（成就完成度、额度用量），中心放数值。

### 4.2 业务层（部分已存在 → 强化 / 新建）

| 组件 | 状态 | 规范要点 |
|---|---|---|
| **StatRow / KpiCard** 🟢 | 强化 | 数值 `metric` 字号 + `--font-num`；涨跌用 `--ok/--err` + ↑↓ 图标；入场数字滚动（count‑up，`prefers-reduced-motion` 关闭）。 |
| **TrendChart / ModelDonut** 🟢 | 强化 | 取 §3.1D 色阶；模型图用品牌色；tooltip 玻璃卡；空数据态。 |
| **GradientFeatureCard** 🔵 | 新建 | Medita「用药/支付卡」风：品牌渐变底 + 白字 + 右箭头；用于首页「今日 AI 额度」「快捷入口高光项」。 |
| **ModelCard** 🟢 | 强化 | 5 模型各自渐变 + glyph/3D 角色；状态：selected / available / request(需申请，**非付费**，文案"申请开通") / maintenance；hover 翻起。 |
| **ChatBubble(MessageBubble)** 🟢 | 强化 | 用户气泡=品牌靛蓝实心；助手气泡=白卡 + 模型色细点；支持 Markdown/代码高亮/表格；**流式打字 + `.animate-blink` 三点**；**引用来源 chip**（点击展开知识库出处）；操作条（复制/重答/赞踩/引用）。 |
| **Composer** 🟢 | 强化 | 自适应高度；附件/图片/语音入口；模型快切；`Enter` 发送 `Shift+Enter` 换行；发送中禁用 + 停止按钮；草稿本地保存。 |
| **KanbanColumn / KanbanCard** 🔵 | 新建 | Hawk 风，用于智能体/提示词「草稿→待审→已发布→已下线」；列头彩色下划线 = §3.1C；卡片含类别丸 + 进度 + 头像堆叠 + 更多菜单；支持拖拽（`@dnd-kit`，新增依赖）与键盘移动。 |
| **AvatarStack** 🔵 | 新建 | 头像堆叠 `+N`；用于协作/使用者/审阅者。 |
| **Leaderboard** 🔵 | 新建 | Dei 风，成就/活跃排行：冠军 3D 头像 + 皇冠 + 排名列表 + 完成度环；**仅 Campus**。 |
| **AchievementBadge** 🔵 | 新建 | 成就徽章（§7 生图）；已得=彩色，未得=灰 + 进度；点亮有庆祝动画。 |
| **CalendarStrip / Schedule** 🟢(TodayCourses) | 强化 | Medita 治疗日历风：周条 + 当日高亮 + 事件点；用于课程表/排期。 |
| **TreeNode(知识库/提示词分类)** 🟢 | 强化 | 展开/折叠 + 选中 + 计数 + 锁标 + 拖入文件高亮；键盘可达（方向键）。 |
| **UploadDialog** 🟢 | 强化 | 拖放区 + 多文件队列 + 逐项进度/状态(done/proc/wait/err) + 类型校验 + 失败重试。 |
| **RightRail · AIContextPanel** 🟢 | 强化 | 对话页右栏：当前模型卡 + 参数 + 引用来源列表 + 推荐提示词 + 安全/合规状态（数据存校内）。 |

### 4.3 组件 ↔ 现有文件映射（实现者对照表）

| 文档组件 | 现有文件 / 动作 |
|---|---|
| Button/Card/Badge/Input… | `components/ui/*`（补状态与 `--rg-*`） |
| StatRow/TrendChart/ModelDonut/QuickActionGrid/TodayCourses/TodoList/AdminView | `components/dashboard/*`（强化） |
| MessageBubble/Composer/ChatSidebar/ChatTopbar | `components/chat/*`（强化流式与引用） |
| ModelCard | `components/hub/ModelCard.tsx`（强化状态） |
| KpiCard/HourHeatmap/AdminTabs | `components/admin/*`（+ DataTable/Gauge 新建） |
| TreeNode/UploadDialog | `components/knowledge/*` |
| Skeleton/EmptyState/CommandPalette/DataTable/Gauge/ProgressRing/GradientFeatureCard/Kanban*/AvatarStack/Leaderboard/AchievementBadge | **新建于 `components/ui/` 或 `components/common/`** |

---

## 5. 页面级蓝图（逐页）

> 每页给：调档 / 目标角色 / 线框 / 关键组件 / 数据 / 交互动效 / AI 生图位 / 空·错态 / 响应式重点。线框用文字描述，实现时配合参考图风格。

### 5.0 全局 Shell（已存在，强化）
- 左侧栏 `--grad-side` 渐变（保留）；选中项：左侧 4px 高亮指示 + 图标着色 + 轻底色（**非彩色竖条贴卡**）。
- 顶栏：面包屑标题 + `⌘K` 搜索入口 + 通知 + 主题切换(Light/Dark/System) + 头像菜单。
- **`data-register` 注入**：`/admin/*` → console；其余 → campus（§3.6）。
- 角色自适应：导航项按 `role` 显隐（学生看不到管理组；教师看教学；管理员/学院管理员看管理组）。详见 §8.1。
- 页面转场：`motion` fade+8px 上移，160ms（reduced-motion 关）。

### 5.1 首页 Dashboard `/dashboard` —— 调档 3（Medita 风友好专业）
- **角色**：全角色入口；按 role 切「教师视角 / 学生视角 / 管理视角」。
- **线框**：顶部欢迎语（"早上好，王思远 👋" + 一句当日洞察）→ KPI 行（StatRow：今日对话/生成/活跃/额度）→ 中区 2/3 趋势图(TrendChart) + 1/3「今日 AI 额度卡」(GradientFeatureCard，品牌渐变)→ 快捷入口网格(QuickActionGrid：教案/试题/论文/配图/学情/反馈)→ 推荐提示词 → 右栏：今日课程(CalendarStrip) + 待办(TodoList)。
- **交互动效**：KPI count‑up；卡片入场 stagger 60ms；快捷入口 hover 翻起 + 图标微动。
- **AI 生图位**：欢迎区右侧小幅「鲁班机器人挥手」3D（§7.1）；快捷入口可用 6 枚扁平 3D 学科/功能图标。
- **空·错态**：新用户无数据 → EmptyState「开始你的第一次 AI 对话」+ CTA；图表无数据 → 占位曲线 + 提示。
- **响应式**：移动端 KPI 横滑、图表全宽、右栏下沉为折叠区。

### 5.2 对话 Chat `/chat` —— 调档 4（Purple Chat 三栏结构）
- **角色**：教师/学生/科研。
- **线框**：左 `ChatSidebar`（会话史：搜索 + 置顶 + 按时间分组 + 未读点）｜中 消息流（`MessageBubble` 流式 + 引用 chip + 操作条；顶部 `ChatTopbar` 模型切换/参数；底部 `Composer`）｜右 `AIContextPanel`（当前模型 + 引用来源 + 推荐提示词 + 数据存校内徽标）。
- **交互动效**：流式打字 + `.animate-blink`；新消息平滑滚动；模型切换时顶栏色条过渡到新模型品牌色；发送时输入区微缩反馈。
- **AI 生图位**：空会话 Hero「问我任何问题」+ 鲁班机器人；模型头像可用 §7.2 的 5 模型 3D 角色。
- **空·错态**：无会话→引导卡 + 建议问题（AIRecruit 风建议卡）；模型超时→可重试气泡；额度用尽→提示"申请提额"（非付费，走审批流）。
- **响应式**：移动端单栏 + 顶部会话抽屉 + 右栏转底部「来源」抽屉。

### 5.3 模型广场 Hub `/hub` —— 调档 4（品牌渐变 + 3D 角色）
- **线框**：标题 + 搜索/能力筛选 → 5 张 `ModelCard`（各自渐变 + 3D 角色 + 上下文窗口/能力标签/状态）→ 「推荐场景」卡（写作/编程/绘图/长文/多模态 → 一键带模型进对话）。
- **交互动效**：卡片 hover 翻起 + 角色微浮(`.animate-float`)；选中态打钩 + 边光。
- **AI 生图位**：⭐ 5 模型 3D 角色（§7.2）是本页主角；可复用登录页 3D 星球作背景点缀。
- **状态**：`request` 模型显示"申请开通"（审批，非付费）；`maintenance` 灰显 + 维护提示。

### 5.4 提示词 Prompts `/prompts` —— 调档 3–4
- **线框**：左分类树（全部/收藏/校园精选/教学/PPT/测验/科研/学习/行政）｜右卡片网格（渐变封面 + 标题 + 推荐模型 + 使用数/收藏/评分 + 难度）｜点开右侧详情抽屉（变量表单 + 预览 + 一键用）。
- **交互**：收藏心跳动画；「校园精选」加 ✨ 角标；使用计数实时 +1 反馈。
- **空·错态**：分类无内容→EmptyState + 「新建模板」；搜索无果→建议词。
- **新建 `/prompts/new`**：表单（标题/分类/难度/推荐模型/变量构建器/正文/预览），降调档至 3（编辑场景偏 console）。

### 5.5 知识库 Knowledge `/knowledge` —— 调档 3
- **线框**：左树（系统/课程/个人空间，含计数与锁）｜右内容（顶部统计卡 + 视图切换「表格(DataTable)/卡片」+ 上传 + 搜索/筛选 + 文件列表：名称/类型/大小/状态/更新时间/权限/操作）。
- **交互**：拖文件入树高亮；上传队列进度（UploadDialog）；处理中文件 `proc` 状态脉冲；权限切换确认。
- **空·错态**：空库→EmptyState「上传第一份资料」；解析失败→错误行 + 重试。
- **a11y**：树形 `role="tree"` + 方向键；表格可键盘操作。

### 5.6 智能体工作台 Agent `/agent` —— 调档 4
- **线框**：顶部 KPI（总数/调用/评分/活跃/待审）→ Tab（全部/教学/科研/行政/我创建/草稿）→ `AgentCard` 网格（渐变 + 能力标签 + 推荐模型 + 绑定知识库 + 调用数/评分 + 状态）。
- **管理视图**：可切 Hawk 看板（草稿→待审→已发布→已下线），供发布审核（与 §5.10 管理端联动）。
- **新建 `/agent/new`**：分步配置（基本→能力/工具→知识库→模型/参数→预览测试→发布），步骤条 + 实时预览。
- **AI 生图位**：智能体头像/封面可用 3D 角色或渐变图案；空状态鲁班机器人「来造一个智能体吧」。

### 5.7 个人中心 / 成就 `/profile` —— 调档 5（成就 Tab 游戏化）
- **线框**：Tab（基本信息 / 安全 / 偏好 / **成就与活动**）。前三 Tab 调档 3（表单为主）；**成就 Tab 调档 5**：连续使用打卡日历、成就徽章墙(AchievementBadge)、学院/班级排行(Leaderboard)、个人使用统计环(ProgressRing)。
- **留存钩子**：连续 N 天解锁徽章；「本周你超过了 82% 的同学」社会认同。
- **AI 生图位**：成就徽章组（§7.3）；个人主页可选 3D 头像。
- **偏好**：模型默认、主题、密度、**青少年护眼模式**（§8.4）、动效开关（reduced-motion）。

### 5.8 （建议新增）学习探索 `/explore` —— 调档 5（Dei 风，最活泼）
- **价值**：把"用 AI 学习"做成有引导的探索任务，显著拉留存（用户诉求）。可作为学生端默认落地页。
- **线框**：3D 角色课程/任务卡网格（学科彩色顶条 + 时长 + 进度）+ 右「成就/排行」+ 顶部「今日任务」。
- **AI 生图位**：⭐ 3D 学科角色/场景卡（§7.4）。
- 备注：此为增值建议，可排在 §9 后期 sprint。

### 5.9–5.13 管理端（调档 1–3，AIRecruit360 + Hawk 风，零 3D/插画）

**5.9 数据看板 `/admin/analytics`（调档 2）**：KPI 行 + 趋势(recharts) + 学院分布柱 + 模型占比甜甜圈 + AI 准确率 Gauge + 时段热力(HourHeatmap)。导出按钮。空数据占位。
**5.10 智能体监控 `/admin/agents`（调档 2–3）**：默认 DataTable（名称/作者/版本/调用/评分/状态/反馈），可切 Hawk 看板做发布审核；行内「上线/下线/查看反馈」。
**5.11 模型管理 `/admin/models`（调档 2）**：模型状态卡（健康/延迟/调用量曲线）+ 额度配置 + 健康检查按钮 + 开关。
**5.12 安全审计 `/admin/audit`（调档 1）**：纯 DataTable（时间/操作者/操作/对象/风险等级/状态）+ 高级筛选 + 风险等级色 badge + 详情抽屉 + 导出。**零装饰动画**。
**5.13 权限管理 `/admin/permissions`（调档 1）**：用户/角色列表 + 权限矩阵（行=角色，列=能力，复选）+ 角色编辑弹窗 + 危险操作二次确认。

> 管理端统一：DataTable 规范一致、确认弹窗一致、空/错/加载态一致、`--font-num` 数字右对齐、compact 密度默认开。

---

## 6. 交互动效与微交互规范

### 6.1 原则
1. **动效服务于反馈与连续性**，不为炫技。2. **ease‑out 收尾**（指数曲线），**禁 bounce/elastic**（Console 尤其）。3. **绝不动画 layout 属性**（用 `transform/opacity`，开 GPU）。4. **全局尊重 `prefers-reduced-motion`**（已在 globals.css 实现，新动画必须可被关闭）。5. Console 动效幅度小、Campus 大（§3.6 `--rg-motion`）。

### 6.2 缓动与时长令牌（写入 globals.css）
```css
:root{
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);     /* 主用：进入/位移 */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* 状态切换 */
  --t-fast: 120ms; --t-base: 200ms; --t-slow: 360ms; --t-cinematic: 600ms;
}
```
`motion`(Framer) 弹簧统一：`{ type:"spring", stiffness:280, damping:24 }`（卡片/弹层），列表 stagger `0.05–0.07s`。

### 6.3 场景动效清单
| 场景 | 规格 |
|---|---|
| 页面转场 | fade + Y 8px，160ms ease‑out |
| 卡片/列表入场 | stagger 60ms，Y 12px→0，opacity 0→1 |
| 卡片 hover | `translateY(var(--rg-lift))` + 阴影升级，`--rg-motion` |
| KPI 数字 | count‑up 800ms ease‑out（reduced 直显终值） |
| 流式回答 | 逐字/逐段 + `.animate-blink` 三点；停止可中断 |
| 骨架加载 | `.animate-shimmer`，内容到达后交叉淡入 |
| 模型切换 | 顶栏色条/光晕过渡到新模型品牌色，300ms |
| 解锁/进入（登录→台） | 沿用登录页电影级解锁；进台首屏轻 Hero 入场 |
| 成就点亮 | 徽章缩放回弹 + 粒子/星光一次性庆祝（仅 Campus，可关） |
| 3D 视差 | 首页/广场 3D 角色随指针轻微视差（≤6px，移动端关） |
| Toast | 右下滑入 + 淡出 |
| 拖拽（看板/知识库） | 抓取放大 + 占位虚线 + 落位回弹 |

---

## 7. AI 生图资产清单（GPT 生图 / Nano‑Banana / Gemini）

> 用户诉求：界面需要的图形元素，用 GPT 内置生图**高保真复刻**。下表每项给**用途 / 位置 / 风格规格 / 可直接粘贴的 prompt / 尺寸 / 透明背景 / 暗色版 / 落盘路径**。
> **统一风格基因**（所有 prompt 复用，确保全站一致）：`soft 3D clay / Pixar-style render, rounded friendly forms, smooth matte surfaces, soft studio lighting, gentle rim light, brand palette indigo #312E81 + edu-blue #2563EB + cyan #06B6D4 with warm accent amber #F59E0B, clean transparent background, subtle ambient occlusion, high detail, centered, no text`。
> **统一负面**：`no text, no watermark, no logo letters, no harsh shadows, no busy background, not photorealistic skin, no clutter`。
> **落盘**：`app/public/illustrations/`（角色/插画）、`app/public/badges/`（徽章）、`app/public/3d/`（已有模型 GLB）。命名 `kebab-case`，每图导出 `@1x.webp / @2x.webp / @1x-dark.webp`（暗色版主要调整描边/发光）。

### 7.1 品牌吉祥物「鲁班机器人」（最高优先，情感主载体）
- **位置**：空状态、首登引导、加载、成就庆祝、对话空屏、错误页。需 5–6 个姿态。
- **Prompt（姿态：挥手欢迎）**：
  `A friendly 3D mascot robot named "Luban", soft clay/Pixar style, rounded chubby body, a small wooden-tech hybrid aesthetic (nod to ancient Chinese craftsman Luban), glowing cyan visor face with two simple friendly eyes, indigo #312E81 and edu-blue #2563EB body with amber #F59E0B accents, waving one hand, cheerful pose, soft studio lighting, gentle rim light, smooth matte surfaces, subtle ambient occlusion, centered, transparent background, no text, high detail` ＋统一负面。
- **变体**：把 `waving` 换成 `thinking with finger on chin` / `celebrating with confetti` / `reading a glowing book` / `sleeping (empty state)` / `pointing forward (onboarding)`。
- **尺寸**：512² 与 1024²，透明 PNG→WebP。

### 7.2 五大模型 3D 角色（模型广场 / 对话头像）
- **位置**：`/hub` 卡片主角、`/chat` 助手头像。各用模型品牌色，**保持同一 clay 基因**以成系列。
- **Prompt 模板**：
  `A 3D clay/Pixar-style spherical character representing the AI model "<NAME>", smooth matte sphere with a subtle friendly face, color palette <C1> to <C2> gradient, soft studio lighting, gentle rim light, floating slightly, soft ambient occlusion, centered, transparent background, no text, high detail` ＋统一负面。
- **代入**：ChatGPT `#10A37F→#2DD4BF`｜Claude `#D97757→#F59E0B`｜GPT‑Image `#7C3AED→#06B6D4`｜Gemini `#4285F4→#A855F7`｜MiniMax `#2563EB→#F59E0B`。
- 备注：已有对应 `.glb`（`app/public/3d/`）可继续用 three.js；位图角色用于卡片缩略与 OG 图，二者风格需对齐。

### 7.3 成就徽章组（个人成就 / 留存）
- **位置**：`/profile` 成就墙、解锁庆祝、排行。约 12 枚（首答/连续7天/百次对话/知识库达人/智能体创造者/科研之星…）。
- **Prompt 模板**：
  `A 3D achievement badge medal, soft clay/Pixar style, rounded shield or circular medal shape, theme: "<THEME e.g. 7-day streak flame>", brand palette indigo/edu-blue with amber gold rim, glossy enamel finish, soft studio lighting, centered, transparent background, no text, high detail` ＋统一负面。
- **双态**：彩色（已得）＋ 生成后用 CSS `filter:grayscale(1) opacity(.5)`（未得），无需单独出灰图。
- **尺寸**：256²。

### 7.4 学科 / 场景卡插画（学习探索 §5.8 · 可选后期）
- **Prompt 模板**：
  `A 3D clay/Pixar-style icon scene representing the school subject "<SUBJECT>", playful objects (e.g. for biology: a friendly cell and DNA helix), pastel accent <PASTEL> with brand indigo, soft lighting, rounded forms, centered, transparent background, no text, high detail` ＋统一负面。

### 7.5 空状态插画（线性版 · Console 用）
- 严肃区不用 3D，改**单色线性插画**（lucide 风格放大组合 or 简笔），用 `--text-3` 色，避免管理端「玩具感」。

### 7.6 其它
- **首页 Hero 背景**：可生成低饱和品牌光斑/星云背景（暗色友好），或复用登录页 Constellation/3D。
- **节日皮肤**（§8.6）：开学季/教师节/期末等限定鲁班姿态与角标。
- **OG / 分享图**：1200×630，鲁班 + 品牌字 + 渐变底。

> **生成流程建议**：先出「鲁班挥手」与「5 模型角色」共 6 张作为风格基准 → 人工确认基因 → 批量出其余，保证系列一致。可在实现阶段由我直接调用生图工具产出首批样例。

---

## 8. 增值补充（你未提到、但强烈建议）

### 8.1 角色自适应（5 角色差异化，关键）
`role: teacher | student | admin | researcher | college-admin`。**同一套页面，按角色裁剪导航与默认落地**：
- **学生**：默认落地 `/explore` 或 `/chat`；导航无管理组；语气最 Campus；强游戏化。
- **教师**：默认 `/dashboard`(教师视角)；强教学快捷入口（教案/试题/学情）。
- **科研**：默认 `/chat`(长文模型)；强知识库与论文场景。
- **管理员 / 学院管理员**：可见管理组；落地可为 `/admin/analytics`；学院管理员数据**按学院隔离**（前端按 scope 过滤展示）。
- 用 zustand `useUserStore.role` 驱动导航与默认路由；权限不足的入口隐藏而非禁用。

### 8.2 首登引导 Onboarding（激活 = 留存第一步）
- 首次登录：3–4 步轻引导（选身份/兴趣学科 → 介绍鲁班与模型广场 → 发起第一次对话）。用 coachmark 高亮 + 鲁班解说，可跳过、不强制。
- 「第一次价值时刻（first value）」目标：**60 秒内完成第一次有用的 AI 输出**。

### 8.3 游戏化与留存机制（呼应"极大留住用户率"）
- **连续使用打卡**（streak）+ 里程碑徽章；**成就与真实产出绑定**（生成 N 份教案、解决 N 个问题），不做空洞积分。
- **班级/学院排行**（Leaderboard，社会认同）+ 「本周超过 82% 同学」。
- **每周 AI 探索任务**（轻挑战）+ 完成度环。
- **克制**：无 dark pattern、无连续打卡焦虑化（断签温和）、无付费诱导（本产品不付费）。

### 8.4 无障碍与中小学合规（硬性）
- **WCAG 2.1 AA**：对比度 ≥4.5:1（pastel 必配 `-ink`）；焦点环全可见；全键盘可达；语义 ARIA（tree/tablist/dialog/table）；图片 `alt`；动效可关。
- **青少年/护眼**：偏好里提供「护眼模式」（降蓝光暖化 + 降对比）、字号放大档（1.0/1.125/1.25）、减少动效一键。
- **色盲安全**：状态不只靠颜色，必伴图标/文字（成功 ✓、错误 ✕）。
- **合规**：未成年人数据最小化提示；内容安全（AI 输出审核）状态可见。

### 8.5 性能预算（高保真 ≠ 卡顿）
- 首屏 LCP < 2.5s；交互 INP < 200ms。**3D/生图资产懒加载**（`next/dynamic ssr:false` + 视口内加载，已用于登录 3D）。
- 图片一律 `next/image` + WebP/AVIF + 尺寸标注；角色位图 ≤150KB(@1x)。
- 字体 `next/font` 自托管 + 子集化中文；路由级 code-split；列表虚拟化（长表/长会话）。
- 动画走 transform/opacity；尊重 reduced-motion；3D 帧率守恒（DPR ≤2）。

### 8.6 主题与皮肤
- 明/暗/跟随系统（已具备）；**节日季节皮肤**（开学季/教师节/期末，仅换 Hero 与鲁班姿态与点缀，不动核心 token）。

### 8.7 信任与安全可视化（教育场景关键差异点）
- 全局可见「数据存校内 · 已加密」徽标（沿用登录页 SSO 信任语言）；对话右栏显「来源可溯」；管理端审计可见性强。这是校园平台的信任资产，应**显性化**而非藏起来。

### 8.8 微文案语气规范
- **Console**：陈述、专业、动词开头（"导出审计日志"/"已停用 2 个模型"）。
- **Campus**：第二人称、鼓励、可带 1 个 emoji（"太棒了，你完成了今天的探索 ✨"/"换个问法，我再试试～"）。
- 错误文案：说人话 + 给出路（"模型有点忙，要不要换 Claude 再试？"），不暴露技术栈细节。

### 8.9 错误 / 降级 / 离线 / 边界
- 统一错误页（404/500/无权限）：鲁班 + 一句温暖文案 + 返回/重试。
- 网络断开：顶部条提示 + 本地草稿保留。
- 长内容/空数据/加载/超时/权限不足：每个数据区都要四态齐全（loading/empty/error/success）。

---

## 9. 实施路线图与验收

### 9.1 分阶段（建议 6 个 Sprint）
| Sprint | 目标 | 产物 |
|---|---|---|
| **S1 地基** | token 增量（§3.1B-E/§3.6/§6.2 写入 globals.css）+ `data-register` 接入 Shell + 新建基础件（Skeleton/EmptyState/Toast/CommandPalette/DataTable/Gauge/ProgressRing） | 设计系统落地、Storybook/样例页 |
| **S2 严肃区** | 管理端 5 页（analytics/agents/models/audit/permissions）按 console 调档 + DataTable 统一 | 管理端可用 |
| **S3 核心用户区** | Dashboard + Chat（流式/引用强化）+ Hub | 主链路可用 |
| **S4 内容区** | Prompts(+new) + Knowledge + Agent(+new) | 全功能页齐 |
| **S5 活泼层** | Profile 成就 + Leaderboard + 成就徽章 + （可选）Explore + 游戏化/Onboarding | 留存机制上线 |
| **S6 资产与打磨** | AI 生图首批 6 张 → 批量；动效/微交互/空错态/响应式/无障碍/性能 全量打磨 | 高保真终态 |

### 9.2 完成定义（DoD，每页必过）
- [ ] 调档正确（`data-register` 对）、token 零硬编码（颜色/圆角/阴影/动效全走变量）
- [ ] 四态齐全（loading 骨架 / empty / error / success）
- [ ] 明暗双色达标、对比度 AA、全键盘可达、`prefers-reduced-motion` 生效
- [ ] 响应式三断点无破版；长列表虚拟化
- [ ] 复用现有 `components/ui/*`，新件入库且有用例
- [ ] 无 §3.4 禁项（彩色竖条 / 嵌套卡 / 滥用玻璃 / 正文渐变字）
- [ ] 截图实测（preview）+ 控制台零错误 + lint/tsc 零错误

---

## 10. 附录

### 10.1 globals.css 增量汇总（实现者照抄）
§3.1B(pastel)、§3.1C(语义色)、§3.6(双调 `--rg-*`)、§6.2(缓动/时长) 的代码块即增量；**已有变量不改**。

### 10.2 命名与目录
- 新组件：`PascalCase.tsx` 于 `components/ui|common|<域>/`；生图资产 `kebab-case.webp` 于 `public/illustrations|badges`。
- 调档容器：`<main data-register="console|campus">`。

### 10.3 参考图 ↔ 应用映射（速查）
AIRecruit360→管理端框架/KPI/gauge/AI 对话三件套；Medita→首页 navy+暖强调/日历/渐变卡；Hawk→智能体提示词看板/类别色；Purple Chat→对话三栏/输入条/反应；Dei→成就排行/3D 角色/游戏化。

### 10.4 待用户确认项
1. 是否新增 `/explore` 学习探索页（§5.8，强留存，建议做）。
2. 学生端默认落地页：`/explore` 还是 `/chat`。
3. 首批 AI 生图是否现在就由我生成样例（鲁班 + 5 模型角色 6 张）。
4. 是否引入 `@dnd-kit`（看板拖拽）依赖。

---

## 11. 评审修订与补充（v1.1，三 agent 审阅折叠）

> 经 **UI 设计总监（8/10）· 无障碍专家（7/10）· 前端架构师（8/10）** 三方审阅。以下为**必须执行的修订项**，与正文同等效力；正文 §3.1C/§3.1D/§3.6 已就地修正，其余汇总于此。

### 11.1 双调差异化要做实（UI ①）
当前分调仅靠圆角/阴影/动效，屏幕上几乎不可感知。**扩展 `--rg-*` 令牌**到真正拉开调性的维度：
```css
:root,[data-register="console"]{ --rg-pad:16px; --rg-type-scale:1; --rg-saturation:0.85; }
[data-register="campus"]{ --rg-pad:24px; --rg-type-scale:1.08; --rg-saturation:1; }
```
- `--rg-pad`：卡片内边距 → 直接改变留白密度（最强分调信号）。
- `--rg-type-scale`：Campus 标题字号 ×1.08、字重更重。
- `--rg-saturation`：Console 压低 pastel/渐变出场（近灰克制），Campus 放行品牌渐变与 pastel。
- **构图原则**：每屏只设一个主视觉焦点；Campus 用「大留白 + 单锚点」。

### 11.2 字体升级（UI ②，关系高级感成败）
- 为 **Campus 高光位**（欢迎语/Hero/成就）指定一款有表情的**展示字**：西文 Geist / Clash Display 级几何无衬线，中文思源宋或特色黑体变体，与正文 Inter 形成「展示 vs 正文」二元。
- `display` 拉大到 **40–48**，明确字距（中文收紧、数字 `tnum`），并给字重语义映射（不是只给一个数）。
- 中文字体落地：**`next/font/local` + `fonttools subset` 预生成 woff2 子集**（常用 3500 字 + 标点），**不要**用 `next/font/google` 的 CJK subset（不可靠、易拉全量几 MB）。

### 11.3 3D 资产质量门（UI ③，避 AI-slop 最大雷区）
- "soft clay/Pixar/cute" 是当前最泛滥廉价的 AI 视觉。**鲁班必须有记忆点**：鲁班锁 / 木作榫卯元素可识别，而非泛化机器人。
- 先出 **2–3 版做美术评审 → 定死参数（打光角度/材质/视角/镜头）→ 出 1 张「基因板」→ 像素级比对批量**（取代 §7.6「先出 6 张当基准」）。
- 补**资产验收标准**：统一视角与光照、系列基因一致、`<canvas>`/位图必带 `aria-label`（装饰性标 `aria-hidden`）。

### 11.4 关键组件的 ARIA / 键盘契约（a11y M4，自动化测不出，最易翻车）
为 §4 下列组件补「role/states + 键盘 + 焦点 + live region」四件套：
| 组件 | 必备契约 |
|---|---|
| CommandPalette(cmdk) | `dialog`+`combobox/listbox/option`、`aria-activedescendant`、↑↓/Enter/Esc、焦点陷阱与归还、结果数 `aria-live` 播报 |
| Kanban 状态流转 | **改用按钮/菜单驱动状态机（"提交审核/上线/下线"），不做拖拽**（审批场景拖拽=误操作+不可达）；若确需排序用已装的 `motion` `<Reorder>`，**砍掉 @dnd-kit 依赖** |
| DataTable(react-table) | `<th scope>`、`aria-sort`、行选 `aria-label`、批量计数 live region、分页可达、空/错/载入对 SR 播报 |
| Gauge/ProgressRing | `role="meter"` + `aria-valuenow/min/max` + `aria-label`（"AI 准确率 92.67%"） |
| TreeNode | `role=tree/treeitem/group`、`aria-expanded/selected/level`、roving tabindex、Home/End |
| Toast(sonner) | 普通 `role=status`、错误 `role=alert`；可键盘聚焦/撤销；hover/focus 暂停计时 |
| ChatBubble 流式 | `aria-live="polite"`，**完成时整段播报**（勿逐字刷屏 SR） |

### 11.5 动效与 reduced-motion 补漏（a11y M5 + 架构师 #7）
- **闪烁 ≤ 3 次/秒**（WCAG 2.3.1）：blink 三点/脉冲/粒子均受限。
- reduced-motion 下：脉冲→静态色、粒子→不播、流式→分段而非逐字、count-up→直显终值。
- ⚠️ **CSS `prefers-reduced-motion` 媒体查询管不到 `motion`(JS) 动画**——JS 动画必须用 `motion` 的 `useReducedMotion()` hook 单独处理。
- 每页**动效预算**：一屏最多 1 处庆祝级动效。

### 11.6 暗色规范（UI 增强 + a11y M6）
- 暗色**不是反色**：背景非纯黑（用品牌靛蓝染）、`elevation` 用 overlay/发光替代阴影、色彩明度补偿。
- pastel 暗色用**成对令牌** `--p-*-surface`（深底）/ `--p-*-ink`（亮字），勿运行时反转浅色。
- 深品牌色（`#312E81`/`#4338CA`）**仅作填充背景，不作暗色前景**；暗色前景/细线用亮化变体（`#60A5FA` 等）。

### 11.7 未成年人保护治理机制（a11y M7，K-12 合规刚需）
在 §8.4 增设子节，落 3 件「机制」而非仅「提示」：
1. **会话/数据留存告知与同意**：留存期、用途、可见范围显性告知 + 未成年人单独同意（对标《未成年人保护法》《个人信息保护法》《FERPA/COPPA》精神）。
2. **家长/教师监管视图**：监护方可见学生 AI 使用概况。
3. **内容安全闭环**：未成年人不当内容一键举报/申诉/求助入口；被拦截时「温和不惊吓」文案。
- 护眼模式**仍须保持 AA 下限**（降对比不得跌破 4.5:1）。

### 11.8 卡片层级 / sparkline / landmark（UI + a11y 增强）
- **卡片三档并存**：主卡（渐变/大/含插画）+ 内容卡（白底描边）+ 信息卡（无边底色块），靠尺寸与填充制造节奏，避免「一屏等大白卡」。
- KpiCard 标准可选 **sparkline**（Medita「数据装饰」手法）。
- 全局 **landmark**：`<nav>/<main>/<aside>` + skip-link + 每页唯一 `<h1>` 不跳级；命中目标 ≥ 44×44（移动端横滑/抽屉/关闭按钮自检）；中英混排补 `lang` 属性。

### 11.9 依赖与技术澄清（架构师 P1/P2）
- **新增依赖**：`@tanstack/react-virtual`（DataTable/长会话虚拟化，当前未装，§8.5 前置）。
- **可砍依赖**：`@dnd-kit` 非必要（见 11.4）。
- **待确认**：`lucide-react@1.14.0` 是反常大版本（社区稳定在 0.4xx）——确认是否有意升级、图标导入与 tree-shaking 正常。
- `motion`/`recharts`/3D 组件均 **client-only**：封装进叶子级 `"use client"` 组件，勿整页 client 化；`next/dynamic ssr:false` 只能在 client wrapper 调用。
- 动手 `next/image`、`next/font`、viewport/metadata **前必读** `node_modules/next/dist/docs/` 对应文档（仓库 AGENTS.md 硬要求，Next 16 与训练记忆有差异）。

### 11.10 反 AI-slop 黑名单（并入 §9.2 DoD，逐条可截图核验）
- [ ] 无彩色侧边竖条做卡片强调
- [ ] 无嵌套卡（卡里套同款卡）
- [ ] 玻璃拟态仅限侧栏/右栏/浮层，内容卡未滥用
- [ ] 正文无渐变文字；全站渐变字 ≤ 2 处（仅品牌字 + 首页 H1）
- [ ] pastel 面积 ≤ 15%，且必配 `-ink` 文字
- [ ] 非一屏等大圆角白卡（卡片三档有节奏）
- [ ] 3D 角色不铺满（仅 Campus 高光位 + 空状态；管理端零 3D/插画）
- [ ] 无霓虹光晕堆叠、无 emoji 滥用（Campus 每处 ≤1 个）
- [ ] 图表/状态不只靠颜色（叠加文字/图标/形状/标注）
- [ ] 数据可视化语义锁色（同实体跨图同色）

### 11.11 三方共识：做得好的点（保留）
`data-register + --rg-*` 分调机制（工程级巧思、与现有 `@custom-variant dark` 同源）；§1「借鉴/不照搬」二分提炼；§3.4 反俗套硬规则；pastel+`-ink` 体系（亮色实测全 ≥4.5:1）；四态入 DoD；性能预算量化；a11y/合规前置；"只增不改"token 纪律与现状逐字吻合。

---

*文档结束 · v1.1 · 已经 UI 设计总监 / 无障碍专家 / 前端架构师 三方审阅并折叠必改项 · 待用户确认 §10.4 + §11.9 事项后即可驱动开发*

