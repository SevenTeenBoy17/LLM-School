# EduAI-Prism 真实用户内测问题清单 20260709 - R53

## 范围

本清单对应 R53 模型广场到聊天模型治理真实使用闭环。测试方式为真实角色登录、真实 API 调用、真实浏览器点击、等待完整返回内容、再做服务端回读和质量评审。

## 已修复问题

### R53-MODEL-001：聊天 API 接受非法模型 ID

- 严重度：P1
- 影响范围：`/api/chat`、消息持久化、模型统计、后台治理可信度
- 基线现象：教师请求 `/api/chat` 时传入不存在的 `modelId`，接口仍返回 200 普通回答。
- 根因：聊天 API 只接收 `modelId` 字符串，没有与模型目录做白名单校验。
- 修复：在 `app/lib/data/models.ts` 增加 `isModelId()`，并在 `app/app/api/chat/route.ts` 中拒绝非法模型。
- 复验：`r53-model-contract-api-summary.json` 中 `chat API rejects invalid model id` 通过，返回 `400 invalid_model`。

### R53-MODEL-002：会话创建 API 接受非法模型 ID

- 严重度：P1
- 影响范围：`/api/chat/sessions`、历史会话、模型治理回读
- 基线现象：教师请求 `/api/chat/sessions` 时传入不存在的 `modelId`，接口创建了带任意模型 ID 的会话。
- 根因：会话创建 API 没有模型目录白名单校验。
- 修复：在 `app/app/api/chat/sessions/route.ts` 中复用 `isModelId()`，非法模型返回 `400 invalid_model`。
- 复验：`r53-model-contract-api-summary.json` 中 `session API rejects invalid model id` 通过。

### R53-HUB-003：模型广场推荐任务被追加到旧会话

- 严重度：P1
- 影响范围：`/hub -> /chat?model=...&seed=...`、教师真实工作流、模型会话一致性
- 基线现象：教师从模型广场点击 Claude 推荐任务，聊天页先加载最近历史会话，发送后新消息追加到旧 ChatGPT 会话；消息模型是 Claude，但会话模型仍是旧值。
- 根因：聊天页初始 effect 在没有 `session` 参数时自动加载 latest session，没有把 `model/seed/prompt/agent` 识别为新任务入口。
- 修复：在 `app/app/(shell)/chat/page.tsx` 中将 `prompt/agent/seed/model` 视为 fresh task，清空 active session、messages、feedback、favorites，并设置 `skipAutoLoadRef`。
- 复验：`r53-hub-chat-browser-summary.json` 中 fresh session、session model、assistant message model、sentinel cleanup 均通过。

## 回归保护

- 危机分支仍优先于模型校验，`intent=crisis` 不进入模型。
- 关怀分支仍优先于模型校验，`kind=care` 不被模型关闭阻断。
- 管理员关闭 Claude 后，学生普通聊天被拦截；恢复后合法教师 Claude 会话可正常创建和返回。
- `session` 直达参数仍按原会话加载；只有 `prompt/agent/seed/model` 新任务入口跳过 latest 自动加载。

## 验证产物

- `.codex-supervisor/qa-12h-20260708/models-r53/logs/r53-model-contract-api-summary.json`
- `.codex-supervisor/qa-12h-20260708/models-r53/logs/r53-hub-chat-browser-summary.json`
- `.codex-supervisor/qa-12h-20260708/models-r53/logs/manual-impact-review-r53.json`
- 静态检查：`npm run lint`、`npx tsc --noEmit`、`npm run build`
- 图谱审阅：164 files / 762 nodes / 7205 edges

## 当前残余风险

- 当前 workspace/app 不是 Git 仓库，无法生成 checkpoint commit 或 diff-based review；本轮以代码图谱状态、手工影响审阅和运行证据替代。
- 本地 QA 的 AI 回复来源为 `local-fallback`，已验证产品行为、模型选择、持久化与 UI 反馈，但外部模型网关可用性不属于 R53 闭环范围。
