import { describe, expect, it } from 'vitest'

import { grades } from '../data/words'
import {
  buildChapter,
  currentChapterOf,
  knowledgeMarksOf,
  type ChapterData,
} from './chapters'
import type { ReviewState } from './review'

const grade = grades[0]
const unit = grade.units[0]
const total = unit.words.length
const FUTURE = '2999-01-01T00:00:00.000Z'
const PAST = '2020-01-01T00:00:00.000Z'

function stateOf(
  stage: number,
  lastReviewedAt = PAST,
  dueAt = FUTURE,
): ReviewState {
  return {
    wordId: '',
    stage,
    dueAt,
    lastReviewedAt,
  }
}

/** 让单元里的每个词都有复习记录 */
function allReviewed(stage: number, lastReviewedAt = PAST): Record<string, ReviewState> {
  return Object.fromEntries(
    unit.words.map((word) => [
      word.id,
      { ...stateOf(stage, lastReviewedAt), wordId: word.id },
    ]),
  )
}

function dataOf(overrides: Partial<ChapterData> = {}): ChapterData {
  return {
    learnedWords: [],
    reviewStates: {},
    listenResults: {},
    ...overrides,
  }
}

describe('章节节点', () => {
  it('新章节只开放学词节点', () => {
    const chapter = buildChapter(grade, unit, dataOf())
    expect(chapter.nodes.map((node) => node.unlocked)).toEqual([
      true,
      false,
      false,
      false,
    ])
    expect(chapter.completed).toBe(false)
  })

  it('学完单词只推进学词节点，复习仍需真正答对过', () => {
    const chapter = buildChapter(
      grade,
      unit,
      dataOf({
        learnedWords: unit.words.map((word) => word.id),
        reviewStates: allReviewed(0),
      }),
    )
    expect(chapter.nodes[0].done).toBe(true)
    expect(chapter.nodes[1].done).toBe(false)
    expect(chapter.nodes[1].unlocked).toBe(true)
  })

  it('听力通过后综合挑战才解锁，掌握度足够时章节完成', () => {
    const learned = unit.words.map((word) => word.id)
    const chapter = buildChapter(
      grade,
      unit,
      dataOf({
        learnedWords: learned,
        reviewStates: allReviewed(3),
        listenResults: { [unit.id]: { correct: 4, total: 5, at: PAST } },
      }),
    )
    expect(chapter.nodes[1].done).toBe(true)
    expect(chapter.nodes[2].done).toBe(true)
    expect(chapter.nodes[3].done).toBe(true)
    expect(chapter.completed).toBe(true)
  })

  it('到期的单词会让复习节点重新变为未完成', () => {
    const chapter = buildChapter(
      grade,
      unit,
      dataOf({
        learnedWords: unit.words.map((word) => word.id),
        reviewStates: Object.fromEntries(
          unit.words.map((word) => [
            word.id,
            { ...stateOf(3, PAST, PAST), wordId: word.id },
          ]),
        ),
      }),
    )
    expect(chapter.due).toBe(total)
    expect(chapter.nodes[1].done).toBe(false)
  })
})

describe('知识印记', () => {
  it('只统计达到掌握阶段的单词', () => {
    expect(knowledgeMarksOf(dataOf({ reviewStates: allReviewed(2) }))).toBe(0)
    expect(knowledgeMarksOf(dataOf({ reviewStates: allReviewed(3) }))).toBe(total)
  })
})

describe('当前章节', () => {
  it('优先返回开始过且最近复习的未完成章节', () => {
    const later = grade.units[1]
    const data = dataOf({
      learnedWords: [unit.words[0].id, ...later.words.map((w) => w.id)],
      reviewStates: {
        [unit.words[0].id]: { ...stateOf(0, '2026-01-01T00:00:00.000Z'), wordId: unit.words[0].id },
        ...Object.fromEntries(
          later.words.map((word) => [
            word.id,
            { ...stateOf(0, '2026-02-01T00:00:00.000Z'), wordId: word.id },
          ]),
        ),
      },
    })
    expect(currentChapterOf(data)?.unit.id).toBe(later.id)
  })

  it('全部完成时没有当前章节', () => {
    const allChapters = grades.flatMap((g) => g.units)
    const data = dataOf({
      learnedWords: allChapters.flatMap((u) => u.words.map((w) => w.id)),
      reviewStates: Object.fromEntries(
        allChapters.flatMap((u) =>
          u.words.map((word) => [
            word.id,
            { ...stateOf(3), wordId: word.id },
          ]),
        ),
      ),
      listenResults: Object.fromEntries(
        allChapters.map((u) => [
          u.id,
          { correct: 5, total: 5, at: PAST },
        ]),
      ),
    })
    expect(currentChapterOf(data)).toBeNull()
  })
})
