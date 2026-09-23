# EduAI Prism 真实用户内测问题清单 R7

## 已修复

| ID | 严重级别 | 问题 | 修复 | 证据 |
| --- | --- | --- | --- | --- |
| R7-FE/AI-001 | P1 | 教师真实等待完整返回后，兜底回答没有满足班级学情、45 分钟流程、三道诊断题、h 符号讲解和家校话术要求。 | 增强 `localTeacherLesson()`，针对二次函数顶点式补救课输出完整可用结构。 | `browser-realuse-r7-summary.json`、`api-readback-r7-final.json` |
| R7-FE-002 | P2 | 390px 移动端打开单条回答导出菜单时，菜单右边界超出视口。 | `MessageBubble` 导出菜单从左对齐改为右对齐。 | `visual-scan-r7.json`、`final-visual-menu-r7.json` |

## 能力降级/未作产品修复

| ID | 严重级别 | 状态 | 说明 | 后续建议 |
| --- | --- | --- | --- | --- |
| R7-QA-003 | P3 | 降级记录 | in-app Browser 未捕获程序化 Blob 下载事件；独立 Playwright 探针因缺 `playwright-core` 不可用。本轮验证复制和导出菜单，不把下载文件捕获声明为通过。 | 若后续必须逐轮验证真实下载文件，建议给 QA harness 增加固定 Playwright 依赖或使用浏览器端下载目录审计能力。 |

## 本轮通过门禁

- `npm run lint`：通过两次。
- `npx tsc --noEmit`：通过两次。
- `npm run build`：通过两次。
- 本地生产服务：`http://127.0.0.1:4920` 最终由 PID 30800 提供。
- Browser 真实移动端复测：通过。
- HTTP API 最终读回：通过。
- code-review-graph：156 files / 645 nodes / 6166 build edges。
- 手工影响审阅：通过，未发现新增安全、会话归属、导出动作或反馈收藏回归。
