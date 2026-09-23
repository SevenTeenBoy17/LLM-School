export type SkillLibraryTone = "blue" | "mint" | "amber" | "coral";

export type SkillLibraryIcon =
  | "compass"
  | "collection"
  | "school"
  | "route"
  | "github"
  | "book"
  | "lesson"
  | "rubric"
  | "research"
  | "curriculum"
  | "layers"
  | "sparkles";

export type SkillResourceKind = "聚合站" | "源码库" | "Skill 文件";

export interface SkillResource {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  kind: SkillResourceKind;
  icon: SkillLibraryIcon;
  tags: string[];
}

export interface SkillLibrarySection {
  id: "directories" | "repositories" | "education" | "curriculum";
  title: string;
  eyebrow: string;
  description: string;
  tone: SkillLibraryTone;
  icon: SkillLibraryIcon;
  resources: SkillResource[];
}

export const SKILL_LINK_AUDIT_DATE = "2026-08-31";

export const SKILL_LIBRARY_SECTIONS: SkillLibrarySection[] = [
  {
    id: "directories",
    title: "Skill 聚合库",
    eyebrow: "先发现，再审查",
    description: "适合按关键词、热度或分类寻找候选 Skill。聚合展示不代表安全认证。",
    tone: "blue",
    icon: "compass",
    resources: [
      {
        id: "skillsmp",
        title: "SkillsMP",
        description: "索引公开 GitHub Skill 文件，支持中文界面与分类检索。",
        source: "skillsmp.com",
        url: "https://skillsmp.com/zh",
        kind: "聚合站",
        icon: "compass",
        tags: ["中文", "GitHub 索引", "搜索"],
      },
      {
        id: "agent-skills-md",
        title: "Agent Skills",
        description: "面向通用 Agent Skill 的发现目录，可按用途浏览候选能力。",
        source: "agent-skills.md",
        url: "https://agent-skills.md/",
        kind: "聚合站",
        icon: "collection",
        tags: ["目录", "通用", "发现"],
      },
      {
        id: "skills-sh",
        title: "Skills.sh",
        description: "聚焦热门 Skill 与安装入口，适合快速查看近期活跃项目。",
        source: "skills.sh",
        url: "https://www.skills.sh/",
        kind: "聚合站",
        icon: "sparkles",
        tags: ["热门", "安装入口", "发现"],
      },
      {
        id: "skillstore",
        title: "SkillStore",
        description: "提供中文入口与资源分类，安装前仍需复核源码、权限和许可证。",
        source: "skillstore.io",
        url: "https://skillstore.io/zh-hans",
        kind: "聚合站",
        icon: "collection",
        tags: ["中文", "分类", "商店"],
      },
      {
        id: "skills-directory",
        title: "Skills Directory",
        description: "社区型 Skill 导航，适合扩展候选清单并回到源码仓库核验。",
        source: "skillsdirectory.com",
        url: "https://www.skillsdirectory.com/",
        kind: "聚合站",
        icon: "compass",
        tags: ["社区", "目录", "导航"],
      },
      {
        id: "agent-skills-me",
        title: "Agent Skills Me",
        description: "编辑精选型资源入口，用于发现后再进入原仓库进行安全审查。",
        source: "agentskills.me",
        url: "https://agentskills.me/",
        kind: "聚合站",
        icon: "sparkles",
        tags: ["精选", "导航", "发现"],
      },
    ],
  },
  {
    id: "repositories",
    title: "源码与合集",
    eyebrow: "回到原仓库核验",
    description: "优先查看维护者、提交历史、许可证、脚本与权限，再决定是否安装。",
    tone: "mint",
    icon: "github",
    resources: [
      {
        id: "anthropic-skills",
        title: "Anthropic Skills",
        description: "Anthropic 维护的公开 Skill 源码仓库，可用于理解标准结构与实践。",
        source: "github.com/anthropics",
        url: "https://github.com/anthropics/skills",
        kind: "源码库",
        icon: "github",
        tags: ["官方", "源码", "规范"],
      },
      {
        id: "vercel-agent-skills",
        title: "Vercel Agent Skills",
        description: "Vercel Labs 维护的 Agent Skill 集合，侧重开发与部署工作流。",
        source: "github.com/vercel-labs",
        url: "https://github.com/vercel-labs/agent-skills",
        kind: "源码库",
        icon: "github",
        tags: ["官方", "开发", "部署"],
      },
      {
        id: "awesome-agent-skills",
        title: "Awesome Agent Skills",
        description: "社区整理的 Skill 合集，可作为候选入口，不等同于逐项安全审计。",
        source: "github.com/JackyST0",
        url: "https://github.com/JackyST0/awesome-agent-skills",
        kind: "源码库",
        icon: "collection",
        tags: ["合集", "社区", "索引"],
      },
      {
        id: "antfu-skills",
        title: "Antfu Skills",
        description: "由 Antfu 维护的技能仓库，适合参考开发工具型 Skill 的组织方式。",
        source: "github.com/antfu",
        url: "https://github.com/antfu/skills",
        kind: "源码库",
        icon: "github",
        tags: ["开发者", "源码", "工具"],
      },
      {
        id: "agent-skills-hunter",
        title: "Agent Skills Hunter",
        description: "大型 Agent Skill 收集与发现仓库，原 Ultimate Collection 链接会跳转至此。",
        source: "github.com/ZhanlinCui",
        url: "https://github.com/ZhanlinCui/Agent-Skills-Hunter",
        kind: "源码库",
        icon: "collection",
        tags: ["合集", "发现", "源码"],
      },
    ],
  },
  {
    id: "education",
    title: "教学与教研",
    eyebrow: "面向教师工作流",
    description: "覆盖备课、差异化教学、课堂准备与教研协作的教育专用资源。",
    tone: "amber",
    icon: "school",
    resources: [
      {
        id: "education-agent-skills",
        title: "Education Agent Skills",
        description: "教育专用 Skill 库，覆盖学习科学、教学法、课程、评价与学校实践。",
        source: "github.com/GarethManning",
        url: "https://github.com/GarethManning/education-agent-skills",
        kind: "源码库",
        icon: "school",
        tags: ["教学", "教研", "学习科学"],
      },
      {
        id: "anthropic-k12-teacher-skills",
        title: "K12 Teacher Skills",
        description: "Anthropic 维护的 K12 教师 Skill 仓库，包含备课、教学设计与差异化支持。",
        source: "github.com/anthropics",
        url: "https://github.com/anthropics/k12-teacher-skills",
        kind: "源码库",
        icon: "book",
        tags: ["K12", "教师", "官方"],
      },
      {
        id: "teaching-skills-codex",
        title: "Teaching Skills for Codex",
        description: "面向大学教师教学生命周期的 Codex Skill 分发版本。",
        source: "github.com/YujxZJCN",
        url: "https://github.com/YujxZJCN/teaching-skills-codex",
        kind: "源码库",
        icon: "research",
        tags: ["Codex", "高校", "教学流程"],
      },
      {
        id: "k12-lesson-plan-creation",
        title: "K12 Lesson Plan Creation",
        description: "生成课程计划、学生材料与课堂观察模板的单项教学 Skill。",
        source: "anthropics/k12-teacher-skills",
        url: "https://github.com/anthropics/k12-teacher-skills/blob/main/plugin/skills/k12-lesson-plan-creation/SKILL.md",
        kind: "Skill 文件",
        icon: "lesson",
        tags: ["教案", "课堂材料", "观察"],
      },
      {
        id: "k12-lesson-differentiation",
        title: "K12 Lesson Differentiation",
        description: "对已有教学内容进行差异化调整的单项 Skill。",
        source: "anthropics/k12-teacher-skills",
        url: "https://github.com/anthropics/k12-teacher-skills/blob/main/plugin/skills/k12-lesson-differentiation/SKILL.md",
        kind: "Skill 文件",
        icon: "layers",
        tags: ["分层教学", "适配", "K12"],
      },
      {
        id: "agent-teacher",
        title: "Agent Teacher",
        description: "面向教学讲解与学习引导的单项 Agent Skill，可直接检查其触发说明。",
        source: "github.com/JackyYang258",
        url: "https://github.com/JackyYang258/agent-teacher/blob/main/SKILL.md",
        kind: "Skill 文件",
        icon: "school",
        tags: ["讲解", "引导", "单项 Skill"],
      },
    ],
  },
  {
    id: "curriculum",
    title: "课程与教学设计",
    eyebrow: "从目标到评价",
    description: "围绕逆向设计、课程序列、评价量规、课程对齐与教研审查形成完整链路。",
    tone: "coral",
    icon: "route",
    resources: [
      {
        id: "backwards-design-unit-planner",
        title: "Backwards Design Unit Planner",
        description: "从预期理解与学习证据反推课程单元活动和教学安排。",
        source: "education-agent-skills",
        url: "https://github.com/GarethManning/education-agent-skills/blob/main/skills/curriculum-assessment/backwards-design-unit-planner/SKILL.md",
        kind: "Skill 文件",
        icon: "route",
        tags: ["逆向设计", "单元规划", "证据"],
      },
      {
        id: "scope-and-sequence-designer",
        title: "Scope and Sequence Designer",
        description: "设计课程内容范围、学习顺序与阶段性进阶关系。",
        source: "education-agent-skills",
        url: "https://github.com/GarethManning/education-agent-skills/blob/main/skills/curriculum-assessment/scope-and-sequence-designer/SKILL.md",
        kind: "Skill 文件",
        icon: "curriculum",
        tags: ["课程序列", "进阶", "范围"],
      },
      {
        id: "criterion-referenced-rubric",
        title: "Criterion Referenced Rubric",
        description: "围绕明确标准设计量规，支持教学目标与评价证据对齐。",
        source: "education-agent-skills",
        url: "https://github.com/GarethManning/education-agent-skills/blob/main/skills/curriculum-assessment/criterion-referenced-rubric-generator/SKILL.md",
        kind: "Skill 文件",
        icon: "rubric",
        tags: ["量规", "评价", "标准"],
      },
      {
        id: "curriculum-crosswalk",
        title: "Curriculum Crosswalk",
        description: "比较课程框架中的目标与覆盖关系，辅助识别缺口和重复。",
        source: "education-agent-skills",
        url: "https://github.com/GarethManning/education-agent-skills/blob/main/skills/curriculum-alignment/curriculum-crosswalk/SKILL.md",
        kind: "Skill 文件",
        icon: "layers",
        tags: ["课程对齐", "框架", "缺口"],
      },
      {
        id: "panel-review",
        title: "Curriculum Panel Review",
        description: "用多角色结构化方式审阅课程框架、目标定义和评价设计。",
        source: "education-agent-skills",
        url: "https://github.com/GarethManning/education-agent-skills/blob/main/skills/professional-learning/panel-review/SKILL.md",
        kind: "Skill 文件",
        icon: "research",
        tags: ["教研审查", "课程框架", "质量"],
      },
      {
        id: "curriculum-developer",
        title: "Curriculum Developer",
        description: "面向课程结构、目标和内容开发的通用教育 Skill。",
        source: "mcroitor/agent-skills-library",
        url: "https://github.com/mcroitor/agent-skills-library/blob/main/education/curriculum-developer/SKILL.md",
        kind: "Skill 文件",
        icon: "curriculum",
        tags: ["课程开发", "目标", "内容"],
      },
      {
        id: "learning-path-designer",
        title: "Learning Path Designer",
        description: "根据学习目标与前置关系设计可执行的学习路径。",
        source: "mcroitor/agent-skills-library",
        url: "https://github.com/mcroitor/agent-skills-library/blob/main/education/learning-path-designer/SKILL.md",
        kind: "Skill 文件",
        icon: "route",
        tags: ["学习路径", "先修关系", "规划"],
      },
      {
        id: "rubric-designer",
        title: "Rubric Designer",
        description: "辅助构建评价维度、表现描述与评分标准的单项 Skill。",
        source: "mcroitor/agent-skills-library",
        url: "https://github.com/mcroitor/agent-skills-library/blob/main/education/rubric-designer/SKILL.md",
        kind: "Skill 文件",
        icon: "rubric",
        tags: ["量规", "评分", "评价"],
      },
    ],
  },
];

export const SKILL_LIBRARY_RESOURCE_COUNT = SKILL_LIBRARY_SECTIONS.reduce(
  (total, section) => total + section.resources.length,
  0,
);
