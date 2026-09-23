# 校内资源库与侧栏：交付检查记录

日期：2026-09-08。范围：侧栏间距修复、教师 / 教研员校内资源库前端及双部署设计。

## 1. 交付范围

| 项目 | 本轮交付 |
|---|---|
| 侧栏 | 展开态账户区紧随导航，间距 12px；低高度时导航独立滚动，保留收起、分组、拖动宽度与账户菜单 |
| 入口 | 教学导航中的“校内资源库”及知识库顶部直达按钮，路由 `/knowledge/resources` |
| 页面 | 分类、组合筛选、列表 / 网格、草稿 / 收藏、详情、空态、错误重试 |
| 文件闭环 | 选择真实文件、校验、填写元数据、主动授权、事务保存、刷新恢复、原文件下载、编辑、确认移除 |
| 可靠性 | 重复内容校验、失败保留输入、事务回滚、旧数据迁移、账户命名空间、版本冲突检测 |
| GPT 资产 | 六枚独立图标、绿底原图、透明 WebP、处理脚本和 SHA-256 清单 |
| 技术路线 | 学校成员权限、私有存储、版本审核、隔离扫描 / 转换、内网与互联网部署、备份恢复 |

**未接资源后端，未向学校服务器上传文件。** 本机草稿使用浏览器 IndexedDB，不是学校归档备份；不同账户键也不是浏览器设备层面的加密隔离。示例有明确来源标识，不能当作真实学校资源或已审核教学成果。

## 2. 审阅发现与修正

| 编号 | 实际发现 | 修正与复验方式 |
|---|---|---|
| R1 | 将 sessionVersion 放入持久存储键，重新登录版本变化可能遗失草稿入口 | 持久键改为稳定 user.id；原版本命名空间仅同账户迁移，合并写入与清理原键在同一事务；独立 IndexedDB 实验和跨登录测试 |
| R2 | 两个窗口旧编辑可能覆盖新资料，甚至重新写回已删除资源 | 增加 revision 与原版本令牌，事务内校验；冲突时保留输入；独立双窗口真实操作复验 |
| R3 | 568×320 横屏的固定弹窗头尾压缩正文，保存及授权被裁切 | 极矮屏改为整窗滚动，并保留安全求助空间；追加 U32 指针与键盘链路 |
| R4 | 外部中止事务后再次 abort 抛出未捕获异常 | abortWith 保留第一个错误并处理已结束事务；真实 IndexedDB 中止注入、原数据不变、恢复重试 |
| R5 | 文本预览截断在 UTF-8 字符中间 | 按 20KB 限制读取，使用流式解码边界；检查无截断替代字符、下载原始字节不变 |
| R6 | Radix 焦点循环回到短屏弹窗顶部时不自动滚动，关闭按钮有焦点但不可见 | 两种资源弹窗使用局部焦点可见性处理；仅整窗滚动布局生效，不改全局 Dialog；U32 保留原失败断言复跑 |

另加缺失 Blob 时禁用编辑的防御性保护。所有历史失败报告保留，未删除失败用例，未降低可点击、回滚或运行时错误断言。选择器错误与产品错误分别记录。

## 3. 检查方式与可信边界

不是只截图或检查按钮存在：浏览器测试实际选择合成文件，等待 IndexedDB 完成通知，刷新后下载并比对字节及 SHA-256；等待失败返回再检查输入、错误状态和持久数据。

- 保存延迟：真实事务提交后暂缓成功回调交付，检查界面不会提前宣称保存成功。
- 失败注入：实际中止 IndexedDB 事务，不用替身成功返回值；原数据与迁移键必须保留。
- 并发：两个真实标签页编辑同一资源；旧编辑不能覆盖新版本、不能恢复已删除资源。
- 升级：从真实 schema v1 数据库开始，迁移后旧 v1 客户端应收到 VersionError。
- 权限：实际教师 / 教研员 / 学生会话检查入口与页面角色门槛；没有把它称为学校租户权限测试。
- 视觉：桌面、低高度侧栏、390px 手机、844×390 及 568×320 横屏、深色、减少动态效果；检查真实命中位置和安全求助遮挡。
- 外部请求：资源服务器写请求被阻断并作为失败统计；示例与草稿不上传外部服务。已有登录请求单独处理。

浏览器主体为此 Windows 机器上的系统 Chrome，使用全新隔离上下文和本地开发服务。未测试 Safari / Firefox、真实磁盘耗尽、生产并发、多学校权限、后端文件扫描或正式双部署。也未通过修改真实密码来触发会话版本变化；该存储边界另由旧版本命名空间迁移实验验证。

全局安全求助入口保留视觉位置且不遮挡资源控件，但遵循现有模态窗口的焦点隔离规则：资源弹窗打开时，应先关闭该弹窗再使用外部安全求助入口。本轮没有修改这一全局行为。

## 4. 分工与审阅

| 执行方 | 实际贡献 | 边界 |
|---|---|---|
| 主任务 | 资源前端、持久化、GPT 资产、文档、集成和构建验证 | 只修改本轮目标文件 |
| Meitner | 侧栏布局、角色导航及移动入口 | 非重叠文件所有权 |
| Archimedes | 现有身份 / 存储架构只读审查、双部署路线 | 发现会话缺少学校成员边界，未接后端 |
| Halley | 模型与浏览器回归、故障注入、截图和内容结果检查 | 仅测试文件与 tester 证据目录 |
| Helmholtz | 独立代码审阅、真实 IndexedDB 及双窗口实验、短屏与测试完整性复核 | 审阅建议是 audit-only，不冒充已签名验收 |
| CodeRabbit CLI | 有限范围审阅 UI 四文件及 model / repository 两文件；定位预览与防御性问题 | UI 审阅报告两项，模型层报告零项；非最终全部文件的签名审核 |

使用了 UI/UX 检索、工程护栏、GPT 生图、浏览器和代码审阅能力。代码关系图更新成功，但缺少 igraph 时使用文件级社区回退；图只作辅助，新增文件另行人工审阅。Advisor 因本机缺少 sh 未成功执行；Mobbin 受订阅限制未成功执行，不计成功能力调用。没有为本轮盲目安装或调用无关插件。

## 5. 复现与定位

在 `D:\VB\LLM-School\app`，保持本地开发服务运行后执行：

```powershell
node tests/school-resources-model.mjs
node tests/school-resources-ui.mjs
node scripts/verify-school-resources.mjs
node tests/manor-fidelity.mjs
node scripts/snapshot-school-resources-delta.mjs
```

资源 UI 脚本默认地址 `http://127.0.0.1:4921`；可用 `SCHOOL_RESOURCES_BASE_URL` 覆盖。浏览器可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定。测试使用隔离浏览器数据和合成文件，不把用户的真实教学资料作为测试夹具。

| 材料 | 位置（相对项目根） |
|---|---|
| 命令 / 退出码 / 时间 / 输出哈希 / 源码哈希 | `.agent-supervisor/resources-20260908/commands/results.json` 及同目录日志 |
| 浏览器总报告 | `.agent-supervisor/resources-20260908/tester/ui-report.json`；每次完整运行另有时间戳目录 |
| 模型报告 | `.agent-supervisor/resources-20260908/tester/model-report.json` |
| 独立审阅历史 | `.agent-supervisor/resources-20260908/reviewer/` |
| 原始检查点与增量 | `.agent-supervisor/checkpoints/resources-20260908/`、`.agent-supervisor/resources-20260908/delta/` |
| GPT 源图、六枚图标及校验 | `app/public/art/school-resources/manifest.json` |

增量以本轮开始前的定向文件快照为基准，不将整个脏工作区与 HEAD 的差异冒充本轮修改。未暂存、提交或回滚其他人的代码；未更改用户密钥、现有资源后端或全局安全求助组件。

## 6. 验证结果

| 验证项 | 最终实际结果 |
|---|---|
| 模型回归 | 6/6，退出码 0 |
| Chrome 浏览器回归 | 33/33，退出码 0；2026-09-08 17:35:29–17:37:41 UTC |
| 源码与资产身份 | 浏览器完整运行前后 18 份 SHA-256 一致，无漂移；代码增量另有独立清单 |
| 运行时 / 外部写入 | 零页面错误、零控制台错误、零资源写请求、零资源图标加载失败 |
| 视觉证据 | 最终运行归档 43 张截图；侧栏实测账户间距 12px，900px 视口内账户底部 886px |
| 极矮横屏 | U32 指针 / 键盘授权、保存、下载、关闭均通过；控件与弹窗对安全求助重叠面积为 0 |
| TypeScript | 全量 `tsc --noEmit --incremental false` 退出码 0 |
| 代码规范 | 本轮产品文件及测试聚焦 ESLint 退出码 0，无警告；全量 ESLint 退出码 0 |
| 生产构建 | `next build` 退出码 0，包含新路由 `/knowledge/resources` |
| 既有庄园回归 | `node tests/manor-fidelity.mjs` 退出码 0；真实种植后刷新持久化、接口结果及视觉阈值通过 |
| 独立最终复核 | R3 审阅建议 APPROVE（audit-only）；三个视口 36 处正向命中 / 可见性检查通过，未留新增 P1/P2 |

全量 Lint 留有一条本轮未涉及文件的既有警告：`app/tests/agent-workbench-migration.mjs:37` 的 `_prompt` 未使用，未为消除警告而修改他人的工作。模型脚本的现有 Node 包类型提示也不等同测试失败。

本轮独立发现的 R1、R2、R3 及键盘循环、事务中止和预览边界均已修正并复核；历史报告里的 REQUEST_CHANGES 对应当时快照，应结合后续关闭记录阅读，不删除历史问题来制造通过。

最新原始报告：[33 项浏览器结果](D:/VB/LLM-School/.agent-supervisor/resources-20260908/tester/2026-09-08T17-35-29-376Z/ui-report.json)、[命令与源码校验](D:/VB/LLM-School/.agent-supervisor/resources-20260908/commands/results.json)、[最终独立复核](D:/VB/LLM-School/.agent-supervisor/resources-20260908/reviewer/r3-final-review.md)。

关键视觉证据：[桌面列表](D:/VB/LLM-School/.agent-supervisor/resources-20260908/tester/2026-09-08T17-35-29-376Z/desktop-list-1366.png)、[手机授权与保存](D:/VB/LLM-School/.agent-supervisor/resources-20260908/tester/2026-09-08T17-35-29-376Z/mobile-consent-safety-overlap.png)、[568×320 保存](D:/VB/LLM-School/.agent-supervisor/resources-20260908/tester/2026-09-08T17-35-29-376Z/short-landscape-pointer-save-568x320.png)、[深色网格](D:/VB/LLM-School/.agent-supervisor/resources-20260908/tester/2026-09-08T17-35-29-376Z/dark-grid-reduced-motion-1366.png)。主任务已在真实 Chrome 页面及关键归档截图中进行目视复核。

## 7. 正式监工门禁边界

上述结果为真实本地命令、浏览器及独立审阅证据，不是 Supervisor 签名门禁。核心门禁尝试分别返回 `gate-event-invalid-state`、`gate-adapter-failure`，两次失败后停止重复尝试，保留原失败并采用本地检查回退；未修改门禁核心、降低质量配置或伪造签名 ReviewRecord。

主任务 finalize 返回退出码 **4**，`health=degraded`、`terminal_state=incomplete`；最终归档日志验证时间为 2026-09-08 17:55:22 UTC。核心报告列出签名质量门禁 MISSING、正式 spec / intent / EvidenceRecord 未闭合，以及核心 git 工作区识别不可用；本轮已有的定向快照、真实命令和独立审阅保留为本地审计证据，不伪造其正式身份。

原始返回：[supervisor-finalize.log](D:/VB/LLM-School/.agent-supervisor/resources-20260908/supervisor-finalize.log)。原样核心报告：[RoundProcessSummary/v1](D:/VB/LLM-School/.agent-supervisor/handoffs/ba71494b296d959aa2942831c937b3a49509f8734b307aaf1b86bdc07fc53f10/latest.md)。自定义导出目录被核心拒绝后，已改用其允许的会话 handoff 目录读取，未绕过路径限制。

结论：**本轮前端实现与本地测试通过；正式 Supervisor 验收 incomplete。** 后端未接入、未部署生产是本轮明确范围，不能将其描述为已经提供学校在线共享服务。
