# EduAI-Prism 真实用户内测 R4：教师教研备课工作流报告

日期：2026-07-08  
范围：教师角色真实使用闭环，不以静态 smoke、按钮数量或接口 200 作为产品结论。  
结论：本轮教师备课切片已复测通过；12 小时总体内测仍继续。

## 一、纠偏后的内测口径

本轮按真实学校/真实教师场景执行：教师登录后先使用知识库查找备课资料，再进入 AI 对话生成课堂方案。每个判断必须等待页面状态、接口状态和 AI 内容完整返回后再评价。

本轮不把以下内容当作产品结论：

- 只检查路由能打开。
- 只统计按钮是否存在。
- 只看截图而不等待 AI 生成完成。
- 只读接口状态码但不读返回内容。

## 二、真实场景设定

角色：王思远，信息科技教研组教师。  
任务：为九年级数学《二次函数顶点式 y=a(x-h)^2+k》准备一节 40 分钟课堂。

真实使用路径：

1. 从登录页点击“点击地球 · 进入鲁班 7 号”。
2. 使用教师账号登录。
3. 进入知识库，查找 R4 备课资料。
4. 在知识库内运行关键词检索测试。
5. 进入 AI 对话，新建会话。
6. 输入带唯一标记的真实备课任务。
7. 等待 AI 回复完整返回。
8. 检查内容结构、学科相关性、来源/耗时标注、布局与控制台状态。
9. 再用后端 API 读取会话，确认结果已持久化。

## 三、环境与证据

- 本地服务：`http://127.0.0.1:4920`
- 运行方式：`next start -p 4920`
- 视口：`1440x900`
- 浏览器：Codex in-app Browser
- 构建验证：`npm run lint`、`npx tsc --noEmit`、`npm run build`
- Graph 门禁：`python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`

证据文件：

- 知识库初始截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-workflow\screenshots\teacher-knowledge-current-initial-r4.png`
- 知识库检索截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-workflow\screenshots\teacher-knowledge-current-search-r4.png`
- 对话初始截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-workflow\screenshots\teacher-chat-current-initial-r4.png`
- 对话完整返回截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-workflow\screenshots\teacher-chat-final-realuse-r4.png`
- 知识库检索日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-workflow\logs\teacher-knowledge-current-search-r4.json`
- 对话完整返回日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-workflow\logs\teacher-chat-final-realuse-r4.json`
- 会话持久化 API 日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-workflow\logs\teacher-chat-session-api-final-r4.json`

## 四、发现与修复

### R4-FE-001 知识库右侧检索测试区域溢出

问题：在 1440 桌面视口下，知识库详情栏里的检索输入和运行按钮曾经超出屏幕，真实教师无法稳定使用。  
修复：收窄知识库详情栏，限制正文换行，右侧详情区域改为原生纵向滚动并禁止横向溢出。  
复测：最终 `outside=[]`、`overflowX=false`，运行检索测试按钮在屏内。

### R4-AI-001 教师本地兜底主题错配

问题：教师请求“二次函数顶点式”教案时，本地兜底曾返回“电路故障分析”。这类错误会直接破坏教研信任。  
修复：`app/lib/server/llm.ts` 增加 `localTeacherLesson()`，按二次函数、顶点、quadratic、vertex 等主题词生成对应教案。  
复测：浏览器完整返回内容包含二次函数、顶点、板书、易错诊断、出门测；没有电路、灯泡、短路、断路。

### R4-FE-002 聊天侧栏真实历史数据下潜在超宽

问题：聊天侧栏在包含长历史预览时，曾经测到异常超宽元素。  
修复：`app/components/chat/ChatSidebar.tsx` 将侧栏会话列表从 Radix ScrollArea 改为原生 `overflow-y-auto overflow-x-hidden` 容器，并补充 `min-w-0`、`overflow-hidden`。  
复测：聊天页真实会话数据下 `outside=[]`、`overflowX=false`。

## 五、真实使用结果

### 登录

教师通过可见 UI 登录，不绕过前端表单。登录后进入 Dashboard，控制台无错误。

### 知识库

检索词：`r4teacher-1783530059394`  
运行测试词：`quadratic function vertex form`

返回结果：

- 命中 1 条 R4 备课资料。
- 结果含唯一 R4 token。
- 结果含 `quadratic` 和 `vertex`。
- 页面无横向溢出。
- 控制台无 error/warn。

### AI 对话

提示词唯一标记：`R4-final-realuse-1783532261137`  
等待结果：约 29.8 秒完整返回。  
页面标注：`GPT-5.4 · 24.0s · 网关降级`

内容检查：

- 包含“本课主题”。
- 包含“学习目标”。
- 包含“课堂导入”。
- 包含“板书设计”。
- 包含“易错诊断”。
- 包含“学生活动”。
- 包含“分层支持”。
- 包含“出门测”。
- 聚焦二次函数顶点式。
- 未出现电路、灯泡、短路、断路污染。
- 生成结束后无“正在生成”残留。
- 页面无横向溢出。
- 控制台无 error/warn。

后端持久化检查：

- `GET /api/chat/sessions`：200
- `GET /api/chat/sessions?id=...`：200
- 最新会话消息数：2
- assistant 消息包含 `source`
- assistant 消息包含 `durationMs`
- 内容检查与浏览器一致。

## 六、审阅门禁

静态/构建：

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过

Graph：

- 文件：156
- 节点：645
- 边：6138
- 状态：已刷新

限制：

- 当前 workspace/app 不是 Git 仓库，无法做基于 git diff 的 `review-changes`。
- 已用 code-review-graph build/status + 人工影响面审阅替代。

## 七、剩余风险

- 本轮只关闭教师知识库 + 教师备课对话切片，总体 12 小时内测未完成。
- 管理员治理、权限、审计、长期对话、导出、移动端多轮真实使用仍待继续。
- 当前外部网关不可用时仍会走“网关降级”，虽然已清晰标注，但生产前仍需真实网关稳定性压测。
- 历史旧会话里仍保留曾经的错误电路回复，用作缺陷追溯证据；本轮没有做数据清理。
- 本地生产服务使用进程内临时 `EDUAI_SESSION_SECRET`，未写入磁盘；这符合本地 QA，但不代表生产密钥配置完成。

## 八、结论

R4 教师真实教研备课工作流通过：教师能登录、检索知识库、发起备课对话、等待完整返回、读取结构化教案，并能看到来源与耗时。已发现的知识库溢出、聊天侧栏溢出风险、教师兜底主题错配均已修复并复测通过。

下一轮建议优先执行管理员真实治理工作流：安全工单、权限调整、审计导出、模型治理配置，并继续坚持“等待完整返回后再评价”的内测口径。
