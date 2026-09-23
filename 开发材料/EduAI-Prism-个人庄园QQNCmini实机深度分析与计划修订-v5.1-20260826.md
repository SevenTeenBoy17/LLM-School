# EduAI Prism 个人庄园 QQNCmini 实机深度分析与计划修订 v5.1

> 版本：5.1  
> 日期：2026-08-26  
> 文档类型：实机审计、现状校准、前端 UI/交互/资产路线修订与验收增量  
> 审计对象：`C:/Users/nuoya/AppData/Local/QQNCmini`、当前 `/student/manor` 实现、v5.0 路线与 v5.2 未挂载原型  
> 前置文档：`EduAI-Prism-个人庄园前端升级与跨学科证据链闭环路线-v5.0-20260825.md`  
> 继承关系：本文是 v5.0 的事实校准与增量修订。未被本文明确修改的证据模型、权限、双部署和未成年人保护原则继续有效  
> 交付边界：本文定义下一阶段如何修改与验收，不代表所列后端、页面和资产均已实现  

---

## 0. 一页决策

### 0.1 核心判断

QQNCmini 值得学习的是以下产品规律：

1. 全幅场景承担第一视觉信号，HUD 沿四周布置，中央地块保持可操作。
2. 高频动作、次级系统、复杂任务分别使用工具坞、附着式托盘、居中工作面和全场景活动中心。
3. 成熟产品不是“按钮很多”，而是入口、状态、异步结果、资源变化、任务进度和返回路径形成连续反馈。
4. 物体附近显示状态，工具选择后显示语义，再对不满足条件的动作返回具体原因。
5. 图鉴、时令活动和任务板把长期目标、阶段进度与当下行动连接起来。

QQNCmini 不应被复制的部分包括：专有角色、Logo、建筑、作物、图标、文案、活动剧情、SWF/Unity/缓存位图、旧 CEF/Flash 技术路线、付费/排行/偷取/限时清零机制以及碎片化二次授权。

个人庄园应继续定义为“学习证据的可解释投影层”，并吸收参考产品的交互语法，而不是把学习链改造成农场任务换皮。

### 0.2 v5.1 五项立即决策

| 决策 | 结论 | 原因 |
| --- | --- | --- |
| 是否采用 CEF、Unity 或 Flash | 否 | 参考应用内存占用高、运行时陈旧、学校部署维护成本高 |
| 是否直接复用 QQNCmini 资产 | 否，立即隔离 | 当前路由存在直接导出精灵引用，与 v5.0 洁净创作红线冲突 |
| 是否直接挂载 v5.2 Mock 原型 | 否 | 它验证了交互概念，但不使用真实 API，刷新即重置，不是生产闭环 |
| 地块数量 | MVP 固定 24 块，6×4 | 与当前 v2 数据和已认可界面一致，避免无必要的 24→16 数据迁移 |
| 首个交付策略 | 先做一条真实纵向闭环，再扩面 | 防止同时铺开项目、图鉴、社交、季节系统后仍没有一条权威链路 |

本文唯一的 MVP 切点是 `CR-MANOR-010`。它包含 Phase 0A、0B、0C 和 Phase 1：资产止损、交互基础设施、隐私/领域/教师前置能力，以及一条学生到教师再回到学生庄园的真实闭环。Phase 1 只交付 `AtlasLite` 来源追踪页、390px 等价列表链路和 `SaveAndExit`；完整图鉴、场景平移缩放、通知联动和多项目扩展不属于首个 MVP。

### 0.3 发布阻断项

以下问题未解决前，不得把当前页面标记为可公开发布：

- `page.tsx` 和 `manor.module.css` 仍引用 `/art/qq-farm/**`。
- `REGISTRY.md` 记录 10 张精灵来自 QQ 农场 SWF 只读导出，它们不是原创发布资产。
- v5.2 `ASSET_PROVENANCE.md` 声称路由仅使用 `manor-v3`，与实际引用不一致。
- v5.2 QA 报告验证的是确定性内存 Adapter，而当前挂载路由仍调用 v2 API。
- `ManorExperience.tsx` 未被当前路由引用，不能用其测试结果证明真实页面闭环。
- 浇水、施肥、除虫在当前页面仍归并为同一个服务端 `nurture` 动作。
- 多个可见入口仍只弹说明、错误映射面板或展示无法完成的禁用状态。

---

## 1. 审计方法、边界与证据强度

### 1.1 已执行的工作

1. 对 QQNCmini 安装目录进行文件、扩展名、版本、签名、哈希和配置清单扫描。
2. 使用 Kaspersky 21.24 对目录执行“仅报告、不修复、不删除”的全文件扫描。
3. 检查 .NET/WPF、CefSharp、Chromium、Flash、配置 URL、PDB 类名和启动边界。
4. 两次正常启动应用，使用已保存的本机账号入口登录，不读取或输入密码、令牌、Cookie。
5. 等待真实主场景加载，逐步使用仓库、种子空状态、节气系统、活动说明、排行榜、图鉴、图鉴说明、系统玩法、活动中心、主题任务和农具反馈。
6. 对异步页面等待真实结果后再判断，未以首次空白或加载图标代替最终结果。
7. 记录运行进程数、内存、连接摘要和安装目录内的文件变化元数据。
8. 正常退出并确认 QQNCmini 相关进程全部结束。
9. 对照当前庄园路由、未挂载原型、v2 服务、测试与资产登记文件进行事实校准。

### 1.2 未执行或受限的内容

- 不读取账号缓存、令牌、Cookie、聊天、二维码内容或其他个人数据。
- 不购买、充值、领奖、发送消息、修改账号设置、偷取好友作物或公开任何数据。
- 不把缓存、SWF 导出图、QQ 截图或反编译代码复制到 EduAI 发布目录。
- 安装目录不是完整游戏源码。能够确认的是微端外壳与运行边界，远程业务服务端不可由本地目录还原。
- 临时 ILSpy 工具下载超时，因此没有把完整反编译代码作为证据；代码判断来自签名程序集、配置、PDB、类型/类名、字符串和真实运行行为。
- 运行环境使用代理，连接显示为 `198.18.0.0/15` 合成地址，不能仅凭套接字 IP 反推真实域名。

### 1.3 证据等级

| 等级 | 证据 | 可支持的结论 |
| --- | --- | --- |
| A1 | 带路径、时间、hash/commit 的源码、配置、扫描报告、测试产物 | 可重复核验的当前事实 |
| A2 | 本轮实机操作、等待后的返回、进程/连接和会话命令输出，但未形成独立归档 | 本次审计观察；不能单独作为发布门禁 |
| B | 签名、哈希、配置、程序集/PDB 元数据 | 技术栈、启动器结构和依赖风险 |
| C | 既有研究文档、Mock 测试、设计说明 | 设计意图和候选方案，不能单独证明生产完成 |

---

## 2. QQNCmini 结构与技术路线分析

### 2.1 安装目录事实

| 项目 | 观察结果 |
| --- | --- |
| 文件数量 | 111 个，约 362.9 MB |
| 启动器 | `QQNCmini.exe`、`AppLauncher.exe` |
| 主外壳 | `app/qqncminiwpfn45.exe` |
| 桌面技术 | .NET Framework 4.5.2、WPF/WinFormsHost |
| Web 容器 | CefSharp 86、Chromium 86.0.4240.x |
| 旧兼容层 | `pepflashplayer32.dll`，Flash 22.0.0.192 |
| 当前游戏入口 | 配置指向腾讯远程 Unity Web 页面，同时保留旧 Flash 资源能力 |
| 外壳能力 | 多账号页签、快速登录、主页入口、刷新、缓存清理、截图、声音、老板键、外部页面和更新 |

主程序、启动器、主外壳和 CefSharp 子进程具有有效腾讯签名；部分第三方/native DLL 未签名，卸载器未签名。有效签名只证明发布者和文件完整性，不证明陈旧依赖仍安全。

### 2.2 安全扫描结果

Kaspersky 扫描统计：

- 扫描对象：115
- 正常：115
- 检测：0
- 可疑：0
- 跳过：0
- 错误：0
- 处理策略：仅报告

该结果说明本次目录扫描未发现恶意对象，但病毒库时间为 2026-05-16，且 CEF 86、Chromium 86、Flash 22 已属明显陈旧技术。安全结论应写为“未检出恶意对象，但存在不可接受的遗留运行时攻击面”，不能写成“绝对安全”。

### 2.3 运行架构

```text
QQNCmini/AppLauncher
  -> WPF 主外壳
  -> WinFormsHost
  -> CefSharp 主进程
  -> 4 个 BrowserSubprocess
  -> 远程 QQ 登录与游戏页面
  -> Unity Canvas/旧 Flash 兼容资源
```

实机运行时观测到：

- 主外壳 1 个，约 214.7 MB Working Set。
- CefSharp 子进程 4 个，合计约 873.1 MB Working Set。
- 总计约 1.09 GB，不含系统和代理开销。
- 最终状态有 6 条 443 连接；代理使用合成地址，未据此做域名归因。
- 安装目录本轮只观察到 `tmp_manifest.json` 元数据更新；浏览缓存位于其他目录，本轮未读取。

### 2.4 对 EduAI 技术路线的结论

不要移植 QQNCmini 的桌面壳或游戏运行时。EduAI 保持：

```text
Next.js 16 + React 19
  -> 原创静态场景 WebP/AVIF
  -> 可访问 DOM 热点与地块
  -> React Query/领域 Adapter
  -> Next Route/API
  -> SQLite 校内部署或 PostgreSQL 公网部署
```

只有在教育交互必须依赖连续空间运动时才引入 Canvas；庄园主链不需要 Unity、Three.js 或 WebGL。文本、状态、按钮和命中区必须保持为 DOM，确保键盘、屏幕阅读器、测试和低端设备可用。

---

## 3. 实机 UI、视觉与交互语言

### 3.1 页面构图

QQNCmini 的稳定结构为：

1. 顶部微端壳：账号页签、站点链接、主页/刷新/清理/截图/声音等工具。
2. 左上资源板：头像、等级、经验、货币和状态。
3. 顶部系统入口：大图标、短标签、深色描边。
4. 左侧活动轨：垂直入口和角标。
5. 中央农场：曲线路径、建筑、地块和对象状态。
6. 右侧社交入口：好友或活动热点。
7. 底部工具坞：语义明确的大图标农具。

它的核心优点不是“像游戏”，而是四边 HUD 不遮挡中央工作区，视线先看场景，再看任务和工具。

### 3.2 四类表面层级

| Surface | 参考行为 | EduAI 用法 |
| --- | --- | --- |
| `EdgeDock` | 顶部系统、左侧活动、底部工具常驻 | 项目、证据、待修订、情境工具 |
| `AttachedTray` | 日常玩法/系统玩法从触发器附近展开 | 低频学习系统目录，不遮挡全场景 |
| `ModalWorkspace` | 仓库、图鉴、任务板居中并压暗场景 | 证据整理、任务详情、修订、图鉴 |
| `WorldHub` | 大型活动覆盖游戏画布，内部再开任务面板 | 跨学科项目叙事中心和阶段地图 |

当前 v5.0 只列出面板名称，没有定义表面层级和互斥规则。v5.1 新增 `OverlayCoordinator`，任何时刻最多一个主工作面，次级气泡不能穿透点击或遮挡关闭入口。

### 3.3 视觉语言

- 背景：高明度黄绿草地、青蓝天空、焦糖土壤和暖白路径。
- 面板：胡桃木/竹木外框、奶油纸内页、金色装饰、绿色主动作。
- 图标：高饱和、粗轮廓、白色外描边、暖色投影。
- 字体：短标题使用粗圆展示字，正文保持清晰无描边。
- 形状：不是现代 SaaS 的卡片瀑布，而是场景、工具、卷轴和任务板。
- 动效：按压、弹出、轻回弹、状态高亮，强反馈只用于阶段完成。

EduAI 可继承材质类别、层级、对比、触觉感和动画节奏，不继承可识别构图、角色、建筑、作物、文字、图标或配色数值组合。

### 3.4 状态反馈规律

实机确认的反馈包括：

- 工具悬停显示“收获果实/捞鱼”等语义。
- 点击地块后显示对象名、状态、土地类型和评估值。
- 不满足前置条件时出现“这块地没东西可收获”明确反馈，状态未改变。
- 仓库分类切换会返回真实空状态和后续入口。
- 排行榜先加载，约 6 秒后返回真实列表与分页。
- 活动任务同时显示时间窗、目标、进度、奖励和完成状态。

应改进之处：部分入口加载期间空白、没有文字说明；某些按钮点击无响应；个别帮助和加工入口跳到不相关页面或二次授权。

---

## 4. 真实使用链路与产品启示

| 实机步骤 | 等待后的真实结果 | 可吸收做法 | EduAI 必须避免 |
| --- | --- | --- | --- |
| 已保存账号登录 | 登录窗关闭，进入场景加载 | 低摩擦恢复上次会话 | 显示账号标识、无最小授权说明 |
| 主场景加载 | 全屏进度条、年龄提示、最终进入农场 | 明确加载阶段和法律/健康提示 | 只给装饰性进度、不提供失败恢复 |
| 仓库 | 果实/成鱼/种子/点券/加工品分类、搜索、总价值、动作 | 分类、搜索、数量和上下文动作一体 | 将学习证据设计成可出售商品 |
| 种子分类 | 空仓状态、购买种子 CTA、部分动作禁用 | 空状态给出下一步 | 只显示灰按钮，不解释权限/条件 |
| 节气系统 | 时间窗、每日领取、订单、积分、技能、商店、里程碑 | 用时令主题串联长期项目和每日行动 | 临时货币清零、每日领取压力、付费购买 |
| 活动详情 | 说明种植→订单→积分→排行→奖励完整规则 | 在一个帮助面解释闭环 | 偷取好友、个人公开排行、机械刷取 |
| 种田排行榜 | 加载后返回排名、积分和分页 | 异步终态、分页 | 初始空白无状态、未成年人竞争压力 |
| 成就图鉴 | 多维进度、分类、分页、徽章和详情入口 | 长期成长视图、多维进度 | 巨大分母、朋友攀比、数量替代质量 |
| 图鉴说明 | 白屏后加载到无关公众号页面 | 无 | 帮助内容跨域、返回路径不清楚 |
| 系统玩法托盘 | 一次显示多个低频系统 | 附着式目录降低主界面拥挤 | 同一功能重复出现在多处 |
| 加工坊 | 跳到 QQ 二次快捷登录 | 无 | 跨模块身份断裂、再次请求权限 |
| 活动中心 | 世界观主视觉、主题任务/活动商店/章节入口 | 重大项目可使用场景化 Hub | 用剧情和奖励掩盖任务本身 |
| 每日任务 | 进度、奖励、领取、未完成原因并列 | 行动列表和终态清晰 | 签到、PVP、礼物成为学习代理指标 |
| 收获工具 | 选中态、对象信息、失败原因，无错误写入 | 工具→对象→前置→结果的短链 | 只弹 toast，不展示对象与下一步 |
| 重新启动 | 已保存入口可再次进入主场景 | 恢复和重入必须稳定 | 靠本地隐式状态无法解释恢复来源 |

### 4.1 参考产品暴露的缺陷

1. 空白加载和旋转图标没有可读状态或超时恢复。
2. “土地幻订单”点击后未出现结果，也没有禁用原因。
3. 图鉴说明跳到无关内容，帮助与当前任务断裂。
4. 加工坊触发二次登录，模块间身份和返回路径不连续。
5. 顶部系统入口和两个玩法托盘重复，信息密度高但可预测性下降。
6. 个人排名、偷取、每日领取、临时货币清零不适合未成年人教育产品。
7. 大量文字直接嵌在复杂插画中，不利于缩放、读屏和多语言。
8. 旧 CEF/Flash 技术栈对学校部署、安全更新和低端设备不友好。

EduAI 只能学习参考产品“做对的结构”，并把其缺陷转化为强制测试项。

---

## 5. 当前 EduAI 庄园真实状态校准

### 5.1 三套实现不能混为一谈

| 对象 | 当前事实 | 可作为何种证据 |
| --- | --- | --- |
| 已挂载 `page.tsx` | 1021 行，调用 `createManorLearningRepository()` 和 v2 API | 当前生产候选行为 |
| `LearningHub.tsx` | 627 行，包含任务、工坊、班级、成果和健康节奏 | 当前真实 UI，但领域边界过度集中 |
| `ManorExperience.tsx` | 630 行，使用 `createMockManorExperienceAdapter()` | 概念原型和交互参考，未挂载 |
| `manor-experience.ts` | 内存快照、确定性结果、刷新重置 | 领域原型，不是持久化实现 |
| v5.2 QA 文档 | 验证 Mock Adapter 和原创 16 地块设计 | 原型验收，不证明当前路由 |
| `manorV2.ts` 与 `/api/v2` | 已有真实证据、地块、教师/管理员基础 | 迁移起点 |

### 5.2 当前代码问题

1. `page.tsx`、`LearningHub.tsx`、`manor.module.css` 分别达到 1021、627、1872 行，状态、视图、请求和演示控制混杂。
2. “新增应用、站内信、关闭农场、问题反馈”等仍只弹本地说明。
3. “装扮农场”映射创作工坊，“好友列表”映射班级面板，名称与结果不一致。
4. 浇水、施肥、除虫最终都映射为 `nurture`，无法证明工具语义真实。
5. portfolio bootstrap 把作品学科固定为“科学”。
6. `missionProgress` 仍由 `daily.completed` 压缩为 `0/1`，不能表达里程碑分步完成。
7. 锁地说明仍是笼统“完成学习项目、积累成长值”，不是服务端条件。
8. 当前页面有真实 API，未挂载原型却宣称“外部请求 0、庄园 API 请求 0”，测试对象与发布对象漂移。

### 5.3 资产合规冲突

当前路由直接引用：

```text
/art/qq-farm/farm-scene.webp
/art/qq-farm/sprites/*.png
```

`REGISTRY.md` 明确记录 10 张精灵来自 QQ 农场 SWF 导出。无论它们是否经过匿名化、是否只读导出，都不能作为 EduAI 的原创公开资产。`farm-scene.webp` 的构图也需要独立相似性复核。

v5.1 要求：

- 立即把 `/public/art/qq-farm` 标记为审计隔离区，不再由任何发布路由 import/url 引用。
- 研究材料移出 `public`，保留访问控制和用途说明。
- 现有 `manor-v3` 是 4×4、16 地块原型，只能留在原型/研究范围；发布替换必须新建 6×4、24 地块原创资产（建议命名 `manor-24-v1`）及同版本命中图。
- 构建门禁扫描 `/art/qq-farm`、SWF 导出文件 hash、QQ/腾讯品牌关键词和未经登记资产。
- 资产文档由构建脚本根据 import 图生成，禁止人工声明与运行时不一致。

### 5.4 地块数量决议

v5.0 和当前 v2 使用 24 地块；v5.2 原型和生成场景使用 16 地块。v5.1 选择 24 块，理由：

- 不引入额外的数据迁移和授权账本映射。
- 与用户认可的界面和长期成长空间一致。
- 可按 6×4 形成稳定几何，桌面命中区更容易测试。
- 移动端通过平移/缩放和列表视图访问，不强行缩小为一次全显示。

若未来要改为 16 块，必须单独提交数据迁移、资产重绘、命中图、回滚和产品决策，不允许由一张新背景图隐式决定。

---

## 6. 对 v5.0 的逐章修订

| v5.0 章节 | v5.1 修改 |
| --- | --- |
| 1.1 审计范围 | 删除“本轮不执行 QQNCmini”；加入本次实机证据、限制和运行数据 |
| 1.3 当前缺陷 | 新增资产发布风险、文档/测试对象漂移、未挂载 Mock 冒充真实闭环 |
| 6 信息架构 | 新增四类 Surface、OverlayCoordinator、系统托盘与项目 WorldHub |
| 7 核心组件 | 新增成果图鉴、时令探究、任务板、操作回执、身份连续性组件 |
| 8 按钮契约 | 新增命中区、表面类型、等待策略、回执、下游可见和跨域禁止字段 |
| 9 前端路线 | 明确保留 Next/DOM；禁止 CEF/Unity/Flash；确定 24 地块与 HTTP Adapter 迁移 |
| 10 资产规范 | 把直接 SWF 导出引用列为阻断；加入自动 import 图和相似性门禁 |
| 12 实施阶段 | 在 Phase 0 前增加“事实与资产止损”；先交付纵向闭环再扩展系统 |
| 13 测试 | 加入热点命中图、Overlay 互斥、白屏超时、身份连续、真实路由绑定测试 |
| 16 DoD | 新增代码/文档/测试/资产四方一致；未挂载原型不得计入完成 |
| 17 任务拆分 | 先清除发布资产风险、建立 Surface/HitMap，再实施功能扩面 |

---

## 7. v5.1 前端 UI 与交互架构

### 7.1 桌面信息架构

```text
ManorShell
├─ TopBar
│  ├─ 返回学习中心
│  ├─ ProjectCompass
│  ├─ SyncStatus
│  ├─ LearningMailbox
│  └─ SaveAndExit
├─ PlayerProjectHUD
│  ├─ 当前角色
│  ├─ 当前里程碑
│  └─ 可用/保留成长授权
├─ ActivityRail
│  ├─ 今日行动
│  ├─ 待整理证据
│  ├─ 待修订
│  └─ 班级共建
├─ SystemDock
│  ├─ 项目地图
│  ├─ 记忆温室
│  ├─ 论证工坊
│  └─ 成果图鉴
├─ ManorScene
│  ├─ 24 PlotHotspot
│  ├─ 7 LearningLandmark
│  └─ AccessibleSceneList
├─ ContextActionDock
└─ OverlayCoordinator
   ├─ AttachedTray
   ├─ ModalWorkspace
   └─ WorldHub
```

顶部和四周只放入口与状态，不在 HUD 里复制复杂表单。复杂工作必须进入具备标题、来源、进度、关闭和恢复焦点的工作面。

### 7.2 新增核心组件

#### `OverlayCoordinator`

- 单一权威状态：`closed / tray / modal / worldHub`。
- 管理焦点陷阱、Esc、返回触发点、z-index、场景 inert 和 URL deep link。
- 新表面打开前先关闭或保存旧表面，禁止多个透明层叠加。
- 跨域页面不得在庄园工作面内无提示替换内容。

#### `SceneHitMap`

- 每个热点定义 `controlId`、`sceneEntityId`、多边形、层级、可见条件和命中优先级。
- 开发模式可显示命中边界和重叠警告。
- 不使用透明全屏元素吞掉其他点击。
- 1440、1280、1024、768、390 逐点自动点击并验证打开的 `surfaceId`。
- 命中坐标由场景坐标统一换算，测试最小/最大缩放、平移边界、重置聚焦、横竖屏、安全区和代表性 DPR，不能只测初始变换。

#### `ContextActionDock`

- 先选择对象，再展示该对象可用动作。
- 工具选中必须有图标、文字、颜色和 `aria-pressed`。
- 服务端 `precondition` 在提交前可见；失败时显示对象状态、原因和下一步。
- 不再让所有养护动作进入一个模糊 `nurture`。

#### `LearningReceipt`

任何写操作返回后显示：

```text
发生了什么
影响了哪个对象
使用了哪条证据/授权
权威版本和时间
下一步可以做什么
查看来源 / 撤销或申诉（适用时）
```

Toast 只做短提示，回执才是可复核结果。

#### `EvidenceArchive`

借鉴仓库的信息组织，但不借鉴“出售”隐喻：

- 分类：待整理、待提交、待复核、需修订、已接受、成果。
- 筛选：项目、学科、目标、来源类型、版本和可见范围。
- 搜索：标题、来源摘要和学生标签。
- 卡片：来源、版本、目标关系、评价状态、下一个动作。
- 空状态：说明为什么为空，并提供可达的真实来源入口。

#### `EvidenceAtlas`

借鉴成就图鉴的长期视图，改为证据质量维度：

- 项目里程碑完成度。
- 不同来源覆盖度。
- 学科目标覆盖度。
- 反例/局限完整度。
- 修订改善记录。
- 学生自主解释和教师反馈回流。

不显示公开个人总榜、不使用夸张的总收集数、不以朋友比较制造压力。每个图鉴单元都能打开来源、理由、评价和版本。

#### `SeasonalInquiryHub`

把“节气系统”改造成教师可发布的时令探究项目：

```text
本期真实问题
  -> 观察/测量任务
  -> 数据和证据
  -> 小组讨论/反例
  -> 作品或行动建议
  -> 反馈修订
  -> 班级共同成果
```

可以显示活动时间窗、阶段进度和本周任务，但不设置每日领取、过期货币清零、付费入口、偷取或个人排名。未参加的学生有等价数据集/模拟路径。

#### `ProjectWorldHub`

重大跨学科项目可使用全场景叙事页，但内容必须是：驱动问题、里程碑、受众、角色、证据缺口和当前阻塞。主视觉不能挤掉任务可读性，所有标题和按钮均为 DOM。

#### `ProjectTaskBoard`

保留“本期任务/今日行动”双层结构：

- 本期任务：里程碑目标、必需证据、完成规则。
- 今日行动：从本期任务派生的可完成步骤。
- 每项显示目标、进度、证据状态、预计时间、结果和下一步。
- “领取”改为“查看结果/继续修订”，奖励由权威状态自动结算。

### 7.3 移动端

移动端按年级带控制认知负荷，而不是所有学生固定五入口：

```text
低年级/未知：庄园 | 今日任务 | 我的
高年级：庄园 | 项目 | 证据 | 温室 | 我的
```

- 24 地块场景可平移/缩放，默认聚焦当前地块。
- 提供等价列表视图，不要求精确点击小地块。
- AttachedTray 转为底部 Sheet，ModalWorkspace 使用全屏 Dialog。
- `SaveAndExit` 和同步状态始终可达。
- 低年级被收纳的项目、证据和温室入口从“今日任务/我的”内可达，不删除能力。
- control manifest 必须声明 `gradeBand`、`viewport`、`mobilePath`、`surfaceId` 和 `maxDepth`；路由图自动断言所有功能三次点击内可达，核心信息不依赖 hover。

### 7.4 无障碍场景契约

- 场景热点与 `AccessibleSceneList` 共享 `sceneEntityId`、名称、状态、可用动作和单一 selection store；任一侧选择后另一侧同步高亮与焦点语义。
- 场景热点使用真实 `button`；同类地块采用 roving focus，方向键移动，Enter/Space 打开动作，Esc 返回当前对象。列表视图提供同等功能，不要求手势或精确指点。
- 状态变化通过可控 live region 宣告对象、结果和下一步，不重复朗读装饰信息；失败后焦点落在错误摘要，关闭后回到触发器，触发器不存在时回到稳定的场景/页面标题。
- 动画遵循 `prefers-reduced-motion`；缩放、拖动、长按均有按钮或列表替代。
- 自动门禁包含全程无指针 E2E；人工矩阵至少覆盖 NVDA + Chrome、VoiceOver + Safari 和 TalkBack + Chrome 的 MVP 纵向链路，并记录版本与结果。

---

## 8. 教育证据链与游戏化修订

### 8.1 权威闭环

```text
真实学习事件
  -> EvidenceCandidate
  -> 学生选择目标并解释关联
  -> 自动规则/教师量规
  -> 接受、退回或需修订
  -> Revision
  -> AcceptedEvidence
  -> 一次性 Grant
  -> 地块/地标/班级成果变化
  -> LearningReceipt
  -> EvidenceAtlas 与成长档案
  -> 下一次复习或项目任务
```

场景动作只消费已经签发的授权，不自己制造高价值学习证据。浇水次数、在线时间、打开活动、点击图标和连续登录都只能进入短期行为轨迹。

### 8.2 跨学科不牵强的 UI 守卫

提交关系前必须同时展示并校验：

1. 共同驱动问题。
2. 具体学科目标，而不是学科名称。
3. 证据来源和版本。
4. 该学科对最终成果的必要作用。
5. 学生自己的关系说明。
6. 至少一项局限或反例。
7. 教师量规和修订入口。

以上七项是版本化领域不变量，不只是 UI 提示；服务端在创建、修订和教师决定时必须重新校验。每个学科分别保存具体目标、学生论证、对成果的必要作用和量规结论，来源元数据由系统填充，不让学生手录伪造。

负向验收必须拒绝仅共享“植物、农场、节水”等主题词的关联。还要执行“移除学科”测试：删除任一声称必要的学科后，最终解释、方法或成果若没有实质变弱，则该关系不能被标记为跨学科闭环。低年级使用句型、示例和语音辅助，但不降低上述证据条件。

### 8.3 从参考活动系统吸收什么

可以吸收：主题周期、阶段任务、里程碑进度、任务详情、上下文帮助和班级共同成果。

必须替换：

| 参考机制 | EduAI 替代 |
| --- | --- |
| 每日领取 | 今日建议，可跳过，不丢失权益 |
| 排行积分 | 班级共同目标与个人私密进步 |
| 临时货币清零 | 可解释、不过期的项目授权或无货币设计 |
| 偷取好友 | 请求同伴反馈、共同观察或匿名数据交换 |
| PVP | 合作比较方法、共同找反例 |
| 付费购买 | 学校配置的等价参与资源 |
| 签到奖励 | 自然结束和间隔复习 |

---

## 9. 技术实现路线

### 9.1 推荐前端目录

```text
student/manor/
  page.tsx
  composition/
    ManorComposition.tsx
    manor-feature-flags.ts
  components/
    shell/
    scene/
      ManorScene.tsx
      SceneHitMap.tsx
      AccessibleSceneList.tsx
    surfaces/
      OverlayCoordinator.tsx
      AttachedTray.tsx
      ModalWorkspace.tsx
      ProjectWorldHub.tsx
    projects/
    evidence/
      EvidenceArchive.tsx
      EvidenceAtlas.tsx
    tasks/
      ProjectTaskBoard.tsx
      SeasonalInquiryHub.tsx
    plots/
      PlotActionSheet.tsx
      ContextActionDock.tsx
    receipts/
      LearningReceipt.tsx
    shared/
  model/
    types.ts
    state-machine.ts
    surface-machine.ts
    selectors.ts
    control-manifest.ts
    hit-map.ts
  adapters/
    ManorV2Adapter.ts
    ManorV3HttpAdapter.ts
    ManorDemoAdapter.ts
  hooks/
```

配套教师、API 和领域边界必须在同一实施计划中有明确所有者：

```text
teacher/manor/
  projects/          # 版本化项目、目标、量规与分配
  reviews/           # 已分配队列、详情、退回/接受、冲突
api/v3/manor/
api/v3/teacher/manor/
lib/manor-v3/
  domain/            # evidence/revision/grant/operation invariants
  application/       # commands, queries, receipts, project review
  persistence/       # SQLite/PostgreSQL repositories
db/migrations/manor-v3/
tests/contracts/manor-v3/
tests/e2e/manor-v3/
```

`ManorDemoAdapter` 只能在 Storybook、开发演示和测试 fixture 中使用，生产 composition 必须在构建时排除。

### 9.2 组件迁移策略

- 从当前页面保留真实 bootstrap、失败重试、操作 busy、焦点归还和 v2 能力。
- 从未挂载 `ManorExperience` 提取 Surface、场景节点、证据关系和错误状态设计。
- 不直接把 `ManorExperience` 挂到生产路由，也不保留它的内存权威状态。
- 先建立 Adapter contract test，再用 `ManorV3HttpAdapter` 替换组合根。
- 删除或隔离重复的 `INITIAL_PLOTS`、Mock snapshot 和硬编码演示数字。

### 9.3 Surface 状态机

```ts
type SurfaceView =
  | { kind: "closed" }
  | { kind: "tray"; surfaceId: string; anchorId: string }
  | { kind: "modal"; surfaceId: string; entityId?: string }
  | { kind: "worldHub"; projectId: string; childModalId?: string };

type SurfaceState = {
  view: SurfaceView;
  workState: "clean" | "dirty" | "save_pending" | "save_failed" | "unknown";
  returnTarget?: { controlId: string; fallback: "scene" | "page-title" };
};
```

路由、返回键、Esc、焦点、场景 inert 和 deep link 全部由该状态机管理，不再由多个布尔状态分别控制。所有关闭、切换 Surface 和 `SaveAndExit` 都先经过 `requestClose`：`dirty` 要求保存/放弃决策，`save_pending` 阻止重复关闭，`save_failed` 提供重试，`unknown` 先查询 operation。直接 deep link 没有原触发器时，焦点回到稳定场景入口或页面标题。

### 9.4 命令返回增量

在 v5.0 `ActionResult` 基础上增加：

```ts
type InteractionReceipt = {
  receiptId: string;
  operationId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeRevision: number;
  afterRevision: number;
  evidenceIds: string[];
  grantSettlementId?: string;
  committedAt: string;
  explanation: string;
  nextActions: Array<{
    id: string;
    label: string;
    routeId: InternalRouteId;
    params: Record<string, string>;
  }>;
};
```

写操作的成功 UI 必须由 `status=succeeded`、`afterRevision` 和回执共同驱动。网络超时保持 unknown 并查询 operation，不显示成功。服务端把回执绑定到 tenant、principal、operation 和被授权对象；`receiptId`/`operationId` 使用不可枚举标识，查询有过期、审计和最小字段投影。客户端不接收任意 URL，只接收类型化内部 `routeId` 和经过 schema 校验的参数。

### 9.5 新增或细化 API

| API ID | Method + path | 角色 | 负责人/阶段 | 用途 |
| --- | --- | --- | --- | --- |
| `MNR-CONTROL-CATALOG` | `GET /api/v3/manor/controls` | 学生 | 前后端 / 0B | 返回可见入口、角标、权限、条件和 control manifest 版本 |
| `MNR-SCENE-PROJECTION` | `GET /api/v3/manor/scene` | 学生 | 后端 / 0C | 返回 24 地块、7 地标和最小状态投影 |
| `MNR-ACTION-PREVIEW` | `POST /api/v3/manor/actions/preview` | 学生 | 后端 / 0C | 返回对象可用动作、成本、前置原因和下一步，不写入 |
| `MNR-OPERATION` | `POST /api/v3/manor/operations` | 学生/教师/授权管理员，按 command allowlist | 后端 / 0C | 以 `Idempotency-Key` 接收角色可用的类型化写命令，返回 `202 + operationId + pending`；学生动作、教师项目写入和评价决定都走此入口 |
| `MNR-OPERATION-QUERY` | `GET /api/v3/manor/operations/{operationId}` | 发起者/授权审计角色 | 后端 / 0C | 返回 pending/unknown/rejected/failed/succeeded；`failed` 含稳定 errorCode 与 retryable，成功终态内嵌 `InteractionReceipt` |
| `MNR-EVIDENCE-ATLAS` | `GET /api/v3/manor/evidence-atlas` | 学生/授权教师 | 后端 / 1-2 | 按项目、目标、来源和修订返回最小投影 |
| `MNR-TEACHER-PROJECT` | `GET /api/v3/teacher/manor/projects` + operation command `teacher.project.upsert` | 教师 | 教师端+后端 / 0C | 查询项目；创建/修订版本化项目、目标、量规和等价路径时提交统一 operation |
| `MNR-TEACHER-REVIEW` | `GET /api/v3/teacher/manor/reviews` + operation command `teacher.review.decide` | 分配教师 | 教师端+后端 / 0C | 查询队列/详情；退回/接受、反馈和冲突处理时提交统一 operation |
| `MNR-SEASONAL-PROJECT` | `GET /api/v3/manor/projects/current` | 学生 | 后端 / 3 | 返回教师发布的时令项目和版本 |
| `MNR-PROJECT-TASKS` | `GET /api/v3/manor/projects/{projectId}/tasks` | 学生 | 后端 / 3 | 返回本期任务和今日行动，不由前端拼装完成状态 |

`MNR-OPERATION` 是所有角色在庄园域内的唯一写操作权威契约；教师资源路由只做查询，教师写入以命令提交到同一 operation application service。`InteractionReceipt` 是成功终态投影，不与 v5.0 `MNR-OPERATION` 并行造第二套协议。必须先生成 OpenAPI/命令判别联合、角色 allowlist、错误码、状态迁移、重放/冲突和 Adapter contract test，再实现页面；测试必须证明不存在绕过 operation service 的 direct write。所有内部跳转使用类型化路由，目标页再次鉴权；庄园内部模块不得重新要求第三方扫码或扩大授权范围。

### 9.6 双部署与性能

| 指标 | 学校本地 | 公网 |
| --- | --- | --- |
| 首屏关键场景资源 | ≤ 1.5 MB | ≤ 1.5 MB，hash CDN |
| 加载预览 | ≤ 250 KB | ≤ 250 KB |
| 首屏外部依赖 | 0 | 仅学校批准的受控域名 |
| LCP 目标 | 校园常规 Wi-Fi ≤ 2.5s | p75 ≤ 2.5s |
| INP 目标 | ≤ 200ms | p75 ≤ 200ms |
| 低端设备 | 30fps，简洁模式等价 | 同左 |
| 离线/弱网 | 可读快照 + 可见 outbox | 可恢复，不伪成功 |

学校本地版本不得依赖运行时生图或外网模型。所有场景资产在发布前生成、审计、压缩并随版本部署。

性能门禁使用 `PerformanceEvidence`，至少记录部署 profile、commit、浏览器/设备、视口、网络/CPU 条件、冷/暖启动、页面状态、运行次数、p50/p75、资源字节、LCP/INP/CLS、长任务和场景帧率。CI 对资源字节做二元门禁；LCP/INP/帧率在固定设备实验室和真实试点各采样，简洁模式必须记录触发条件并通过功能等价测试。

### 9.7 模型与生图安全边界

- 对话、工单或截图中出现过的 API 凭据一律按已暴露处理：立即在供应商侧吊销并轮换，不继续沿用。
- 本轮只对工作区文本做了精确凭据特征扫描并未命中；扫描排除了依赖/构建/测试产物，也未覆盖 Git 历史、ignored 文件、二进制、第三方日志或供应商后台，因此仅是本轮 A2 观察，不是发布级 secret-scan 证据。
- 密钥只能进入服务端密钥管理或部署环境变量，禁止写入前端 bundle、`NEXT_PUBLIC_*`、Markdown、测试截图、浏览器存储和客户端网络请求。
- 学生端不得直连生图或第三方模型中转端点。若制作期需要生图，由受控资产流水线离线调用，经过内容安全、来源、相似性、未成年人适宜性和人工审阅后再入库。
- 模型端点、供应商和数据出境策略必须列入学校部署清单；无法满足本地化要求时，庄园运行时保持零模型依赖。
- 提示词只描述抽象风格和功能约束，不上传 QQNCmini 截图、缓存、导出精灵、学生数据或可识别个人信息。

### 9.8 外连、缓存与未成年人数据边界

- 在两种部署 profile 中维护版本化 `endpoint-egress-manifest`，列出浏览器请求、服务端出站、字体/CDN、遥测和模型端点；未知域名 fail closed。
- 使用收紧的 CSP、`connect-src`/`img-src`/`font-src` 白名单、服务端出站守卫和遥测字段清单。发布门禁采集全新浏览器会话 HAR 与服务端 egress trace，本地 profile 必须为 0 外连。
- v5.0 `CR-MANOR-001` 是任何真实学生证据写入前的硬前置：字段清单、tenant/principal 边界、RetentionPolicy、导出/删除、监护与学校审批均已验证。
- 可读快照和 outbox 只保存完成离线任务所需的最小字段，并绑定 tenant、principal、schema 和 TTL；退出登录、切换账号、撤权和设备解绑时清除。禁止 service worker 缓存认证响应。
- outbox 重放前重新鉴权和校验对象版本，不能因旧会话恢复而自动重复写操作；试点前必须有隐私审批与数据处置演练证据。

---

## 10. 原创资产生产与隔离路线

### 10.1 立即处理

1. 建立 `restricted-reference/qqncmini` 或工作区外审计目录，不进入 Next `public`。
2. 让构建在发现 `/art/qq-farm` 发布引用时失败。
3. 将当前 10 张导出精灵全部替换为原创图标或 Lucide + 原创材质底。
4. 对 `farm-scene.webp` 做独立相似性复核；不通过则重新构图，不能把“复核中”资产留在发布 bundle。
5. 把现有 16 地块 `manor-v3` 标为 prototype-only；为 `manor-24-v1` 校验 hash、完整输入谱系、提示词摘要、制作工具/模型版本、适用条款快照、发布权和审核人。
6. 自动生成 `asset-import-report.json`，列出每个路由真实加载的资产。

### 10.2 可给制作角色的抽象 brief

允许描述：

- 2.5D 乡村学习场景。
- 暖阳、明亮草地、可数的 6×4 地块、曲线路径。
- 四角分布原创观察站、记忆温室、创作工坊和班级树屋。
- 胡桃木、奶油纸、金色边线、绿色主动作。
- 粗轮廓、软阴影、可读的中央操作区。

禁止提供：

- QQNCmini 截图、SWF 导出图、缓存位图或专有角色作为生图输入。
- “照着 QQ 农场一比一”“保持同样建筑/坐标/角色”等提示。
- QQ、腾讯、企鹅、原活动名称、VIP、货币和原文案。

### 10.3 资产清单

| 资产组 | 数量建议 | 状态要求 |
| --- | ---: | --- |
| 主场景 + 预览 | 2 | 24 地块明确、无文字、无 UI、原创构图 |
| 学习地标 | 7 | default/active/complete/disabled 可由 DOM 状态叠加 |
| 系统入口图标 | 8-12 | 同一描边、光源和透视 |
| 工具图标 | 6 | 语义一一对应，不共用含混图形 |
| 项目主题横幅 | 每项目 1 | 无 baked text，支持本地化 |
| 状态符号 | 8 | 颜色 + 图标 + 文本三重表达 |

### 10.4 发布权与洁净创作审阅

每个资产记录 creator、tool/model version、完整输入谱系、提示词摘要、条款/许可证快照、允许的分发与修改范围、修改历史、文件 hash 和 rights reviewer verdict。来源或发布权未知、条款不兼容、输入含受限参考图的资产一律阻断。

洁净创作审阅由未参与资产制作的角色执行，审阅产物绑定候选资产 hash 和参考集合，只比较构图、轮廓、角色/建筑辨识度、图标语义、调色关系和材质组合，不复制像素。记录每项结论、要求修改和最终 `APPROVE/REQUEST_CHANGES`；单独一个“APPROVE”文本不构成证据。

---

## 11. 修订后的实施阶段

### Phase 0A：事实与资产止损（2-3 天）

- 生成真实 import 图，确认当前路由加载资产。
- 移除发布路由对 `/art/qq-farm` 的引用，研究资产移出 public。
- 给 v5.2 QA、ASSET_PROVENANCE 和当前路由加“测试对象”标识。
- 建立构建门禁：未挂载组件测试不能计入路由通过。
- 固定 24 地块、Surface 类型和功能命名决策。

**出口 `CR-MANOR-008`：**生产包没有 QQ/SWF 导出资产引用；文档、import 图和实际 bundle 一致。

### Phase 0B：交互基础设施（1 周）

- 拆出 `OverlayCoordinator`、`SceneHitMap`、`ContextActionDock` 和 control manifest。
- 修复静默按钮、错误映射、永久禁用和热点重叠。
- 建立 loading/empty/error/unknown/retry 的统一表面。
- 定义唯一 `MNR-OPERATION` 状态机、InteractionReceipt 投影、OpenAPI、错误码和 Adapter contract test；UI 先接 fixture，再接真实 0C 服务。
- 加入 guarded close、LearningReceipt 和 operation reconcile。

**出口 `CR-MANOR-009`：**所有可见控件命中后打开唯一正确表面；无透明遮挡、静默点击或伪成功。

### Phase 0C：隐私、领域、教师与迁移前置（2-3 周）

- 先完成并复核 v5.0 `CR-MANOR-001`：字段清单、tenant/principal 隔离、RetentionPolicy、导出/删除、客户端缓存和审批边界。
- 落地 v3 operation、场景投影、动作预览、一次性授权账本、版本冲突、回执查询、回滚与 SQLite/PostgreSQL 迁移/回滚脚本。
- 提供一个版本化“校园节水 M1”项目种子或最小教师创建入口，绑定目标、量规、等价参与路径和班级作业。
- 教师端交付已分配队列、证据详情、逐量规退回/接受、反馈、修订冲突和学生可见结果；用代表性班级规模测量队列完成时长与积压。
- 完成 endpoint/egress manifest、CSP、出站守卫、receipt 所有权/过期/审计和跨 tenant 负向测试。

**出口 `CR-MANOR-009A`：**未成年人数据前置门禁通过；两种数据库 profile 的迁移/回滚、operation contract 和教师决定链可独立复核，尚未开放真实学生写入。

### Phase 1：真实纵向闭环（2 周）

仅在 `CR-MANOR-001/008/009/009A` 全部通过后交付一条完整链：

```text
校园节水 M1 观察
 -> 活动/测验候选
 -> 学生关联科学目标
 -> 教师退回
 -> 学生修订
 -> 接受
 -> 授权
 -> 1 个地块动作
 -> LearningReceipt
 -> AtlasLite/成长档案来源详情
 -> 刷新与重新登录一致
```

- 学生端同时交付 390px 等价列表流程和 `SaveAndExit`，不要求本阶段完成场景自由平移缩放。
- 教师端沿用 0C 队列完成真实退回、学生修订和量规接受；反馈内容必须在学生端可读且可行动。

**出口 `CR-MANOR-010`（唯一 MVP 切点）：**请求、返回、数据库、刷新、重新登录、教师端、AtlasLite、390px 等价链和回执可由一个 correlationId 串联；代表性队列没有无人负责的阻塞项。

### Phase 2：证据仓库与图鉴（2 周）

- 上线 EvidenceArchive 全状态分类、搜索和空状态。
- 上线 EvidenceAtlas 五类质量进度和来源详情。
- 补齐 Revision、Claim、反馈和复习 attempt。
- 删除作品学科硬编码和单一 `0/1` 任务进度。

**出口 `CR-MANOR-011`：**图鉴每项可追溯，数量不冒充掌握，退回和修订可闭环。

### Phase 3：时令探究与项目 WorldHub（2 周）

- 实现教师配置的时令项目、时间窗、等价参与路径和本期/今日任务。
- 加入项目主视觉、里程碑、任务工作面和班级共同成果。
- 明确禁止个人排行、每日领取压力、付费和过期货币。

**出口 `CR-MANOR-012`：**至少一个时令项目跨 3 个学科、3 个来源、1 个反例和 1 次修订；七项关系不变量由服务端逐条校验，关键词关联和“移除学科不削弱成果”的负例必须被拒绝。

### Phase 4：移动、通知与学生端联动（1-2 周）

- 完成 24 地块自由平移/缩放、变换后 HitMap 和横竖屏适配；保留 Phase 1 已有等价列表视图。
- 接入通知 deep link、错题、活动、知识库、对话 meta-only 和成果回放。
- 扩展 quiet、弱网 outbox、跨设备恢复和错误恢复；保留 Phase 1 已有 `SaveAndExit`。

**出口 `CR-MANOR-013`：**390×844 能完成同一纵向闭环，重新登录恢复位置和状态。

### Phase 5：班级共建、治理与双部署试点（2 周 + 试点）

- 上线角色化班级共建，不公开个人排名。
- 完成分享预览、撤回传播、访问记录、举报、屏蔽和教师治理。
- 在 0C 双数据库契约基础上完成备份恢复、故障演练和运维手册。
- 真实学生/教师试点 2-4 周。

**出口 `CR-MANOR-014`：**零 S0/S1、全部 G0 通过、两种部署 EvidenceBundle 可复核。

---

## 12. 新增验收门禁

### 12.1 真实路由绑定

- 测试启动 `/student/manor`，记录实际 React 组件、Adapter 和 API 请求。
- 未被路由 import 的组件测试只能标记为 prototype，不计入发布覆盖率。
- QA 报告自动写入 commit、路由、feature flag、Adapter 类型和数据库 profile。
- 文档中的“无网络请求”“使用原创资产”等声明由自动检查验证。

### 12.2 热点和 Surface

1. 每个热点中心、四角和相邻边界点击结果正确。
2. 重叠命中区阻断构建，除非 manifest 明确优先级。
3. 打开 tray/modal/worldHub 后背景不可误触。
4. Esc、关闭、浏览器返回和 deep link 经过 guarded close；分别测试 clean/dirty/save_pending/save_failed/unknown，并验证确定性焦点回退。
5. 100%、125%、150%、200% 缩放下命中和文字不漂移。
6. 对最小/最大场景缩放、四向平移边界、重置聚焦、横竖屏、安全区和代表性 DPR 重复热点中心/边界测试。
7. 全程无指针完成 MVP；场景与等价列表的 selection、状态、动作和 live announcement 一致。

### 12.3 异步结果

| 状态 | 必须显示 | 禁止 |
| --- | --- | --- |
| 0-800ms | 按压/选中反馈 | 提前成功 |
| 800ms-8s | 任务名称、加载状态、可取消性 | 白屏和无说明 spinner |
| >8s | 仍在处理、operationId、查询/重试 | 重复提交 |
| success | 回执、版本、下一步 | 只显示 toast |
| rejected | 具体规则、字段、可修订入口 | “操作失败”空话 |
| failed | 稳定 errorCode、retryable、重试/联系支持路径 | 当成业务拒绝或自动重复写入 |
| unknown | 查询终态、保持未结算 | 自动当作成功或失败 |

### 12.4 身份连续性

- 庄园内部模块共享现有学校会话，不出现 QQNCmini 式二次扫码。
- 外部资源使用明确外链标识、新窗口策略和返回路径。
- deep link 使用类型化内部 route ID，目标二次鉴权，不能借 URL 打开其他学生对象。
- 会话失效时保存草稿，登录后恢复意图但不自动重复写操作。
- operation/receipt 查询按 tenant、principal、operation 和对象授权绑定；测试跨 tenant ID、枚举、重放、编码路径穿越、协议相对 URL、替代 scheme 和过期回执。

### 12.5 资产门禁

```text
production source/CSS/config 扫描 /art/qq-farm -> 0；排除文档、测试与 restricted-reference
production bundle import graph -> 不含受限目录或已登记禁止 hash
asset import graph -> 每项均有来源、条款/许可证、发布权和 hash
商标/专名扫描 -> 无 QQ/腾讯/原活动名
独立洁净创作审阅 artifact -> 绑定 hash、比较维度、意见与 APPROVE
主场景人工计数 -> 恰好 24 个可映射地块
视觉回归 + 热点几何 -> 同时通过
```

### 12.6 十轮内测主题

1. 资产来源与 bundle 真值。
2. 当前路由、Adapter、API 和数据库真值。
3. 24 地块命中与热点遮挡。
4. Surface 互斥、返回和焦点。
5. 证据候选到教师决定。
6. 退回、修订、接受与一次性奖励。
7. 工具前置、回执、刷新和冲突。
8. 移动、键盘、读屏、缩放和 reduced motion。
9. 权限、隐私、弱网、超时和双部署。
10. 真实学生/教师内容质量与可解释性。

每轮必须等待真实终态并评价返回内容，不以 HTTP 200、面板打开或 Mock 成功代替业务通过。

### 12.7 2026-08-26 基线测试及其证明范围

| 命令 | 结果 | 能证明 | 不能证明 |
| --- | --- | --- | --- |
| `npm run test:manor-model` | 通过 | Mock 领域契约、拒绝路径和场景状态可重复 | 持久化、真实路由和生产 Adapter |
| `npm run test:manor-roles` | 通过 | 学生、教师、管理员测试链和审计标识可运行 | 真实学校账号目录、人工评价质量 |
| `npm run test:manor-v2` | 通过 | 24 地块、证据修订、并发幂等、账本和主要安全错误码 | 浏览器 UI、资产合规和跨部署恢复 |
| `npm run test:manor-learning` | 通过 | 当前 `/student/manor?qa=1` 请求权威 bootstrap、证据、地块动作和会话结束 API；四种视口响应成功 | 按钮文案与动作语义完全一致、真实学生内容质量 |
| `npm run test:manor-fidelity` | 通过 | 当前路由 24 地块、核心入口、键盘、持久化和视觉距离在既定阈值内 | QQ/SWF 资产合法、全部可见控件有真实终态、参考图相似性安全 |

基线测试为“当前可运行”提供了可信下限，也暴露了覆盖边界。发布判定必须继续叠加真实路由资产扫描、全控件 manifest、返回内容质量评审、教师人工评价、移动读屏和双部署恢复，不能因为五个命令退出码为 0 就越过发布阻断项。

### 12.8 隐私、外连与性能门禁

- `CR-MANOR-001`、tenant/principal 负向测试、RetentionPolicy、登出/换号清理和 outbox 重授权在首次真实学生写入前通过。
- 学校本地 profile 的全新浏览器 HAR 与服务端 egress trace 均为 0 外连；公网 profile 只出现 manifest 中批准的域名，未知域名使构建或启动失败。
- CSP、出站守卫、遥测字段清单和 secret scan EvidenceRecord 绑定 commit/profile；secret scan 分别声明 working tree、ignored、history 和 binary 的覆盖或未覆盖范围。
- `PerformanceEvidence` 记录固定条件和真实试点数据；首屏资源预算为 CI 二元门禁，LCP/INP/CLS/长任务/帧率达到 §9.6 目标，简洁模式功能等价。

---

## 13. 实施任务优先级

### D0：立即执行

1. 隔离 `/public/art/qq-farm`，替换当前发布引用。
2. 生成路由 import/asset/API 真值报告。
3. 给 Mock 原型和 QA 文档加清晰边界。
4. 确定 24 地块原创场景与命中图。
5. 修复可见静默入口和错误面板映射。
6. 拆分水、肥、虫、收获、清理服务端语义。
7. 修复 mission 早完成、作品学科硬编码和锁地假条件。

### D1：纵向闭环

1. OverlayCoordinator 和 control manifest。
2. `CR-MANOR-001`、v3 数据/迁移、唯一 operation/receipt 契约和双数据库 contract test。
3. 教师项目/量规、分配队列、详情、退回/接受、反馈和冲突处理。
4. 一个项目、一个目标、一个教师退回、一次修订、一个地块结果。
5. EvidenceArchive 最小版和 AtlasLite 来源详情。
6. 390px 等价列表链路和 SaveAndExit。

### D2：稳定后扩展

1. SeasonalInquiryHub 和 ProjectWorldHub。
2. 多项目、多学科、Claim 和反例。
3. 班级共建、分享、举报、屏蔽和撤回传播。
4. 完整 EvidenceAtlas、场景自由平移缩放、通知/弱网联动。
5. 更丰富原创装扮和主题资产。

以下内容延期：公开排行榜、自由评论、私信、付费、可交易证据、连续签到、随机宝箱和运行时生图。

---

## 14. 风险与停止条件

| 风险 | 当前信号 | 控制 |
| --- | --- | --- |
| 资产侵权 | 当前路由直接引用 SWF 导出精灵 | 立即隔离、原创替换、构建门禁 |
| 测试失真 | Mock 原型测试被写成路由通过 | 路由/Adapter/commit 绑定 |
| 视觉先于业务 | 场景已成熟但真实证据链仍断 | 先纵向闭环，后扩展活动 |
| 身份断裂 | 参考加工坊跳二次登录 | 同一学校会话、外链明确化 |
| 未成年人数据提前采集 | 原计划到 Phase 5 才集中处理隐私 | 0C 前置 CR-MANOR-001、缓存/保留/租户门禁 |
| 隐性外连 | CDN、字体、遥测或模型配置可能绕过本地目标 | endpoint/egress manifest、CSP、HAR 与服务端 trace |
| 回执越权 | receipt/operation ID 与跳转参数可能被枚举或重放 | tenant/principal 绑定、类型化路由、过期与负向测试 |
| 教师队列阻塞 | 学生闭环依赖教师但现有队列能力基础 | 0C 教师最小工作台、分配、SLA/积压容量测试 |
| 热点错位 | 实机场景入口密集、自动点击可能误命中 | 多边形 HitMap、重叠门禁、逐点测试 |
| 空白等待 | 排行/帮助出现长时间空白 | 分阶段加载和超时恢复 |
| 游戏化过度 | 排名、偷取、领取、清零 | 个人私密成长、班级协作、无惩罚退出 |
| 性能失控 | 参考应用约 1.09 GB | 静态图 + DOM、预算门禁、简洁模式 |

出现以下任一情况应停止扩功能：

- 发布 bundle 仍引用 QQ/SWF 导出资产。
- 任一候选资产缺少适用条款、发布权或独立洁净创作审阅。
- 真实路由和 QA 报告测试对象不一致。
- 任一写按钮无法给出权威回执和刷新一致性。
- `CR-MANOR-001`、tenant 隔离、RetentionPolicy 或本地零外连未通过。
- 教师队列没有可分配负责人、量规反馈或可接受的积压上限。
- 跨学科关联只靠主题词，没有目标、来源和必要作用。
- 移动端或简洁模式无法完成纵向闭环。
- S0/S1 权限、隐私、重复奖励或数据丢失问题未关闭。

---

## 15. v5.1 Definition of Done 增量

除 v5.0 DoD 外，新增：

- [ ] 生产路由、运行时 Adapter、测试报告和文档指向同一对象。
- [ ] 生产 bundle 不含 QQ/SWF/缓存导出资产或其直接衍生引用；每项发布资产具有条款/许可证、发布权和独立洁净创作审阅。
- [ ] 24 地块数量、视觉、DOM 命中区和后端对象完全一致。
- [ ] 每个入口声明唯一 `surfaceId`，不存在重复或错误映射。
- [ ] 场景与等价列表共享语义/选择状态；无指针 E2E 和指定 AT/browser 人工矩阵通过。
- [ ] 加载超过 800ms 有可读状态，超过 8s 有恢复路径。
- [ ] 写操作只经唯一 `MNR-OPERATION`，具有 InteractionReceipt、版本和下游一致性证据；跨 tenant、枚举、重放、过期和恶意路由参数均被拒绝。
- [ ] `CR-MANOR-001`、RetentionPolicy、tenant/principal 隔离、登出/换号缓存清理和 outbox 重授权先于真实学生数据写入。
- [ ] 学校本地 profile 的浏览器与服务端外连均为 0；公网外连与遥测完全匹配版本化 manifest。
- [ ] 教师能创建/获得版本化项目与量规、处理分配队列、退回/接受并让学生看到可行动反馈；代表性积压在容量阈值内。
- [ ] 庄园内部模块不出现二次第三方授权。
- [ ] EvidenceAtlas 的每个进度可追溯到来源、目标、量规和修订。
- [ ] 跨学科七项不变量由服务端校验，关键词关联和“移除学科不削弱成果”负例被拒绝。
- [ ] 时令项目不含付费、公开个人排名、偷取、签到惩罚或清零压力。
- [ ] 未挂载原型的测试不计入发布通过。
- [ ] 资产 import 图、来源登记、hash 和实际 bundle 自动一致。
- [ ] `PerformanceEvidence` 在固定条件与真实试点下满足资源、LCP、INP、CLS、长任务和帧率预算，简洁模式功能等价。

---

## 16. 最终建议

v5.0 的证据中心方向正确，不需要推翻；真正需要修改的是实施顺序和事实治理。

下一步不应先增加更多按钮、活动或装饰，而应按以下顺序执行：

```text
先隔离不合规资产
 -> 校准真实路由与测试对象
 -> 建立 Surface/HitMap/回执基础设施
 -> 前置隐私、租户、领域迁移和教师工作流
 -> 跑通一个真实证据纵向闭环
 -> 上线证据仓库与图鉴
 -> 再扩时令项目、活动世界和班级共建
 -> 最后做双部署硬化与真实学校试点
```

QQNCmini 的价值是证明了“场景化产品必须拥有完整的状态和反馈体系”；EduAI 的竞争力则应来自更可信的一层：每个任务、按钮、地块、图鉴和成长变化都能解释来自哪次学习、证明哪个目标、经过什么评价、如何修订，以及下一步为什么值得做。

---

## 17. 本地证据索引

### 17.1 主张到证据矩阵

本轮代码基线为 `c0422179fbe0a8ebf4656675a93fead597a6c5d7`，但工作区存在大量既有未提交改动，因此下列源码证据同时绑定文件 hash；不能把基线 commit 单独当成当前页面身份。

| Evidence ID | 采集器/时间 | 证据或 digest | 支持的主张 | 证明边界 |
| --- | --- | --- | --- | --- |
| `EV-QQ-CONFIG-A1` | PowerShell/Get-FileHash，2026-08-26 | manifest `252B7C...C884`；launcher `FF7509...2727`；config `939981...CE17` | 微端版本、启动入口和远程配置 | 不证明远程服务端实现 |
| `EV-QQ-BINARY-A1` | Authenticode/Get-FileHash，2026-08-26 | QQNCmini `D8ECA4...DB0F2`；launcher `E59058...45945`；WPF host `77F878...4DAFF`，腾讯签名有效 | 发布者、文件身份和 WPF/CefSharp 外壳边界 | 签名不证明陈旧依赖安全 |
| `EV-QQ-AV-A2` | Kaspersky 21.24，2026-08-26；病毒库 2026-05-16 | 目录扫描 115/115 正常，0 检测、0 可疑、0 跳过、0 错误；本轮未生成独立报告文件 | 本轮只读扫描未检出恶意对象 | 会话输出未归档，只能作为 A2；不代表绝对安全 |
| `EV-QQ-RUN-A2` | 受控 computer-use，两次启动，2026-08-26 | 主场景、仓库、时令、排行、图鉴、活动任务、农具反馈、重入和正常退出的会话观察 | 参考产品的实际 UI、等待后返回和身份断裂行为 | 截图/网络 trace 未形成独立本地 artifact，不作为发布门禁 |
| `EV-MANOR-SOURCE-A1` | rg/Get-FileHash，2026-08-26 | page `427940...E4CDFE`；repository `92B931...A678`；v2 server `BBE4A9...27CA4`；registry `8E7847...C25F8` | 当前挂载路由、Adapter/API 与资产登记冲突 | 绑定 dirty working tree，不代表已发布 bundle |
| `EV-MANOR-BASE-A1` | Get-FileHash，2026-08-26 | v5.0 `AD2247...AB5C21` | 本文继承和修订的基线 | 不证明 v5.0 所列功能已实现 |
| `EV-MANOR-TEST-A2` | npm/node，2026-08-26，cwd `D:/VB/LLM-School/app` | 五个 `test:manor-*` 命令 exit 0；终端输出未独立归档 | §12.7 所列当前基线 | A2 会话证据，不满足未来 commit/profile 绑定的发布门禁 |
| `EV-SECRET-SAMPLE-A2` | rg 精确特征扫描，2026-08-26 | 工作区文本未命中；未保存含秘密的命令或输出 artifact | 用户提供凭据未被本轮直接写入源码 | 明确不覆盖 history/ignored/binary/第三方日志 |
| `EV-DOC-REVIEW-A2` | 4 个只读审阅组，2026-08-26 | 初审 head `AA4CF0...9BECB`；连贯性、产品、设计、安全均 `REQUEST_CHANGES` | 本文修订来源与独立问题发现 | 最终稿需要按新 hash 再复核 |

发布阶段必须把 A2 项替换为持久化 EvidenceRecord，至少含 argv 类别、cwd、开始/结束时间、exit code、输出 digest、artifact hash、commit/profile 和采集器版本；缺失项保持 `degraded`，不能自动升级为通过。

### 17.2 可复核本地来源

- `C:/Users/nuoya/AppData/Local/QQNCmini/manifest.json`
- `C:/Users/nuoya/AppData/Local/QQNCmini/launcher_config.json`
- `C:/Users/nuoya/AppData/Local/QQNCmini/app/config/config.json`
- `D:/VB/LLM-School/app/app/(shell)/student/manor/page.tsx`
- `D:/VB/LLM-School/app/app/(shell)/student/manor/components/LearningHub.tsx`
- `D:/VB/LLM-School/app/app/(shell)/student/manor/components/ManorExperience.tsx`
- `D:/VB/LLM-School/app/app/(shell)/student/manor/components/ManorScene.tsx`
- `D:/VB/LLM-School/app/app/(shell)/student/manor/model/manor-learning.ts`
- `D:/VB/LLM-School/app/app/(shell)/student/manor/model/manor-experience.ts`
- `D:/VB/LLM-School/app/app/(shell)/student/manor/manor.module.css`
- `D:/VB/LLM-School/app/lib/server/manorV2.ts`
- `D:/VB/LLM-School/app/public/art/REGISTRY.md`
- `D:/VB/LLM-School/app/docs/research/appimg-qq-com-f0863a89/happyfarm-unity-release-268e6c8b/ASSET_PROVENANCE.md`
- `D:/VB/LLM-School/app/docs/research/appimg-qq-com-f0863a89/happyfarm-unity-release-268e6c8b/QA_REPORT.md`
- `D:/VB/LLM-School/开发材料/EduAI-Prism-个人庄园前端升级与跨学科证据链闭环路线-v5.0-20260825.md`
