"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  BarChart3,
  Boxes,
  BookOpen,
  Camera,
  Library,
  MessagesSquare,
  NotebookPen,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type RoleId = "teacher" | "student" | "admin";

interface Capability {
  icon: LucideIcon;
  title: string;
  desc: string;
}

/**
 * 角色对应的**产品实拍**（不是效果图、不是重绘的示意）。
 *
 * 两条纪律写在类型里，因为它们比样式更容易在下一次改动中被悄悄丢掉：
 *
 * · `alt` 必须**具体描述图里有什么**，不能写「教师端截图」了事。这三张图承载信息
 *   （tab 切换后视觉上唯一变的东西就是它），不是装饰；读屏用户切 tab 时如果听到的
 *   三段 alt 一模一样，那这次切换对他们而言等于没发生。
 * · 图旁必须有「界面实拍 · 内容为演示样例」。截图里是**种子演示数据**——教师端那张
 *   有「8 / 500 次」「平均掌握 70%」，管理端那张有一整屏审计条目。不标注就等于把
 *   演示样例当成真实业绩展示，这跟直接编一个数字没有区别，只是更难被发现。
 */
interface RoleShot {
  src: string;
  alt: string;
}

interface Role {
  id: RoleId;
  label: string;
  /** 面板首行的一句话定位——不是卖点，是「你进来会看到什么」。 */
  lede: string;
  /** 摘要卡的一句收益。三条**必须同句式**，否则横向对比失效——
   *  这是同构三卡的全部价值所在：读者不用切三次 tab 就能比出差别。 */
  summary: string;
  /** 摘要卡的三条要点。数量固定为 3 以保证三卡等高。 */
  highlights: [string, string, string];
  shot: RoleShot;
  items: Capability[];
}

/**
 * 能力清单全部取自本项目已实现的功能，**不含任何指标数字**。
 * 门户是登录前的公开页，任何「提升 X%」都需要真实测量支撑；我们没有，
 * 所以一个都不写——宁可让文案平淡，也不让它可疑。
 */
const ROLES: Role[] = [
  {
    id: "teacher",
    label: "教师",
    lede: "从备课到看班，四件事在同一个地方完成。",
    summary: "把重复的备课动作交出去，判断留给自己",
    highlights: ["三步生成教案初稿", "看班级聚合而非盯个人", "自建学科助手给学生用"],
    shot: {
      src: "/shots/teacher.webp",
      alt: "教师端首页界面实拍：左侧导航为今日教学、班级学情、AI 对话、提示词中心、知识库；主区是问候语、一排统计卡片与班级学情入口，右栏列出今日事项和待办事项。界面中的数字均为演示样例。",
    },
    items: [
      {
        icon: BookOpen,
        title: "备课助手",
        desc: "三步向导：选学段与课题、给约束、生成教案初稿，每一步都可以改了再往下走。",
      },
      {
        icon: Library,
        title: "提示词库",
        desc: "把用顺手的提示词存下来，也能分享给同教研组的老师直接取用。",
      },
      {
        icon: BarChart3,
        title: "班级学情",
        desc: "看班级的聚合情况，而不是盯着某一个学生——用来决定下节课先讲哪里。",
      },
      {
        icon: Boxes,
        title: "智能体自建",
        desc: "按自己的学科和讲法配一个助手，设定它的角色、资料范围和回答方式。",
      },
    ],
  },
  {
    id: "student",
    label: "学生",
    lede: "它会陪你想，不会替你写。",
    summary: "把不会的地方问明白，不把答案抄回去",
    highlights: ["先反问再拆步骤", "错题只和自己比", "使用时段由学校设定"],
    shot: {
      src: "/shots/student.webp",
      alt: "学生端首页界面实拍：左侧导航为首页、AI 对话、成长、AI 工具；主区是问候语和「继续上次的对话」「看看我的成长」「到知识库找资料」三个入口，右下角有常驻的安全求助按钮。界面中的内容均为演示样例。",
    },
    items: [
      {
        icon: MessagesSquare,
        title: "AI 对话",
        desc: "苏格拉底式引导：先反问、先拆步骤，不直接把答案递给你。",
      },
      {
        icon: NotebookPen,
        title: "错题本与成长记录",
        desc: "错题记下来、隔段时间再练一次；成长记录只和自己比，没有排行榜。",
      },
      {
        icon: Library,
        title: "学习工具",
        desc: "检索校内知识库里的资料，用关键词找到老师上传的讲义和参考材料。",
      },
      {
        icon: ShieldCheck,
        title: "学校设定的使用时段",
        // 原文写「由家长设置」。系统里**没有家长这个角色**——lib/types.ts:24 的 UserRole
        // 只有 teacher/student/admin/researcher/college-admin；api/guardian/route.ts:50
        // 的作用域也只由 admin(全校)/teacher(本班) 的会话决定。在登录前的公开页上
        // 对**未成年人本人**宣称一个不存在的监护通道，比编一个用户数严重：
        // 学生会据此相信「我爸妈能管这个」。
        desc: "使用时段和每日上限由学校或班主任设定，到点会提醒你停下来休息。",
      },
    ],
  },
  {
    id: "admin",
    label: "管理员",
    lede: "谁能用、用什么模型、发生过什么，都可查可管。",
    summary: "把权限与用量放到明处，出了事查得到",
    highlights: ["按角色分配可见范围", "配模型与每日上限", "关键操作留痕可追溯"],
    shot: {
      src: "/shots/admin.webp",
      alt: "管理端安全审计界面实拍：顶部分栏为数据看板、安全审计、权限管理、模型管理、智能体监控；下方是按时间排列的审计日志表格，列出时间、用户、操作、涉及资源、风险与状态。界面中的记录均为演示样例。",
    },
    items: [
      {
        icon: SlidersHorizontal,
        title: "模型与公平使用配置",
        desc: "配置校内可选的模型，并按公平使用原则安排资源，让每个班都用得上。",
      },
      {
        icon: UsersRound,
        title: "权限与角色管理",
        desc: "按教师、学生、管理员分配权限，控制各角色能看到和能操作的范围。",
      },
      {
        icon: ScrollText,
        title: "审计日志",
        desc: "关键操作留痕，需要复盘时可以追溯是谁在什么时候做了什么。",
      },
      {
        icon: ShieldCheck,
        title: "守护策略下发",
        // 只有两级作用域：api/guardian/route.ts:50 `scope = isAdmin ? "global" : user.classId`，
        // 即全校与班级，**没有年级这一档**。
        desc: "把使用时段、每日上限等守护策略统一下发到全校或班级。",
      },
    ],
  },
];

export function RoleEntries() {
  const [active, setActive] = useState<RoleId>("teacher");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // 首屏**不做**入场动画，只有用户切换过之后才动。
  // 原因：入场若写进首帧（无论 motion 的 initial 还是 CSS 动画的 from），
  // 在 JS 水合完成之前（或水合失败时）本区块的正文是看不见的——
  // 这是登录前的公开页，主内容不该押在一次 JS 动画上。
  // R4 生产真值轮把这里从 motion 换成了 CSS 动画：/portal 路由图里只有本组件
  // 引 motion，而它只用来做这一个 0.2s 淡入——为此背整个动画库不划算
  //（实测换掉后路由 JS 560→491KB，−69KB——写这行注释的第一版填的是拍脑袋的
  // 433，量完才改成真值。**数字必须来自测量，包括注释里的**）。曲线与时长照抄原值，行为不变；
  // reduced-motion 由 globals.css 的 motion-safe 包裹处理。
  // 用 state 而非 ref：渲染期间读 ref 会被 react-hooks/refs 判错，且语义上
  // 这确实是「要影响渲染结果」的值。
  const [hasSwitched, setHasSwitched] = useState(false);

  const activeIndex = ROLES.findIndex((r) => r.id === active);
  const activeRole = ROLES[activeIndex];

  // 左右方向键 + Home/End 循环切换，并把焦点跟过去——只按 aria-selected
  // 而不移动焦点的话，键盘用户会看到内容变了但焦点还留在原处。
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    let next = activeIndex;
    if (event.key === "ArrowLeft") next = (activeIndex - 1 + ROLES.length) % ROLES.length;
    if (event.key === "ArrowRight") next = (activeIndex + 1) % ROLES.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = ROLES.length - 1;

    const target = ROLES[next];
    select(target.id);
    tabRefs.current[target.id]?.focus();
  }

  function select(id: RoleId) {
    // no-op 守卫（R5 对抗复核 R4-F1）：点击已选中的 tab（或按 Home 落回当前 tab）
    // 若照样翻 hasSwitched，会给**已可见**的面板增挂 .portal-panel-in——同 key 不
    // 重挂载，但 CSS 动画照样从 from 帧重播，整块面板闪没一次再淡回（实测 min
    // opacity 0.001、约 100ms 明显半透明）。motion 版此路径天然无动画（initial 只在
    // mount 读取），守卫把这个语义找回来。onKeyDown 里的 focus() 不依赖本函数，
    // 键盘焦点行为不受影响。
    if (id === active) return;
    setHasSwitched(true);
    setActive(id);
    // URL 同步（rank 12）：不同步就丢失分享能力——「我把这段发给你」只能落到默认
    // 的教师 tab。用 replaceState 而不是 push：切三次 tab 不该让人按三次返回键；
    // 也不用 router.replace（那会触发 Next 的路由生命周期，为一个纯视图状态过重）。
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#roles-${id}`);
    }
  }

  return (
    <section
      id="roles"
      aria-labelledby="roles-heading"
      // isolate：底层美术用 -z-10，需要一个自己的层叠上下文兜住，
      // 否则它会往上穿到 section 背景之下（或穿到相邻区块之上，取决于兄弟节点）。
      // overflow-clip 而非 overflow-hidden（R5 对抗复核 AT-1）：hidden 会产生滚动容器，
      // 把后代 portal-reveal 的 view() 时间轴劫持到本 section（timeline.source 指向它、
      // 进度几何锁死在 1），眉标的入场从未播放过——静默死挂载。clip 只裁切不产生
      // 滚动容器，view() 继续向上找到根滚动器；装饰拱门的裁切效果不变。
      className="relative isolate w-full overflow-clip bg-[var(--bg-2)] py-16 md:py-24"
    >
      {/* ── 区块背景美术：三道空拱门 ────────────────────────────────────────
          三道拱门是这个区块唯一的隐喻——三个角色、三道门、门后各不相同。
          它**纯装饰**：alt="" + aria-hidden，区块的全部信息由文字和产品实拍承载，
          图挂了也不损失任何内容（登录前的公开页不该把信息押在一次图片请求上）。

          两个刻意的取舍：

          A. **锚在版心而不是铺满视口。** 拱门的间距因此和下面三个角色入口落在
             同一列宽里，读起来是「这三道门属于这块内容」，而不是一张贴在整页
             背景上的墙纸。理想情况是拱门逐一对齐三个 tab，但 tab 是一枚靠左的
             紧凑胶囊（三档视口下宽度 200–240px），把 1400px 的画面压进去只会
             变成三条竖线；所以退一步做**列宽对齐**而不是**逐个对齐**。

          B. **object-contain 而不是 cover。** 390px 档下区块高度约是宽度的 3 倍，
             cover 会把这张 1.5:1 的图裁成一条被放大 3 倍的横切片——拱门变成几段
             莫名其妙的粗弧。contain 让它在任何比例下都保持完整；空出来的那块与
             --bg 同为暖奶油，看不出接缝。

          锚点与不透明度**分档给**，这是实测改出来的，不是一开始就想到的：

          · ≥1024px：区块高度（约 856px）恰好接近图按版心宽算出的高度（1200÷1.5=800），
            贴底 + 0.20，三道拱门整个立在内容后面，拱顶正好落在标题右侧的留白上。
          · <1024px：布局竖排，区块被拉到 1347px（768 档）乃至 1147px（390 档）高，
            而图只有 485 / 233px 高。此时若仍贴底，拱门整个被下方那排不透明卡片盖住，
            **只剩几条竖线露在区块最底下**——看着像渲染残留，不像装饰。首版就是这样，
            是截图看出来的。改成贴顶：拱顶落在标题区的留白里，拱脚往下钻进截图卡片，
            读起来是「门在内容后面」。同时压到 0.10——竖排档的正文直接压在图上，
            0.20 在这一档会开始抢笔画。

          换句话说：**同一张图，宽屏当布景、窄屏当水印**。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 mx-auto w-full max-w-[var(--portal-max)] select-none px-[var(--portal-pad)]"
      >
        <Image
          src="/art/portal-roles.webp"
          alt=""
          aria-hidden="true"
          width={1400}
          height={933}
          sizes="(min-width: 1280px) 1200px, 100vw"
          /* 0.20 的深靛压在奶油上混出的是脏灰——拱门轮廓横穿卡片，读作水印而非底纹。
             降到 0.10 并从左向右淡入：左侧标题区几乎无图，右侧卡片区只剩极淡轮廓。 */
          style={{
            maskImage: "linear-gradient(to right, transparent 0, black 45%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0, black 45%)",
          }}
          className="h-full w-full object-contain object-top opacity-[0.07] lg:object-bottom lg:opacity-10"
        />
      </div>

      <div className="relative mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]">
        {/* 入场只挂在眉标+标题上，不挂 tab 与面板：tab 有自己的切换动效（motion），
            两套动画叠在同一元素上会互相打架。 */}
        <p className="portal-reveal text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-accent)]">
          三个角色，一套系统
        </p>
        <h2
          id="roles-heading"
          className="mt-3 max-w-[20ch] text-[length:var(--fs-d2)] font-bold leading-[var(--lh-d)] tracking-tight text-[var(--text)]"
        >
          按你的身份进入 i-learning
        </h2>
        <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-[var(--text-2)]">
          同一个校内平台，教师、学生和管理员看到的是不同的入口。下面是各自登录后能用到的东西。
        </p>

        {/* ── 同构摘要三卡（rank 12）───────────────────────────────────────
            为什么要在 tab 之上再加一排卡：tab 一次只显示一个角色，读者要切三次、
            读 12 张能力卡才能比出差别——而「角色分流」这个模式的全部价值恰恰在
            **横向对比**。三卡内部结构完全同构（角色名 + 同句式的一句收益 +
            三条等长要点 + 同一个动作），少一样对比就失效。
            tab 不废：它承载着每角色一张真实实拍，从「唯一入口」降级为「深入查看」，
            顺带解决了 tab 在移动端不易被发现的问题。

            ⚠️ ARIA：这三个按钮**不是** role="tab"（它们在 tablist 之外），
            也不能给 aria-selected——否则页面上会出现第二个假 tablist，读屏用户
            听到两组互相矛盾的「已选中」。它们只是普通按钮 + aria-controls。 */}
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {ROLES.map((role) => {
            const selected = role.id === active;
            return (
              <li
                key={`sum-${role.id}`}
                /* 卡片是**承载面**不是控件（本轮修正）：初版把整张卡做成 <button>，
                   于是它成了「用户界面组件」，WCAG 1.4.11 要求其边界对背景 ≥3:1——
                   实测未选中态的 --border 压在加深后的 --bg-2 暖带上只有 **1.04:1**，
                   白底对暖带也只有 1.19:1，等于这个控件没有可辨边界。
                   （这是 rank 13 加深分带与 rank 12 新增卡的**交互缺陷**：两项单看都没问题。）
                   修法不是把描边加粗到深棕（那会毁掉整页的轻盈感，也与其余卡片不一致），
                   而是回到全站既有语义：卡片是 li 承载面，动作是卡内的显式按钮。 */
                className={cn(
                  "flex h-full flex-col rounded-[var(--r-card)] border p-5 transition-colors duration-[var(--t-base)] ease-[var(--ease-out)]",
                  selected
                    ? "border-[var(--portal-accent)] bg-[var(--card)]"
                    : "border-[var(--border)] bg-[var(--card)]",
                )}
              >
                <span className="text-[16px] font-bold text-[var(--text)]">{role.label}</span>
                <span className="mt-2 text-[16px] leading-relaxed text-[var(--text-2)]">
                  {role.summary}
                </span>
                <ul className="mt-4 space-y-1.5">
                  {role.highlights.map((h) => (
                    <li key={h} className="text-[14px] leading-relaxed text-[var(--text-2)]">
                      · {h}
                    </li>
                  ))}
                </ul>
                {/* 动作是文字按钮（透明底）：不给它填充，就不会再变成一个需要
                    自证边界的实心控件；触达用 min-h 补到 44px。
                    aria-controls 只在选中项上挂——面板只渲染当前那一个，
                    三张都挂会产生两个悬空引用（本文件在 tab 上早写过这条规则，
                    我在摘要卡上又踩了一次，教训是同一约束要在同类元素上一起执行）。 */}
                <button
                  type="button"
                  onClick={() => {
                    select(role.id);
                    tabRefs.current[role.id]?.focus();
                  }}
                  aria-controls={selected ? `roles-panel-${role.id}` : undefined}
                  className="mt-4 inline-flex min-h-[44px] items-center self-start text-[14px] font-semibold text-[var(--portal-accent)] underline-offset-4 hover:underline"
                >
                  {selected ? "正在看这个角色" : "看这个角色的界面 →"}
                </button>
              </li>
            );
          })}
        </ul>

        {/* 胶囊分段控件 */}
        <div
          role="tablist"
          aria-label="按角色查看功能"
          onKeyDown={onKeyDown}
          className="mt-6 inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] p-1"
        >
          {ROLES.map((role) => {
            const selected = role.id === active;
            return (
              <button
                key={role.id}
                ref={(node) => {
                  tabRefs.current[role.id] = node;
                }}
                type="button"
                role="tab"
                id={`roles-tab-${role.id}`}
                aria-selected={selected}
                /* 只在选中的 tab 上挂 aria-controls。面板是「只渲染当前那一个」，
                   三个 tab 都挂就意味着任意时刻有两个指向页面上不存在的 id——
                   axe 的 aria-valid-attr-value 会报错，读屏的「跳到受控面板」
                   快捷键在未选中项上会静默失败。另一种修法是三个面板全渲染、
                   非选中的加 hidden；这里选前者，因为它不改变渲染成本。 */
                aria-controls={selected ? `roles-panel-${role.id}` : undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(role.id)}
                className={cn(
                  "min-h-[44px] rounded-full px-5 text-[16px] transition-colors duration-[var(--t-base)] ease-[var(--ease-out)]",
                  selected
                    ? "bg-[var(--portal-accent)] font-semibold text-[var(--card)]"
                    : "bg-transparent font-normal text-[var(--text-2)] hover:text-[var(--text)]",
                )}
              >
                {role.label}
              </button>
            );
          })}
        </div>

        {/* 面板：只渲染选中的那个，key 变化触发一次极轻的淡入位移 */}
        {/* 高度跳变：本轮范式审计断言「三份面板长度不等，切 tab 必然改变文档高度」，
            实测**只有一档成立**——1440px 与 1024px 下三份面板 402/402/402 与
            454/454/454（完全相同，零跳变），仅 390px 下管理员面板 801px 比另两个
            777px 高 24px（文案折行差一行）。
            判定：记录不修。硬编码 min-h 要覆盖连续宽度就得写死若干魔数，宽度一变
            就失准，比一处 24px 位移更脆弱；真要根治该去对齐三份文案的折行长度，
            而不是在容器上塞常量。下次若移动端面板差距超过一屏的 1/8 再重新评估。 */}
        <div
          key={activeRole.id}
          id={`roles-panel-${activeRole.id}`}
          role="tabpanel"
          aria-labelledby={`roles-tab-${activeRole.id}`}
          tabIndex={0}
          className={`mt-6 rounded-[var(--r-card)]${hasSwitched ? " portal-panel-in" : ""}`}
        >
          <p className="text-[16px] font-semibold text-[var(--text)]">{activeRole.lede}</p>

          {/* ── 实拍 + 能力卡 ────────────────────────────────────────────────
              改版前切 tab 只换文字，三份文案长度又相近，观感是「什么都没发生」。
              现在每个面板带一张对应角色的**产品实拍**，切换时整块画面跟着换——
              这是 tab 第一次有视觉分量。

              布局：≥1024px 左图右卡（5:7），768–1023px 上图下卡，<768px 不显示图。
              小屏藏图不是偷懒：390px 下这张 1100px 宽的截图缩到 350px，界面里的
              文字全部糊成灰线，既读不出内容又白下载 20–45KB。宁可不放。

              卡片从四列改为两列：右侧只剩 7fr，四列每格不到 160px，中文标题会
              逐字换行。两列在 1440 下每格约 326px，是这批文案的舒适宽度。 */}
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
            <figure className="hidden md:block">
              <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
                {/* 1400×875 = 1024 CSS px 视口 @DPR2 缩制，位图密度 1.37×（原先 1.0×）。
                    视口不能再窄：应用外壳在 <1024 收起竖向导航，而这三张的 alt 都写着
                    「左侧导航为…」——拍窄了 alt 立刻变成假描述。
                    拍摄纪律（含按播种姓名做的身份自证）见 scripts/shoot-portal-shots.mjs。 */}
                <Image
                  src={activeRole.shot.src}
                  alt={activeRole.shot.alt}
                  width={1400}
                  height={875}
                  sizes="(min-width: 1024px) 480px, 92vw"
                  className="block h-auto w-full"
                />
              </div>
              {/* 「演示样例」必须在图**旁边**，不能只写在页脚或 alt 里：看图的人
                  不会去读页脚，读屏的人不会去看图注——两处各说一遍才都覆盖得到。 */}
              <figcaption className="mt-3 flex items-center gap-2 text-[12px] leading-normal font-normal text-[var(--text-2)]">
                <Camera aria-hidden="true" className="h-[14px] w-[14px] shrink-0" />
                界面实拍 · 内容为演示样例
              </figcaption>
            </figure>

            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {activeRole.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.title}
                    // 三件套解除（rank 11）：常态去 shadow-sm，只留描边 + 白底与 --bg-2 暖带的底色差；
                    // 阴影退回 hover 态与抬升同时出现，重新承担「可点」的语义。
                    className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)] p-5 transition-[transform,box-shadow] duration-[var(--t-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-11 w-11 place-items-center rounded-[var(--r-ctl)] bg-[var(--portal-tint)] text-[var(--portal-accent)]"
                    >
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    <h3 className="mt-4 text-[18px] font-semibold leading-snug text-[var(--text)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-[16px] leading-relaxed text-[var(--text-2)]">
                      {item.desc}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* 生成美术的署名。放在区块右下角、不放进 aria-hidden 的装饰层里——
            AIGC 标识是给**读者**看的合规声明，藏进装饰层等于没标。
            与上面的「界面实拍」图注刻意分开写：一句说的是「这是真界面但数据是演示的」，
            一句说的是「这张画不是拍来的也不是画师画的」，两件事不该合并成一句含糊的免责。 */}
        {/* 体例与 Capabilities / TrustSafety 的同类标注一致：纯右对齐文本，无图标
            （对齐审计 X-2：三条同字号同色同右缘的合规标注，此前只有这条多一枚图标）。 */}
        <p className="mt-10 text-right text-[12px] leading-normal font-normal text-[var(--text-2)]">
          背景美术由 AI 生成
        </p>
      </div>
    </section>
  );
}
