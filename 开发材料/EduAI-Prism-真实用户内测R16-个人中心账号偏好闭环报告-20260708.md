# EduAI-Prism 真实用户内测 R16：个人中心、账号资料与偏好设置闭环报告

日期：2026-07-08  
轮次：R16  
范围：登录后个人中心 `/profile`，账号资料、偏好设置、安全验证  
状态：本轮闭环通过；12 小时整体真实使用内测仍继续

## 1. 内测方法校正

本轮按“真实用户和真实学校/公司内部研讨”的方式执行，不再把页面能打开、接口能返回当作完整内测结论。

硬性评判规则：

- 使用真实角色登录：以教师账号完成可见登录和真实页面流转。
- 使用真实路径：从浏览器访问 `/profile`、`/profile?tab=prefs`，不绕过 UI 直接下结论。
- 等待结果返回：所有 UI 状态、保存反馈、API 读回、页面重载和浏览器日志稳定后再评价。
- 区分产品问题和测试环境问题：环境限制只记为 QA caveat，不替代产品 verdict。
- 先使用后研讨：模拟真实教师修改资料、调整偏好、验证密码错误，再基于结果判断留存风险、可用性和修复优先级。

## 2. 真实使用场景

用户画像：清波校区教师王思远，日常需要在个人中心维护账号资料、调整界面偏好，并确认安全设置不会误改密码。

真实使用任务：

- 打开个人中心并切换到偏好设置。
- 修改“减少动效”等偏好，等待保存结果，并验证服务端是否持久化。
- 修改账户名称和简介，保存后用 API 读回验证，再恢复原始资料。
- 输入不匹配、弱密码、错误旧密码，确认不会改动真实密码。
- 检查移动/桌面可点控件高度、横向溢出、控制台错误和页面反馈。

## 3. 初测发现

| 编号 | 优先级 | 问题 | 真实影响 | 初测结论 |
| --- | --- | --- | --- | --- |
| R16-PROFILE-001 | P1 | `/profile?tab=prefs` 没有打开“偏好设置”，仍停留在“账户资料”。 | 顶栏/侧栏的偏好入口失效，真实用户会以为设置丢失或页面跳错。 | 确认缺陷 |
| R16-PROFILE-002 | P2 | 个人中心 tabs、保存按钮和偏好开关触控尺寸偏小，部分约 28-29px，开关约 18px。 | 移动端和触屏设备误触率高，后台/教师日常设置体验不稳。 | 确认缺陷 |
| R16-PREF-003 | P2 | 偏好修改可以持久化，但页面没有“保存中/已保存/失败恢复”反馈。 | 用户无法判断设置是否生效，网络慢或失败时容易重复点击。 | 确认缺陷 |
| R16-ACCOUNT-004 | - | 账户资料保存、API 读回、恢复原值通过。 | 未发现产品缺陷。 | 通过 |
| R16-SEC-005 | - | 密码不匹配、弱密码、错误旧密码均有正确提示，原密码仍可登录。 | 未执行真实改密，避免破坏演示账号；错误路径通过。 | 通过 |

## 4. 修复内容

修改文件：

- `D:\VB\LLM-School\app\app\(shell)\profile\page.tsx`

关键修复：

- URL 参数成为个人中心 tab 的单一来源：`/profile?tab=prefs` 会直接选中“偏好设置”。
- 个人中心组件包裹 `Suspense`，满足 Next.js 对 `useSearchParams()` 的构建要求。
- tabs 切换使用 `router.replace()` 写回 URL，支持可分享、可刷新、可从侧栏直达。
- 偏好保存增加 `保存中... / 已保存到服务端 / 保存失败，已恢复服务端设置` 的可见状态。
- 偏好保存失败时自动拉取服务端偏好并回滚 UI，避免本地假成功。
- 仅在个人中心范围内增大 tabs、按钮和 switch 尺寸，避免影响全局组件。

## 5. 复测证据

静态验证：

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过

运行验证：

- 生产式本地服务：`http://127.0.0.1:4920/login` 返回 HTTP 200
- 真实教师登录后访问：`http://127.0.0.1:4920/profile?tab=prefs`
- 选中 tab：`偏好设置`
- tab 高度：约 `35px`
- 偏好开关尺寸：约 `35 x 56px`
- 小尺寸控件清单：`[]`
- 修改“减少动效”后可见状态：`已保存到服务端`
- API 读回：`reduceMotion=true`
- 恢复状态：API 已恢复 `reduceMotion=false`
- 横向溢出：无
- console error/warn：0

代码图谱与影响复核：

- `python -m code_review_graph build/status`：通过
- 图谱规模：156 files，655 nodes，6081 status edges，95 flows
- 手动影响复核：通过；本轮只触达个人中心页面，没有改全局 primitive

证据文件：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\logs\r16-profile-prefs-baseline.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\logs\r16-prefs-toggle-baseline.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\logs\r16-api-readback-after-prefs-toggle.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\logs\r16-account-save-baseline.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\logs\r16-password-validation-baseline.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\logs\r16-profile-prefs-final.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\logs\r16-pref-restore.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\screenshots\r16-profile-prefs-final.png`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\profile-account\logs\manual-impact-review-r16.json`

## 6. 内部研讨结论

这类页面不是视觉展示页，而是高频信任页面。真实教师和管理员会把“资料是否保存”“设置是否立即生效”“安全设置是否可靠”直接等同于产品可信度。因此个人中心应坚持：

- 入口要准确：从任何地方进入偏好页，都必须落到正确 tab。
- 状态要外显：保存中、成功、失败恢复必须清楚出现。
- 触控要稳：后台类界面也不能牺牲移动端和触屏可点性。
- 失败要可恢复：偏好类设置如果服务端失败，UI 必须回到真实服务端状态。
- 安全要克制：测试不应随意真实改密；先覆盖错误路径和不破坏账号的安全验证。

## 7. 本轮结论

R16 个人中心、账号资料、偏好设置与密码错误验证闭环通过。  
本轮问题已修复并复测无误。  
12 小时级别的全站真实使用内测仍保持进行中，后续继续按“真实角色使用、等待全部结果返回、再评价和研讨”的方式推进。
