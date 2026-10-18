/**
 * 复习调度：给每个已学单词排一个「下次到期复习时间」，到期后进复习队列。
 * 采用简化版间隔重复（Leitner 思路）：连续答对则间隔逐级拉长，答错则回到最初。
 */

/** 一个已学单词的复习状态 */
export interface ReviewState {
  wordId: string
  /** 连续复习答对次数，越大越熟，下次间隔越长 */
  stage: number
  /** 下次到期复习时间（ISO 字符串） */
  dueAt: string
  /** 最近一次复习时间（ISO 字符串），多设备合并时以它为准 */
  lastReviewedAt: string
}

/** 各掌握等级对应的复习间隔（天）：stage 0 → 1 天后，逐级拉长 */
export const REVIEW_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30, 60]

const MAX_STAGE = REVIEW_INTERVALS_DAYS.length - 1
const DAY_MS = 24 * 60 * 60 * 1000
/** 答错后隔多久再复习：当天稍后再出现一次，而不是拖到第二天 */
const WRONG_RETRY_MS = 10 * 60 * 1000

/** 新学单词首次进入复习队列：学完过 1 天复习一次 */
export function initialReviewState(wordId: string, at = Date.now()): ReviewState {
  return {
    wordId,
    stage: 0,
    dueAt: new Date(at + REVIEW_INTERVALS_DAYS[0] * DAY_MS).toISOString(),
    lastReviewedAt: new Date(at).toISOString(),
  }
}

/** 存量单词按天摊开时，每天最多安排多少个进复习队列 */
export const REVIEW_BACKLOG_PER_DAY = 20

/**
 * 给存量已学单词生成初始复习记录，并把它们按天摊开：
 * 第 index 个词排到「今天 + floor(index / REVIEW_BACKLOG_PER_DAY) 天」，
 * 这样老用户不会一上来就面对上百个待复习，而是每天消化一批。
 */
export function backlogReviewState(
  wordId: string,
  index: number,
  at = Date.now(),
): ReviewState {
  const offsetDays = Math.floor(index / REVIEW_BACKLOG_PER_DAY)
  return {
    wordId,
    stage: 0,
    dueAt: new Date(at + offsetDays * DAY_MS).toISOString(),
    lastReviewedAt: new Date(at).toISOString(),
  }
}

/** 根据本次复习结果算出新状态：答对升级拉长间隔，答错回到最初 */
export function nextReviewState(
  prev: ReviewState | undefined,
  wordId: string,
  correct: boolean,
  at = Date.now(),
): ReviewState {
  const stage = correct ? Math.min((prev?.stage ?? 0) + 1, MAX_STAGE) : 0
  const delayMs = correct ? REVIEW_INTERVALS_DAYS[stage] * DAY_MS : WRONG_RETRY_MS
  return {
    wordId,
    stage,
    dueAt: new Date(at + delayMs).toISOString(),
    lastReviewedAt: new Date(at).toISOString(),
  }
}

/** 该记录是否已到期需要复习 */
export function isReviewDue(state: ReviewState, at = Date.now()): boolean {
  return new Date(state.dueAt).getTime() <= at
}
