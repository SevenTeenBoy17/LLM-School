# EduAI-Prism 真实用户内测问题清单 R52

| ID | 严重级别 | 状态 | 问题 | 修复与验证 |
| --- | --- | --- | --- | --- |
| R52-AUTH-001 | P1 | 已修复 | `login / me / logout / switch-role` 响应缺少 `no-store`，会话身份结果存在缓存风险。 | 增加 `jsonNoStore`；API 最终 22 项检查通过。 |
| R52-AUTH-002 | P2 | 已修复 | 登录页忽略 proxy 的 `from`，用户从受保护页面登录后被送到默认页。 | 新增安全回跳和角色门槛；老师从 `/knowledge` 登录后返回 `/knowledge`。 |
| R52-LOGIN-003 | P2 | 已修复 | 移动登录页隐藏的桌面 3D 仍被挂载并触发 GLTF 错误。 | 移动端不挂载桌面 3D；移动登录 canvas=0，console=0。 |
| R52-LOGIN-004 | P1 | 已修复 | 桌面登录左侧 GLB 场景过重，触发 WebGL shader/显存/hydration 错误。 | 切换为轻量轨道视觉，解锁球保留程序化 Three.js；桌面 canvas 非空，console=0。 |

## 最终通过标准

- API 返回状态、cookie、身份、退出、rate-limit 和权限边界全部通过。
- 真实浏览器点击登录/退出/重新登录后，会话读回和页面跳转全部通过。
- 桌面登录页存在可见非空 3D canvas；移动登录页不挂载隐藏 3D；两端 console 均无 error/warn。
- lint、tsc、build、code-review-graph、手工影响审阅通过。
