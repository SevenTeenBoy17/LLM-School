# EduAI-Prism 真实用户内测问题清单 R43

生成时间：2026-07-09 10:29 PDT  
范围：聊天长链路、整段复制/导出、历史恢复、移动端弱网继续对话  
最终状态：全部关闭

| 编号 | 严重级别 | 问题 | 修复状态 | 证据 |
| --- | --- | --- | --- | --- |
| R43-CHAT-ONB-001 | P1 | 移动端通过 `/chat?session=...` 恢复历史时，首次引导层可能延迟挂载并遮挡发送按钮，真实点击失败。 | 已修复 | `OnboardingGuide` 增加即时卸载状态；全屏引导不再出现在 `/chat`；最终 R43 `mobile.clicked=true`、`slowNotice=true`、`issues=[]`。 |
| R43-CHAT-TARGET-002 | P2 | 桌面侧栏“发起新对话”按钮实测高度低于稳定触控基线。 | 已修复 | `ChatSidebar` 按钮改为显式 52px；最终 R43 `buttonBox.height=52`。 |
| R43-HARNESS-003 | P2 | 回归脚本此前允许 Enter 兜底触发移动端发送，不能证明按钮真实可点。 | 已修复 | R43 harness 新增 `clicked=true`、POST 201、按钮 `>=44px`、移动端发送按钮真实点击断言。 |
| R43-ENV-004 | P2 | 本地生产启动若只在 start 注入 `EDUAI_SESSION_SECRET`，登录 API 仍可能 500；需构建阶段也带 QA 密钥。 | 已处理 | 使用 QA 专用会话密钥重新构建并启动；登录 API 返回 200。正式环境需配置真实强随机密钥。 |

## 最终验证

- 最终日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\chat-longchain-r43\logs\r43-chat-longchain-R43_CHAT_LONGCHAIN_1783618038097.json`
- Verdict：`pass`
- Issues：`[]`
- 新建对话：`201`，按钮 `clicked=true`，按钮高度 `52px`
- 移动端第三轮：发送按钮 `clicked=true`，慢响应提示 `true`，最终 `200`
- 复制/导出/历史恢复/读回/清理：全部通过
- 静态检查：lint、tsc、build 全部通过
- 图谱审阅：159 files / 698 nodes / 6559 edges，手工影响面审阅通过
