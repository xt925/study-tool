import { defineStore } from 'pinia'

import type { StorageAdapter } from '../platform'

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
  /** 按 "YYYY-MM-DD" 记录每日已学单词数 */
  dailyWords: Record<string, number>
}

const STATE_VERSION = 1

function genDeviceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
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

function loadState(): ProgressState {
  const fallback: ProgressState = {
    version: STATE_VERSION,
    deviceId: genDeviceId(),
    dirty: false,
    stars: 0,
    learnedWords: [],
    completedUnits: [],
    dailyWords: {},
  }
  const adapter = getStorage()
  try {
    const raw = adapter.get(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<ProgressState>
    return {
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
      dailyWords: parsed.dailyWords ?? {},
    }
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
  return {
    version: Math.max(a.version, b.version),
    deviceId: a.deviceId, // 设备 id 始终以本机为准
    dirty: a.dirty || b.dirty,
    stars: Math.max(a.stars, b.stars),
    learnedWords: [...new Set([...a.learnedWords, ...b.learnedWords])],
    completedUnits: [...new Set([...a.completedUnits, ...b.completedUnits])],
    dailyWords,
  }
}

export const useProgressStore = defineStore('progress', {
  state: (): ProgressState => loadState(),
  getters: {
    level: (state) => levelFromStars(state.stars),
    todayWordCount: (state) => state.dailyWords[todayKey()] ?? 0,
    isLearnedWord: (state) => (wordId: string) =>
      state.learnedWords.includes(wordId),
    isUnitCompleted: (state) => (unitId: string) =>
      state.completedUnits.includes(unitId),
  },
  actions: {
    persist() {
      this.dirty = true
      getStorage().set(STORAGE_KEY, JSON.stringify(this.$state))
    },
    /** 导出当前进度快照（将来上传服务器用）：POST 这个对象即可 */
    exportProgress(): ProgressState {
      return JSON.parse(JSON.stringify(this.$state)) as ProgressState
    },
    /** 用服务器返回的进度合并到本地（登录/同步成功后的回调里调用） */
    importProgress(remote: Partial<ProgressState>) {
      const merged = mergeProgress(this.$state, {
        ...loadState(),
        ...remote,
      } as ProgressState)
      this.$patch(merged)
      this.dirty = false // 刚同步完，本地无未同步改动
      getStorage().set(STORAGE_KEY, JSON.stringify(this.$state))
    },
    addStars(n: number) {
      this.stars += n
      this.persist()
    },
    markWordLearned(wordId: string) {
      if (!this.learnedWords.includes(wordId)) {
        this.learnedWords.push(wordId)
      }
      const key = todayKey()
      this.dailyWords[key] = (this.dailyWords[key] ?? 0) + 1
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
