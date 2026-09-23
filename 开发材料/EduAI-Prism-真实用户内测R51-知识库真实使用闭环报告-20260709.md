# EduAI-Prism 真实用户内测 R51：知识库真实使用闭环报告

时间：2026-07-09 16:47 PDT  
范围：`/knowledge` 知识库上传、检索、详情回读、跨角色可见性、移动端可用性、缓存隐私头  
结论：通过。本轮发现并修复 2 个产品问题，另修正 1 个 QA 等待策略问题。

## 真实使用场景

本轮模拟一所学校内部的真实知识库使用：

- 教师 `teacher` 上传课堂资料，并选择 `课程成员`、`仅本人`、`学部成员`、二进制文件名检索四种场景。
- 学生 `student` 与教师同班同学段，应能读到课程共享与学部共享资料，但不能读到教师个人资料。
- 科研账号 `research` 为跨学段，应不能读取初中部学部共享资料。
- 管理员 `admin` 应能治理查看全部资料。

## 修复内容

1. 知识库 API 响应统一补充 `Cache-Control: no-store`

- 文件：`app/app/api/knowledge/route.ts`
- 文件：`app/app/api/knowledge/[id]/route.ts`
- 文件：`app/app/api/knowledge/search/route.ts`
- 原因：知识库列表、搜索片段、详情预览、删除结果都可能包含校内资料或权限状态，不能被浏览器或中间层缓存。

2. 移动端知识库搜索输入框触控高度修复

- 文件：`app/app/(shell)/knowledge/page.tsx`
- 原因：浏览器内测测得搜索输入框高度 35px，低于本项目已采用的 40px 触控底线。
- 修复：主搜索输入增加 `h-10 min-h-[40px]`。

3. QA 脚本等待策略加严

- 文件：`.codex-supervisor/qa-12h-20260708/knowledge-r51/r51-knowledge-browser.spec.js`
- 原因：原脚本可能被页面旧详情或搜索框附近文本抢跑。
- 修复：必须等待“搜索结果卡片”返回命中文件名，再等待右侧详情 `aside` 返回正文预览后才判定合格。

## 验证证据

- API 脚本：`r51-knowledge-api-summary.json`，42 项检查，`verdict=pass`
- 浏览器脚本：`r51-knowledge-browser-summary.json`，11 项检查，`verdict=pass`
- 移动端截图：`r51-knowledge-mobile-final.png`
- 桌面端截图：`r51-knowledge-desktop-final.png`
- 手工影响审查：`manual-impact-review-r51.json`

核心通过点：

- 匿名访问 `/api/knowledge` 与 `/api/knowledge/search` 返回 401。
- 教师上传返回 201 和真实文件 id。
- 教师、学生、科研、管理员列表返回 200 且 `cache-control=no-store`。
- 学生同班可读课程资料，不能读教师 `self` 资料。
- 科研账号不能读初中部 `college` 资料。
- 管理员可读教师 `self` 资料。
- 搜索返回真实正文片段，二进制文件只诚实返回“命中文件名”。
- 删除只允许上传者本人，删除后详情回读 404。
- 浏览器真实上传后等待“上传完成”，搜索唯一标记，点击结果，详情正文预览回读成功。
- 移动端 390px 无横向溢出，`smallTargets=[]`，console 无错误。

## 质量判断

本轮合格。知识库作为校内资料承载面，隐私缓存头、权限边界、真实检索片段、移动端可操作性都已通过返回值和页面回读证明。

残余风险：

- 当前工作区不是 git 仓库，无法做 checkpoint commit 或 diff-based graph review；已用 code-review-graph 全量构建和手工影响审查降级覆盖。
- 本轮验证关键词检索与诚实二进制行为，不覆盖 PDF/Word/PPT 的 OCR 或向量检索能力。
