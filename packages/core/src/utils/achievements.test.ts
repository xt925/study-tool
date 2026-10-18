import { describe, expect, it } from 'vitest'

import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  MASTERED_STAGE,
  type AchievementContext,
} from './achievements'

const EMPTY: AchievementContext = {
  stars: 0,
  learnedCount: 0,
  completedUnitCount: 0,
  maxStreak: 0,
  masteredCount: 0,
  speechCount: 0,
}

function byId(id: string) {
  const def = ACHIEVEMENTS.find((a) => a.id === id)
  if (!def) throw new Error(`找不到成就 ${id}`)
  return def
}

describe('ACHIEVEMENTS', () => {
  it('id 唯一、目标为正数，空进度下指标都是 0', () => {
    expect(ACHIEVEMENT_IDS.size).toBe(ACHIEVEMENTS.length)
    expect(ACHIEVEMENTS.length).toBeGreaterThan(0)
    for (const def of ACHIEVEMENTS) {
      expect(def.goal).toBeGreaterThan(0)
      expect(def.measure(EMPTY)).toBe(0)
    }
  })

  it('词汇量类按已学单词数判断', () => {
    const def = byId('words-10')
    expect(def.measure({ ...EMPTY, learnedCount: 9 })).toBeLessThan(def.goal)
    expect(
      def.measure({ ...EMPTY, learnedCount: 10 }),
    ).toBeGreaterThanOrEqual(def.goal)
  })

  it('星星 / 单元 / 打卡 / 复习掌握 / 跟读各自取对应指标', () => {
    expect(
      byId('stars-500').measure({ ...EMPTY, stars: 500 }),
    ).toBeGreaterThanOrEqual(500)
    expect(
      byId('unit-5').measure({ ...EMPTY, completedUnitCount: 5 }),
    ).toBeGreaterThanOrEqual(5)
    expect(
      byId('streak-7').measure({ ...EMPTY, maxStreak: 7 }),
    ).toBeGreaterThanOrEqual(7)
    expect(
      byId('mastered-50').measure({ ...EMPTY, masteredCount: 50 }),
    ).toBeGreaterThanOrEqual(50)
    expect(
      byId('speak-20').measure({ ...EMPTY, speechCount: 20 }),
    ).toBeGreaterThanOrEqual(20)
  })
})

describe('MASTERED_STAGE', () => {
  it('复习掌握口径为 stage >= 3', () => {
    expect(MASTERED_STAGE).toBe(3)
  })
})
