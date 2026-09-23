# EduAI Prism 真实用户内测 R36：知识库上传、检索、权限闭环报告

时间：2026-07-09 07:26 PDT  
范围：`/knowledge` 知识库上传、关键词检索、学生/教师/管理员可见性、移动端触控质量。

## 1. 本轮真实使用场景

本轮按“真实教师 + 真实学生 + 真实管理员”的公司/学校内测方式执行，不以按钮存在或接口 200 作为通过标准。脚本必须等待上传完成态、搜索结果返回、详情/删除权限返回，并阅读返回片段后再判定。

- 教师：通过真实登录进入知识库，使用上传弹窗分别上传课程共享文件和仅本人可见文件。
- 学生：搜索课程共享文件，检查同班可见；搜索教师私有文件，检查不可见；尝试删除课程文件，必须失败。
- 管理员：搜索并读取课程共享文件与教师私有文件，用于治理可见性验证。
- 移动端教师：打开知识库，检查可见控件触控面积、横向溢出和截图。

## 2. 发现与修复

### R36-KB-MOB-001：移动端知识库控件触控面积不足

基线复测发现移动端多个高频控件低于 40px：表格/卡片切换、上传文件、文件行选择、删除按钮，以及全局安全求助入口。第一轮用 `min-h-10` 后仍只有约 35px，原因是项目根字号缩放影响 rem。

修复：改为显式 `min-h-[40px]` / `h-[40px] w-[40px]`，覆盖知识库页、上传弹窗与安全求助入口。

### R36-QA-001：脚本误把查询词回显判定为隐私泄漏

学生搜索教师私有文件时，页面正常显示 `检索「查询词」· 0 条命中`。基线脚本把搜索框/结果头的查询词回显误判为泄漏。已改为判断是否出现私有文件名或命中片段，并要求有清晰 0 命中状态。

## 3. 最终通过证据

最终 Playwright 真实用户复测：`verdict=pass`，`issues=[]`。证据日志：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/knowledge-r36/logs/r36-knowledge-R36_KB_1783607082060.json`

关键返回值：

- 教师课程文件检索：命中 `r36-course-visible-R36_KB_1783607082060.txt`，snippet 含课程共享 token。
- 教师私有文件检索：命中 `r36-self-private-R36_KB_1783607082060.txt`，snippet 含教师私有 token。
- 学生课程文件：搜索命中，详情 `200`。
- 学生教师私有文件：搜索 `hits: []`，详情 `404`。
- 学生非 owner 删除课程文件：`404 not_found`。
- 管理员：课程文件与教师私有文件均可搜索并详情 `200`。
- 清理：教师删除两个 R36 临时文件均 `200 ok`，清理后搜索不再命中。
- 移动端：`mobileSmallTargets=[]`，无横向溢出。

## 4. 验证与审阅

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- 本地生产服务重启：`http://127.0.0.1:4920/login` 返回 `200`。
- `code-review-graph build/status`：通过，`159 files / 691 nodes / 6497 edges`。
- 手工影响审阅：通过，记录在 `manual-impact-review-r36.json`。

## 5. 改动文件

- `D:/VB/LLM-School/app/app/(shell)/knowledge/page.tsx`
- `D:/VB/LLM-School/app/components/knowledge/UploadDialog.tsx`
- `D:/VB/LLM-School/app/components/common/SafetyHelp.tsx`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/knowledge-r36/r36-knowledge-realuse.js`

## 6. 结论

R36 通过。知识库的真实上传、搜索结果质量、学生/管理员权限边界、owner-only 删除和移动端主要触控问题均已闭环。整体 12 小时真实内测目标仍保持进行中，建议下一轮继续覆盖知识库移动端上传弹窗完整路径或管理员知识治理/审计侧联动。
