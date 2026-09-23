# EduAI-Prism 真实用户内测问题清单 R11

日期：2026-07-08  
范围：教师真实会议材料生成、恢复、复制、导出闭环  
状态：本轮确认问题均已修复并复验通过。

| ID | 严重级别 | 问题 | 真实影响 | 修复 | 复验状态 |
| --- | --- | --- | --- | --- | --- |
| R11-FE-001 | P1 | topbar 整段复制在浏览器剪贴板写入受限时失败 | 教师无法把已生成的会议材料稳定带到 Word/OA/会议纪要，直接影响留存 | 增加 `execCommand` 复制尝试、Clipboard API 尝试、手动 Markdown 复制弹窗 | 通过：`r11-copy-final-smoke.json` |
| R11-FE-002 | P1/P2 | topbar 整段导出菜单在真实页面中不稳定，点击可能落到其它控件 | 教师会误以为导出失效，会议前准备材料风险高 | 主导出改为直接导出整段 Markdown，增加可见状态提示和 toast，移除不可达隐藏菜单 | 通过：`r11-export-notice-final.json` |

## 已验证证据

- 完整生成内容：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/teacher-meeting-export/logs/r11-teacher-session-readback.json`
- 最终复制复验：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/teacher-meeting-export/logs/r11-copy-final-smoke.json`
- 最终导出复验：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/teacher-meeting-export/logs/r11-export-notice-final.json`
- 人工影响审阅：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/teacher-meeting-export/logs/manual-impact-review-r11.json`
- 静态/构建：`npm run lint`、`npx tsc --noEmit`、`npm run build`
- 图审阅：code-review-graph build/status，156 files / 650 nodes / 6038 edges

## 本轮未关闭但需后续跟进

1. 浏览器 Blob 下载事件仍超时，后续如需 OS 级下载证明，应改用可控 Playwright 下载目录或浏览器外部文件系统探针。
2. 整段多格式导出若要重新暴露，需要设计为稳定可访问 popover，并在移动端和桌面端分别复验。
3. 继续 12 小时真实内测：建议下一切片选择“管理员移动端审计可读性”或“教师多会议材料批量带出”。
