# EduAI Prism 真实用户内测问题清单 R38

## 已修复

### R38-KB-SEARCH-001 P2：搜索 0 命中时仍显示完整文件列表

- 现象：搜索 PDF 隐藏字节 token 时，结果卡显示 `0 条命中`，但默认文件列表仍展示刚上传的 PDF，容易误导用户以为该 PDF 被正文命中。
- 修复：有搜索词时只显示检索结果/空状态，不显示默认全量文件列表；空状态补充“二进制文件未提取正文，仅按文件名检索”。
- 验证：最终脚本中教师隐藏 PDF 字节 token 搜索 `hits=[]`，UI 显示 no-hit 与二进制说明，不再显示该 PDF 文件名。

### R38-QA-001 P3：缺少二进制诚实检索专项脚本

- 现象：此前知识库测试覆盖文本上传和权限，但未单独证明 PDF/Word/PPT 等二进制文件不会被伪装成全文检索。
- 修复：新增 R38 脚本，使用文件名 token 与隐藏文件字节 token 双证据验证。
- 验证：教师/学生/管理员隐藏字节 token 均 `hits=[]`，文件名 token 均按文件名命中。

## 通过项

- PDF 上传完成，上传选择阶段标注“仅文件名”。
- 文件名 token 检索返回 `（命中文件名）`。
- PDF 字节隐藏 token 对教师/学生/管理员均不命中。
- PDF 详情返回 `hasText=false`、`chunkCount=0`、`textPreview=""`。
- 管理员审计可见 `kb_upload allow`。
- 教师移动端删除成功，清理后文件名检索 `hits=[]`。
- `lint`、`typecheck`、`build`、Playwright、code-review-graph、手工审阅均通过。

## 遗留风险

- 当前工作区不是 git 仓库，无法生成 git checkpoint 或 diff-based review；本轮使用 supervisor 证据、Playwright 日志、code-review-graph 和手工审阅替代。
- 这是“诚实边界”验证，不是 OCR/PDF 解析能力实现；若后续产品要支持 PDF 正文检索，应单独设计解析、OCR、失败回退、隐私和性能测试。
