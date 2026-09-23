# EduAI Prism 真实用户内测 R37：移动端知识库上传与 API 边界报告

时间：2026-07-09 07:40 PDT  
范围：移动端 `/knowledge` 上传弹窗、学部共享 scope、学生/管理员读回、非法输入/未登录 API 边界、移动端删除按钮。

## 1. 本轮真实使用场景

本轮继续按真实用户/真实学校内测方式执行，不以“按钮可见”作为通过标准。教师必须在 390x844 移动端真实完成上传流程，等到完成态返回，再由学生和管理员读取结果；所有 API 边界必须返回明确状态码和错误形状。

- 未登录用户：访问知识库列表、搜索、上传。
- 教师：移动端登录，打开上传弹窗，选择本地 txt 文件，选择“学部成员”，等待上传完成。
- 学生：同学段账号搜索并读取该学部共享文件。
- 管理员：搜索并读取该文件。
- 学生越权：尝试删除教师上传文件。
- 教师：移动端卡片视图点击“删除”，等待页面反馈并确认清理后不再命中。

## 2. 发现与修复

### R37-KB-MOB-001：移动端上传弹窗底部按钮不可达

基线在真实移动端上传时失败：选择文件后，“下一步”按钮虽然渲染出来，但弹窗整体超出视口，Playwright 报告元素在 viewport 外，真实用户也会很难继续流程。

修复：

- `UploadDialog` 增加 `max-h-[calc(100dvh-24px)]`。
- 弹窗内部启用 `overflow-y-auto`。
- 移动端 padding 从 `p-6` 调整为 `p-4 sm:p-6`。
- 文件列表在移动端限制高度并滚动。
- 底部步骤操作条改为 `sticky bottom-0`，确保“下一步/开始上传/完成”可达。

### R37-KB-MOB-002：卡片视图删除按钮宽度不足

复测发现卡片视图“删除”按钮高度为 40px，但宽度只有约 37.5px，低于稳定触控目标。

修复：给卡片删除按钮增加 `min-w-[40px]`，最终移动端触控检查 `smallTargets=[]`。

### R37-QA-001：预期 400 边界请求不应计为异常 console

本轮脚本故意触发非法输入，浏览器 console 会记录 400 Bad Request。已将预期 400/401/403/404 边界请求从“意外 console 错误”中过滤，同时保留状态码与响应体作为 API 证据。

## 3. 最终通过证据

最终 Playwright 真实用户复测：`verdict=pass`，`issues=[]`。

证据日志：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/knowledge-mobile-r37/logs/r37-knowledge-mobile-R37_KB_MOBILE_1783607956111.json`

关键返回值：

- 未登录列表/搜索/上传：均 `401 unauthenticated`。
- 非法空文件名/非法 scope/超大 size/text 超长：均 `400 invalid_input`。
- 教师移动端上传完成：UI 完成态返回，并可检索到 `R37_KB_MOBILE_1783607956111_COLLEGE_SCOPE_TOKEN`。
- 学生同学段读回：详情 `200`，`textPreview` 含完整 token 和真实片段。
- 学生删除教师文件：`404 not_found`。
- 管理员读回：详情 `200`，`textPreview` 含完整 token 和真实片段。
- 移动端触控：`smallTargets=[]`，无横向溢出。
- 教师移动端卡片删除：页面出现 `已删除该文件`，清理后搜索 `hits=[]`。

## 4. 验证与审阅

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- 本地生产服务重启：`http://127.0.0.1:4920/login` 返回 `200`。
- `code-review-graph build/status`：通过，`159 files / 691 nodes / 6497 edges`。
- 手工影响审阅：通过，记录在 `manual-impact-review-r37.json`。

## 5. 改动文件

- `D:/VB/LLM-School/app/components/knowledge/UploadDialog.tsx`
- `D:/VB/LLM-School/app/app/(shell)/knowledge/page.tsx`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/knowledge-mobile-r37/r37-knowledge-mobile-boundary.js`

## 6. 结论

R37 通过。移动端知识库上传弹窗从“流程卡死”修复为可完整完成；学部共享、学生/管理员读回、非法输入、未登录、越权删除与真实移动端删除按钮均已闭环。整体 12 小时真实内测仍继续推进。
