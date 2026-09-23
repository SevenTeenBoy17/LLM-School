// Role-based navigation helpers (pure, server-safe).
// Drives default landing + console visibility + **the navigation tree itself**.
import type { UserRole } from "@/lib/types";

/** Where each role should land after login / role switch. */
export function homeFor(role: UserRole): string {
  switch (role) {
    case "student":
      return "/student/home"; // S2 角色化：学生落极简首页（四入口之一）
    case "researcher":
      return "/research"; // S1 角色化：科研默认落教研中心（/class 仍为其可达的次级入口）
    case "admin":
    case "college-admin":
      return "/admin/analytics";
    case "teacher":
    default:
      return "/dashboard";
  }
}

/** Only management roles may see the 管理与监控 console group. */
export function canAccessConsole(role: UserRole): boolean {
  return role === "admin" || role === "college-admin";
}

/**
 * 班级学情（/class）准入——白名单单一真相源（评审 P1）。
 * 该页含全班未成年人实名诊断（PII），必须 default-deny 未知角色，且 nav 可见集与守卫准入集共用此处。
 * 仅任教角色可见（教师/科研）；管理员走 console 数据看板，不进 /class。
 */
export const CLASS_ROLES: UserRole[] = ["teacher", "researcher"];
export function canAccessClass(role: UserRole): boolean {
  return CLASS_ROLES.includes(role);
}

/**
 * 教研板块（/research*）准入（S1 角色化）：教师/科研/管理可达，学生 default-deny。
 * 与 Sidebar「教研」分组可见集共用此单一真相源（与 canAccessClass 同一模式）。
 */
export const RESEARCH_ROLES: UserRole[] = ["teacher", "researcher", "admin", "college-admin"];
export function canAccessResearch(role: UserRole): boolean {
  return RESEARCH_ROLES.includes(role);
}

/** 课件工坊包含教师个人备课稿，仅任课教师与科研教研角色可用。 */
export const COURSEWARE_ROLES: UserRole[] = ["teacher", "researcher"];
export function canAccessCourseware(role: UserRole): boolean {
  return COURSEWARE_ROLES.includes(role);
}

/** 校内资源库仅供教师与科研人员使用，导航与路由守卫共用此白名单。 */
export const SCHOOL_RESOURCE_ROLES: UserRole[] = ["teacher", "researcher"];
export function canAccessSchoolResources(role: UserRole): boolean {
  return SCHOOL_RESOURCE_ROLES.includes(role);
}

/** 学生端命名空间（/student*）：仅学生可达（S2）。 */
export function canAccessStudent(role: UserRole): boolean {
  return role === "student";
}

export const ROLE_LABEL: Record<UserRole, string> = {
  teacher: "教师",
  student: "学生",
  researcher: "科研人员",
  admin: "管理员",
  "college-admin": "学院管理员",
};

// ─────────────────────────────────────────────────────────────────────────────
// 导航树 —— 单一真相源
// ─────────────────────────────────────────────────────────────────────────────
/**
 * **为什么导航树必须住在这里，而不是各个渲染组件里。**
 *
 * 此前 Sidebar.tsx 与 MobileNav.tsx 各写了一份 NAV，两份**内容不同**。实测差异：
 *
 * · student：桌面 4 项（首页 / AI 对话 / 成长 / AI 工具），移动 5 项
 *   （我的学习 / 学习探索 / AI 对话 / 提示词中心 / 知识库）。
 *   → 学生在手机上**完全打不开成长页与 AI 工具**；却多出两个「生产者」入口
 *     （提示词中心、知识库），方向与 S2「学生端收敛为只学只用」正好相反。
 * · teacher / researcher：移动端**整个「教研」分组四项全缺**
 *   （教研中心 / 课题与论文 / 集体备课 / 教学产物）。
 * · admin：移动端缺「守护设置」——那是未成年人保护的配置入口。
 *
 * 这不是「移动端简化」，是两份表各自演化后的漂移：没有任何一处记录过要在小屏
 * 藏掉这些目的地。Material 3 的自适应导航规范把这条写成了硬要求——**跨断点
 * 共用同一张导航图，不同断点只换导航 UI 组件，不换目的地**。
 *
 * 放在 nav.ts 还有第二个理由：准入白名单（CLASS_ROLES / RESEARCH_ROLES）就在本文件，
 * proxy.ts 也从这里取。导航可见集与服务端准入集共用同一批常量，才不会再次漂移。
 *
 * icon 存**字符串名**而非组件：本文件被 proxy.ts（边缘运行时）导入，不能牵进 React。
 * 渲染层各自维护一张显式的 name→组件映射表（显式表可 tree-shake，且缺项是可门禁的）。
 */
export interface NavItem {
  id: string;
  label: string;
  /** lucide-react 导出名；渲染层用显式映射表解析 */
  icon: string;
  href: string;
  badge?: string;
  roles?: UserRole[];
}

export interface NavGroup {
  id: string;
  section: string;
  roles?: UserRole[];
  /** S1：教师端分组可折叠（disclosure）；学生/管理组不折叠 */
  collapsible?: boolean;
  items: NavItem[];
}

/** 非学生（教师/科研/管理）共享的「生产者」功能集；学生端收敛为只学/只用（评审 P1-2） */
export const TEACHERLIKE: UserRole[] = ["teacher", "researcher", "admin", "college-admin"];
export const SWITCHABLE_ROLES: UserRole[] = ["teacher", "student", "researcher", "admin", "college-admin"];

export const NAV: NavGroup[] = [
  {
    id: "teaching",
    section: "教学",
    roles: TEACHERLIKE,
    collapsible: true,
    items: [
      { id: "dashboard", label: "今日教学", icon: "Home", href: "/dashboard" },
      { id: "class", label: "班级学情", icon: "LineChart", href: "/class", roles: CLASS_ROLES },
      { id: "manor-evidence", label: "庄园证据", icon: "ShieldCheck", href: "/class/manor", roles: ["teacher"] },
      { id: "chat", label: "AI 对话", icon: "MessageCircle", href: "/chat" },
      { id: "prompts", label: "提示词中心", icon: "Sparkles", href: "/prompts" },
      { id: "knowledge", label: "知识库", icon: "BookOpen", href: "/knowledge" },
      { id: "school-resources", label: "校内资源库", icon: "Archive", href: "/knowledge/resources", roles: SCHOOL_RESOURCE_ROLES },
    ],
  },
  {
    id: "research",
    section: "教研",
    roles: RESEARCH_ROLES,
    collapsible: true,
    items: [
      { id: "research-center", label: "教研中心", icon: "FlaskConical", href: "/research" },
      { id: "research-paper", label: "课题与论文", icon: "FileText", href: "/research/paper" },
      { id: "research-prep", label: "集体备课", icon: "Users2", href: "/research/prep" },
      { id: "research-courseware", label: "课件工坊", icon: "FileText", href: "/research/courseware", roles: COURSEWARE_ROLES },
      { id: "research-artifacts", label: "教学产物", icon: "Archive", href: "/research/artifacts" },
    ],
  },
  {
    id: "tools",
    section: "更多工具",
    roles: TEACHERLIKE,
    collapsible: true,
    items: [
      { id: "hub", label: "模型广场", icon: "LayoutGrid", href: "/hub", badge: "5" },
      { id: "agent", label: "智能体工作台", icon: "Bot", href: "/agent" },
      { id: "skills", label: "技能库", icon: "SlidersHorizontal", href: "/skills", badge: "NEW" },
    ],
  },
  // F7（规格 §IA 三组侧栏）：S2 的「锁死 4 入口」在 W-B2~B4 落地 7 个真实页面后已不成立——
  // 徽章/庄园/活动都藏在二级链接里，「有门没人跑」会在导航层重演。改为三组分组：
  // 学习（高频动线）固定展开；成长/项目可折叠。「学习探索」维持并线进首页队列的既定意图。
  {
    id: "student-learn",
    section: "学习",
    roles: ["student"],
    items: [
      { id: "s-home", label: "首页", icon: "Home", href: "/student/home" },
      { id: "s-chat", label: "AI 对话", icon: "MessageCircle", href: "/chat" },
      { id: "s-tools", label: "AI 工具", icon: "Sparkles", href: "/student/tools" },
    ],
  },
  {
    id: "student-growth",
    section: "成长",
    roles: ["student"],
    collapsible: true,
    items: [
      { id: "s-growth", label: "成长总览", icon: "GraduationCap", href: "/student/growth" },
      { id: "s-badges", label: "数字徽章", icon: "Medal", href: "/student/badges" },
      { id: "s-manor", label: "个人庄园", icon: "Trees", href: "/student/manor" },
    ],
  },
  {
    // 单项分组不设折叠：折叠一个只有一条的组=把唯一入口藏起来（F7 headless 实测抓到）
    id: "student-project",
    section: "项目",
    roles: ["student"],
    items: [
      { id: "s-activities", label: "项目活动", icon: "ClipboardList", href: "/student/activities", badge: "NEW" },
      { id: "s-resources", label: "学习资源", icon: "BookOpen", href: "/student/resources" },
    ],
  },
  {
    id: "admin",
    section: "管理与监控",
    roles: ["admin", "college-admin"],
    items: [
      { id: "analytics", label: "数据看板", icon: "BarChart3", href: "/admin/analytics" },
      { id: "audit", label: "安全审计", icon: "ShieldCheck", href: "/admin/audit" },
      { id: "permissions", label: "权限管理", icon: "Users", href: "/admin/permissions" },
      { id: "guardian", label: "守护设置", icon: "GraduationCap", href: "/admin/guardian" },
      { id: "manor-audit", label: "庄园审计", icon: "Trees", href: "/admin/manor" },
    ],
  },
];

/** 该角色可见的分组（组与项两级都过滤，空组不返回）。桌面与移动共用。 */
export function navFor(role: UserRole): NavGroup[] {
  return NAV
    .filter((g) => !g.roles || g.roles.includes(role))
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.roles || it.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}

/**
 * 该角色的**目的地集合**（扁平、去重、已排序）。
 * 存在的意义是给门禁一个可直接比对的值——「桌面与移动目的地一致」这条断言，
 * 只有在两侧都由同一个函数产出时才有意义；若两侧仍各自计算，断言就是恒真的装饰。
 */
export function destinationsFor(role: UserRole): string[] {
  return [...new Set(navFor(role).flatMap((g) => g.items.map((it) => it.href)))].sort();
}

/**
 * 管理台二级导航（components/admin/AdminTabs.tsx 消费）。
 *
 * 这是本项目的**第三个**导航面，此前它也自带一份表，与侧栏「管理与监控」组不一致：
 * 侧栏有「守护设置」而这里没有，这里有「模型管理 / 智能体监控」而侧栏没有。
 * 两者不必内容相同——侧栏是主导航（收敛到 4 项），这里是控制台内的全量二级导航——
 * 但必须来自同一份声明，否则又是一次「各写各的」。
 */
export const CONSOLE_NAV: NavItem[] = [
  { id: "analytics", label: "数据看板", icon: "BarChart3", href: "/admin/analytics" },
  { id: "audit", label: "安全审计", icon: "ShieldAlert", href: "/admin/audit" },
  { id: "permissions", label: "权限管理", icon: "Users", href: "/admin/permissions" },
  { id: "models", label: "模型管理", icon: "LayoutGrid", href: "/admin/models" },
  { id: "agents", label: "智能体监控", icon: "Bot", href: "/admin/agents" },
  { id: "guardian", label: "守护设置", icon: "GraduationCap", href: "/admin/guardian" },
  { id: "manor-audit", label: "庄园审计", icon: "Trees", href: "/admin/manor" },
];

/**
 * 段边界安全的 active 判定。
 *
 * 三个导航面此前都写的是裸 `pathname.startsWith(href)`——那会让 `/student/home`
 * 在 `/student/homework` 上误判为当前页。现在没有这样的路由，所以它是**潜伏**缺陷
 * 而不是已发生的缺陷；但三处同时合并时钉死它的成本是零，而将来新增一个同前缀
 * 路由时排查它的成本不是。
 */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

/**
 * 返回当前路由最具体的导航目的地，避免父入口与子入口同时高亮。
 * 例如 `/research/courseware` 同时匹配 `/research` 和自身时，只选后者。
 */
export function activeNavHref(pathname: string, groups: readonly NavGroup[]): string | null {
  const matches = groups
    .flatMap((group) => group.items)
    .filter((item) => isNavActive(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length);
  return matches[0]?.href ?? null;
}

/**
 * **不进导航的 (shell) 路由登记册。**
 *
 * 存在的唯一理由：让「忘了接线」与「有意不接线」在代码里可区分。
 * 没有这份登记册，「某个页面没有入口」既可能是设计也可能是事故，而门禁无从判断——
 * 于是只能不写这道门，或者写一道永远绿的。
 *
 * 门禁断言：app/(shell)/** 下每个 page.tsx 对应的路由，必须要么出现在
 * NAV / CONSOLE_NAV 里，要么在这里登记并写明 why。新增页面忘了接入口即红。
 */
export const NAV_ORPHANS: { path: string; why: string; reachableFrom?: string }[] = [
  { path: "/learn", why: "S2 并线的旧地址；proxy.ts 对学生 307 → /student/home，页面文件按设计保留" },
  { path: "/profile", why: "由侧栏页脚与顶栏的账户下拉进入，不占主导航位", reachableFrom: "components/shell/Topbar.tsx" },
  { path: "/explore", why: "S2 锁死 4 入口，扩展能力并线进学生首页起手队列", reachableFrom: "app/(shell)/student/home/page.tsx" },
  { path: "/hub/image", why: "/hub 的教师生图子页", reachableFrom: "app/(shell)/hub/page.tsx" },
  { path: "/student/tools/image", why: "/student/tools 的子页", reachableFrom: "app/(shell)/student/tools/page.tsx" },
  { path: "/student/mindmap", why: "W-B2 思维导图：经 AI 工具聚合页卡片进入（工具子能力不占导航位）", reachableFrom: "app/(shell)/student/tools/page.tsx" },
  // F7：/student/activities、/student/badges、/student/manor 已转正为侧栏三组导航项，自孤儿册除名
  { path: "/prompts/new", why: "/prompts 的新建子页", reachableFrom: "app/(shell)/prompts/page.tsx" },
  { path: "/agent/new", why: "/agent 的新建子页", reachableFrom: "app/(shell)/agent/page.tsx" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 路由标题与父子关系
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Topbar 此前用一张**扁平精确匹配表**取标题，于是所有不在表里的路径都落到兜底
 * 「EduAI Prism · 学校 AI 平台」。实测漏网的包括 **整个 /student 命名空间**
 * （/student/home、/student/growth、/student/tools、/student/tools/image）
 * 与 /research/artifacts、/prompts/[id]、/prompts/[id]/edit、/hub/image ——
 * 也就是说学生在自己的工作区里，顶栏永远显示不出自己在哪一页。
 *
 * 改为**最长前缀匹配** + 显式 parent：
 * · 前缀匹配让 /prompts/p-123/edit 这类动态段自动归到 /prompts 之下，不必逐条登记；
 * · parent 让深层页能给出一条「回父页」路径。回父走 router.push(parent) 而**不是**
 *   history.back()——后者会退回到带筛选/滚动状态的上一个历史项，而用户想要的是
 *   「回到那个列表页」，两者在用户从外部链接直达时完全不同。
 *
 * 层级上限二级（父 + 当前）：Polaris 的 backAction 就是单级返回，够用且不会在
 * 窄屏把标题挤没。
 */
export interface RouteMeta {
  title: string;
  sub: string;
  /** 父路由；有值即在顶栏渲染「回父页」按钮 */
  parent?: string;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  "/dashboard": { title: "今日教学", sub: "Dashboard" },
  "/class": { title: "班级学情", sub: "Class Insight" },
  "/class/manor": { title: "庄园学习证据", sub: "Evidence Review", parent: "/class" },
  "/chat": { title: "AI 对话", sub: "通用对话" },
  "/hub": { title: "模型广场", sub: "Model Hub" },
  "/hub/image": { title: "教学配图", sub: "Image Studio", parent: "/hub" },
  "/prompts": { title: "提示词中心", sub: "Prompt Library" },
  "/prompts/new": { title: "新建模板", sub: "Prompt Library", parent: "/prompts" },
  "/knowledge": { title: "知识库", sub: "Knowledge Base" },
  "/knowledge/resources": { title: "校内资源库", sub: "School Resources", parent: "/knowledge" },
  "/agent": { title: "智能体工作台", sub: "Agents" },
  "/agent/new": { title: "新建智能体", sub: "Agents", parent: "/agent" },
  "/skills": { title: "技能库", sub: "Skill Library" },
  "/research": { title: "教研中心", sub: "Research" },
  "/research/paper": { title: "课题与论文", sub: "Paper Studio", parent: "/research" },
  "/research/prep": { title: "集体备课", sub: "Co-Prep", parent: "/research" },
  "/research/courseware": { title: "课件工坊", sub: "Courseware Studio", parent: "/research" },
  "/research/artifacts": { title: "教学产物", sub: "Artifacts", parent: "/research" },
  "/student/home": { title: "首页", sub: "我的学习" },
  "/student/growth": { title: "成长", sub: "错题本与学习统计" },
  "/student/tools": { title: "AI 工具", sub: "学习小工具" },
  "/student/tools/image": { title: "画一张图", sub: "AI 工具", parent: "/student/tools" },
  "/student/mindmap": { title: "思维导图", sub: "AI 工具", parent: "/student/tools" },
  "/student/activities": { title: "项目活动", sub: "学科小项目" },
  "/student/badges": { title: "数字徽章", sub: "我的成长" },
  "/student/manor": { title: "个人庄园", sub: "我的成长" },
  "/explore": { title: "学习探索", sub: "Explore", parent: "/student/home" },
  "/learn": { title: "我的学习", sub: "Learning" },
  "/admin/analytics": { title: "数据看板", sub: "Analytics" },
  "/admin/audit": { title: "安全审计", sub: "Audit" },
  "/admin/manor": { title: "庄园因果审计", sub: "Manor Audit", parent: "/admin/audit" },
  "/admin/permissions": { title: "权限管理", sub: "Permissions" },
  "/admin/guardian": { title: "守护设置", sub: "Guardian" },
  "/admin/models": { title: "模型管理", sub: "Models", parent: "/admin/analytics" },
  "/admin/agents": { title: "智能体监控", sub: "Agent Monitor", parent: "/admin/analytics" },
  "/profile": { title: "个人中心", sub: "Profile" },
};

const META_KEYS = Object.keys(ROUTE_META).sort((a, b) => b.length - a.length);

/**
 * 最长前缀匹配。`/prompts/p-1/edit` → `/prompts`，父页也随之为 `/prompts`
 * （精确登记的 key 优先，因为 META_KEYS 按长度降序）。
 * 注意边界：必须匹配到「完整路径段」，否则 `/agents` 会被 `/agent` 命中。
 */
export function metaForPath(path: string): RouteMeta {
  const key = META_KEYS.find((k) => path === k || path.startsWith(`${k}/`));
  if (!key) return { title: "EduAI Prism", sub: "学校 AI 平台" };
  const meta = ROUTE_META[key];
  // 落在已登记 key 的子路径上（动态段，如 /prompts/p-1）：父页即该 key 本身。
  if (path !== key && !meta.parent) return { ...meta, parent: key };
  return meta;
}
