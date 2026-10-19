/**
 * 宠物系统：宠物定义、食物/玩耍选项、成长曲线与离线衰减。
 * 全部是纯逻辑，不依赖平台 API，store 与页面共用。
 */

export type PetType = 'cat' | 'dragon' | 'penguin'

export interface PetState {
  type: PetType
  name: string
  /** 伙伴等级（不同宠物形象共用同一份成长） */
  level: number
  /** 当前等级内已积累的经验 */
  exp: number
  /** 饱食度 0~100 */
  fullness: number
  /** 心情 0~100 */
  mood: number
  /** 上次结算离线衰减的时间（ISO 字符串） */
  lastTickAt: string
  /** 最近一次陪伴打卡的日期（YYYY-MM-DD） */
  lastCheckInDate: string
  /** 连续陪伴天数 */
  checkInStreak: number
  totalFeeds: number
  totalPlays: number
}

export interface PetTypeDef {
  type: PetType
  name: string
  emoji: string
  desc: string
  defaultName: string
  /** 非初始伙伴的解锁价格（星星） */
  unlockCost: number
}

export interface PetFood {
  id: string
  emoji: string
  name: string
  cost: number
  fullness: number
  mood: number
  exp: number
}

export interface PetPlay {
  id: string
  emoji: string
  name: string
  cost: number
  mood: number
  fullness: number
  exp: number
}

/** 宠物互动的结果，页面据此提示 */
export interface PetActionResult {
  ok: boolean
  reason?: string
  levelUp?: boolean
  level?: number
  /** 本次获得的星星（照顾行为触发的每日打卡奖励） */
  earned?: number
  /** 本次操作是否完成了今日陪伴打卡 */
  checkedIn?: boolean
  /** 连续陪伴天数（打卡后） */
  streak?: number
}

export const PET_TYPES: PetTypeDef[] = [
  {
    type: 'cat',
    name: '小橘猫',
    emoji: '🐱',
    desc: '爱撒娇的小橘猫，最喜欢晒太阳',
    defaultName: '咪咪',
    unlockCost: 60,
  },
  {
    type: 'dragon',
    name: '小火龙',
    emoji: '🐲',
    desc: '会喷小火苗，努力学英语的龙宝宝',
    defaultName: '小火',
    unlockCost: 120,
  },
  {
    type: 'penguin',
    name: '小企鹅',
    emoji: '🐧',
    desc: '摇摇摆摆的小企鹅，走路自带节拍',
    defaultName: '团团',
    unlockCost: 180,
  },
]

/** 领养时送的见面礼，保证新用户第一次就能喂一次宠物 */
export const PET_WELCOME_STARS = 20

export const PET_FOODS: PetFood[] = [
  { id: 'apple', emoji: '🍎', name: '小苹果', cost: 5, fullness: 18, mood: 4, exp: 18 },
  { id: 'meat', emoji: '🍖', name: '香香肉', cost: 12, fullness: 38, mood: 10, exp: 40 },
  { id: 'cake', emoji: '🎂', name: '生日蛋糕', cost: 30, fullness: 65, mood: 25, exp: 85 },
]

export const PET_PLAYS: PetPlay[] = [
  { id: 'ball', emoji: '🎾', name: '扔球球', cost: 4, mood: 30, fullness: -6, exp: 15 },
  { id: 'park', emoji: '🎠', name: '逛游乐园', cost: 12, mood: 55, fullness: -10, exp: 40 },
]

export const PET_STAT_MAX = 100

/** 幼年 / 成长期 / 成年：升级后形象会变 */
export function petStage(level: number): 0 | 1 | 2 {
  if (level >= 10) return 2
  if (level >= 5) return 1
  return 0
}

export const PET_STAGE_NAMES = ['幼年期', '成长期', '成年期'] as const

/** 升到下一级所需的经验 */
export function expToNext(level: number): number {
  return 40 + (level - 1) * 20
}

export function findPetType(type: string): PetTypeDef | undefined {
  return PET_TYPES.find((item) => item.type === type)
}

export function createPet(type: PetType, name: string): PetState {
  const def = findPetType(type)
  const now = new Date().toISOString()
  return {
    type,
    name: name.trim().slice(0, 12) || def?.defaultName || '宝宝',
    level: 1,
    exp: 0,
    fullness: 80,
    mood: 80,
    lastTickAt: now,
    lastCheckInDate: '',
    checkInStreak: 0,
    totalFeeds: 0,
    totalPlays: 0,
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

/** 从任意来源（本地存储 / 服务器）读到的数据里挑出合法的宠物状态 */
export function normalizePet(raw: unknown): PetState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const p = raw as Partial<PetState>
  const def = typeof p.type === 'string' ? findPetType(p.type) : undefined
  if (!def) return null
  return {
    type: def.type,
    name:
      typeof p.name === 'string' && p.name.trim()
        ? p.name.trim().slice(0, 12)
        : def.defaultName,
    level: clampInt(p.level, 1, 99, 1),
    exp: clampInt(p.exp, 0, 100000, 0),
    fullness: clampInt(p.fullness, 0, PET_STAT_MAX, 80),
    mood: clampInt(p.mood, 0, PET_STAT_MAX, 80),
    lastTickAt:
      typeof p.lastTickAt === 'string' ? p.lastTickAt : new Date().toISOString(),
    lastCheckInDate:
      typeof p.lastCheckInDate === 'string' ? p.lastCheckInDate : '',
    checkInStreak: clampInt(p.checkInStreak, 0, 100000, 0),
    totalFeeds: clampInt(p.totalFeeds, 0, 1000000, 0),
    totalPlays: clampInt(p.totalPlays, 0, 1000000, 0),
  }
}

/** 多端同步时合并宠物：等级取高、状态取最近结算的一方、次数取大 */
export function mergePet(
  a: PetState | null,
  b: PetState | null,
): PetState | null {
  if (!a) return b
  if (!b) return a
  const newer = a.lastTickAt >= b.lastTickAt ? a : b
  const higher = a.level >= b.level ? a : b
  const sameLevel = a.level === b.level
  const checkIn = a.lastCheckInDate >= b.lastCheckInDate ? a : b
  return {
    ...newer,
    level: higher.level,
    exp: sameLevel ? Math.max(a.exp, b.exp) : higher.exp,
    // 连续陪伴以较近的一次打卡为准；同一天取较大值
    lastCheckInDate: checkIn.lastCheckInDate,
    checkInStreak:
      a.lastCheckInDate === b.lastCheckInDate
        ? Math.max(a.checkInStreak, b.checkInStreak)
        : checkIn.checkInStreak,
    totalFeeds: Math.max(a.totalFeeds, b.totalFeeds),
    totalPlays: Math.max(a.totalPlays, b.totalPlays),
  }
}

/** 饱食度每 30 分钟 -1，心情每 45 分钟 -1 */
const FULLNESS_DECAY_MS = 30 * 60 * 1000
const MOOD_DECAY_MS = 45 * 60 * 1000

/**
 * 按离线时长结算衰减。返回同一对象表示没有变化（避免无意义地写存储）。
 */
export function applyPetDecay(pet: PetState, now = Date.now()): PetState {
  const last = Date.parse(pet.lastTickAt)
  if (!Number.isFinite(last)) {
    return { ...pet, lastTickAt: new Date(now).toISOString() }
  }
  const elapsed = now - last
  if (elapsed < FULLNESS_DECAY_MS) return pet

  const fullness = Math.max(0, pet.fullness - Math.floor(elapsed / FULLNESS_DECAY_MS))
  const mood = Math.max(0, pet.mood - Math.floor(elapsed / MOOD_DECAY_MS))
  return {
    ...pet,
    fullness,
    mood,
    lastTickAt: new Date(now).toISOString(),
  }
}

/** 增加经验并处理连续升级 */
export function gainPetExp(
  pet: PetState,
  amount: number,
): { pet: PetState; levelsGained: number } {
  let level = pet.level
  let exp = pet.exp + Math.max(0, amount)
  let levelsGained = 0
  while (level < 99 && exp >= expToNext(level)) {
    exp -= expToNext(level)
    level += 1
    levelsGained += 1
  }
  return { pet: { ...pet, level, exp }, levelsGained }
}

/** 宠物当前想说的话 */
export function petSpeech(pet: PetState): string {
  if (pet.fullness <= 20) return '肚子咕咕叫…可以给我一点吃的吗？🥺'
  if (pet.mood <= 20) return '有点无聊，陪我玩一会儿吧～'
  if (pet.fullness >= 85 && pet.mood >= 85) return '我现在超级幸福！谢谢你陪着我 💖'
  const hour = new Date().getHours()
  if (hour >= 21 || hour < 6) return '夜深啦，早点休息，明天再一起学习哦 🌙'
  if (pet.checkInStreak >= 7) return `我们已经连续陪伴 ${pet.checkInStreak} 天啦！`
  return '今天也要一起学英语哦！'
}
