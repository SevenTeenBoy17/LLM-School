# EduAI-Prism 真实用户内测 R46：学生探索页真实数据闭环报告

时间：2026-07-09 11:49 PDT  
范围：学生登录后 `/explore` 探索页、`GET /api/explore`、真实返回值读回、桌面与移动端可视化检查。

## 结论

R46 已通过。学生 `/explore` 不再使用静态任务、静态成就、静态排行榜或前端本地打勾状态；页面改为读取受保护的 `/api/explore`，由当前账号真实学习记录派生探索任务、任务完成、成就和成长指标。

最终证据显示：

- 匿名访问 `/api/explore` 返回 401。
- 学生账号登录成功，`/api/explore` 返回 200，`cache-control=no-store`。
- `/api/explore.sourceSummary` 与 `/api/learning.sourceSummary` 完全一致：会话 11、提问 16、AI 回复 16、收藏 1、反馈 1、知识库 0、诚信信号 10。
- 页面主内容显示“后端实时探索快照 / API /api/explore / no-store”和上述数字，移动端同样可见。
- 同伴对比明确显示未接入，不展示虚构排行。
- 桌面端任务筛选、任务链接、任务卡点击均返回正确导航结果。
- 移动端 390px 无横向溢出、无小触控目标、右栏隐藏后成就/成长仍在主内容可见。

## 真实用户路径

1. 通过可视登录页点击“点击地球进入登录”。
2. 使用真实学生账号 `student` 登录。
3. 打开 `/explore` 并等待 `/api/explore` 返回。
4. 阅读页面来源快照、任务、成就、成长状态和未接入说明。
5. 点击“继续学习”筛选，确认只返回 `continue` 状态任务。
6. 点击知识库任务链接，确认进入 `/knowledge`。
7. 返回 `/explore`，点击第一张真实会话任务卡，确认进入对应 `/chat?session=...`。
8. 切换 390px 移动视口，复核来源读回、成就、成长、触控目标和横向溢出。

## 已修复问题

| 编号 | 级别 | 问题 | 修复 |
| --- | --- | --- | --- |
| R46-EXPLORE-001 | P1 | `/explore` 使用静态 mock 任务、任务完成、成就和成长数据，学生可能误以为是假数据为真实学习记录。 | 新增 `getExploreSnapshot()` 和 `/api/explore`，任务/成就/进度由当前账号真实会话、消息、收藏、反馈、知识库和诚信聚合派生。 |
| R46-EXPLORE-002 | P2 | 真实浏览器检查发现任务链接 39px、筛选按钮 35px，低于稳定触控目标。 | 将任务链接和筛选按钮提升为 `min-h-12`，复测桌面/移动端均为 42px，已无小目标。 |

## 关键证据

- API 证据：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/explore-r46/logs/r46-explore-api-summary-final-clean.json`
- 桌面浏览器证据：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/explore-r46/logs/r46-explore-browser-desktop-final.json`
- 移动浏览器证据：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/explore-r46/logs/r46-explore-browser-mobile-final.json`
- 桌面截图：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/explore-r46/logs/r46-explore-desktop-1440-final.png`
- 移动截图：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/explore-r46/logs/r46-explore-mobile-390-final.png`
- 手动影响面审查：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/explore-r46/logs/manual-impact-review-r46.json`

## 验证结果

| 检查项 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npx tsc --noEmit` | 通过 |
| `npm run build` | 通过，路由表包含 `/api/explore` |
| API 真实返回值审阅 | 通过 |
| 桌面 1440px 浏览器内测 | 通过 |
| 移动 390px 浏览器内测 | 通过 |
| code-review-graph | 通过，162 files / 728 nodes / 6952 edges |

## 涉及文件

- `app/lib/data/explore.ts`
- `app/lib/server/db.ts`
- `app/app/api/explore/route.ts`
- `app/app/(shell)/explore/page.tsx`
- `app/components/explore/QuestCard.tsx`
- `app/components/explore/Leaderboard.tsx`

## 残余风险

- 当前工作区不是 git 仓库，无法做 git diff review 或 checkpoint commit；本轮使用 supervisor 证据、code-review-graph 和手动影响面审查替代。
- 历史会话标题若是自动化测试 token，学科识别会显示“综合”；这是诚实降级，不影响数据真实性。
- 同伴对比仍为未接入状态；在没有匿名班级分位数据前，不应展示排行。
