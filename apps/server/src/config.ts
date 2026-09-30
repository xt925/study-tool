export const SPEECH_QUOTA = {
  perWordPerDay: 10,
  perAccountPerDay: 300,
} as const

/** 配额日固定按北京时间（UTC+8，无夏令时）切分，与国内用户直觉一致 */
const QUOTA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000

/** 返回配额日 "YYYY-MM-DD"；后端的 UTC 日期在上午 8 点前会停在昨天，故不用它 */
export function quotaDay(at: Date = new Date()): string {
  return new Date(at.getTime() + QUOTA_UTC_OFFSET_MS).toISOString().slice(0, 10)
}