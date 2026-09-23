# EduAI-Prism 真实用户内测 R6：管理员治理工作流报告

生成时间：2026-07-08  
测试环境：本地生产包 `http://127.0.0.1:4920`  
测试方法：模拟真实学校/公司内部使用，等待 UI、API、导出、状态变更全部返回后再评价。

## 1. 本轮目标

本轮聚焦管理员治理工作流，不把静态页面、按钮数量或路由 200 当成产品质量结论。测试角色按真实校内运营/信息化/安全团队处理一天内常见任务：

- 管理员从真实登录页进入后台。
- 学生创建安全求助工单，管理员在审计页跟进并完成。
- 管理员搜索审计样例和权限用户。
- 管理员调整模型治理开关并恢复原值。
- 管理员导出审计日志和权限报表。
- 每一步都等待服务端响应、页面状态变化或导出内容生成后再判定。

## 2. 真实使用过程与证据

### 2.1 登录与服务端治理回执

- 管理员账号：`admin / Admin@123`，通过可见登录页进入后台。
- API 回执复核：`/api/auth/me` 返回 `role=admin`。
- 真实工单链路：学生本地求助工单创建 200，管理员 PATCH 跟进 200，管理员 PATCH 完成 200。
- 最终 API 回读：审计 62 条、工单 4 条、模型 `chatgpt.autoDowngrade=false` 已恢复。

证据：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-governance\logs\admin-governance-api-preflight-r6.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-governance\logs\admin-governance-api-final-r6.json`

### 2.2 浏览器真实管理员操作

已完成：

- `/admin/audit` 等待真实审计与工单返回。
- 新建 R6 工单在页面显示为待跟进。
- 点击“跟进”后，行状态变为“跟进中”，并出现“完成”按钮。
- 点击“完成”后，行状态变为“已处理”，跟进/完成按钮消失。
- `/admin/models` 点击“超额自动降级”后显示“已保存到服务端”，再恢复原值并再次保存成功。
- 全程相关页面无控制台 error/warn。

证据：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-governance\logs\browser-realuse-r6-summary.json`

### 2.3 导出验证

- 权限报表导出触发真实浏览器下载事件，文件名 `权限报表-teacher.csv`，大小 202 字节。
- 审计导出在首次新会话中被 onboarding 引导遮挡；按真实首次用户流程点击“跳过引导”后，导出生成 `服务端审计日志.csv`，CSV Blob 大小 4371 字节，内容包含真实服务端审计字段与行数据。
- 内置浏览器无法稳定捕捉 Blob download event，已使用 bundled Playwright + Blob/anchor 探针降级验证。

## 3. 发现并修复的问题

### R6-FE-001：审计页搜索框未真正筛选

问题表现：

- 在 `/admin/audit` 输入“未知IP”后，目标行出现，但王思远、李欣然、陈教授、刘子涵等无关样例行仍然显示。

修复：

- 在 `app/app/(shell)/admin/audit/page.tsx` 增加受控搜索状态。
- 对时间、用户、角色、操作、资源、风险、状态进行查询匹配。
- 增加空结果提示“未找到匹配的样例审计记录”。

复测：

- 搜索“未知IP”只剩目标行。
- 搜索 `no-such-r6-audit` 显示空状态。

### R6-FE-002：权限页用户搜索框未真正筛选

问题表现：

- 在 `/admin/permissions` 输入不存在用户 `no-such-r6-user` 后，教师样例用户仍然显示。

修复：

- 在 `app/app/(shell)/admin/permissions/page.tsx` 增加受控搜索状态。
- 对姓名、工号、学院、角色、状态进行查询匹配。
- 增加空结果提示“未找到匹配的用户”。

复测：

- 搜索 `T2015007` 只剩陈教授。
- 搜索 `no-such-r6-user` 显示空状态。

## 4. 验证与审阅

已通过：

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- 重启本地生产服务 `next start -p 4920`
- 浏览器真实操作复测
- API 最终回读
- `python -m code_review_graph build`
- `python -m code_review_graph status`
- 人工影响审查

code-review-graph：

- Build：156 files / 645 nodes / 6156 edges
- Status：645 nodes / 5976 edges

人工审查结论：

- 改动只影响两个管理页的本地显示筛选。
- 审计 API、工单状态 PATCH、模型治理 API、权限保存 API、CSV 导出函数均未改动。
- 未发现新的回归风险。

## 5. 本轮结论

R6 管理员治理切片通过修复后验收。管理员真实治理链路已经能完成：登录、读取真实审计、处理安全工单、搜索定位、模型治理保存、导出复盘数据。

整体 12 小时内测目标仍未完成；R6 只关闭管理员治理工作流，后续仍需继续移动端、长会话、多人协作与持续运行观察。
