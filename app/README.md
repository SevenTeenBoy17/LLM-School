# EduAI Prism 应用工程

安装、演示账号、正式部署与数据安全说明见 [仓库首页](../README.md)。前端和服务端 API 都在本目录，不需要额外启动另一套后端。

```bash
npm ci
node scripts/setup-local.mjs demo
npm run dev -- --hostname 127.0.0.1 --port 4921
```

需要 Node.js 24.x。Windows PowerShell 如拦截 npm，使用 `npm.cmd`。打开 <http://127.0.0.1:4921/login>。

正式部署使用干净数据目录、强随机密钥及 HTTPS。禁止将演示账号部署到公网。SQLite 数据必须放在持久化磁盘，不能直接使用 Vercel 的临时文件系统。
