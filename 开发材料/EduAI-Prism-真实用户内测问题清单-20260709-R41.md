# EduAI Prism 真实用户内测问题清单 R41

生成时间：2026-07-09 08:39 PDT  
范围：通知、全局搜索、移动端搜索入口、Dashboard 高频 CTA

## 已修复

| 编号 | 问题 | 严重度 | 修复 | 复测 |
| --- | --- | --- | --- | --- |
| R41-SEARCH-001 | 全局搜索会话结果按钮高度 38.5px，低于严格 40px 目标。 | P2 | `CommandPalette` 结果行增加 `min-h-[44px]`。 | 通过：最终搜索弹窗 `smallTargets=[]`。 |
| R41-MOBILE-SEARCH-002 | 移动端 Topbar 没有可见全局搜索入口。 | P1 | `Topbar` 增加移动端搜索图标按钮，复用全局搜索事件。 | 通过：移动端 `hasVisibleSearchButton=true`。 |
| R41-DASHBOARD-CTA-003 | 移动 Dashboard “发起新对话”按钮高度 28px。 | P2 | 该 CTA 增加 `min-h-[40px]`。 | 通过：移动端扫描 `smallTargets=[]`。 |
| R41-QA-001 | 第一版脚本将全局搜索 dialog 误定位为输入框。 | QA | 改为 `input[aria-label*="搜索"]`，并补临时会话清理。 | 通过：最终脚本完整执行并清理样本。 |

## 验证通过项

- 通知 GET：返回真实教师通知和未读数。
- 单条通知 PATCH：`200 { ok: true, unread: 2 }`。
- 单条已读持久化：通过。
- 全部已读：最终 `unread=0`。
- 会话搜索：返回真实 session，点击导航到 `/chat?session=...`。
- 智能体搜索：返回真实 agent，点击导航到 `/chat?agent=...`。
- 无结果搜索：API 空数组 + UI 无匹配文案。
- 通知菜单、搜索弹窗、移动 Dashboard：无小目标，无横向溢出。
- 清理：临时会话和智能体均删除成功。

## 后续观察

- 通知目前只支持标记已读，不支持点击通知后跳转到对应智能体/工单/审批项；后续可以为通知增加 `targetUrl`，进一步提升治理效率。
- `/api/search` 是关键词聚合搜索，不是向量语义搜索；无结果文案已经明确为校内关键词检索，后续可作为语义检索升级点。
