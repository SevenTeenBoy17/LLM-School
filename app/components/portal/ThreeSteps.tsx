/**
 * ThreeSteps — 「三步上手」区块（启动成本消解器）。
 *
 * 它回答的是教师最敏感、而本页此前完全没答的一个问题：**我今晚能不能用上。**
 * 研究把这个区块列为拉开首页分差的关键项——教师群体对新工具的时间成本极度敏感，
 * 一个能数得清步数的流程，比十句「高效易用」都管用。
 *
 * 三条纪律：
 *
 * 1. **步骤名取自实现，不是营销话术。** 这三步就是 components/research/PrepWizard.tsx
 *    里 STEPS 常量的三项（选模板 / 填必填项 / 预览并开始）——教师照着这一节的描述
 *    进平台，看到的步骤条上写的是同样三个词。若那个常量改了，这里必须跟着改：
 *    这是铁律②在本组件的落点（页面不得描述一个产品里不存在的流程）。
 *
 * 2. **每步写清「你拿到什么」而不是「系统做了什么」。** 前者是教师的语言，
 *    后者是产品经理的语言。
 *
 * 3. **不放数字。** 没有「3 分钟出教案」这类承诺——我们没有测过，编一个就是
 *    首屏那条纪律（一处编造会连累整页的安全承诺）的自我背叛。
 *
 * 待补（如实记录，不假装已完成）：研究建议每步配一张该步骤的真实界面裁图。
 * 本轮未拍——scripts/shoot-portal-shots.mjs 目前只覆盖四张整页实拍，
 * 加三张向导分步图需要新增「走到第 N 步再截」的采集逻辑与收边判定。
 * 在图拍好之前，这一节用序号 + 文字承担，不放占位图（空图框比没有图更糟）。
 */

interface Step {
  /** 与 PrepWizard 的 STEPS 常量逐字一致 */
  name: string;
  /** 这一步教师实际做什么 */
  action: string;
  /** 做完这一步手里有什么 */
  outcome: string;
}

const STEPS: Step[] = [
  {
    name: "选模板",
    action: "从提示词中心挑一个贴近你这节课的模板",
    outcome: "拿到一份已经写好结构的提问框架，不用从空白开始",
  },
  {
    name: "填必填项",
    action: "填学段、课题、课标依据这些只有你知道的信息",
    outcome: "AI 拿到的是你这个班的约束，不是通用条件",
  },
  {
    name: "预览并开始",
    action: "看一眼渲染后的完整提问，确认无误再发出",
    outcome: "一份可以直接改的初稿；不满意就追问，比重写快",
  },
];

export function ThreeSteps() {
  return (
    <section
      id="how-to-start"
      aria-labelledby="how-to-start-heading"
      className="w-full bg-[var(--bg)] py-[var(--sec-y-lg)]"
    >
      <div className="mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]">
        <header className="portal-reveal max-w-[var(--measure-lg)]">
          <p className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-accent)]">
            上手路径
          </p>
          <h2
            id="how-to-start-heading"
            className="mt-[var(--gap-after-eyebrow)] text-[length:var(--fs-d2)] font-bold leading-[var(--lh-d)] text-[var(--text)]"
          >
            备一节课，三步
          </h2>
          <p className="mt-[var(--gap-para)] text-[16px] leading-relaxed text-[var(--text-2)]">
            这三步就是教师端备课向导里的三步，名字都没换。不需要先培训，也不需要先学怎么写提示词。
          </p>
        </header>

        <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.name}
              className="relative rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)] p-6"
            >
              {/* 序号走 --font-num（等宽数字）：门户此前零使用这条字轨。
                  字号从既有七档里挑 28px，不为序号新增第八档。 */}
              <span
                aria-hidden
                className="text-num text-[28px] font-bold leading-none text-[var(--portal-accent)]"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 text-[16px] font-bold text-[var(--text)]">{step.name}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-[var(--text-2)]">
                {step.action}
              </p>
              <p className="mt-4 border-t border-[var(--border-2)] pt-3 text-[14px] leading-relaxed text-[var(--text-3)]">
                这一步之后：{step.outcome}
              </p>
            </li>
          ))}
        </ol>

        {/* 三级转化点：文字链不做按钮化，不与首屏/页尾的两处主 CTA 抢权重。 */}
        <a
          href="/login"
          className="mt-8 inline-flex min-h-[24px] items-center gap-1 text-[16px] font-semibold text-[var(--portal-accent)] underline-offset-4 hover:underline"
        >
          进入平台，从第一步开始 →
        </a>
      </div>
    </section>
  );
}
