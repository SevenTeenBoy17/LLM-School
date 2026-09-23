# EduAI-Prism 真实用户内测 R53：模型广场到聊天模型治理闭环报告

## 本轮目标

本轮继续执行“真实用户、真实学校/公司式内测”方法，不把点击成功当成合格，而是等待 API、页面、AI 内容、会话回读全部返回后再判断。R53 聚焦模型治理链路：

- 管理员在后台关闭/恢复 Claude 对学生开放，验证权限设置确实影响学生聊天。
- 教师从模型广场点击 Claude 推荐任务进入聊天，验证前端选择、聊天请求、可见回答、会话持久化和消息持久化都一致。
- 对非法 `modelId` 做后端边界测试，避免任意模型 ID 被写入会话或消息。

## 基线发现的问题

1. `R53-MODEL-001`：`/api/chat` 接受非法 `modelId`，并会继续生成普通回答。  
   风险：攻击者或错误前端可以把不存在的模型 ID 写入聊天消息，后台统计、模型治理和后续追踪会失真。

2. `R53-MODEL-002`：`/api/chat/sessions` 接受非法 `modelId` 并创建会话。  
   风险：会话级模型归属不可信，模型广场、历史会话和后台模型统计之间会出现口径漂移。

3. `R53-HUB-003`：从模型广场带 `model=claude&seed=...` 进入聊天时，页面先自动加载“最近历史会话”，导致新任务追加到旧会话里。  
   风险：用户以为自己创建了 Claude 新任务，实际会话仍可能是旧的 ChatGPT 会话；消息模型与会话模型不一致，影响用户信任和后台治理。

## 修复方案

- 在 `app/lib/data/models.ts` 增加统一的 `isModelId()` 校验入口，让 API 和前端共享模型目录事实来源。
- 在 `app/app/api/chat/route.ts` 中增加非法模型校验；危机/关怀分支仍保持最高优先级，不能因为模型参数错误阻断未成年人安全帮助。
- 在 `app/app/api/chat/sessions/route.ts` 中拒绝非法 `modelId`，防止任意模型 ID 进入新会话。
- 在 `app/app/(shell)/chat/page.tsx` 中把 `prompt/agent/seed/model` 视为“新任务入口”，进入页面时清空当前活跃会话，避免自动加载最近历史会话。

## 最终验证证据

- API 真实链路：`.codex-supervisor/qa-12h-20260708/models-r53/logs/r53-model-contract-api-summary.json`，`verdict=pass`，18 项检查通过。
- 浏览器真实链路：`.codex-supervisor/qa-12h-20260708/models-r53/logs/r53-hub-chat-browser-summary.json`，`verdict=pass`，15 项检查通过。
- 静态验证：`npm run lint`、`npx tsc --noEmit`、`npm run build` 均通过。
- 本地生产服务：`http://127.0.0.1:4920` 持续监听，PID `8600`。
- 代码图谱：`python -m code_review_graph status` 显示 164 files / 762 nodes / 7205 edges。
- 手工影响审阅：`.codex-supervisor/qa-12h-20260708/models-r53/logs/manual-impact-review-r53.json`，`verdict=pass`。

## 关键通过项

- 管理员关闭 Claude 后，学生普通聊天返回 `kind=blocked`。
- 学生关怀/安全类内容仍返回 `kind=care`，不被模型关闭或非法模型校验阻断。
- `/api/chat` 和 `/api/chat/sessions` 对非法 `modelId` 均返回 `400 { "error": "invalid_model" }`。
- 教师合法 Claude 会话创建成功，聊天完整返回后，回读会话 `modelId=claude`，助手消息 `modelId=claude`。
- 教师从模型广场点击 Claude 推荐后，浏览器端当前模型为 `claude`，可见回答头部显示 Claude，前端请求体发送 `modelId=claude`。
- 带 seed 的 Hub 工作流创建的是新会话，不再追加到旧的 latest sentinel 会话。
- 浏览器 console 无 error/warning；测试创建的会话和 sentinel 会话均清理成功。

## 影响面审阅

本轮代码改动集中在模型目录校验、聊天 API、会话 API 和聊天页初始加载逻辑。未改变模型卡视觉、后台模型设置 UI、数据库结构或付费逻辑；产品仍保持“不做付费版本”的约束。

风险控制点：

- 安全分支顺序保持不变：危机、关怀优先于模型治理校验。
- 学术诚信分支进入前会先拒绝非法模型，防止非法模型 ID 借 scaffold 消息持久化。
- `/chat?session=...` 的直达会话仍按原逻辑加载，不被新任务清空逻辑误伤。
- 手动“新建对话”仍按当前模型创建新会话。

## 结论

R53 模型广场到聊天模型治理闭环通过。模型开放策略、非法模型边界、Hub 推荐进入聊天、新会话创建、AI 返回内容质量、会话/消息回读一致性均已验证。整体 12 小时真实用户内测目标仍保持 active，可继续进入下一轮非重复真实工作流。
