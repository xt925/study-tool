import { describe, expect, it } from 'vitest'

import { buildWeekReport, recentDays } from './report'

const DAY_MS = 24 * 60 * 60 * 1000
const TODAY = '2026-10-11'
/** 北京时间 2026-10-11 12:00 对应的 UTC 时间 */
const NOW = Date.UTC(2026, 9, 11, 4, 0, 0)

describe('recentDays', () => {
  it('返回最近 7 天，从早到晚且连续', () => {
    const days = recentDays(7, TODAY)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-10-05')
    expect(days[6]).toBe(TODAY)
  })
})

describe('buildWeekReport', () => {
  it('统计总词数、活跃天数与达标天数', () => {
    const report = buildWeekReport(
      {
        dailyWords: {
          '2026-10-05': 5,
          '2026-10-06': 10,
          '2026-10-08': 10,
          '2026-10-11': 10,
        },
        reviewStates: {},
        speechScores: [],
      },
      10,
      TODAY,
      NOW,
    )

    expect(report.days).toHaveLength(7)
    expect(report.totalWords).toBe(35)
    expect(report.activeDays).toBe(4)
    // 10、10、10 三天达标，5 个的那天不达标
    expect(report.goalMetDays).toBe(3)
  })

  it('统计 7 天内的复习词数与跟读次数', () => {
    const report = buildWeekReport(
      {
        dailyWords: {},
        reviewStates: {
          w1: { lastReviewedAt: new Date(NOW - 2 * DAY_MS).toISOString() },
          w2: { lastReviewedAt: new Date(NOW - 10 * DAY_MS).toISOString() },
        },
        speechScores: [
          { recordedAt: new Date(NOW - 1 * DAY_MS).toISOString() },
          { recordedAt: new Date(NOW - 8 * DAY_MS).toISOString() },
        ],
      },
      0,
      TODAY,
      NOW,
    )

    expect(report.reviewedWords).toBe(1)
    expect(report.speechCount).toBe(1)
    // 未设目标时不统计达标天数
    expect(report.goalMetDays).toBe(0)
  })

  it('没有进度数据时返回全 0', () => {
    const report = buildWeekReport(null, 5, TODAY, NOW)
    expect(report.totalWords).toBe(0)
    expect(report.activeDays).toBe(0)
    expect(report.days.every((d) => d.words === 0)).toBe(true)
    expect(report.goalMetDays).toBe(0)
  })
})
