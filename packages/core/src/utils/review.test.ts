import { describe, expect, it } from 'vitest'

import {
  REVIEW_BACKLOG_PER_DAY,
  REVIEW_INTERVALS_DAYS,
  backlogReviewState,
  initialReviewState,
  isReviewDue,
  nextReviewState,
} from './review'

const DAY_MS = 24 * 60 * 60 * 1000
/** 固定基准时间，避免测试受当前时间影响 */
const AT = Date.UTC(2026, 9, 11, 0, 0, 0)

/** dueAt 距离基准时间多少天 */
function daysFromBase(iso: string): number {
  return (new Date(iso).getTime() - AT) / DAY_MS
}

describe('initialReviewState', () => {
  it('新学单词排到 1 天后首次复习，stage 为 0', () => {
    const state = initialReviewState('w1', AT)
    expect(state.wordId).toBe('w1')
    expect(state.stage).toBe(0)
    expect(daysFromBase(state.dueAt)).toBe(REVIEW_INTERVALS_DAYS[0])
    expect(state.lastReviewedAt).toBe(new Date(AT).toISOString())
  })
})

describe('backlogReviewState', () => {
  it('存量单词按每天 20 个摊开', () => {
    expect(daysFromBase(backlogReviewState('a', 0, AT).dueAt)).toBe(0)
    expect(
      daysFromBase(
        backlogReviewState('b', REVIEW_BACKLOG_PER_DAY - 1, AT).dueAt,
      ),
    ).toBe(0)
    expect(
      daysFromBase(backlogReviewState('c', REVIEW_BACKLOG_PER_DAY, AT).dueAt),
    ).toBe(1)
    expect(
      daysFromBase(
        backlogReviewState('d', REVIEW_BACKLOG_PER_DAY * 2 + 5, AT).dueAt,
      ),
    ).toBe(2)
  })
})

describe('nextReviewState', () => {
  it('答对时 stage +1 并拉长间隔', () => {
    const first = nextReviewState(undefined, 'w', true, AT)
    expect(first.stage).toBe(1)
    expect(daysFromBase(first.dueAt)).toBe(REVIEW_INTERVALS_DAYS[1])

    const second = nextReviewState(first, 'w', true, AT)
    expect(second.stage).toBe(2)
    expect(daysFromBase(second.dueAt)).toBe(REVIEW_INTERVALS_DAYS[2])
  })

  it('stage 封顶在最长间隔，不会越界', () => {
    let state = nextReviewState(undefined, 'w', true, AT)
    for (let i = 0; i < 20; i += 1) {
      state = nextReviewState(state, 'w', true, AT)
    }
    const maxStage = REVIEW_INTERVALS_DAYS.length - 1
    expect(state.stage).toBe(maxStage)
    expect(daysFromBase(state.dueAt)).toBe(REVIEW_INTERVALS_DAYS[maxStage])
  })

  it('答错回到 stage 0，约 10 分钟后重现', () => {
    const learned = nextReviewState(undefined, 'w', true, AT)
    const wrong = nextReviewState(learned, 'w', false, AT)
    expect(wrong.stage).toBe(0)
    expect(new Date(wrong.dueAt).getTime() - AT).toBe(10 * 60 * 1000)
  })
})

describe('isReviewDue', () => {
  it('到期时间不晚于当前时间时需要复习', () => {
    const state = initialReviewState('w', AT)
    expect(isReviewDue(state, AT + DAY_MS - 1)).toBe(false)
    expect(isReviewDue(state, AT + DAY_MS)).toBe(true)
    expect(isReviewDue(state, AT + DAY_MS + 1)).toBe(true)
  })
})
