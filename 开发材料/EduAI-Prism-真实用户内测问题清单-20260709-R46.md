# EduAI-Prism 真实用户内测问题清单 R46

时间：2026-07-09 11:49 PDT  
工作流：学生 `/explore` 探索页真实数据闭环。

## 已关闭问题

| 编号 | 级别 | 状态 | 现象 | 处理结果 |
| --- | --- | --- | --- | --- |
| R46-EXPLORE-001 | P1 | 已修复并复测通过 | `/explore` 依赖静态 mock 的任务、成就、成长数据和本地任务打勾，无法代表真实学生学习进度。 | 新增受保护 `/api/explore`，复用 `/api/learning` 的真实来源摘要，页面展示来源读回和未接入说明。 |
| R46-EXPLORE-002 | P2 | 已修复并复测通过 | 桌面真实渲染中任务链接 39px、筛选按钮 35px，触控目标偏小。 | 提升任务链接和筛选按钮为 `min-h-12`，桌面和移动端复测均无小目标。 |

## 复测证据

- API：`r46-explore-api-summary-final-clean.json`，verdict=pass。
- 桌面：`r46-explore-browser-desktop-final.json`，verdict=pass，issues=[]。
- 移动端：`r46-explore-browser-mobile-final.json`，verdict=pass，issues=[]。
- 静态/构建：lint、tsc、build 均通过。
- 审查：`manual-impact-review-r46.json`，verdict=pass。

## 暂不处理但需记录

- `code-review-graph` 可用，但 git 仓库不可用，因此本轮不能提交 checkpoint 或跑 diff-based review。
- 同伴排名尚未接入真实匿名班级分位，页面继续保持“未接入”诚实显示。
- 历史自动化测试会话可能在探索卡标题中显示测试 token；这属于历史数据质量，不是本轮 `/explore` 真实数据接入缺陷。
