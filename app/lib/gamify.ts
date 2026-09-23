/**
 * W-B4 · 徽章与庄园目录（规格⑧⑨，单一真相源，服务端与客户端共用）。
 * 判据确定性（规格⑧-1）：每枚徽章绑定**可追溯的真实平台事件流**，口径为个人绝对量，
 * 详情可展开「凭什么获得」；绝不用相对位次（红线 R1 禁排行榜）。
 * 阶梯（动森 10/100 启示）：首档开箱即中（threshold=1），长线目标刻意稀缺。
 * 庄园（规格⑨）：纯几何部件（Monument Valley 语言）、明码标价确定性兑换（禁抽卡/禁付费/禁限时）。
 */

export type BadgeEvent = "quiz_answered" | "mistake_reviewed" | "activity_approved" | "eval_positive" | "active_days" | "ai_question" | "image_created" | "peer_like" | "class_contrib";

export const EVENT_LABEL: Record<BadgeEvent, string> = {
  quiz_answered: "完成随堂小测",
  mistake_reviewed: "清理错题",
  activity_approved: "项目活动入册",
  eval_positive: "获得老师正向点评",
  active_days: "有学习记录的天数",
  ai_question: "向 AI 学伴提问",
  image_created: "完成 AI 生图作品",
  peer_like: "给同学的庄园点赞",
  class_contrib: "为班级共建认捐",
};

export interface BadgeDef {
  id: string; name: string; desc: string;
  tier: 1 | 2 | 3 | 4 | 5; // 稀有度金字塔：1 尘埃 → 5 恒星（天体隐喻契合现有轨道视觉）
  event: BadgeEvent; threshold: number;
}

export const TIER_NAME: Record<number, string> = { 1: "尘埃", 2: "卫星", 3: "行星", 4: "彗星", 5: "恒星" };

/** H9 · 徽章系列目录：7 个系列× 5 档 = 35 枚；系列与事件流 1:1，墙面按此分组渲染。 */
export const SERIES_ORDER: BadgeEvent[] = ["quiz_answered", "mistake_reviewed", "activity_approved", "eval_positive", "active_days", "ai_question", "image_created", "peer_like", "class_contrib"];
export const SERIES_META: Record<BadgeEvent, { name: string; blurb: string; mascot: string; lore: string }> = {
  quiz_answered: { name: "随堂小测", blurb: "每道小测都在帮你认识自己的正确率", mascot: "答答",
    lore: "来自笔尖星云的铅笔火箭。每答完一道小测，它的尾焰就亮一分——它相信答错也是燃料。" },
  mistake_reviewed: { name: "错题清理", blurb: "回头看错的地方，是最快的进步", mascot: "补丁",
    lore: "肚皮上缝着星形补丁的小怪兽。每清掉一道错题，它就把补丁磨亮一点——它说，补过的地方比原来更结实。" },
  activity_approved: { name: "项目作品", blurb: "把想法做成作品，入册留档", mascot: "册册",
    lore: "一本会走路的档案夹，最喜欢收藏你做完的作品。每入册一件，它怀里的星星就多一颗。" },
  eval_positive: { name: "课堂点评", blurb: "被老师看见的瞬间", mascot: "小灯",
    lore: "灯笼肚子的萤火虫宝宝。每次你的努力被老师看见，它的灯就亮一分——它负责记住每一个被点亮的瞬间。" },
  active_days: { name: "学习足迹", blurb: "有学习记录的每一天都算数", mascot: "陀陀",
    lore: "背着小星球赶路的乌龟。它走得不快，但每一天的脚印都算数——光环会随你坚持的日子越变越亮。" },
  ai_question: { name: "勤学好问", blurb: "提出问题，就是思考的开始", mascot: "奇奇",
    lore: "一只永远在举手的小章鱼，触手会卷成问号。它相信每个问题都是一颗小星星，攒多了就是自己的星云。" },
  image_created: { name: "AI 创作", blurb: "用 AI 画出你的想象", mascot: "彩彩",
    lore: "尾巴是画笔的小变色龙，蘸的不是颜料，是想象力。你每画一幅，它身上的颜色就多一种。" },
  peer_like: { name: "同学互助", blurb: "去同学的庄园串串门", mascot: "暖暖",
    lore: "揣着小爱心的圆企鹅，最喜欢串门。你每去同学的庄园点亮一颗赞，它的围巾就暖一度——温暖是会传染的。" },
  class_contrib: { name: "班级共建", blurb: "大家的图书角，一块砖一块砖攒出来", mascot: "砖砖",
    lore: "戴安全帽的小海狸，班级共建的工地主管。你每认捐一次，它就多垒一块砖——点亮的建筑属于每一个人。" },
};

export const BADGES: BadgeDef[] = [
  // H9/H11：9 系列 × 5 档 = 45 枚。既有 id/名字/阈值一律原样保留（已授予不受影响）。
  // 小测线
  { id: "quiz-1", name: "第一问", desc: "完成第 1 道随堂小测——从这里开始认识自己的正确率。", tier: 1, event: "quiz_answered", threshold: 1 },
  { id: "quiz-10", name: "十题在手", desc: "累计完成 10 道随堂小测。", tier: 2, event: "quiz_answered", threshold: 10 },
  { id: "quiz-50", name: "题海行星", desc: "累计完成 50 道随堂小测。", tier: 3, event: "quiz_answered", threshold: 50 },
  { id: "quiz-100", name: "百题彗星", desc: "累计完成 100 道随堂小测——百题之后，正确率曲线开始说话。", tier: 4, event: "quiz_answered", threshold: 100 },
  { id: "quiz-200", name: "小测恒星", desc: "累计完成 200 道随堂小测——长线目标，不急。", tier: 5, event: "quiz_answered", threshold: 200 },
  // 错题清理线
  { id: "fix-1", name: "第一次回头", desc: "清理第 1 道错题——回头看错的地方，是最快的进步。", tier: 1, event: "mistake_reviewed", threshold: 1 },
  { id: "fix-10", name: "补丁卫星", desc: "累计清理 10 道错题。", tier: 2, event: "mistake_reviewed", threshold: 10 },
  { id: "fix-25", name: "磨亮行星", desc: "累计清理 25 道错题。", tier: 3, event: "mistake_reviewed", threshold: 25 },
  { id: "fix-50", name: "薄弱点猎手", desc: "累计清理 50 道错题。", tier: 4, event: "mistake_reviewed", threshold: 50 },
  { id: "fix-100", name: "化错恒星", desc: "累计清理 100 道错题——把错过的题，都变成自己的题。", tier: 5, event: "mistake_reviewed", threshold: 100 },
  // 项目线
  { id: "proj-1", name: "初次入册", desc: "第 1 个项目活动通过老师批阅、进入档案袋。", tier: 1, event: "activity_approved", threshold: 1 },
  { id: "proj-3", name: "三件在册", desc: "累计 3 个项目活动入册。", tier: 2, event: "activity_approved", threshold: 3 },
  { id: "proj-5", name: "项目行星", desc: "累计 5 个项目活动入册。", tier: 3, event: "activity_approved", threshold: 5 },
  { id: "proj-10", name: "佳作彗星", desc: "累计 10 个项目活动入册。", tier: 4, event: "activity_approved", threshold: 10 },
  { id: "proj-20", name: "作品恒星", desc: "累计 20 个项目活动入册。", tier: 5, event: "activity_approved", threshold: 20 },
  // 课堂点评线
  { id: "eval-1", name: "被看见", desc: "第 1 次获得老师正向点评。", tier: 1, event: "eval_positive", threshold: 1 },
  { id: "eval-3", name: "被点亮", desc: "累计 3 次老师正向点评。", tier: 2, event: "eval_positive", threshold: 3 },
  { id: "eval-6", name: "闪光行星", desc: "累计 6 次老师正向点评。", tier: 3, event: "eval_positive", threshold: 6 },
  { id: "eval-10", name: "课堂彗星", desc: "累计 10 次老师正向点评。", tier: 4, event: "eval_positive", threshold: 10 },
  { id: "eval-25", name: "常亮恒星", desc: "累计 25 次老师正向点评——长线目标，不急。", tier: 5, event: "eval_positive", threshold: 25 },
  // 坚持线（学习产出天数，非在线时长）
  { id: "days-3", name: "三天小步", desc: "累计 3 天有学习记录。", tier: 1, event: "active_days", threshold: 3 },
  { id: "days-7", name: "七日环轨", desc: "累计 7 天有学习记录。", tier: 2, event: "active_days", threshold: 7 },
  { id: "days-30", name: "月轨行星", desc: "累计 30 天有学习记录。", tier: 3, event: "active_days", threshold: 30 },
  { id: "days-100", name: "百日长轨", desc: "累计 100 天有学习记录。", tier: 4, event: "active_days", threshold: 100 },
  { id: "days-200", name: "四季恒星", desc: "累计 200 天有学习记录——差不多就是完整的一学年。", tier: 5, event: "active_days", threshold: 200 },
  // 提问线（chat 真实 user 消息计数）
  { id: "ask-1", name: "第一次举手", desc: "向 AI 学伴提出第 1 个问题——提问就是思考的开始。", tier: 1, event: "ai_question", threshold: 1 },
  { id: "ask-20", name: "追问卫星", desc: "累计向 AI 学伴提问 20 次。", tier: 2, event: "ai_question", threshold: 20 },
  { id: "ask-60", name: "好奇行星", desc: "累计向 AI 学伴提问 60 次。", tier: 3, event: "ai_question", threshold: 60 },
  { id: "ask-150", name: "十万个为什么", desc: "累计向 AI 学伴提问 150 次。", tier: 4, event: "ai_question", threshold: 150 },
  { id: "ask-400", name: "求索恒星", desc: "累计向 AI 学伴提问 400 次——长线目标，不急。", tier: 5, event: "ai_question", threshold: 400 },
  // AI 创作线（生图 done 计数）
  { id: "img-1", name: "第一笔", desc: "完成第 1 幅 AI 生图作品。", tier: 1, event: "image_created", threshold: 1 },
  { id: "img-5", name: "涂鸦卫星", desc: "累计完成 5 幅 AI 生图作品。", tier: 2, event: "image_created", threshold: 5 },
  { id: "img-15", name: "脑洞行星", desc: "累计完成 15 幅 AI 生图作品。", tier: 3, event: "image_created", threshold: 15 },
  { id: "img-40", name: "灵感彗星", desc: "累计完成 40 幅 AI 生图作品。", tier: 4, event: "image_created", threshold: 40 },
  { id: "img-100", name: "造梦恒星", desc: "累计完成 100 幅 AI 生图作品——长线目标，不急。", tier: 5, event: "image_created", threshold: 100 },
  // 同学互助线（H11 新增：给出的庄园赞计数——manor_likes.visitorId）
  { id: "like-1", name: "第一个赞", desc: "第 1 次给同学的庄园点赞——温暖从一个赞开始。", tier: 1, event: "peer_like", threshold: 1 },
  { id: "like-10", name: "暖心卫星", desc: "累计给同学的庄园点了 10 个赞。", tier: 2, event: "peer_like", threshold: 10 },
  { id: "like-30", name: "友爱行星", desc: "累计给同学的庄园点了 30 个赞。", tier: 3, event: "peer_like", threshold: 30 },
  { id: "like-80", name: "互助彗星", desc: "累计给同学的庄园点了 80 个赞。", tier: 4, event: "peer_like", threshold: 80 },
  { id: "like-180", name: "暖阳恒星", desc: "累计给同学的庄园点了 180 个赞——长线目标，不急。", tier: 5, event: "peer_like", threshold: 180 },
  // 班级共建线（H11 新增：认捐次数——class_build_contrib.userId）
  { id: "build-1", name: "添第一砖", desc: "第 1 次为班级共建认捐积分——添上你的第一块砖。", tier: 1, event: "class_contrib", threshold: 1 },
  { id: "build-5", name: "筑基卫星", desc: "累计为班级共建认捐 5 次。", tier: 2, event: "class_contrib", threshold: 5 },
  { id: "build-15", name: "垒墙行星", desc: "累计为班级共建认捐 15 次。", tier: 3, event: "class_contrib", threshold: 15 },
  { id: "build-40", name: "栋梁彗星", desc: "累计为班级共建认捐 40 次。", tier: 4, event: "class_contrib", threshold: 40 },
  { id: "build-100", name: "灯塔恒星", desc: "累计为班级共建认捐 100 次——长线目标，不急。", tier: 5, event: "class_contrib", threshold: 100 },
];

/**
 * 积分规则（规格⑨-2：每分可解释 + 每类行为日上限防刷；产分全部挂既有学习动线末端）。
 * 日常满产 ≈ 5×10 + 10×5 + 30 + 10×3 = 160 分/天；最小件 60 分 ≈ 0.5~1 天，对齐数值基准。
 */
export const POINT_RULES: Record<BadgeEvent, { per: number; dayCap: number; reason: string }> = {
  quiz_answered: { per: 5, dayCap: 10, reason: "完成 1 道随堂小测 = +5" },
  mistake_reviewed: { per: 10, dayCap: 5, reason: "清理 1 道错题 = +10" },
  activity_approved: { per: 30, dayCap: 1, reason: "1 个项目活动入册 = +30" },
  eval_positive: { per: 10, dayCap: 3, reason: "1 次老师正向点评 = +10" },
  active_days: { per: 0, dayCap: 0, reason: "" }, // 天数只用于徽章，不产分（不奖励挂机）
  ai_question: { per: 0, dayCap: 0, reason: "" }, // 提问只计徽章不产分（产分会奖励刷问）
  image_created: { per: 0, dayCap: 0, reason: "" }, // 生图只计徽章不产分（配额之外不再加刷图动机）
  peer_like: { per: 0, dayCap: 0, reason: "" }, // 点赞只计徽章不产分（产分会催生刷赞换分）
  class_contrib: { per: 0, dayCap: 0, reason: "" }, // 认捐本身是花积分的公益动作，不再回流产分
};

/** 庄园部件：纯几何语言（圆/方/三角/梯形），价格明码标价、确定性获得（R4 禁抽卡）。 */
export interface ManorPart {
  id: string; name: string; price: number;
  kind: "tree" | "bush" | "flower" | "pond" | "path" | "bench" | "house" | "tower" | "library";
  w: number; h: number; // 占地格数（网格 10×6）
}

export const MANOR_PARTS: ManorPart[] = [
  { id: "flower", name: "三色花圃", price: 60, kind: "flower", w: 1, h: 1 },
  { id: "bush", name: "圆丘灌木", price: 60, kind: "bush", w: 1, h: 1 },
  { id: "path", name: "石板小径", price: 60, kind: "path", w: 1, h: 1 },
  { id: "tree", name: "三角松", price: 120, kind: "tree", w: 1, h: 2 },
  { id: "bench", name: "梯形长椅", price: 150, kind: "bench", w: 2, h: 1 },
  { id: "pond", name: "圆镜池塘", price: 200, kind: "pond", w: 2, h: 2 },
  { id: "house", name: "方顶小屋", price: 500, kind: "house", w: 2, h: 2 },
  { id: "tower", name: "了望塔", price: 800, kind: "tower", w: 1, h: 3 },
  // 地标：积分之外还要求徽章数（积分可花/徽章不可花分轨，荣誉不被消费掉——规格⑨-2）
  { id: "library", name: "小图书馆", price: 1200, kind: "library", w: 3, h: 2 },
];

/**
 * 学科作物不是“换皮积分商品”：每一种都绑定一种明确、可解释的解锁证据。
 * 除 points 外，其余通道只读取既有真实学习事件；永久解锁，不设过期、概率或倒计时。
 */
export type CropUnlock =
  | { kind: "starter" }
  | { kind: "points"; cost: number }
  | { kind: "teacher"; need: number }
  | { kind: "quest"; need: number }
  | { kind: "explore"; need: number }
  | { kind: "badge"; need: number };

export interface ManorCrop {
  id: "wheat" | "tomato" | "bean" | "rice" | "sunflower" | "bamboo";
  name: string;
  subject: string;
  unlock: CropUnlock;
  knowledge: string;
  prompt: string;
}

export const MANOR_CROPS: ManorCrop[] = [
  {
    id: "wheat", name: "时间麦穗", subject: "数学",
    unlock: { kind: "starter" },
    knowledge: "观察同一株麦穗的籽粒分组，用乘法与估算描述总量。",
    prompt: "先选一块田种下它；真实学习成果会变成学习雨露。",
  },
  {
    id: "tomato", name: "光谱番茄", subject: "科学",
    unlock: { kind: "teacher", need: 1 },
    knowledge: "比较光照条件与果实颜色，练习提出变量、记录证据和解释变化。",
    prompt: "获得 1 次教师正向点评后永久解锁。",
  },
  {
    id: "bean", name: "攀援豆", subject: "生物",
    unlock: { kind: "explore", need: 2 },
    knowledge: "沿着藤蔓辨认茎、叶和向性，思考植物怎样寻找支撑与光。",
    prompt: "累计收获 2 次作物后，通过探索永久解锁。",
  },
  {
    id: "rice", name: "水纹稻", subject: "地理",
    unlock: { kind: "quest", need: 1 },
    knowledge: "把水稻生长与气候、水源和地形联系起来，理解农业的地域条件。",
    prompt: "完成 1 个通过教师批阅的项目任务后永久解锁。",
  },
  {
    id: "sunflower", name: "向光葵", subject: "物理",
    unlock: { kind: "badge", need: 3 },
    knowledge: "用太阳位置和影子方向描述一天中的光照变化。",
    prompt: "获得 3 枚数字徽章后永久解锁，徽章不会被扣除。",
  },
  {
    id: "bamboo", name: "词语竹", subject: "语文",
    unlock: { kind: "points", cost: 120 },
    knowledge: "每一节竹节收藏一个新词：词义、例句与自己的联想缺一不可。",
    prompt: "用 120 学习积分确定性兑换，获得后可以反复种植。",
  },
];

export const MANOR_PLOT_COUNT = 24;
export const MANOR_CROP_STAGE_MAX = 3;
/** 新手可立即体验一次完整成长，不需要先为界面“打工”。 */
export const MANOR_STARTER_GROWTH_ENERGY = 3;

/**
 * 周协作副本（规格⑧-3 Friends Quest 模式）：全班共享一条进度条，
 * **不显示任何个人贡献占比或排序**（R1）；只有共同输出，没有集体惩罚——
 * 达标全员 +20，不达标什么都不发生（无连坐掉血）。
 * 周窗口 = Unix 周纪元对齐的 7 天段（确定性可复算）；目标随名册人数缩放。
 */
export const WEEKLY_QUESTS: Array<{ event: BadgeEvent; label: string; perStudent: number }> = [
  { event: "quiz_answered", label: "全班一起完成随堂小测", perStudent: 5 },
  { event: "mistake_reviewed", label: "全班一起清理错题", perStudent: 3 },
  { event: "activity_approved", label: "全班一起完成项目入册", perStudent: 1 },
];
export const WEEKLY_BONUS = 20;
export const WEEK_MS = 7 * 86_400_000;

/**
 * 月度剧情副本（规格⑧-3 Habitica quest line）：章节化长线目标，
 * 三个目标全部达成 → +50 积分 + 赠一件庄园建材（收藏产出，非消耗）。
 * 目标全部绑定当月真实事件计数；按月份轮换章节文案。
 */
export interface MonthChapter {
  id: string; name: string; story: string;
  goals: Array<{ event: BadgeEvent; need: number; label: string }>;
  giftPart: string;
}
export const MONTH_CHAPTERS: MonthChapter[] = [
  {
    id: "observer", name: "观察者之路", story: "这个月，练习把世界看仔细——小步提问、回头订正、留下一份自己的记录。",
    goals: [
      { event: "quiz_answered", need: 10, label: "完成 10 道随堂小测" },
      { event: "mistake_reviewed", need: 5, label: "清理 5 道错题" },
      { event: "activity_approved", need: 1, label: "1 个项目活动入册" },
    ],
    giftPart: "flower",
  },
  {
    id: "builder", name: "修筑者之月", story: "这个月，把学到的东西垒起来——多做几道题，把错的补牢，交出一份作品。",
    goals: [
      { event: "quiz_answered", need: 15, label: "完成 15 道随堂小测" },
      { event: "mistake_reviewed", need: 8, label: "清理 8 道错题" },
      { event: "activity_approved", need: 1, label: "1 个项目活动入册" },
    ],
    giftPart: "bush",
  },
];
export const CHAPTER_BONUS = 50;

/**
 * 班级共建（规格⑨-4 学期尺度公共意义）：全班自愿认捐积分点亮公共建筑。
 * 正和博弈：只显示集体总进度，**无认捐名单/占比/排序**（R1）；点亮后全班共有。
 * 顺序解锁：完成一座才开下一座，对齐学期节点。
 */
export const CLASS_BUILDS: Array<{ id: string; name: string; desc: string; cost: number; kind: "flowerbed" | "library-corner" }> = [
  { id: "flowerbed", name: "班级花坛", desc: "教室窗台下的第一块公共绿地——谁浇的水不重要，花开了大家一起看。", cost: 800, kind: "flowerbed" },
  { id: "library-corner", name: "班级图书角", desc: "一起攒出来的读书角落——点亮后它属于每一个人。", cost: 2000, kind: "library-corner" },
];

export const MANOR_GRID = { w: 10, h: 6 };
/** 地标部件的徽章门槛：需要已获得 ≥N 枚徽章（不扣徽章，只作资格）。 */
export const LANDMARK_BADGE_GATE: Record<string, number> = { library: 15, tower: 10 };  // H10：目录 14→35 枚后等比上调（43%/29% 占比不变），恢复地标稀缺
/** 首次进入即赠（禁空地块「先打工」冷启动，规格⑨-4）。 */
export const STARTER_PARTS = ["tree", "flower", "path"];
