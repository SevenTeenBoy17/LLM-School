# EduAI Prism QQNCmini 农场资源审计与复刻映射

> 审计日期：2026-08-23  
> 审计方式：安装目录与运行缓存只读扫描、Chromium Cache v2 结构解析、官方 JPEXS CLI 资源导出、窗口匿名化视觉测量  
> 隐私约束：不记录账号、令牌、Cookie、查询参数或 API 密钥；含账号标识的临时抓图在测量后删除

## 1. 结论摘要

`C:\Users\nuoya\AppData\Local\QQNCmini` 不是完整游戏源码目录，而是 QQ 农牧场微端的 CEF 浏览器外壳。它通过配置加载远程 Flash/Unity WebGL 页面，真正可复用的当前页面资源位于运行缓存：

- 安装目录：110 个文件，362,867,402 bytes。
- 主要组成：CEF 86、CefSharp、语言包、GPU/WebGL 运行库、启动器和更新配置。
- 运行缓存：`%APPDATA%\qqncminiwpfn45`，256 个文件，298,784,018 bytes。
- 缓存有效载荷：162 个外部文件，其中 58 个压缩 SWF、42 个 UnityFS、23 个 PNG、17 个 gzip、4 个 JPEG、4 个 JSON、4 个 UnityWeb Brotli、3 个 XML/HTML。
- 当前可见页面：经典 QQ 农场 Flash 主界面；不是新版 Unity 卡片面板。

因此复刻策略不是移植 CEF 或 Unity 运行时，而是提取当前页面的视觉语法与公开媒体素材，以 React 组件、本地状态和单张无 UI 场景底图重建桌面体验。

## 2. 安装与运行入口

### 2.1 安装外壳

| 项目 | 证据 |
| --- | --- |
| 主程序 | `app/qqncminiwpfn45.exe` |
| 启动参数 | `loginType=12` |
| CEF | 86.0.24 / Chromium 86.0.4240.198 |
| 页面配置 | `app/config/config.json` |
| Flash 入口 | `https://appimg.qq.com/happyfarm/happyfarm3_v_502.swf` |
| Unity 入口 | `https://appimg.qq.com/happyfarm/unity/web/index/release/index.html` |
| 缓存目录 | `%APPDATA%/qqncminiwpfn45/BrowserCache/session_partition_1` |

### 2.2 缓存解析

缓存采用 Chromium block-file backend。依据 Chromium 官方结构：`data_1` 以 256-byte `EntryStore` 保存 key 与四个数据流地址，`0x8000002A` 一类地址指向 `f_00002a` 外部文件。审计使用共享读模式复制 `data_1`，再按 `EntryStore` 解析 URL 到缓存文件的映射；URL 查询参数被全部丢弃。

参考：

- Chromium `disk_format.h`: `EntryStore` 与 block-file 格式。
- Chromium Disk Cache 设计文档：CacheAddr 与 `f_xxxxxx` 外部文件规则。

## 3. 当前主界面关键资源映射

| 缓存文件 | 远端资源 | 大小 | SHA-256 前 16 位 | 用途判断 |
| --- | --- | ---: | --- | --- |
| `f_000037` | `happyfarm3_v_502.swf` | 942,986 | `D2600E778F01588E` | Flash 主加载器 |
| `f_00003d` | `farmui4_v_79.swf` | 4,702,405 | `E109121D41F5F112` | 主场景、木纹面板、农场背景与入口 |
| `f_000040` | `farmui5_v_89.swf` | 6,972,678 | `FF415F784ECF6C13` | 活动入口、面板、按钮和新版叠加层 |
| `f_00003e` | `farmui_full_v_62.swf` | 249,091 | `EF2A25CBF5D911CF` | 资源/VIP/排序等 UI 素材 |
| `f_00003f` | `main4_v_408.swf` | 459,015 | `5E2823D417BA6663` | 主界面逻辑与组合层 |
| `f_000041` | `farmui3_v_24.swf` | 153,454 | `5EE2AB5A6EFFBBCB` | 旧主界面兼容素材 |
| `f_00003b` | `data_zh_CN_v_1765.xml` | 4,907,364 | `2255D17741B9285A` | 中文资源与素材 URL 清单 |

JPEXS 26.2.1 从上述 6 个 SWF 中导出 191 张位图，总计 8,065,538 bytes。最大可用背景为 `farmui4_v_79.swf/966.png`（1025×801）；它证明了目标采用“远景山丘 + 弯曲道路 + 中央斜向田块 + 边缘建筑”的开放场景结构，但当前账号场景还会叠加动态房屋、作物和活动入口，因此不能只用该旧背景截图替代页面。

## 4. 解码工具安全记录

| 项目 | 值 |
| --- | --- |
| 来源 | `github.com/jindrapetrik/jpexs-decompiler` 官方稳定版发布 |
| 版本 | 26.2.1 |
| ZIP SHA-256 | `0333B56998A55BD83F4E0DEB678A811FCDC45607582B4F5DD438309C8C3AD5CE` |
| CLI SHA-256 | `2D9BA11FDB264EC15354D520A5249024B5C8F1960493C794D1C16C7A2523D161` |
| Authenticode | Valid；Jindrich Petrik |
| 安装位置 | `.agent-supervisor/tools/ffdec-26.2.1` |
| 使用范围 | 只读导出 image/frame；未写回任何 SWF 或 QQNCmini 文件 |

## 5. 当前页面视觉拆解

### 5.1 画布与缩放

- 最大化测量窗口：约 1706×1066；页面随桌面宽度铺满，没有固定 1280px 黑边。
- 微端页签与官网链接区约占顶部 102px；游戏场景从其下方开始。
- 场景使用全幅插画，UI 以绝对定位浮层叠加；不会随着内容生成普通文档流。
- 1440px 复刻应使用固定 16:10 游戏舞台，`min-width: 1180px`，并以 `object-fit: cover` 控制背景；只实现桌面，不设置移动断点。

### 5.2 主要区域

| 区域 | 目标特征 | React 映射 |
| --- | --- | --- |
| 微端页签栏 | 浅灰页签、米黄站点链接、关闭与新增按钮 | `FarmChrome`，本地标签切换 |
| 用户资源面板 | 左上木纹框、头像、经验条、等级/VIP、金币与宝石 | `PlayerStatusPanel`，本地模拟数据 |
| 主入口带 | 右上大型插画入口，白描边、深棕投影文字 | `ModeDock`，选中/悬浮/禁用态 |
| 左侧活动带 | 礼盒、手机农场、钟鸣等竖排入口 | `ActivityRail`，本地弹窗 |
| 场景核心 | 草坡、石路、豆藤屋、工坊、狗屋、矿架与房屋 | `FarmScene` 背景与可点击热点 |
| 农田 | 斜向透视的棕色已开垦地和绿色未开垦地 | `PlotGrid`，CSS 透视定位与本地状态 |
| 工具 | 右下喷壶/农具形象按钮 | `ToolDock`，选中、忙碌、成功、失败 |
| 浮层 | 木板/纸张式面板，棕色粗描边，黄色主按钮 | `FarmModal` / `FarmDropdown` |

### 5.3 配色与样式

- 天空：浅青蓝；草地：黄绿色到鲜绿色；土壤：焦糖棕。
- UI 主材质：深胡桃木、浅奶油纸、金黄描边、亮绿色进度条。
- 文字：白或奶黄填充，2–4px 深棕描边，短标题采用粗圆卡通字。
- 图标：高饱和插画、明显白色外描边、低角度暖色阴影。
- 圆角不是主要语言；面板多为木板、纸张和不规则插画轮廓。
- 动效以轻微上下浮动、缩放回弹、星光闪烁和状态切换为主，避免现代 SaaS 渐变卡片风格。

## 6. 纯前端复刻方案

### 6.1 场景层

已基于匿名化参考生成独立无 UI 场景底图 `qq-farm-clean-scene-generated.png`：1586×992，2,432,271 bytes，SHA-256 `4B835A9C6BE5CCEF4984CC9174F58C9255EB5AF769EB56821235DE58E760F47F`。它保留草坡、道路、田块、房屋、豆藤屋、工坊和狗屋的空间关系，但不含账号、文字或按钮。

### 6.2 组件层

1. `FarmChrome`：页签和站点链接，只做本地选中状态。
2. `PlayerStatusPanel`：经验、等级、金币和宝石；所有数字为 deterministic fixture。
3. `ModeDock`：主界面、牧场、时光农场、节气系统、魔法池；非当前页面只弹出“演示未开放”。
4. `ActivityRail`：精彩活动、手机农场、钟鸣入口；打开同一套本地模态框。
5. `PlotGrid`：24 块斜向田地，支持空地、种植、成熟、禁用、加载、成功和失败。
6. `ToolDock`：选择铲子、浇水、施肥、除虫和收获工具；只改变本地 UI。
7. `FarmModal`：木纹标题、纸张内容和金黄/绿色动作按钮。
8. `ToastStack`：短时反馈，模拟原页的操作提示。

### 6.3 前后端边界

- 不调用现有 `/api/manor`。
- 不使用数据库、认证、Server Action 或文件上传。
- 不保存表单、田地或资源变化。
- 不请求 QQ、模型或任何第三方业务接口。
- 所有加载、成功、失败、空态和禁用态由本地 React state 驱动。

## 7. 1440px 验收基线

1. 页面在 1440×900 下显示完整场景、顶部页签、资源面板、右上入口、左侧入口、田块和工具栏。
2. `document.documentElement.scrollWidth === document.documentElement.clientWidth`。
3. 所有主要可点击控件拥有可访问名称、键盘焦点和 44px 以上命中区域。
4. 标签切换、入口弹窗、工具选择、田块状态、加载/成功/失败/空态/禁用态均可由 Playwright 触发并等待结果返回。
5. 页面产生 0 条控制台 error，0 个第三方业务请求，0 个对 `/api/manor` 的请求。
6. TypeScript、ESLint、专用 fidelity gate 和生产构建退出码均为 0。

## 8. 不复刻内容

- 牧场、时光农场、节气系统和魔法池的目标页内容。
- 付费、充值、真实登录、真实账号数据和排行榜数据。
- 移动端导航、触摸手势、移动断点和响应式重排。
- Unity/Flash 运行时、CEF 外壳和远程 QQ 业务接口。
