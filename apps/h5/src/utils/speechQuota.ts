/**
 * 「跟读打分」每个词的每日重读次数限制。
 * 计数存在 localStorage，按本地日期跨天自动归零。
 * 只有真正发起过腾讯评测才应该调用 consumeAttempt（静音被前端挡掉的不算）。
 */

const STORAGE_KEY = 'english-h5-speech-quota'

/** 每个词每天最多评测多少次 */
export const DAILY_LIMIT_PER_WORD = 15

interface QuotaState {
  /** YYYY-MM-DD */
  date: string
  counts: Record<string, number>
}

function today(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** 读当天用量；日期不是今天（或数据损坏）就当作全新的一天 */
function load(): QuotaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as QuotaState
      if (parsed?.date === today() && parsed.counts) return parsed
    }
  } catch {
    // 脏数据或隐私模式，按新的一天处理
  }
  return { date: today(), counts: {} }
}

function save(state: QuotaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存不进去就算了，不阻塞使用
  }
}

/** 这个词今天还剩几次机会 */
export function remainingAttempts(wordId: string): number {
  const used = load().counts[wordId] ?? 0
  return Math.max(0, DAILY_LIMIT_PER_WORD - used)
}

/** 记一次真实评测（发起腾讯请求前调用） */
export function consumeAttempt(wordId: string): void {
  const state = load()
  state.counts[wordId] = (state.counts[wordId] ?? 0) + 1
  save(state)
}
