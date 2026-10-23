import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { StorageAdapter } from '../platform'
import { initStorage, mergeProgress, useProgressStore } from './progress'

const STORAGE_KEY = 'english-h5-progress'
const DAY_MS = 24 * 60 * 60 * 1000

type ProgressState = Parameters<typeof mergeProgress>[0]

/** 与 store 内部 todayKey 相同口径的本地日期 */
function dayKey(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * DAY_MS)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function baseState(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    version: 1,
    deviceId: 'dev-test',
    dirty: false,
    stars: 0,
    learnedWords: [],
    completedUnits: [],
    speechScores: [],
    dailyWords: {},
    reviewStates: {},
    wrongWords: {},
    wrongClearedAt: {},
    favorites: {},
    favoriteRemovedAt: {},
    streak: 0,
    maxStreak: 0,
    lastActiveDate: '',
    achievements: {},
    ...overrides,
  } as ProgressState
}

function memoryAdapter(seed?: string) {
  const data = new Map<string, string>()
  if (seed !== undefined) data.set(STORAGE_KEY, seed)
  const adapter: StorageAdapter = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value)
    },
  }
  return { adapter, data }
}

/** 每个用例重新注入存储 + 新建 pinia，保证 store 状态互不影响 */
function createStore(seed?: ProgressState) {
  const { adapter, data } = memoryAdapter(seed ? JSON.stringify(seed) : undefined)
  initStorage(adapter)
  setActivePinia(createPinia())
  return { store: useProgressStore(), data }
}

describe('进度持久化', () => {
  it('学习单词后写入本地存储，并生成复习记录', () => {
    const { store, data } = createStore()
    store.markWordLearned('w1')

    const raw = data.get(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const saved = JSON.parse(raw!) as ProgressState
    expect(saved.learnedWords).toContain('w1')
    expect(saved.reviewStates.w1).toBeTruthy()
  })
})

describe('连续打卡', () => {
  it('第一次学习开始打卡，同一天重复学习不累加', () => {
    const { store } = createStore()
    store.addStars(5)
    expect(store.streak).toBe(1)
    expect(store.lastActiveDate).toBe(dayKey())
    expect(store.checkedInToday).toBe(true)

    store.addStars(5)
    expect(store.streak).toBe(1)
  })

  it('昨天有学习则今天续上连续天数', () => {
    const { store } = createStore(
      baseState({ streak: 3, maxStreak: 3, lastActiveDate: dayKey(-1) }),
    )
    store.addStars(5)
    expect(store.streak).toBe(4)
    expect(store.maxStreak).toBe(4)
  })

  it('断签超过一天从 1 重新开始，历史最长保留', () => {
    const { store } = createStore(
      baseState({ streak: 9, maxStreak: 9, lastActiveDate: dayKey(-3) }),
    )
    store.addStars(5)
    expect(store.streak).toBe(1)
    expect(store.maxStreak).toBe(9)
    expect(store.currentStreak).toBe(1)
  })

  it('超过一天没学时 currentStreak 显示 0', () => {
    const { store } = createStore(
      baseState({ streak: 5, maxStreak: 5, lastActiveDate: dayKey(-2) }),
    )
    expect(store.currentStreak).toBe(0)
    expect(store.checkedInToday).toBe(false)
  })
})

describe('复习', () => {
  it('学新词进入复习队列，1 天后才到期', () => {
    const { store } = createStore()
    const before = Date.now()
    store.markWordLearned('w1')

    const state = store.reviewStates.w1
    expect(state.stage).toBe(0)
    expect(new Date(state.dueAt).getTime()).toBeGreaterThanOrEqual(
      before + DAY_MS - 1000,
    )
    expect(store.dueReviewIds).not.toContain('w1')
  })

  it('复习答对推进 stage 并加星，答错回到 stage 0', () => {
    const { store } = createStore()
    store.markWordLearned('w1')
    expect(store.stars).toBe(0)

    store.markReviewed('w1', true)
    expect(store.reviewStates.w1.stage).toBe(1)
    expect(store.stars).toBe(5)

    store.markReviewed('w1', false)
    expect(store.reviewStates.w1.stage).toBe(0)
    expect(store.stars).toBe(5)
  })

  it('存量已学单词按每天 20 个摊开', () => {
    const learnedWords = Array.from({ length: 45 }, (_, i) => `w${i}`)
    const { store } = createStore(baseState({ learnedWords }))

    // 今天只有第一批 20 个到期
    expect(store.dueReviewIds).toHaveLength(20)

    const counts = new Map<string, number>()
    for (const id of learnedWords) {
      const date = store.reviewStates[id].dueAt.slice(0, 10)
      counts.set(date, (counts.get(date) ?? 0) + 1)
    }
    expect([...counts.values()].sort((a, b) => b - a)).toEqual([20, 20, 5])
  })
})

describe('错题本', () => {
  it('答错累计次数，重练答对后移除并加星', () => {
    const { store } = createStore()
    store.recordWrong('w1')
    store.recordWrong('w1')
    expect(store.wrongWords.w1.count).toBe(2)
    expect(store.wrongWordCount).toBe(1)

    store.clearWrongWord('w1')
    expect(store.wrongWordCount).toBe(0)
    expect(store.stars).toBe(5)
  })

  it('超过 200 条时只保留 200 条', () => {
    const { store } = createStore()
    for (let i = 0; i < 205; i += 1) store.recordWrong(`w${i}`)
    expect(store.wrongWordCount).toBe(200)
  })

  it('重练答对清除后，同步合并服务器旧错题不会把它加回来', () => {
    const { store } = createStore()
    store.recordWrong('w1')
    store.clearWrongWord('w1')

    // 服务器上还是清除前的旧数据
    const server = baseState({
      wrongWords: {
        w1: {
          wordId: 'w1',
          count: 1,
          lastWrongAt: '2020-01-01T00:00:00.000Z',
        },
      },
    })
    const merged = mergeProgress(server, store.exportProgress())
    expect(merged.wrongWords.w1).toBeUndefined()
  })
})

describe('收藏', () => {
  it('收藏上限 50 个，超出后拒绝新增', () => {
    const { store } = createStore()
    for (let i = 0; i < 50; i += 1) {
      expect(store.addFavorite(`w${i}`)).toBe(true)
    }
    expect(store.addFavorite('w50')).toBe(false)
    expect(store.favoriteCount).toBe(50)
    expect(store.isFavoriteWord('w0')).toBe(true)
  })

  it('重复收藏同一个单词只保留一条', () => {
    const { store } = createStore()
    store.addFavorite('w1')
    store.addFavorite('w1')
    expect(store.favoriteCount).toBe(1)
  })

  it('批量取消收藏后，同步合并服务器旧收藏不会复活', () => {
    const { store } = createStore()
    store.addFavorite('w1')
    store.addFavorite('w2')
    store.removeFavorites(['w1'])

    const server = baseState({
      favorites: {
        w1: { wordId: 'w1', addedAt: '2020-01-01T00:00:00.000Z' },
        w2: { wordId: 'w2', addedAt: '2020-01-02T00:00:00.000Z' },
      },
    })
    const merged = mergeProgress(server, store.exportProgress())
    expect(merged.favorites.w1).toBeUndefined()
    expect(merged.favorites.w2).toBeTruthy()
  })
})

describe('听力挑战', () => {
  it('同一单元只保留答对更多的一轮', () => {
    const { store } = createStore()
    store.recordListenResult('u1', 3, 5)
    expect(store.listenResults.u1.correct).toBe(3)

    store.recordListenResult('u1', 2, 5)
    expect(store.listenResults.u1.correct).toBe(3)

    store.recordListenResult('u1', 5, 5)
    expect(store.listenResults.u1.correct).toBe(5)
  })

  it('同步合并时按单元取最好成绩', () => {
    const a = baseState({
      listenResults: {
        u1: { correct: 3, total: 5, at: '2026-10-01T00:00:00.000Z' },
      },
    })
    const b = baseState({
      listenResults: {
        u1: { correct: 4, total: 5, at: '2026-10-02T00:00:00.000Z' },
        u2: { correct: 5, total: 5, at: '2026-10-02T00:00:00.000Z' },
      },
    })
    const merged = mergeProgress(a, b)
    expect(merged.listenResults.u1.correct).toBe(4)
    expect(merged.listenResults.u2.correct).toBe(5)
  })
})

describe('成就', () => {
  it('达成条件时自动解锁', () => {
    const { store } = createStore()
    expect(store.achievements['first-word']).toBeUndefined()

    store.markWordLearned('w1')
    expect(store.achievements['first-word']).toBeTruthy()
  })

  it('启动时静默补齐老数据已达成的成就', () => {
    const learnedWords = Array.from({ length: 10 }, (_, i) => `w${i}`)
    const { store } = createStore(baseState({ learnedWords, stars: 100 }))

    expect(store.achievements['first-word']).toBeTruthy()
    expect(store.achievements['words-10']).toBeTruthy()
    expect(store.achievements['stars-100']).toBeTruthy()
  })
})

describe('mergeProgress', () => {
  it('星星取大、单词并集、打卡取最近、复习取更新、错题计次取大、成就并集', () => {
    const a = baseState({
      stars: 100,
      learnedWords: ['w1', 'w2'],
      streak: 3,
      maxStreak: 3,
      lastActiveDate: '2026-10-10',
      reviewStates: {
        w1: {
          wordId: 'w1',
          stage: 2,
          dueAt: '2026-10-12T00:00:00.000Z',
          lastReviewedAt: '2026-10-10T00:00:00.000Z',
        },
      },
      wrongWords: {
        w1: {
          wordId: 'w1',
          count: 1,
          lastWrongAt: '2026-10-09T00:00:00.000Z',
        },
      },
      achievements: { 'first-word': '2026-10-01T00:00:00.000Z' },
    })
    const b = baseState({
      stars: 80,
      learnedWords: ['w2', 'w3'],
      streak: 4,
      maxStreak: 5,
      lastActiveDate: '2026-10-11',
      reviewStates: {
        w1: {
          wordId: 'w1',
          stage: 3,
          dueAt: '2026-10-13T00:00:00.000Z',
          lastReviewedAt: '2026-10-11T00:00:00.000Z',
        },
      },
      wrongWords: {
        w1: {
          wordId: 'w1',
          count: 4,
          lastWrongAt: '2026-10-11T00:00:00.000Z',
        },
      },
      achievements: { 'stars-100': '2026-10-02T00:00:00.000Z' },
    })

    const merged = mergeProgress(a, b)
    expect(merged.stars).toBe(100)
    expect(new Set(merged.learnedWords)).toEqual(new Set(['w1', 'w2', 'w3']))
    expect(merged.lastActiveDate).toBe('2026-10-11')
    expect(merged.streak).toBe(4)
    expect(merged.maxStreak).toBe(5)
    expect(merged.reviewStates.w1.stage).toBe(3)
    expect(merged.wrongWords.w1.count).toBe(4)
    expect(Object.keys(merged.achievements).sort()).toEqual([
      'first-word',
      'stars-100',
    ])
  })
})
