# EduAI Prism 响应式适配与上线部署报告 - 2026-07-07

## 交付结果

- 线上地址：https://app-eta-olive-27.vercel.app
- Vercel 项目：`z5239663-9540s-projects/app`
- 最新生产部署：`https://app-r2agncqgs-z5239663-9540s-projects.vercel.app`
- 生产别名：`https://app-eta-olive-27.vercel.app`

## 本轮改动

1. 移动端/平板登录页不再依赖 3D 地球点击后才显示表单。
   - 小屏直接渲染账号、密码、登录按钮。
   - 桌面端继续保留 3D 解锁体验。
   - 小屏卡片圆角、内边距、Logo 尺寸和表单间距做了压缩，避免 390px 视口裁切。

2. 生产部署适配。
   - `package.json` 增加 `engines.node = 24.x`，对齐本地 `node:sqlite` 运行环境。
   - Vercel 环境下 SQLite 写入 `os.tmpdir()/eduai-prism`，避免写入只读应用包目录。
   - 新增 `.vercelignore`，排除 `.next`、`node_modules`、`.data`、本地环境文件和日志，避免上传本地构建产物与敏感文件。

## 验证证据

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- 本地开发态响应式审计：68 个页面/视口组合通过。
  - 导航错误：0
  - 整页横向溢出：0
  - 关键 console：0
  - 小屏登录输入缺失：0
  - 小屏导航缺失：0
- 本地生产态响应式审计：68 个页面/视口组合通过。
  - 导航错误：0
  - 整页横向溢出：0
  - 关键 console：0
  - 小屏登录输入缺失：0
  - 小屏导航缺失：0
- 模拟 Vercel 环境本地生产运行：
  - `VERCEL=1`
  - `EDUAI_ENABLE_DEMO_SEED=true`
  - `/api/auth/login` 返回 200
  - 390px dashboard 无横向溢出、无 console 错误。
- 线上手机登录验证：
  - 390px `/login` 可见 2 个输入框。
  - teacher / Teacher@123 登录成功。
  - 成功跳转 `/dashboard`。
  - 线上手机 dashboard 无横向溢出，移动导航按钮存在。
- 线上 HTTP 会话验证：
  - student：`/learn`、`/explore`、`/chat` 均返回 200。
  - admin：`/admin/analytics`、`/admin/permissions`、`/admin/models` 均返回 200。
- Vercel runtime error 聚合：
  - 未发现应用异常分组。
  - 仅存在 Node `node:sqlite` ExperimentalWarning，属于当前技术栈已知平台警告。
- code-review-graph：
  - 图谱构建：156 files / 635 nodes / 6010 edges。
  - 变更审查提示登录页与 DB 为高影响路径；已用登录提交、生产构建、生产响应式审计、线上 HTTP 与线上手机登录覆盖核心风险。

## 证据文件

- `.codex-supervisor/responsive-audit-20260706-login-fix-v3/`
- `.codex-supervisor/responsive-audit-20260706-postfix-dev/`
- `.codex-supervisor/responsive-audit-20260706-production/`
- `.codex-supervisor/online-verification-20260706/`
- `.codex-supervisor/online-verification-20260706-focused/`

## 已知说明

- 线上批量 Playwright route sweep 在部分 student/admin 路由上出现 `ERR_CONNECTION_CLOSED`，但同一路由用真实 HTTP 会话返回 200，Vercel runtime errors 也未显示应用错误。已将其判定为本轮自动化连接侧不稳定，不作为应用阻断。
- 当前 SQLite 在线上使用 Vercel 临时目录，适合演示与非付费版本验证；若后续需要长期保留用户生成数据，应迁移到托管数据库。
- 当前部署通过 CLI deployment env 传入 `EDUAI_SESSION_SECRET` 与 `EDUAI_ENABLE_DEMO_SEED=true`。后续手动重新部署时，需要继续提供等价生产环境变量，或在 Vercel 项目环境变量中持久配置。
