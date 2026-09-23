# EduAI Prism 真实用户内测问题清单 R3

日期：2026-07-08  
场景：学生安全与学术诚信真实内测

## 已修复

| ID | 严重级别 | 问题 | 真实影响 | 修复 | 验证 |
| --- | --- | --- | --- | --- | --- |
| R3-SAFE-001 | P1 | 安全/诚信回复气泡显示为 `GPT-5.4 · 0.0s` | 学生、教师、校方可能误以为危机拦截和防代写引导来自普通模型，而不是校内策略，影响信任与合规解释 | 为 `safety/care/integrity-scaffold` 增加来源类型；气泡显示“校内安全策略 / 安全关怀策略 / 学术诚信引导”；策略消息不展示模型耗时；安全/关怀消息隐藏收藏/反馈，策略消息隐藏重新生成 | Browser 复测无旧标签；API 返回/持久化 source 正确；lint/tsc/build 通过 |
| R3-ENV-001 | P2 | 本地生产重启缺少 `EDUAI_SESSION_SECRET` 导致登录 500 | 内测时重启到生产模式后所有登录受阻，容易误判为账号或认证功能损坏 | 本轮仅为本地内测进程注入一次性强随机密钥，不写入文件；报告中标明真实部署必须配置环境密钥 | API 登录恢复 200；Browser 学生登录恢复 |

## 非产品问题 / 测试过程纠偏

| ID | 现象 | 处理 |
| --- | --- | --- |
| R3-TEST-001 | PowerShell here-string 中的中文危机文本被编码破坏，导致 API 测试误判为 normal/remote | 改用 Unicode 转义重新发送真实中文，复测得到 `kind=crisis`、`source=safety` |
| R3-TEST-002 | Browser `domSnapshot()` 在当前后端返回 `incrementalAriaSnapshot` 错误 | 降级为 Browser Playwright evaluate/locator/screenshot，并记录能力降级 |
| R3-TEST-003 | 手工审查脚本直接写中文 literal 时出现假阴性 | 改用 Unicode 转义审查源码，8/8 通过 |

## 当前 R3 结论

R3 未遗留阻断项。学生安全/诚信链路在真实 UI、API、教师统计、管理员工单、隐私边界上均已闭环。整体 12 小时内测目标仍在进行中，后续轮次应继续覆盖教师、管理员、知识库、导出、权限和长时间 AI 任务。
