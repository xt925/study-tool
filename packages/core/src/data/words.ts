import words_7a from './words_7a'
import words_7b from './words_7b'
import words_8a from './words_8a'
import words_8b from './words_8b'
import words_9a from './words_9a'
import words_9b from './words_9b'
export interface Sense {
  pos: string // 词性，如 "n."；词组为空字符串
  meaning: string // 该词性对应的释义
}

export interface Word {
  id: string
  word: string // 单词或词组
  phonetic?: string // 音标（词组没有）
  senses: Sense[] // 词性+释义，一个词可能有多个词性（如 doubt n./v.）
  example?: string // 简单英文例句（可选，没有就不展示）
  exampleMeaning?: string // 例句中文
  audio?: string // 留空，发音走 utils/audio 的三级兜底
  isPhrase?: boolean // 词组
}

/** 单词的完整释义文本（多个词性的释义合并展示/出题用） */
export function meaningOf(word: Word): string {
  return word.senses.map((s) => s.meaning).join('；')
}

/** 词性文本，如 "n. v."；词组返回空串 */
export function posOf(word: Word): string {
  return word.senses.map((s) => s.pos).filter(Boolean).join(' ')
}

export interface Unit {
  id: string // 如 "grade7a-unit1"
  title: string // 如 "Unit 1"
  name?: string // 单元名，如 "School Life"；课本词表没有单元名时留空
  words: Word[]
}

export interface Grade {
  id: string // "grade7a"~"grade9b"，按学期分册（七上/七下/八上/八下/九上/九下）
  name: string // 如 "七年级上册"
  emoji: string
  units: Unit[]
}

export const grades: Grade[] = [
  words_7a,
  words_7b,
  words_8a,
  words_8b,
  words_9a,
  words_9b,
]

export function getGrade(gradeId: string): Grade | undefined {
  return grades.find((g) => g.id === gradeId)
}

export function getUnit(
  gradeId: string,
  unitId: string,
): { grade: Grade; unit: Unit } | undefined {
  const grade = getGrade(gradeId)
  const unit = grade?.units.find((u) => u.id === unitId)
  return grade && unit ? { grade, unit } : undefined
}

export function getAllWords(): Word[] {
  return grades.flatMap((g) => g.units.flatMap((u) => u.words))
}
