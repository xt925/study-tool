/**
 * 成就 / 徽章定义。
 *
 * 每个徽章只描述「达成条件」，不在数据里写死。是否解锁由进度 store 根据
 * AchievementContext（从当前进度算出来）判断，解锁后记录到 achievements 里。
 */

/** 从进度中提炼出的、用于判断成就的指标 */
export interface AchievementContext {
  stars: number
  /** 已学单词数 */
  learnedCount: number
  /** 已完成单元数 */
  completedUnitCount: number
  /** 历史最长连续打卡天数 */
  maxStreak: number
  /** 复习到「掌握」阶段的单词数 */
  masteredCount: number
  /** 跟读评分次数 */
  speechCount: number
}

export interface AchievementDef {
  id: string
  emoji: string
  name: string
  description: string
  /** measure(ctx) 达到 goal 即解锁 */
  goal: number
  measure: (ctx: AchievementContext) => number
}

/** 复习等级达到这个 stage 视为「掌握」 */
export const MASTERED_STAGE = 3

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-word',
    emoji: '🌱',
    name: '初次见面',
    description: '学会第一个单词',
    goal: 1,
    measure: (c) => c.learnedCount,
  },
  {
    id: 'words-10',
    emoji: '📚',
    name: '小有积累',
    description: '学会 10 个单词',
    goal: 10,
    measure: (c) => c.learnedCount,
  },
  {
    id: 'words-50',
    emoji: '📖',
    name: '词汇达人',
    description: '学会 50 个单词',
    goal: 50,
    measure: (c) => c.learnedCount,
  },
  {
    id: 'words-100',
    emoji: '🧠',
    name: '词汇大师',
    description: '学会 100 个单词',
    goal: 100,
    measure: (c) => c.learnedCount,
  },
  {
    id: 'words-300',
    emoji: '👑',
    name: '单词宗师',
    description: '学会 300 个单词',
    goal: 300,
    measure: (c) => c.learnedCount,
  },
  {
    id: 'stars-100',
    emoji: '⭐',
    name: '星光初现',
    description: '累计获得 100 星',
    goal: 100,
    measure: (c) => c.stars,
  },
  {
    id: 'stars-500',
    emoji: '🌟',
    name: '星光闪耀',
    description: '累计获得 500 星',
    goal: 500,
    measure: (c) => c.stars,
  },
  {
    id: 'stars-1000',
    emoji: '💫',
    name: '星河璀璨',
    description: '累计获得 1000 星',
    goal: 1000,
    measure: (c) => c.stars,
  },
  {
    id: 'unit-1',
    emoji: '🚩',
    name: '旗开得胜',
    description: '完成 1 个单元',
    goal: 1,
    measure: (c) => c.completedUnitCount,
  },
  {
    id: 'unit-5',
    emoji: '🏁',
    name: '单元专家',
    description: '完成 5 个单元',
    goal: 5,
    measure: (c) => c.completedUnitCount,
  },
  {
    id: 'streak-3',
    emoji: '🔥',
    name: '三日不辍',
    description: '连续打卡 3 天',
    goal: 3,
    measure: (c) => c.maxStreak,
  },
  {
    id: 'streak-7',
    emoji: '📅',
    name: '七日坚持',
    description: '连续打卡 7 天',
    goal: 7,
    measure: (c) => c.maxStreak,
  },
  {
    id: 'streak-30',
    emoji: '🗓️',
    name: '月度传奇',
    description: '连续打卡 30 天',
    goal: 30,
    measure: (c) => c.maxStreak,
  },
  {
    id: 'mastered-10',
    emoji: '🔁',
    name: '温故知新',
    description: '10 个单词复习到掌握',
    goal: 10,
    measure: (c) => c.masteredCount,
  },
  {
    id: 'mastered-50',
    emoji: '🎯',
    name: '融会贯通',
    description: '50 个单词复习到掌握',
    goal: 50,
    measure: (c) => c.masteredCount,
  },
  {
    id: 'speak-1',
    emoji: '🎙️',
    name: '开口第一步',
    description: '完成 1 次跟读评分',
    goal: 1,
    measure: (c) => c.speechCount,
  },
  {
    id: 'speak-20',
    emoji: '🎤',
    name: '跟读达人',
    description: '完成 20 次跟读评分',
    goal: 20,
    measure: (c) => c.speechCount,
  },
]

/** 全部成就 id 集合，用于校验持久化数据 */
export const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id))
