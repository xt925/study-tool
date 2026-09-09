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
  stars: number
  learnedWords: string[]
  completedUnits: string[]
  /** 按 "YYYY-MM-DD" 记录每日已学单词数 */
  dailyWords: Record<string, number>
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
