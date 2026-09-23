# EduAI-Prism 真实用户内测 R52：认证会话、登录回跳与登录视觉闭环报告

## 本轮目标

本轮按真实学校/公司内测方式执行：不只点按钮，也等待 API、页面跳转、会话读取、退出失效和视觉检查结果完整返回后再评判。本轮聚焦认证登录、退出、角色边界、登录页移动/桌面视觉性能。

## 发现并修复的问题

1. `R52-AUTH-001`：认证相关 JSON 响应缺少 `Cache-Control: no-store`。  
   已修复 `login / me / logout / switch-role` 的成功与错误响应，避免身份和会话状态被中间层或浏览器缓存。

2. `R52-AUTH-002`：匿名用户从 `/knowledge` 被带到 `/login?from=%2Fknowledge` 后，登录成功没有回到原页面。  
   已修复登录页安全回跳逻辑，允许安全本地路径返回，并对 `/admin`、`/class` 做客户端角色门槛保护。

3. `R52-LOGIN-003`：移动登录页虽然隐藏桌面 3D 区块，但组件仍被挂载并触发 GLB/Three 资源加载错误。  
   已改为移动端不挂载桌面 3D 区块，移动登录页 console 清零。

4. `R52-LOGIN-004`：桌面登录左侧 GLB 轨道场景加载多份 50MB+ 模型，触发 WebGL shader、显存和 hydration 错误。  
   已将登录左侧改为轻量轨道视觉；右侧解锁球保留 Three.js 程序化 3D，桌面 canvas 像素检查非空且 console 清零。

## 最终证据

- 静态：`npm run lint` 通过；`npx tsc --noEmit` 通过；`npm run build` 通过。
- API：`.codex-supervisor/qa-12h-20260708/auth-r52/logs/r52-auth-api-summary.json`，`verdict=pass`。
- 浏览器真实链路：`.codex-supervisor/qa-12h-20260708/auth-r52/logs/r52-auth-browser-summary.json`，`verdict=pass`。
- 登录视觉：`.codex-supervisor/qa-12h-20260708/auth-r52/logs/r52-login-visual-3d-summary.json`，`verdict=pass`。
- 截图：`r52-login-desktop.png`、`r52-login-mobile.png` 已写入本轮 logs 目录。
- code-review-graph：刷新通过，164 files / 762 nodes / 7399 edges；因非 git 仓库，使用手工影响审阅补充。

## 影响面审阅

改动集中在认证 API、登录页回跳、登录页 3D 资源策略和本轮 QA 脚本。未改变生产 `switch-role` 禁用策略，角色真实性通过老师/学生真实重新登录验证。未写入密钥，服务使用进程级临时 `EDUAI_SESSION_SECRET`。

## 结论

R52 认证会话与登录视觉闭环通过。认证状态返回值、退出失效、学生/admin 边界、登录回跳、移动触控目标、桌面/移动 console、桌面 3D 非空像素检查均通过。整体 12 小时真实内测目标仍保持 active，可继续下一轮。
