import type { Unit, Word } from '../data/words'
import { getAllWords, meaningOf } from '../data/words'

export type QuestionType = 'en2zh' | 'zh2en' | 'listen' | 'spell'

export interface Question {
  type: QuestionType
  word: Word
  /** 选择题的选项文本 / 拼写题的字母库 */
  options: string[]
  /** 拼写题的挖空显示，如 "_p_l_" */
  masked?: string
  /** 拼写题被挖掉的字母位置 */
  blankIndexes?: number[]
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** 生成 count 个不重复选项：1 个正确 + 干扰项（优先同单元，不足则从全部词补充） */
function pickDistractors(word: Word, pool: Word[], count: number): Word[] {
  const others = shuffle(pool.filter((w) => w.id !== word.id))
  const picked: Word[] = []
  for (const w of others) {
    if (picked.length >= count) break
    const dup = picked.some(
      (p) => meaningOf(p) === meaningOf(w) || p.word === w.word,
    )
    if (!dup) picked.push(w)
  }
  return picked
}

function maskWord(word: string): { masked: string; blankIndexes: number[] } {
  const letters = word.split('')
  const blankIndexes: number[] = []
  // 挖掉约一半的字母（至少 1 个），跳过重复的已挖位置
  const candidates = letters
    .map((_, i) => i)
    .filter((i) => /[a-zA-Z]/.test(letters[i]))
  const target = Math.max(1, Math.floor(candidates.length / 2))
  for (const i of shuffle(candidates)) {
    if (blankIndexes.length >= target) break
    blankIndexes.push(i)
  }
  blankIndexes.sort((a, b) => a - b)
  const masked = letters
    .map((ch, i) => (/[a-zA-Z]/.test(ch) && blankIndexes.includes(i) ? '_' : ch))
    .join('')
  return { masked, blankIndexes }
}

/** 基于一个 unit 生成 count 道混合题（4 种题型轮换打乱） */
export function generateQuiz(unit: Unit, count = 8): Question[] {
  const all = getAllWords()
  const types: QuestionType[] = ['en2zh', 'zh2en', 'listen', 'spell']
  const words = shuffle(unit.words).slice(0, count)
  const questions: Question[] = words.map((word, i) => {
    let type = types[i % types.length]
    // 词组带空格，不适合拼写题，换成听音选词
    if (type === 'spell' && (word.isPhrase || word.word.includes(' '))) {
      type = 'listen'
    }
    if (type === 'en2zh') {
      const distractors = pickDistractors(word, [...unit.words, ...all], 3)
      return {
        type,
        word,
        options: shuffle([meaningOf(word), ...distractors.map((w) => meaningOf(w))]),
      }
    }
    if (type === 'zh2en' || type === 'listen') {
      const distractors = pickDistractors(word, [...unit.words, ...all], 3)
      return {
        type,
        word,
        options: shuffle([word.word, ...distractors.map((w) => w.word)]),
      }
    }
    const { masked, blankIndexes } = maskWord(word.word)
    return {
      type: 'spell',
      word,
      options: shuffle(word.word.split('')),
      masked,
      blankIndexes,
    }
  })
  return questions
}
