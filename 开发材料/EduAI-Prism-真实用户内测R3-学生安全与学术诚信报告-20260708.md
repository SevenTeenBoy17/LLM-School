# EduAI Prism 真实用户内测 R3 报告：学生安全与学术诚信

日期：2026-07-08  
范围：学生端 AI 对话、学术诚信拦截、危机求助、安全工单、教师班级治理闭环  
方法：模拟真实学生与学校团队使用。所有评价均在 UI/API/AI 内容完整返回后进行，不以接口 200、按钮数量或截图烟测直接下结论。

## 真实场景

1. 学生刘子涵从登录页进入学习首页，再点击“开始提问”进入 AI 对话。
2. 学生提出代写/抄答案请求，等待完整回复渲染。
3. 学生提出危机求助请求，等待完整回复、热线和安全求助面板渲染。
4. 教师王思远查看班级诚信周统计，验证诚信事件是否形成学校侧治理闭环。
5. 管理员李校长查看安全工单，验证危机求助是否可被校内安全/心理团队看见。

## 结论

R3 场景已通过修复后复测。学生代写请求被转为“学术诚信引导”，未泄露最终答案；危机求助被“校内安全策略”拦截，展示 400-161-9995、110 / 120，并自动打开安全求助面板；危机内容不进入普通聊天历史，诚信引导会以去标识化计数进入教师班级统计。

本轮发现并修复 1 个真实产品问题：安全/诚信回复曾显示为 “GPT-5.4 · 0.0s”，会误导学校和学生以为这是普通模型输出。修复后改为“学术诚信引导 / 校内安全策略”，并隐藏策略消息的重新生成入口。

## 修复内容

| 模块 | 修复 |
| --- | --- |
| `app/lib/types.ts` | 扩展 `ChatMessage.source`，加入 `safety`、`care`、`integrity-scaffold` |
| `app/lib/server/db.ts` | 服务端持久化消息类型同步扩展，诚信引导可带来源落库 |
| `app/app/api/chat/route.ts` | 危机/关怀/诚信/普通模型响应均返回明确来源；普通模型返回后端耗时 |
| `app/app/(shell)/chat/page.tsx` | 前端按 `kind/source` 映射策略来源；策略消息不展示模型耗时 |
| `app/components/chat/MessageBubble.tsx` | 策略消息使用专属图标、标签和视觉身份；隐藏安全/关怀消息的收藏/反馈，隐藏所有策略消息的重新生成 |

## 关键证据

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| API 诚信拦截 | `kind=scaffold`，`source=integrity-scaffold`，未泄露最终答案 | `.codex-supervisor/qa-12h-20260708/student-safety/logs/student-policy-source-api-r3-postfix-v2.json` |
| API 危机拦截 | `kind=crisis`，`source=safety`，`help=true` | 同上 |
| 教师治理闭环 | `integrityWeekly` 从 5 增至 6 | 同上 |
| 危机隐私边界 | 实际危机文本和热线不进入普通会话历史 | 同上 |
| 管理员工单 | 管理员可见 `chat:crisis-auto` 工单 | 同上 |
| 浏览器真实学生路径 | 登录学生 -> 学习页 -> 开始提问 -> 两类消息完整返回 | `.codex-supervisor/qa-12h-20260708/student-safety/logs/student-policy-label-browser-r3-postfix.json` |
| UI 标签修复 | 显示“学术诚信引导 / 校内安全策略”，旧 `GPT-5.4 · 0.0s` 不再出现 | 同上 |
| 移动端布局 | `overflowX=false`，0 console error/warn | 同上 |

截图：  
`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\student-safety\screenshots\student-policy-label-browser-r3-postfix.png`

## 验证命令

| 命令/检查 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npx tsc --noEmit` | 通过 |
| `npm run build` | 通过 |
| Browser 真实路径复测 | 通过 |
| API 回归复测 | 通过 |
| `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph` | 156 files / 644 nodes / 6132 edges |
| 手工影响审查 | 8/8 通过 |

## 环境说明

生产方式重启本地服务时发现 `.env.local` 未配置 `EDUAI_SESSION_SECRET`，生产启动后登录会返回 500。本轮没有把密钥写入项目文件，而是用一次性本地进程环境密钥启动 4920，用于内测验证。真实部署前必须在目标环境配置强随机 `EDUAI_SESSION_SECRET`。

## 后续建议

1. R4 继续做教师真实教研工作流：创建提示词、课堂资料检索、班级学情分析、导出与分享边界。
2. R5 做管理员治理工作流：模型开关、权限变更、审计日志、安全工单处理闭环。
3. 长测中保留“等待完整返回后评价”的规则，尤其是 AI 输出、上传解析、导出生成和后台统计更新。
