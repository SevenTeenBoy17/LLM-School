# EduAI-Prism 真实用户内测 R17：管理员权限保存与审计闭环报告

日期：2026-07-08  
轮次：R17  
范围：后台权限管理 `/admin/permissions`、角色权限保存、审计记录、API 安全边界  
状态：本轮闭环通过；12 小时整体真实使用内测仍继续

## 1. 本轮真实使用标准

本轮继续执行“真实用户和真实学校/公司内部研讨”的内测方式：

- 使用真实管理员账号 `admin / Admin@123` 通过可见登录页进入后台。
- 使用真实页面 `/admin/permissions`，不只看接口或静态代码。
- 真实修改教师角色的一个可恢复权限位：`用户管理`。
- 等待页面状态、服务端读回、审计记录和恢复结果全部返回后再评价。
- 临时权限变更必须恢复到原值，避免内测污染演示数据。
- 后端边界必须复核：学生不能读写权限 API，非法角色必须被拒绝。

## 2. 真实使用流程

用户画像：学校平台管理员李校长，需要临时核验教师角色权限配置是否能保存、是否有审计记录、是否能恢复。

步骤：

1. 打开登录页，输入 `admin / Admin@123`。
2. 登录后进入后台数据看板，再打开 `/admin/permissions`。
3. 读取教师角色当前权限位和审计记录作为 baseline。
4. 在可见 UI 中把教师角色 `用户管理` 从 false 切到 true。
5. 点击 `保存角色权限`，等待页面显示 `已保存到服务端`。
6. 用管理员 API 会话读回 `/api/admin/permissions/teacher`，确认 `用户管理=true`。
7. 读取 `/api/audit`，确认出现 `role_perms_update`。
8. 通过可见 UI 把 `用户管理` 恢复为 false，并再次保存。
9. API 读回确认 `用户管理=false`，审计记录累计增加。
10. 用学生账号复核权限 API 读写均为 403，非法角色为 400。

## 3. 初测发现

| 编号 | 优先级 | 问题 | 真实影响 | 初测结论 |
| --- | --- | --- | --- | --- |
| R17-ADM-PERM-001 | P2 | `/admin/permissions` 多个高频控件触控尺寸偏小：导出/新增/批量/保存按钮约 28px，编辑按钮约 25px，权限开关约 18px。 | 管理员在触屏设备、窄屏笔记本、远程桌面中容易误触；权限页属于高风险后台操作，触控不稳会降低信任感。 | 确认缺陷 |
| R17-ADM-PERM-002 | - | 教师角色权限保存功能。 | 页面显示保存成功，API 读回成功，审计记录生成。 | 通过 |
| R17-ADM-PERM-003 | - | 权限恢复与数据清理。 | 通过 UI 恢复原值，API 读回 `用户管理=false`。 | 通过 |
| R17-ADM-PERM-004 | - | 后端安全边界。 | 学生 GET/PUT 权限 API 返回 403，非法角色 GET/PUT 返回 400。 | 通过 |

## 4. 修复内容

修改文件：

- `D:\VB\LLM-School\app\app\(shell)\admin\permissions\page.tsx`

修复点：

- 导出权限报表、新增角色、批量导入、复制到其他、保存角色权限按钮增加本页局部 `min-h-10`。
- 用户列表的 `编辑` 按钮从 `h-7` 调整为 `min-h-10 px-3`。
- 权限开关只在本页局部放大到约 `35 x 56px`，不修改全局 Switch。
- 保持已有权限保存、审计和 RBAC 逻辑不变。

## 5. 复测证据

静态验证：

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过
- 本地生产式服务重启后 `/login` 返回 HTTP 200

浏览器复测：

- 管理员可见登录：通过
- 打开 `/admin/permissions`：通过
- `smallTargets=[]`
- `disabledSmallTargets=[]`
- 权限开关尺寸：约 `35 x 56px`
- 横向溢出：无
- console error/warn：0
- 保存后页面状态：`已保存到服务端`
- 恢复后页面状态：`已保存到服务端`

API 与审计复测：

- 保存后 `/api/admin/permissions/teacher` 读回：`用户管理=true`
- 恢复后 `/api/admin/permissions/teacher` 读回：`用户管理=false`
- `/api/audit` 出现多条 `role_perms_update`
- 学生账号 GET `/api/admin/permissions/teacher`：403
- 学生账号 PUT `/api/admin/permissions/teacher`：403
- 管理员访问非法角色 GET/PUT：400

代码图谱与影响复核：

- `python -m code_review_graph build/status`：通过
- 图谱规模：156 files，655 nodes，6081 status edges，95 flows
- 手动影响复核：通过；本轮只触达权限管理页 UI 尺寸，不改 API、数据库、全局按钮或全局开关组件。

证据文件：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-api-baseline.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-browser-final-state.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-api-after-save-unicode-key.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-api-after-restore.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-browser-postfix-save.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-browser-postfix-restore.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-api-postfix-after-save.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-api-postfix-after-restore.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\r17-api-security-boundary.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\logs\manual-impact-review-r17.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-permissions\screenshots\r17-admin-permissions-postfix.png`

## 6. 内部研讨结论

权限管理页属于后台高风险页面，用户留存和信任不只来自“能保存”，还来自“能看清、点得准、保存后有证据、错误角色不能越权”。本轮结论：

- 权限保存主链路是可靠的：UI 状态、API 读回和审计记录一致。
- 后端边界是可靠的：非管理员无法读写权限，非法角色被拒绝。
- 视觉和交互细节仍会影响真实信任：小按钮和小开关在后台页面中不是小问题，已经修复。
- 测试脚本里的中文 key 必须使用 Unicode escape 或 UTF-8 文件体，避免 PowerShell 管道转码导致误判。

## 7. 本轮结论

R17 管理员权限保存、审计、恢复与后端边界闭环通过。  
本轮确认的触控尺寸问题已修复并复测无误。  
12 小时全站真实使用内测仍继续执行。
