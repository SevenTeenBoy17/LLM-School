# EduAI Prism 真实用户内测 R38：知识库二进制诚实检索与审计报告

时间：2026-07-09 07:50 PDT  
范围：知识库 PDF/二进制上传、文件名检索诚实性、隐藏正文不可检索、学生/管理员可见性、审计联动、移动端删除。

## 1. 本轮真实使用场景

本轮验证“二进制文件不伪造正文检索能力”。教师真实上传一个 `.pdf` 文件，文件名包含 `FILENAME_ONLY` token，文件字节内容包含另一个隐藏 token。若产品诚实，文件名 token 应命中，隐藏字节 token 不应命中。

- 教师：移动端上传 `.pdf`，scope 选课程成员，等待上传完成。
- 教师/学生/管理员：搜索文件名 token，应命中并显示“命中文件名”。
- 教师/学生/管理员：搜索隐藏 PDF 字节 token，应 0 命中。
- 详情：PDF 应显示 `hasText=false`、`chunkCount=0`、`textPreview=""`。
- 管理员：审计中应看到 `kb_upload allow`。
- 教师：移动端卡片删除并确认清理。

## 2. 发现与修复

### R38-KB-SEARCH-001：0 命中时仍显示完整文件列表，造成误判

基线发现：搜索隐藏 PDF 字节 token 时，顶部明确显示 `0 条命中`，但下方仍显示完整文件列表，里面包含刚上传的 PDF。真实用户容易误以为该 PDF 被隐藏正文命中。

修复：

- 增加 `searchTerm`，搜索词激活时只显示检索卡片，不再显示默认全量文件列表。
- 0 命中空状态增加说明：`PDF / Word / PPT 等二进制文件未提取正文，仅按文件名检索。`

### R38-QA-001：二进制诚实性脚本补全

新增 R38 Playwright 脚本，用文件名 token 和隐藏字节 token 双 token 验证合同，避免只看“上传成功”而漏掉内容诚实性。

## 3. 最终通过证据

最终 Playwright 真实用户复测：`verdict=pass`，`issues=[]`。

证据日志：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/knowledge-binary-r38/logs/r38-knowledge-binary-R38_KB_BINARY_1783608500836.json`

关键返回值：

- 教师文件名检索：命中 `r38-binary-R38_KB_BINARY_1783608500836_FILENAME_ONLY.pdf`，snippet 为 `（命中文件名）`。
- 教师隐藏 PDF 字节 token 检索：`hits=[]`。
- 学生文件名检索：命中同一 PDF，snippet 为 `（命中文件名）`。
- 学生隐藏 PDF 字节 token 检索：`hits=[]`。
- 管理员隐藏 PDF 字节 token 检索：`hits=[]`。
- 详情：`type=PDF`、`hasText=false`、`chunkCount=0`、`textPreview=""`。
- 审计：管理员读取到 `kb_upload` / `allow` / `u-teacher`。
- 移动端：`smallTargets=[]`，无横向溢出。
- 清理：教师卡片删除返回可见反馈，清理后文件名检索 `hits=[]`。

## 4. 验证与审阅

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- 本地生产服务重启：`http://127.0.0.1:4920/login` 返回 `200`。
- `code-review-graph build/status`：通过，`159 files / 691 nodes / 6495 edges`。
- 手工影响审阅：通过，记录在 `manual-impact-review-r38.json`。

## 5. 改动文件

- `D:/VB/LLM-School/app/app/(shell)/knowledge/page.tsx`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/knowledge-binary-r38/r38-knowledge-binary-audit.js`

## 6. 结论

R38 通过。知识库对二进制文件的能力边界已更诚实：不会伪造 PDF 正文检索，搜索无命中时不再混入全量文件列表造成误导，审计联动也已闭环。整体 12 小时真实内测仍继续推进。
