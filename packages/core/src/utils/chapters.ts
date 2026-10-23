/**
 * 章节地图：把教材单元当作一个个可探索的「区域」，
 * 每个区域有四个节点（学词 / 复习 / 听力 / 综合挑战）。
 *
 * 关键设计：所有节点状态都从已有的学习数据推导，不额外记录「已完成」，
 * 因此不存在反复刷同一关就能推进地图的问题。真正决定推进的是复习掌握度。
 */

import { grades, type Grade, type Unit } from '../data/words'
import { MASTERED_STAGE } from './achievements'
import { isReviewDue, type ReviewState } from './review'

/** 复习节点：单元内至少这么多比例的单词「复习答对过」才算过关 */
const REVIEW_SHARE = 0.6

/** 综合挑战节点：单元内至少这么多比例的单词达到掌握阶段 */
const MASTERY_SHARE = 0.6

/** 听力节点：一轮听力挑战的正确率门槛 */
const LISTEN_PASS_RATE = 0.8

/** 听力挑战的最好成绩，按单元记录（一轮 5 题，只存最好的一轮） */
export interface ListenResult {
  correct: number
  total: number
  /** 记录时间（ISO 字符串），多设备合并时用 */
  at: string
}

/** 推导章节状态所需的最小进度数据（避免 core 里互相引用 store） */
export interface ChapterData {
  learnedWords: string[]
  reviewStates: Record<string, ReviewState>
  listenResults?: Record<string, ListenResult>
}

export type ChapterNodeId = 'learn' | 'review' | 'listen' | 'challenge'

export interface ChapterNode {
  id: ChapterNodeId
  emoji: string
  title: string
  /** 节点下方的一行进度说明 */
  detail: string
  done: boolean
  /** 前置节点没完成时不可进入 */
  unlocked: boolean
}

export interface Chapter {
  grade: Grade
  unit: Unit
  /** 已学词数 */
  learned: number
  /** 单元总词数 */
  total: number
  /** 复习到掌握阶段的词数（= 该章节贡献的知识印记） */
  mastered: number
  /** 当前到期待复习的词数 */
  due: number
  nodes: ChapterNode[]
  doneCount: number
  completed: boolean
  /** 该章节最近一次复习时间，用来挑「当前章节」 */
  lastActiveAt: string
}

function ratioNeed(total: number, share: number): number {
  return Math.max(1, Math.ceil(total * share))
}

/** 从任意来源（本地 / 服务器）读到的数据里挑出合法的听力成绩 */
export function normalizeListenResults(
  raw: unknown,
): Record<string, ListenResult> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, ListenResult> = {}
  for (const [unitId, value] of Object.entries(
    raw as Record<string, Partial<ListenResult>>,
  )) {
    if (
      value &&
      typeof value.correct === 'number' &&
      typeof value.total === 'number' &&
      value.total > 0 &&
      typeof value.at === 'string'
    ) {
      out[unitId] = {
        correct: Math.max(0, Math.min(value.correct, value.total)),
        total: value.total,
        at: value.at,
      }
    }
  }
  return out
}

/** 单个单元的章节状态 */
export function buildChapter(
  grade: Grade,
  unit: Unit,
  data: ChapterData,
  at = Date.now(),
): Chapter {
  const learnedSet = new Set(data.learnedWords)
  const total = unit.words.length
  let learned = 0
  let reviewed = 0
  let mastered = 0
  let due = 0
  let lastActiveAt = ''

  for (const word of unit.words) {
    if (learnedSet.has(word.id)) learned += 1
    const record = data.reviewStates[word.id]
    if (!record) continue
    if (record.stage >= 1) reviewed += 1
    if (record.stage >= MASTERED_STAGE) mastered += 1
    if (isReviewDue(record, at)) due += 1
    if (record.lastReviewedAt > lastActiveAt) lastActiveAt = record.lastReviewedAt
  }

  const needReview = ratioNeed(total, REVIEW_SHARE)
  const needMaster = ratioNeed(total, MASTERY_SHARE)
  const listen = data.listenResults?.[unit.id]
  const listenNeed = listen ? ratioNeed(listen.total, LISTEN_PASS_RATE) : 0

  const learnDone = total > 0 && learned === total
  const reviewDone = total > 0 && due === 0 && reviewed >= needReview
  const listenDone = !!listen && listen.correct >= listenNeed
  const challengeDone = total > 0 && mastered >= needMaster

  const nodes: ChapterNode[] = [
    {
      id: 'learn',
      emoji: '📖',
      title: '认识新词',
      detail: `${learned}/${total} 个单词`,
      done: learnDone,
      unlocked: true,
    },
    {
      id: 'review',
      emoji: '🔁',
      title: '复习巩固',
      detail:
        due > 0
          ? `${due} 个词等着复习`
          : reviewDone
            ? '复习已过关'
            : `已复习 ${reviewed}/${needReview}`,
      done: reviewDone,
      unlocked: learned > 0,
    },
    {
      id: 'listen',
      emoji: '🎧',
      title: '听力挑战',
      detail: listen
        ? `最好成绩 ${listen.correct}/${listen.total}`
        : `答对 ${Math.round(LISTEN_PASS_RATE * 100)}% 即可通过`,
      done: listenDone,
      unlocked: reviewDone,
    },
    {
      id: 'challenge',
      emoji: '⚔️',
      title: '综合挑战',
      detail: `掌握 ${mastered}/${needMaster} 个才点亮`,
      done: challengeDone,
      unlocked: listenDone,
    },
  ]

  const doneCount = nodes.filter((node) => node.done).length
  return {
    grade,
    unit,
    learned,
    total,
    mastered,
    due,
    nodes,
    doneCount,
    completed: doneCount === nodes.length,
    lastActiveAt,
  }
}

/** 按教材顺序展开全部章节 */
export function buildChapters(data: ChapterData, at = Date.now()): Chapter[] {
  return grades.flatMap((grade) =>
    grade.units.map((unit) => buildChapter(grade, unit, data, at)),
  )
}

/** 知识印记总数：每个复习到掌握阶段的单词产出一枚，单词量就是上限 */
export function knowledgeMarksOf(data: ChapterData): number {
  return Object.values(data.reviewStates).filter(
    (record) => record.stage >= MASTERED_STAGE,
  ).length
}

/**
 * 当前应该继续的章节：
 * 优先「已经开始但没完成」的章节里最近复习过的那一个，否则从第一章开始。
 */
export function currentChapterOf(
  data: ChapterData,
  at = Date.now(),
): Chapter | null {
  const chapters = buildChapters(data, at)
  const pending = chapters.filter((chapter) => !chapter.completed)
  if (pending.length === 0) return null
  const started = pending.filter((chapter) => chapter.learned > 0)
  if (started.length === 0) return pending[0]
  return started.reduce((best, chapter) =>
    chapter.lastActiveAt > best.lastActiveAt ? chapter : best,
  )
}
