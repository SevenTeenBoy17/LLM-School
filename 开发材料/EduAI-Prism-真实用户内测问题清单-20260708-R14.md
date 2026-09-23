# EduAI-Prism 真实用户内测问题清单 R14

日期：2026-07-08  
内测切片：桌面端 Shell / Dropdown / 管理员审计筛选  
方法：真实角色登录后等待页面内容返回，再打开菜单、点击导航和筛选控件。

| ID | 严重级别 | 状态 | 问题 | 处理 |
| --- | --- | --- | --- | --- |
| R14-AUDIT-001 | P2 | 已修复 | 管理员 `/admin/audit` 桌面端 `全部 / 高风险 / 待处理 / 已忽略` 筛选 tabs 初测约 `29px` 高，低于桌面高频控件建议下限。 | 审计页 4 个 `TabsTrigger` 从 `md:min-h-0` 改为 `md:min-h-10`，移动端 `min-h-12` 保持不变；最终实测约 `35px`。 |
| R14-QA-001 | P3 | 已记录 | Browser `domSnapshot()` 在登录页降级，无法作为本轮主要 DOM 证据。 | 使用同一浏览器的 evaluate、locator、截图、console logs 继续取证，不将工具降级误报为产品问题。 |
| R14-QA-002 | P3 | 已记录 | 初测 naive offscreen 检查把首屏以下正常滚动内容算作 offscreen。 | 复测时将滚动内容与 overlay/dropdown 失败分开，仅把菜单/固定层越界作为失败。 |

## 最终验收

- 学生 `/learn`：真实登录、内容返回、通知/设置 dropdown 打开，通过。
- 教师 `/dashboard`：真实登录、内容返回、通知/设置 dropdown 打开，通过。
- 教师侧边栏：点击 `班级学情` 进入 `/class`，通过。
- 管理员 `/admin/audit`：真实登录、内容返回、通知/设置 dropdown 打开，通过。
- 管理员筛选 tabs：`高风险 / 待处理 / 已忽略 / 全部` 均可点击并 selected/active，高度约 `35px`。
- 横向溢出：无。
- 控制台：无 error/warn。
- 静态验证：lint / tsc / build 通过。
- 审阅：code-review-graph 构建通过，手动影响面审阅通过。
