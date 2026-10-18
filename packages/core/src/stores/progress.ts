import { defineStore } from 'pinia'

import { findUnit } from '../data/words'
import type { StorageAdapter } from '../platform'
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENTS,
  MASTERED_STAGE,
  type AchievementContext,
} from '../utils/achievements'
import {
  backlogReviewState,
  initialReviewState,
  isReviewDue,
  nextReviewState,
  type ReviewState,
} from '../utils/review'

const STORAGE_KEY = 'english-h5-progress'

/** 星星累计换算等级：0~100 Lv.1，100~250 Lv.2，250~500 Lv.3，之后每 250 一级 */
export function levelFromStars(stars: number): number {
  if (stars < 100) return 1
  if (stars < 250) return 2
  if (stars < 500) return 3
  return 3 + Math.floor((stars - 500) / 250) + 1
}

export function levelProgress(stars: number): number {
  const level = levelFromStars(stars)
  if (level === 1) return stars / 100
  if (level === 2) return (stars - 100) / 150
  if (level === 3) return (stars - 250) / 250
  const base = 500 + (level - 4) * 250
  return (stars - base) / 250
}

interface ProgressState {
  /** 数据版本号，将来结构变化时用于迁移 */
  version: number
  /** 设备唯一标识，首次启动生成；将来同步时用于区分设备 */
  deviceId: string
  /** 本地是否有未同步到服务器的改动 */
  dirty: boolean
  stars: number
  learnedWords: string[]
  completedUnits: string[]
  speechScores: SpeechScoreRecord[]
  /** 按 "YYYY-MM-DD" 记录每日已学单词数 */
  dailyWords: Record<string, number>
  /** 每个已学单词的复习状态，key 为 wordId */
  reviewStates: Record<string, ReviewState>
  /** 错题本：答错过的单词，key 为 wordId */
  wrongWords: Record<string, WrongWordRecord>
  /** 连续打卡：当前连续天数（截至 lastActiveDate） */
  streak: number
  /** 历史最长连续天数 */
  maxStreak: number
  /** 最近一次有学习行为的日期（YYYY-MM-DD） */
  lastActiveDate: string
  /** 已解锁的成就：成就 id -> 解锁时间（ISO 字符串） */
  achievements: Record<string, string>
}

export interface SpeechScoreRecord {
  id: string
  unitId: string
  wordId: string
  total: number
  accuracy: number
  fluency: number
  completion: number
  recordedAt: string
}

/** 错题本里的一条：某个单词答错过的记录 */
export interface WrongWordRecord {
  wordId: string
  /** 累计答错次数 */
  count: number
  /** 最近一次答错时间（ISO 字符串） */
  lastWrongAt: string
}

const STATE_VERSION = 1

/** 跟读评分记录只保留最近这么多条，避免长期使用后无限膨胀（会随进度一起同步） */
const MAX_SPEECH_SCORES = 500

/** 错题本最多保留这么多条，超出后淘汰最早答错的 */
const MAX_WRONG_WORDS = 200

/** 按时间裁剪评分记录，只保留最新的 MAX_SPEECH_SCORES 条 */
function trimSpeechScores(records: SpeechScoreRecord[]): SpeechScoreRecord[] {
  if (records.length <= MAX_SPEECH_SCORES) return records
  return [...records]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .slice(-MAX_SPEECH_SCORES)
}

/** 错题本超出上限时，保留最近答错的 MAX_WRONG_WORDS 条 */
function trimWrongWords(
  records: Record<string, WrongWordRecord>,
): Record<string, WrongWordRecord> {
  const entries = Object.entries(records)
  if (entries.length <= MAX_WRONG_WORDS) return records
  return Object.fromEntries(
    entries
      .sort((a, b) => b[1].lastWrongAt.localeCompare(a[1].lastWrongAt))
      .slice(0, MAX_WRONG_WORDS),
  )
}

/** 从任意来源读到的数据里挑出合法的错题记录 */
function normalizeWrongWords(raw: unknown): Record<string, WrongWordRecord> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, WrongWordRecord> = {}
  for (const [id, value] of Object.entries(raw as Record<string, Partial<WrongWordRecord>>)) {
    if (value && typeof value.lastWrongAt === 'string') {
      out[id] = {
        wordId: typeof value.wordId === 'string' ? value.wordId : id,
        count: typeof value.count === 'number' ? value.count : 1,
        lastWrongAt: value.lastWrongAt,
      }
    }
  }
  return out
}

/** 从任意来源读到的数据里挑出合法的成就记录（只认当前定义的成就 id） */
function normalizeAchievements(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (ACHIEVEMENT_IDS.has(id) && typeof at === 'string') out[id] = at
  }
  return out
}

/** 从进度中提炼出判断成就用的指标 */
function contextOf(state: ProgressState): AchievementContext {
  return {
    stars: state.stars,
    learnedCount: state.learnedWords.length,
    completedUnitCount: state.completedUnits.length,
    maxStreak: state.maxStreak,
    masteredCount: Object.values(state.reviewStates).filter(
      (r) => r.stage >= MASTERED_STAGE,
    ).length,
    speechCount: state.speechScores.length,
  }
}

/**
 * 老数据升级时补齐已满足条件的成就（不弹提示，只静默记账）。
 * 否则一个新功能上线后，老用户要等下一次操作才会一次性解锁一堆历史成就。
 */
function backfillAchievements(state: ProgressState): ProgressState {
  const ctx = contextOf(state)
  const now = new Date().toISOString()
  const achievements = { ...state.achievements }
  let changed = false
  for (const def of ACHIEVEMENTS) {
    if (!achievements[def.id] && def.measure(ctx) >= def.goal) {
      achievements[def.id] = now
      changed = true
    }
  }
  return changed ? { ...state, achievements } : state
}

function genDeviceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 把日期格式化成 "YYYY-MM-DD"（本地时区） */
function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function todayKey(): string {
  return dayKey()
}

/** 两个 "YYYY-MM-DD" 相差几天（b - a） */
function dayDiff(a: string, b: string): number {
  const ta = new Date(`${a}T00:00:00`).getTime()
  const tb = new Date(`${b}T00:00:00`).getTime()
  return Math.round((tb - ta) / DAY_MS)
}

/**
 * 从每日学习记录推导连续打卡（老数据升级用，让别人已有的学习历史直接变成 streak）。
 * 返回截至最近活跃日的连续天数，以及历史最长连续天数。
 */
function deriveStreak(dailyWords: Record<string, number>): {
  streak: number
  maxStreak: number
  lastActiveDate: string
} {
  const days = Object.keys(dailyWords)
    .filter((date) => (dailyWords[date] ?? 0) > 0)
    .sort()
  if (days.length === 0) return { streak: 0, maxStreak: 0, lastActiveDate: '' }

  let maxStreak = 1
  let run = 1
  for (let i = 1; i < days.length; i += 1) {
    run = dayDiff(days[i - 1], days[i]) === 1 ? run + 1 : 1
    maxStreak = Math.max(maxStreak, run)
  }

  let streak = 1
  for (let i = days.length - 1; i > 0; i -= 1) {
    if (dayDiff(days[i - 1], days[i]) !== 1) break
    streak += 1
  }

  return { streak, maxStreak, lastActiveDate: days[days.length - 1] }
}

let storage: StorageAdapter | null = null

/**
 * 注入平台相关的持久化实现（h5 用 localStorage，uni-app 用 uni.getStorageSync）。
 * 必须在首次使用 useProgressStore 之前调用。
 */
export function initStorage(adapter: StorageAdapter): void {
  storage = adapter
}

function getStorage(): StorageAdapter {
  if (!storage) {
    throw new Error(
      '[@study/core] 未注入 storage 适配器，请先调用 initStorage(adapter)',
    )
  }
  return storage
}

/** 从任意来源（localStorage / 服务器）读到的数据里挑出合法的复习记录 */
function normalizeReviewStates(raw: unknown): Record<string, ReviewState> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, ReviewState> = {}
  for (const [id, value] of Object.entries(raw as Record<string, Partial<ReviewState>>)) {
    if (
      value &&
      typeof value.stage === 'number' &&
      typeof value.dueAt === 'string'
    ) {
      out[id] = {
        wordId: typeof value.wordId === 'string' ? value.wordId : id,
        stage: value.stage,
        dueAt: value.dueAt,
        lastReviewedAt:
          typeof value.lastReviewedAt === 'string' ? value.lastReviewedAt : value.dueAt,
      }
    }
  }
  return out
}

/**
 * 给已学但没有复习记录的单词补复习记录（老数据升级、服务器合并后都可能出现缺口）。
 * 补的时候按天摊开：每天最多 REVIEW_BACKLOG_PER_DAY 个，其余顺延到之后几天，
 * 避免一次性涌出上百个待复习把人吓退。
 */
function ensureReviewStates(state: ProgressState): ProgressState {
  const reviewStates = { ...state.reviewStates }
  const now = Date.now()
  let pending = 0
  let changed = false
  for (const wordId of state.learnedWords) {
    if (reviewStates[wordId]) continue
    reviewStates[wordId] = backlogReviewState(wordId, pending, now)
    pending += 1
    changed = true
  }
  return changed ? { ...state, reviewStates } : state
}

function loadState(): ProgressState {
  const fallback: ProgressState = {
    version: STATE_VERSION,
    deviceId: genDeviceId(),
    dirty: false,
    stars: 0,
    learnedWords: [],
    completedUnits: [],
    speechScores: [],
    dailyWords: {},
    reviewStates: {},
    wrongWords: {},
    streak: 0,
    maxStreak: 0,
    lastActiveDate: '',
    achievements: {},
  }
  const adapter = getStorage()
  try {
    const raw = adapter.get(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<ProgressState>
    const dailyWords = parsed.dailyWords ?? {}
    // 老数据没有 streak 字段时，用已有的每日学习记录推导，避免连续记录从 0 开始
    const hasStreak =
      typeof parsed.streak === 'number' &&
      typeof parsed.lastActiveDate === 'string'
    const derived = hasStreak ? null : deriveStreak(dailyWords)
    return backfillAchievements(
      ensureReviewStates({
        // 旧版本数据没有这些字段，自动补默认值（相当于一次静默迁移）
        version: parsed.version ?? STATE_VERSION,
        deviceId: parsed.deviceId ?? genDeviceId(),
        dirty: parsed.dirty ?? false,
        stars: typeof parsed.stars === 'number' ? parsed.stars : 0,
        learnedWords: Array.isArray(parsed.learnedWords)
          ? parsed.learnedWords
          : [],
        completedUnits: Array.isArray(parsed.completedUnits)
          ? parsed.completedUnits
          : [],
        speechScores: Array.isArray(parsed.speechScores)
          ? trimSpeechScores(parsed.speechScores)
          : [],
        dailyWords,
        reviewStates: normalizeReviewStates(parsed.reviewStates),
        wrongWords: normalizeWrongWords(parsed.wrongWords),
        streak: hasStreak ? parsed.streak! : (derived?.streak ?? 0),
        maxStreak:
          typeof parsed.maxStreak === 'number'
            ? parsed.maxStreak
            : Math.max(derived?.maxStreak ?? 0, derived?.streak ?? 0),
        lastActiveDate: hasStreak
          ? parsed.lastActiveDate!
          : (derived?.lastActiveDate ?? ''),
        achievements: normalizeAchievements(parsed.achievements),
      }),
    )
  } catch {
    return fallback
  }
}

/** 合并两份进度（本地 vs 服务器）：星星取大值，单词/单元取并集，每日取大值 */
export function mergeProgress(
  a: ProgressState,
  b: ProgressState,
): ProgressState {
  const dailyWords: Record<string, number> = { ...a.dailyWords }
  for (const [date, n] of Object.entries(b.dailyWords)) {
    dailyWords[date] = Math.max(dailyWords[date] ?? 0, n)
  }
  const speechScores = new Map<string, SpeechScoreRecord>()
  for (const record of [...a.speechScores, ...b.speechScores]) {
    speechScores.set(record.id, record)
  }
  // 复习记录按 wordId 取「最近复习过」的一条：多设备各自复习时，进度新的一方胜出
  const reviewStates: Record<string, ReviewState> = { ...a.reviewStates }
  for (const [wordId, next] of Object.entries(b.reviewStates)) {
    const current = reviewStates[wordId]
    if (!current || next.lastReviewedAt > current.lastReviewedAt) {
      reviewStates[wordId] = next
    }
  }
  // 错题本按 wordId 并集：次数取大、时间取最近，不叠加（避免同一错误在多设备上重复计数）
  const wrongWords: Record<string, WrongWordRecord> = { ...a.wrongWords }
  for (const [wordId, next] of Object.entries(b.wrongWords)) {
    const current = wrongWords[wordId]
    if (!current) {
      wrongWords[wordId] = next
    } else {
      wrongWords[wordId] = {
        wordId,
        count: Math.max(current.count, next.count),
        lastWrongAt:
          next.lastWrongAt > current.lastWrongAt
            ? next.lastWrongAt
            : current.lastWrongAt,
      }
    }
  }
  // 连续打卡：以最近活跃的一天为准；同一天取较大的连续天数，最长记录取历史最大
  const lastActiveDate =
    a.lastActiveDate > b.lastActiveDate ? a.lastActiveDate : b.lastActiveDate
  const streak =
    a.lastActiveDate === b.lastActiveDate
      ? Math.max(a.streak, b.streak)
      : a.lastActiveDate > b.lastActiveDate
        ? a.streak
        : b.streak
  const maxStreak = Math.max(a.maxStreak, b.maxStreak, streak)
  // 成就取并集，同一成就保留最早解锁时间
  const achievements: Record<string, string> = { ...a.achievements }
  for (const [id, at] of Object.entries(b.achievements)) {
    if (!achievements[id] || at < achievements[id]) achievements[id] = at
  }
  return {
    version: Math.max(a.version, b.version),
    deviceId: a.deviceId, // 设备 id 始终以本机为准
    dirty: a.dirty || b.dirty,
    stars: Math.max(a.stars, b.stars),
    learnedWords: [...new Set([...a.learnedWords, ...b.learnedWords])],
    completedUnits: [...new Set([...a.completedUnits, ...b.completedUnits])],
    speechScores: trimSpeechScores([...speechScores.values()]),
    dailyWords,
    reviewStates,
    wrongWords: trimWrongWords(wrongWords),
    streak,
    maxStreak,
    lastActiveDate,
    achievements,
  }
}

export const useProgressStore = defineStore('progress', {
  state: (): ProgressState => loadState(),
  getters: {
    level: (state) => levelFromStars(state.stars),
    todayWordCount: (state) => state.dailyWords[todayKey()] ?? 0,
    isLearnedWord: (state) => (wordId: string) =>
      state.learnedWords.includes(wordId),
    // 单元是否"已完成"以该单元的全部单词是否都学过为准（而不是看完成奖励标记），
    // 这样跳着学、或在单词表里逐个学完，状态都能正确反映
    isUnitCompleted: (state) => (unitId: string) => {
      const unit = findUnit(unitId)
      if (!unit || unit.words.length === 0) {
        return state.completedUnits.includes(unitId)
      }
      return unit.words.every((w) => state.learnedWords.includes(w.id))
    },
    /** 已到期、需要复习的单词 id，按到期时间从早到晚排序 */
    dueReviewIds: (state) => {
      const now = Date.now()
      return Object.values(state.reviewStates)
        .filter((r) => isReviewDue(r, now))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .map((r) => r.wordId)
    },
    /** 待复习单词数，首页入口展示用 */
    dueReviewCount: (state) => {
      const now = Date.now()
      return Object.values(state.reviewStates).filter((r) => isReviewDue(r, now))
        .length
    },
    /** 错题本里的单词 id，按最近答错时间从新到旧排序 */
    wrongWordIds: (state) =>
      Object.values(state.wrongWords)
        .sort((a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt))
        .map((r) => r.wordId),
    /** 错题本词数，首页入口展示用 */
    wrongWordCount: (state) => Object.keys(state.wrongWords).length,
    /** 展示用连续天数：超过一天没学，连续链就断了，显示 0 */
    currentStreak: (state) => {
      if (state.lastActiveDate === todayKey()) return state.streak
      const yesterday = dayKey(new Date(Date.now() - DAY_MS))
      return state.lastActiveDate === yesterday ? state.streak : 0
    },
    /** 今天是否已经有学习行为 */
    checkedInToday: (state) => state.lastActiveDate === todayKey(),
    /** 判断成就用的当前指标，成就页展示进度也用 */
    achievementContext: (state): AchievementContext => contextOf(state),
  },
  actions: {
    persist() {
      this.dirty = true
      this.evaluateAchievements()
      getStorage().set(STORAGE_KEY, JSON.stringify(this.$state))
    },
    /** 按当前进度检查并解锁达成的成就（已解锁的不重复记） */
    evaluateAchievements() {
      const ctx = this.achievementContext
      const now = new Date().toISOString()
      for (const def of ACHIEVEMENTS) {
        if (!this.achievements[def.id] && def.measure(ctx) >= def.goal) {
          this.achievements[def.id] = now
        }
      }
    },
    /** 导出当前进度快照（将来上传服务器用）：POST 这个对象即可 */
    exportProgress(): ProgressState {
      return JSON.parse(JSON.stringify(this.$state)) as ProgressState
    },
    /** 用服务器返回的进度合并到本地（登录/同步成功后的回调里调用） */
    importProgress(remote: Partial<ProgressState>) {
      const merged = ensureReviewStates(
        mergeProgress(this.$state, {
          ...loadState(),
          ...remote,
        } as ProgressState),
      )
      this.$patch(merged)
      this.dirty = false // 刚同步完，本地无未同步改动
      this.evaluateAchievements() // 合并来的进度可能满足新成就条件
      getStorage().set(STORAGE_KEY, JSON.stringify(this.$state))
    },
    /** 记录今天有学习行为：跨天时推进连续打卡（同一天多次调用只算一次） */
    touchStreak() {
      const today = todayKey()
      if (this.lastActiveDate === today) return
      const yesterday = dayKey(new Date(Date.now() - DAY_MS))
      this.streak = this.lastActiveDate === yesterday ? this.streak + 1 : 1
      this.lastActiveDate = today
      this.maxStreak = Math.max(this.maxStreak, this.streak)
    },
    addStars(n: number) {
      this.stars += n
      this.touchStreak()
      this.persist()
    },
    markWordLearned(wordId: string) {
      if (!this.learnedWords.includes(wordId)) {
        this.learnedWords.push(wordId)
      }
      // 新学的词直接排进复习队列，学完 1 天后首次复习
      if (!this.reviewStates[wordId]) {
        this.reviewStates[wordId] = initialReviewState(wordId)
      }
      const key = todayKey()
      this.dailyWords[key] = (this.dailyWords[key] ?? 0) + 1
      this.touchStreak()
      this.persist()
    },
    completeWord(wordId: string) {
      // 完成单词 +5⭐
      this.markWordLearned(wordId)
      this.addStars(5)
    },
    completeRepeat() {
      // 跟读完成 +5⭐
      this.addStars(5)
    },
    /** 提交一次复习结果：答对 +5⭐ 并拉长下次间隔，答错回到最初 */
    markReviewed(wordId: string, correct: boolean) {
      this.reviewStates[wordId] = nextReviewState(
        this.reviewStates[wordId],
        wordId,
        correct,
      )
      if (correct) this.stars += 5
      this.touchStreak()
      this.persist()
    },
    /** 记录一次答错（测验/游戏里判错时调用），进错题本 */
    recordWrong(wordId: string) {
      const prev = this.wrongWords[wordId]
      this.wrongWords[wordId] = {
        wordId,
        count: (prev?.count ?? 0) + 1,
        lastWrongAt: new Date().toISOString(),
      }
      this.wrongWords = trimWrongWords(this.wrongWords)
      this.persist()
    },
    /** 错题重练答对：从错题本移除，+5⭐；不在错题本里则不加分 */
    clearWrongWord(wordId: string) {
      if (this.wrongWords[wordId]) {
        delete this.wrongWords[wordId]
        this.stars += 5
      }
      this.persist()
    },
    recordSpeechScore(
      record: Omit<SpeechScoreRecord, 'recordedAt'>,
    ) {
      const saved = {
        ...record,
        recordedAt: new Date().toISOString(),
      }
      const existingIndex = this.speechScores.findIndex((item) => item.id === record.id)
      if (existingIndex === -1) this.speechScores.push(saved)
      else this.speechScores[existingIndex] = saved
      this.speechScores = trimSpeechScores(this.speechScores)
      this.persist()
    },
    answerCorrect() {
      // 答对题目 +10⭐
      this.addStars(10)
    },
    completeUnit(unitId: string) {
      // 完成单元 +30⭐（重复完成不重复加星，只标记）
      if (!this.completedUnits.includes(unitId)) {
        this.completedUnits.push(unitId)
        this.addStars(30)
      } else {
        this.persist()
      }
    },
  },
})
