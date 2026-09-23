# EduAI-Prism 真实用户内测问题清单 R19

日期：2026-07-08  
范围：提示词库创建、测试、发布、发送到对话、权限边界、清理

| ID | 严重级别 | 问题 | 真实影响 | 状态 |
| --- | --- | --- | --- | --- |
| R19-PROMPT-001 | P1 | 教师导学案提示词含“教研组评审/研讨”时，被本地兜底误判为会议材料 | 教师等待完整结果后拿不到导学案，真实教研任务失败 | 已修复并复测 |
| R19-PROMPT-002 | P1 | 窄屏/移动端提示词卡片无发送到对话入口，右侧详情面板隐藏 | 用户能找到模板但无法进入 AI 对话使用，主链路阻断 | 已修复并复测 |
| R19-PROMPT-003 | P2 | 新增卡片发送按钮初始触控尺寸不足 | 移动端可用但难点，影响留存与效率 | 已修复并复测 |

## 复测证据

- 发布前测试修复后：`r19-preview-postfix.json`
- 卡片发送到对话：`r19-card-send-to-chat-postfix.json`
- 完整聊天结果：`r19-chat-final-after-card-send.json`
- 会话稳定态：`r19-chat-settled-check.json`
- API 权限与清理：`r19-api-boundary-persistence-cleanup.json`
- 最终卡片发送尺寸：`r19-final-seed-card-send-navigation.json`
- 最终异步预填等待：`r19-final-seed-card-send-prefill-wait.json`

## 残余风险

- 当前外部模型仍可能降级到本地兜底，真实等待约 24s；用户体验上已有来源/耗时标注，但后续仍需优化网关可用性与长等待提示。
- Browser 下载/剪贴板类 OS 级事件在本环境仍可能退化；本轮不涉及下载验收。
