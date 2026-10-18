import { quotaDay } from './config.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** 周报统计只需要进度里的这几个字段，便于单独测试 */
export interface WeekReportSource {
  dailyWords: Record<string, number>
  reviewStates: Record<string, { lastReviewedAt: string }>
  speechScores: { recordedAt: string }[]
}

/** 返回最近 count 天的日期（"YYYY-MM-DD"，按北京时间日），从早到晚 */
export function recentDays(count: number, today = quotaDay()): string[] {
  const base = new Date(`${today}T00:00:00Z`).getTime()
  const out: string[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    out.push(new Date(base - i * DAY_MS).toISOString().slice(0, 10))
  }
  return out
}

/** 近 7 天学习报告：每日词数、合计、活跃天数、复习/跟读次数、达标天数 */
export function buildWeekReport(
  p: WeekReportSource | null,
  dailyGoal: number,
  today = quotaDay(),
  now = Date.now(),
) {
  const days = recentDays(7, today).map((date) => ({
    date,
    words: p?.dailyWords[date] ?? 0,
  }))
  const since = now - 7 * DAY_MS
  return {
    days,
    totalWords: days.reduce((sum, d) => sum + d.words, 0),
    activeDays: days.filter((d) => d.words > 0).length,
    reviewedWords: p
      ? Object.values(p.reviewStates).filter(
          (r) => new Date(r.lastReviewedAt).getTime() >= since,
        ).length
      : 0,
    speechCount: p
      ? p.speechScores.filter(
          (s) => new Date(s.recordedAt).getTime() >= since,
        ).length
      : 0,
    goalMetDays:
      dailyGoal > 0 ? days.filter((d) => d.words >= dailyGoal).length : 0,
  }
}
