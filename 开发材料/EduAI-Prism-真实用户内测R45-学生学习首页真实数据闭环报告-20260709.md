# EduAI-Prism 真实用户内测 R45 - 学生学习首页真实数据闭环报告

生成时间：2026-07-09 11:24 PDT

## 结论

本轮围绕学生登录后的 `/learn` 学习首页进行真实使用闭环内测。结论为：通过。

学生通过可见登录页完成真实登录后，页面等待 `/api/learning` 返回完整结果，再对页面内容、后端 API、移动端布局、控制台、构建产物和代码结构进行复核。最终证据显示：学习首页已从静态示例数据升级为当前账号的后端实时学习快照，移动端也能看到来源读回，不再把未接入的作业、错题、同伴排行伪装成真实功能。

## 本轮真实用户路径

1. 打开 `http://127.0.0.1:4920/login`。
2. 在桌面视口 `1440x900` 下点击“点击地球进入登录”。
3. 通过可见表单输入 `student / Student@123`。
4. 等待登录跳转到 `/learn`。
5. 等待页面完成 `/api/learning` 返回和渲染。
6. 阅读 KPI、最近学习会话、复习入口、功能接入状态、来源读回和禁用同步动作。
7. 切换到移动视口 `390x844`，重新加载并等待完整内容返回。
8. 检查移动端无横向溢出、无小于 44px 的启用触控目标、无控制台错误。
9. 通过 Node 端对当前生产服务执行 API 读回。

## 后端读回结果

最终证据文件：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\r45-learning-summary-final.json`

核心返回值：

| 项目 | 结果 |
| --- | --- |
| 匿名访问 `/api/learning` | 401 |
| 学生登录 | 200 |
| 学生读取 `/api/learning` | 200 |
| 教师读取自身学习快照 | 200 |
| 缓存策略 | `cache-control: no-store` |
| 学生会话数 | 11 |
| 学生提问数 | 16 |
| AI 回复数 | 16 |
| 收藏数 | 1 |
| 反馈数 | 1 |
| 知识库文件数 | 0 |
| 诚信引导周计数 | 10 |

后端判断通过项：

- KPI 与 `sourceSummary` 对齐。
- 最近学习会话来自真实 `chat_sessions` 和 `chat_messages`。
- 复习入口来自真实会话上下文，不冒充题目级错题本。
- 作业系统、错题本、同伴排行均明确标注 `not_connected`。
- 学习任务包含真实证据，如今日提问、收藏/反馈、今日会话。

## 浏览器验收结果

最终证据文件：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\r45-browser-ui-evidence-final.json`
- 桌面截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\r45-learn-desktop-1440-final.png`
- 移动截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\r45-learn-mobile-390-final.png`

最终浏览器判定：

| 检查项 | 桌面 | 移动 |
| --- | --- | --- |
| 页面完整就绪 | 通过 | 通过 |
| 后端实时学习快照标识 | 通过 | 通过 |
| `API /api/learning` 标识 | 通过 | 通过 |
| 学习会话 11 | 通过 | 通过 |
| AI 学习轮次 16 | 通过 | 通过 |
| 学习覆盖度 68% | 通过 | 通过 |
| 估算学习时长 128 分钟 | 通过 | 通过 |
| 来源读回 | 通过 | 通过 |
| 未接入作业/错题/排行诚实标注 | 通过 | 通过 |
| 无旧静态作业示例 | 通过 | 通过 |
| 横向溢出 | 无 | 无 |
| 控制台错误/警告 | 无 | 无 |
| 移动端启用触控目标小于 44px | 不作为桌面阻断 | 0 |

## 本轮发现并修复的问题

### R45-LEARN-DATA-001 - P1

问题：`/learn` 学习首页原先容易依赖静态客户端学习样例，学生看到的作业、复习和排行类内容可能被误认为真实数据。

修复：

- 新增 `GET /api/learning`。
- 在 `app/lib/server/db.ts` 中新增 `getLearningSnapshot(user)`。
- 从 `chat_sessions`、`chat_messages`、`favorites`、`feedback`、`kb_files`、`integrity` 聚合当前用户学习足迹。
- 前端 `/learn` 改为请求后端快照并展示来源读回。
- 未接入模块明确标注，不再混入示例数据。

### R45-LEARN-TOUCH-002 - P2

问题：移动端 `/learn` 页面上的全局“安全求助”入口实测高度为 40px，低于本轮触控基线。

修复：

- 将 `SafetyHelp` 浮动入口和弹窗内相关操作控件提升到 `min-h-[44px]`。
- 最终移动端浏览器证据返回 `smallEnabledTargets=[]`。

### R45-LEARN-MOBILE-003 - P2

问题：来源读回原本只在 `xl` 右侧栏展示，较窄视口中 `RightRail` 被隐藏，移动学生无法确认页面数据来源。

修复：

- 在 `/learn` 主内容中新增移动端可见的“来源读回”卡片。
- 复用同一组 `sourceRows` 和刷新动作。
- 最终移动端浏览器证据返回 `sourceReadback=true`。

## 验证命令

| 验证 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npx tsc --noEmit` | 通过 |
| `npm run build` | 通过 |
| 本地生产服务 `127.0.0.1:4920` | 已重启并监听 |
| Browser 插件真实登录和桌面/移动复测 | 通过 |
| API 读回脚本 | 通过 |
| `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph` | 161 files / 717 nodes / 7046 edges |
| `python -m code_review_graph status --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph` | 716 nodes / 6840 edges / 161 files |

## 审阅结论

手工影响审阅记录：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\manual-impact-review-r45.json`

审阅结论：

- API 鉴权边界清楚，匿名 401。
- 返回值使用 `no-store`，避免学习快照缓存误导。
- 变更范围集中在 `/learn`、`/api/learning`、学习快照聚合和 SafetyHelp 触控尺寸。
- 没有数据库迁移、没有生产部署、没有修改密钥。
- 因工作区不是 Git 仓库，无法生成 checkpoint commit 或 PR 级 diff 审阅，已用 code-review-graph、运行证据和手工影响审阅替代。

## 残余风险

- 学习覆盖度是根据当前可用学习足迹估算，不等同于正式成绩或掌握度测评。
- 教务作业、题目级错题本、同伴排行仍未接入，本轮已在 UI 中诚实标注。
- 本轮验证为本地生产服务，不包含线上部署或多实例环境验证。

