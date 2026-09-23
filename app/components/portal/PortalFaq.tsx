import type { ReactNode } from "react";

/**
 * PortalFaq — 门户的问答承压层（锚点 #faq）。
 *
 * 为什么需要它：本页在这一轮之前是「简洁但不完备」——6 个区块读起来很干净，
 * 代价是几个真实问题一个都没答（账号哪来、推理出校是什么意思、每天能用多少次、
 * 答错了算谁的、为什么不能传附件、家长能不能看到）。家长和新教师一定会问，
 * 不答不等于问题不存在，只等于他们带着疑问离开。折叠区的价值就是让这些答案
 * 有处可去而不撑破节奏。
 *
 * 四条硬约束：
 *
 * 1. **用原生 details/summary，不自造 aria-expanded 组件。** 原生元素免费带来
 *    键盘（Enter/Space）、读屏（已折叠/已展开）与浏览器内查找（Ctrl+F 能命中
 *    折叠内容并自动展开）三件事，自造的一个都拿不到。
 *
 * 2. **安全内容零条进折叠（铁律）。** 危机识别、求助路径、12356、自伤相关一律
 *    不进这里——给未成年人的规则折叠一次就等于少一半人看见（与 TrustSafety
 *    「刻意不做成手风琴」同一条纪律）。本文件的答案只含账号、配额、数据流向
 *    这类程序性信息；安全承诺留在 #safety 常驻可见。
 *
 * 3. **展开动效不用 max-height 魔数。** 猜大了有空转尾巴，猜小了内容被截断。
 *    用 details::details-content + interpolate-size（见 globals.css），
 *    不支持的浏览器仍能正常开合，只是没有滑动过渡——降级方向是「少一个动效」
 *    而不是「内容出不来」。
 *
 * 4. **答案只写实现真做到的事。** 每条答案上方的注释标了它的事实来源文件；
 *    实现改了这里必须跟着改。这是铁律②在本组件的落点——同一类错已在配额口径
 *    上犯过一次（页面写「排队」而实现是每日上限）。
 */

type Faq = { q: string; a: ReactNode; group: string };

const FAQS: Faq[] = [
  {
    group: "账号与开通",
    q: "我怎么拿到账号？",
    // 事实来源：PortalFooter 结尾 CTA 下的小字；/login 只有登录表单，无自助注册入口。
    a: (
      <>
        账号由学校统一下发，页面上没有自助注册入口。老师和学生都联系班主任或学校信息中心开通；
        拿到账号后从页面右上角的「进入平台」登录即可，不需要另外安装什么。
      </>
    ),
  },
  {
    group: "账号与开通",
    q: "学校还没接入，可以先自己试试吗？",
    // 事实来源：本项目无试用/自助开通通道。不虚构「预约演示」这类不存在的路径。
    a: (
      <>
        暂时不行——平台按学校为单位部署，没有面向个人的试用通道。
        如果你想推动学校接入，这一页可以直接打印带给信息中心或家长会（页脚有「打印这一页」），
        上面写的边界与数据流向就是需要他们过目的内容。
      </>
    ),
  },
  {
    group: "数据与推理",
    q: "「经加密通道调用校外大模型」到底是什么意思？",
    // 事实来源：SafetyHelp.tsx 的站内披露 + TrustSafety 数据卡。存储在校内 / 计算在校外，分开说。
    a: (
      <>
        存储和计算是两件事。你的对话、作业与错题<strong>存放在学校自有环境</strong>；
        但生成回答这一步需要算力，平台会把这次提问经加密通道送到校外的大模型服务算完再送回来。
        送出去的内容只用于生成这一次的回答，不进入任何模型的训练集，也不做其他用途。
        我们把这件事单独写出来，是因为只说「数据在校内」会让人误以为计算也在校内。
      </>
    ),
  },
  {
    group: "数据与推理",
    q: "老师能看到学生和 AI 的对话原文吗？",
    // 事实来源：db.ts「学生本人数据，教师端仅去标识聚类计数」+ class 页「不含任何原文与姓名」。
    a: (
      <>
        看不到原文。学生的对话与错题属于学生本人，教师端拿到的是<strong>去标识的聚类计数</strong>——
        按「学科 × 知识点」聚合出哪些地方错得多，不含任何原文，也不带姓名。
        这样老师能定位补差重点，又不会变成翻看学生私下问了什么。
      </>
    ),
  },
  {
    group: "数据与推理",
    q: "家长能看到孩子的使用情况吗？",
    // 事实来源：lib/types.ts 角色枚举里没有 parent；guardian_settings 由学校/班主任设定。
    a: (
      <>
        平台没有家长账号这个角色，家长不能登录查看对话内容。
        与家长相关的是「守护」——使用时段与每日上限由学校或班主任设定，学生端会明示当前处于守护状态。
        想了解孩子的使用情况，目前的路径是问班主任，而不是自己登录查。
      </>
    ),
  },
  {
    group: "使用额度",
    q: "每天能用多少次？用完了怎么办？",
    // 事实来源：app/api/chat/route.ts 配额门（每人每模型每日上限，超额提示次日恢复、可换模型）。
    a: (
      <>
        每人每天在每个模型上都有固定的使用次数，具体数值由学校管理员设定，教师和学生的额度可以不同。
        用完后当天不再增加，会提示<strong>次日恢复</strong>，也可以换一个模型继续用。
        这不是付费墙——平台不收费，也没有「花钱买更多次数」这个选项。
      </>
    ),
  },
  {
    group: "能力边界",
    q: "为什么不支持上传附件？",
    // 事实来源：Composer.tsx 的常驻披露 data-safety-critical="no-upload"。
    a: (
      <>
        因为附件是最容易把不该外传的东西一次性带出去的通道——一张试卷照片、一份学生名单，
        送进模型就收不回来了。目前只接受手动输入的文字；需要引用校内资料时走「知识库」检索，
        由平台在校内范围内取材。
      </>
    ),
  },
  {
    group: "能力边界",
    q: "AI 答错了算谁的？",
    // 事实来源：MessageBubble.tsx 的降级整句提示（学生版/教师版分写）。
    a: (
      <>
        算使用者的——这不是推卸，是它现在的定位：它出初稿，你做判断。
        平台能做的是把不确定说在前面：当一条回答没有经过外部模型（走了校内兜底）时，
        回答下方会有一整句提示告诉你它可能不准，而不是用一个小灰字标记糊弄过去。
        涉及成绩、评价与对外发布的内容，请人工复核后再用。
      </>
    ),
  },
  {
    group: "能力边界",
    q: "它会帮学生把作业写完吗？",
    // 事实来源：TrustSafety「分学段的内容边界」+ 诚信脚手架（integrity-scaffold）。
    a: (
      <>
        不会。遇到「帮我把这篇作文写出来」这类请求，它会转成引导思路与方法，不产出可以直接交上去的成品。
        学生问作业题时得到的是「先拆解 / 走第一步 / 你来试」，最后一句写在回答里：
        不会替你写完整答案，但会陪你想明白。
      </>
    ),
  },
];

/** 分组顺序固定：先解决「能不能用」，再解决「用了之后数据去哪」，最后是「它能做到什么程度」。 */
const GROUP_ORDER = ["账号与开通", "数据与推理", "使用额度", "能力边界"] as const;

export function PortalFaq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="w-full bg-[var(--bg)] py-[var(--sec-y-md)]"
    >
      {/* 窄栏而不是全宽：宽度变化本身就是区块转场信号（零动效手法），
          且问答是纯阅读内容，1280 宽的行长读起来很累。 */}
      <div className="mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]">
        <div className="mx-auto max-w-[var(--measure-lg)]">
          <header className="portal-reveal">
            <p className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-accent)]">
              还想问的
            </p>
            <h2
              id="faq-heading"
              className="mt-[var(--gap-after-eyebrow)] text-[length:var(--fs-d2)] font-bold leading-[var(--lh-d)] text-[var(--text)]"
            >
              真实会被问到的九个问题
            </h2>
            <p className="mt-[var(--gap-para)] text-[16px] leading-relaxed text-[var(--text-2)]">
              下面每一条答案都对着实现写，不写平台做不到的事。
              涉及危机求助的内容不在这里折叠——它常驻在上一节，不需要点开。
            </p>
          </header>

          <div className="mt-10 space-y-8">
            {GROUP_ORDER.map((group) => (
              <div key={group}>
                <h3 className="text-[14px] font-semibold tracking-[0.05em] text-[var(--text-3)]">
                  {group}
                </h3>
                <ul className="mt-3 space-y-2">
                  {FAQS.filter((f) => f.group === group).map((faq) => (
                    <li key={faq.q}>
                      <details className="portal-faq rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)]">
                        {/* min-h 写绝对像素：根字号 14px 下 rem 档位不落整数，
                            而这是触控目标（≥44px 是移动端可点的下限）。 */}
                        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-[16px] font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">
                          <span>{faq.q}</span>
                          {/* 箭头用文字三角而不是图标组件：这一个字符不值得引入一个
                              client 组件，本区块整体是静态服务端渲染。 */}
                          <span
                            aria-hidden
                            className="portal-faq-caret shrink-0 text-[16px] text-[var(--text-3)] transition-transform duration-[var(--t-base)] ease-[var(--ease-out)] motion-reduce:transition-none"
                          >
                            ▾
                          </span>
                        </summary>
                        <div className="px-5 pb-5 text-[16px] leading-relaxed text-[var(--text-2)]">
                          {faq.a}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
