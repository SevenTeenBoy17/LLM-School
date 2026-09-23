# EduAI Prism 真实用户内测问题清单 R39

轮次：R39  
主题：知识库上传/删除与后台审计治理闭环  
最终状态：全部已修复并复测通过  

## R39-KB-AUD-001

严重级别：P1  
问题：教师通过真实 UI 删除知识库文件后，DELETE 返回 `200 { ok: true }`，但后台 `/api/audit` 没有对应 `kb_delete allow` 审计行。  
影响：管理员无法追踪知识库删除行为，审计链路不完整。  
修复：`app/app/api/knowledge/[id]/route.ts` 成功删除写入 `kb_delete allow`，失败的已登录删除尝试写入 `kb_delete deny`。  
证据：最终日志中 `deleteAudit.ok=true`，行内容为 `userId=u-teacher / role=teacher / path=/api/knowledge / action=kb_delete / result=allow`。  
状态：已修复，通过。

## R39-AUD-SEARCH-002

严重级别：P1  
问题：后台审计页搜索框只过滤样例日志，不过滤真实服务端审计记录；无匹配搜索仍显示真实 `kb_upload` 行。  
影响：真实管理员无法有效定位服务端审计记录，且无匹配状态不可信。  
修复：`app/app/(shell)/admin/audit/page.tsx` 新增真实审计匹配函数，真实服务端记录列表、空态与导出均绑定同一查询结果。  
证据：最终日志中 `NO_MATCH` 搜索 `hasKbUpload=false`、`hasKbDelete=false`、`hasNoMatchCopy=true`。  
状态：已修复，通过。

## R39-AUD-EXPORT-003

严重级别：P2  
问题：导出按钮原先导出全部真实审计记录，和当前搜索筛选状态不一致。  
影响：管理员搜索 `kb_delete` 后导出的仍可能是全部记录，容易误判。  
修复：CSV 导出改为导出 `filteredServerAudit`，状态提示返回筛选后的真实记录数。  
证据：最终日志中 `kb_upload` 导出反馈为 `已生成 14 条真实审计 CSV（筛选：kb_upload）`，`kb_delete` 导出反馈为 `已生成 2 条真实审计 CSV（筛选：kb_delete）`。  
状态：已修复，通过。

## R39-UI-TARGET-004

严重级别：P2  
问题：严格扫描发现桌面侧栏链接、顶部全局搜索、审计筛选 Tabs 低于 40px。  
影响：高频管理界面点击目标偏小，影响真实后台人员重复操作效率。  
修复：`Sidebar.tsx` 链接、`Topbar.tsx` 全局搜索、审计 Tabs 改为明确 `40px` 级尺寸。  
证据：第三轮最终日志 `smallTargets=[]`。  
状态：已修复，通过。

## R39-UI-TICKET-005

严重级别：P2  
问题：第二轮复测发现安全工单表格内“跟进/完成”按钮仍为约 `37.3 x 28px`。  
影响：审计治理页仍存在同页可操作按钮低于标准的问题。  
修复：审计页桌面表格中的安全工单行内按钮升级为 `min-h-[40px]`。  
证据：第三轮最终日志 `smallTargets=[]`。  
状态：已修复，通过。

## 最终复测

最终日志：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/knowledge-audit-r39/logs/r39-knowledge-audit-R39_KB_AUDIT_1783609520795.json`

- `verdict=pass`
- `issues=[]`
- `npm run lint` 通过
- `npx tsc --noEmit` 通过
- `npm run build` 通过
- code-review-graph 刷新通过
- 手工影响面审查通过
