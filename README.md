# EduAI Prism / i-learning

面向学校的教育 AI 应用，包含学生、教师、教研员和管理员界面。仓库提供前后端源码、运行资产、数据库初始化逻辑、测试脚本和开发文档。

**不包含真实用户数据库、学生作品、上传文件、API 密钥或原电脑的登录状态。** 新电脑首次运行会创建独立数据库。

![学生个人庄园（合成演示数据）](docs/screenshots/student-manor.png)

上图为本次独立运行验证的界面。教师校内资源库当前为前端演示与本地草稿，学校共享后端尚未接入；不能把页面可打开等同于全校共享资源已上线。

## 快速运行：本机演示

需要 **Node.js 24.x**（包含 npm）、Git 和现代浏览器。Node 24 是必要条件，服务端使用 `node:sqlite`。首次安装依赖需要联网；未配置模型密钥也能打开应用，真实 AI 生成需要另行配置。

```bash
git clone https://github.com/SevenTeenBoy17/LLM-School.git
cd LLM-School/app
npm ci
node scripts/setup-local.mjs demo
npm run dev -- --hostname 127.0.0.1 --port 4921
```

打开 <http://127.0.0.1:4921/login>。Windows PowerShell 若阻止 `npm.ps1`，把 `npm` 换成 `npm.cmd`，**不需要关闭系统执行策略或以管理员运行**。

演示数据为合成数据，仅供本机体验；这些账号不是生产账号：

| 角色 | 用户名 | 演示密码 | 主要入口 |
| --- | --- | --- | --- |
| 学生 | `student` | `Student@123` | 学习首页、个人庄园 |
| 教师 | `teacher` | `Teacher@123` | 今日教学、校内资源库、庄园证据 |
| 管理员 | `admin` | `Admin@123` | 用户和平台管理 |

初始化工具生成随机会话密钥，使用 `.data-demo` 保存演示数据，**不覆盖已有 `.env.local`**。已有配置请先自行备份并检查，不能将真实学校数据库拿来做演示。结束服务按 Ctrl+C。

## 正式运行：单校单实例

与演示环境分开使用干净的克隆目录。不要复制演示数据到生产环境，生产启动会拒绝已知演示账号。

```bash
cd LLM-School/app
npm ci
node scripts/setup-local.mjs production
npm run build
npm run start -- --hostname 127.0.0.1 --port 4921
```

初始化工具将管理员用户名和随机密码写入本机 `.env.local`。在自己的编辑器中查看 `EDUAI_BOOTSTRAP_ADMIN_USERNAME` / `EDUAI_BOOTSTRAP_ADMIN_PASSWORD` 并安全保存，**不要发送到群聊或提交 Git**。初始管理员仅在空数据库初始化时创建，之后更改配置不会修改已有账号密码。

| 配置 | 用途 |
| --- | --- |
| `EDUAI_SESSION_SECRET` | 强随机会话密钥；工具自动生成 |
| `EDUAI_DB_DIR`、`EDUAI_ASSET_DIR` | 数据与生成资产持久化目录；生产使用 `.data-production` |
| `EDUAI_BOOTSTRAP_ADMIN_*` | 空库初始管理员；初始化后清理不再需要的配置 |
| `EDUAI_PUBLIC_ORIGIN` | 对外唯一站点源，例如 `https://edu.example.edu.cn` |
| `LLM_API_KEY`、`LLM_BASE_URL` | 可选，学校自行配置兼容模型服务 |
| `LLM_IMAGE_API_KEY`、`LLM_IMAGE_BASE_URL` | 可选，学校自行配置生图服务 |
| `EDUAI_LLM_ALLOWED_ORIGINS` | 网关来源白名单；换供应商时同步修改 |

当前空库可创建初始管理员，但管理界面的批量用户导入仍未接通。真实教师、学生账号的学校目录接入/导入需另行实施；不要把演示账号迁入生产库来绕过这一限制。查看各角色功能请使用上述本机演示模式。

生产 Cookie 使用 Secure：跨设备正式访问必须通过 **HTTPS**，不能直接使用 `http://局域网IP:端口`。本机 localhost/127.0.0.1 用于自测，远程入口应配置 TLS 反向代理。

就绪检查：<http://127.0.0.1:4921/api/health/ready>。配置不完整或数据库不可用时返回 503。

### 学校服务器 / 互联网

详见 [部署说明](app/deploy/README.md)。在 `app` 目录执行以下两种模板之一：

```bash
# 校园主机：受控内网，正式入口仍需 TLS 反向代理
docker compose --env-file .env.local -f deploy/school.compose.yml up -d --build

# 互联网单实例：应用端口默认只绑定 127.0.0.1，由 TLS 代理对外服务
docker compose --env-file .env.local -f deploy/internet-single.compose.yml up -d --build
```

两种模板不要同时启动。容器使用独立命名卷 `/data`，不会自动导入本机 `.data-production`。配置域名、证书、备份、访问控制后再开放使用。**当前 SQLite 版本不支持 Vercel 临时磁盘、多副本扩容或多学校共用一套实例。** 多校隔离、PostgreSQL、对象存储和任务队列迁移需要另行实施。

## 工程结构

```text
app/
  app/                 页面与服务端 API
  components/          各角色界面组件
  lib/                 业务模型、权限、SQLite 数据层、模型网关
  public/              运行图片、3D 模型等静态资源
  scripts/             本机初始化和资产制作工具
  tests/               单元、接口和浏览器测试源码
  deploy/              双部署模板
  .env.example         空值配置示例
  package-lock.json    依赖锁定文件
tests/                 跨模块测试源码
开发材料/              设计方案与历史实施文档
scripts/               安全源码导出工具
docs/                  发布边界与验证记录
```

前后端由同一个 Next.js 服务提供，不需要另外启动后端。部分历史文档引用原电脑绝对路径或本地测试截图，不是运行依赖。文档中的计划不等于已实现功能，以当前源码、实际行为和对应测试记录为准。

## 验证与维护

```bash
cd app
npm run build
node tests/manor-v6-model.mjs
```

浏览器自动化测试按脚本要求执行；首次使用 Playwright 可执行 `npx playwright install chromium`。历史综合脚本可能依赖特定演示数据、端口或本地工具，不能不加检查地在生产数据库上运行。

技术栈：Next.js 16、React 19、TypeScript、Node.js 24、SQLite，及 Tailwind、Radix、Three.js 等界面依赖。精确版本以锁定文件为准。生产更新先在独立副本验证，再备份并部署。

备份须覆盖数据库和用户文件：停止写入后备份整个数据目录，或者采用 SQLite 一致性备份及配套文件快照。不要运行中只复制 SQLite 文件而忽略 WAL。恢复应在隔离目录验证账号与资源可用性。

## 共享范围与限制

- 当前工作树的清洁源码快照，不携带含历史数据库的原电脑 Git 历史。
- 保留项目运行资产；排除 QQNCmini 程序、缓存、反编译参考文件和已隔离第三方素材。
- 包含较大的 3D 模型，首次克隆需要较多时间与磁盘空间；模型无需从原电脑另外复制。
- 未指定本项目开源许可证。受邀协作者依项目所有者授权查看、运行和协作；公开再分发或商业使用前须明确授权，第三方依赖遵循各自许可。
- 源码发布不等于整个平台通过生产安全、隐私合规或全部业务验收。资产许可、学校制度、未成年人数据保护和 AI 服务采购仍须部署方核查。

本次上传范围与验证见 [源码发布说明](docs/SOURCE-RELEASE.md)。
