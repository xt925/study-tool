#!/usr/bin/env node
/**
 * 校验 packages/core/src/data/words_*.ts 里单元 id 与词 id 是否自洽。
 *
 * 检查三项：
 *   1. 单元 id 不重复
 *   2. 单元编号连续无缺号（七上 0~6，其余册 1~6）
 *   3. 每个单元内部词 id 里的 uN 与该单元的编号一致
 *
 * 用法：node scripts/check_words_ids.mjs [目录]
 *   目录可省略，默认 packages/core/src/data（传目录主要用于自测）。
 * 发现问题时以非 0 退出，方便以后接进 CI。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultDir = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/core/src/data')
const dataDir = process.argv[2] ? resolve(process.argv[2]) : defaultDir

const UNIT_RE = /id:\s*'(grade(\d[ab])-unit(\d+))'/
const WORD_RE = /id:\s*'(g\d[ab]-u(\d+)-w\d+)'/

/** 七上从 Unit 0 开始，其余册从 Unit 1 开始 */
function expectedNumbers(file, count) {
  const start = file.startsWith('words_7a') ? 0 : 1
  return Array.from({ length: count }, (_, i) => start + i)
}

const problems = []
const files = readdirSync(dataDir)
  .filter((f) => /^words_\w+\.ts$/.test(f))
  .sort()

for (const file of files) {
  const lines = readFileSync(join(dataDir, file), 'utf8').split('\n')
  const units = []
  let current = null

  lines.forEach((line, i) => {
    const unit = line.match(UNIT_RE)
    if (unit) {
      current = { id: unit[1], num: Number(unit[3]), line: i + 1, badWords: [] }
      units.push(current)
      return
    }
    const word = line.match(WORD_RE)
    if (word && current && Number(word[2]) !== current.num) {
      current.badWords.push({ id: word[1], num: Number(word[2]), line: i + 1 })
    }
  })

  // 1. 单元 id 重复
  const firstSeen = new Map()
  for (const unit of units) {
    if (firstSeen.has(unit.id)) {
      problems.push(
        `${file}:${unit.line} 单元 id 重复 ${unit.id}（首次出现在第 ${firstSeen.get(unit.id)} 行）`,
      )
    } else {
      firstSeen.set(unit.id, unit.line)
    }
  }

  // 2. 编号连续
  const nums = units.map((u) => u.num)
  const expected = expectedNumbers(file, nums.length)
  if (nums.join(',') !== expected.join(',')) {
    problems.push(`${file} 单元编号应为 ${expected.join(',')}，实际是 ${nums.join(',')}`)
  }

  // 3. 单元的编号与内部词 id 的编号一致
  for (const unit of units) {
    for (const word of unit.badWords) {
      problems.push(
        `${file}:${word.line} 词 ${word.id} 的编号 u${word.num} 与所在单元 ${unit.id} 的编号 u${unit.num} 不一致`,
      )
    }
  }

  console.log(`${file}: ${units.length} 个单元 [${nums.join(',')}]`)
}

if (problems.length) {
  console.log(`\n发现 ${problems.length} 个问题：`)
  for (const p of problems) console.log(`  ✗ ${p}`)
  process.exit(1)
}

console.log('\n✓ 单元 id 唯一、编号连续、词 id 编号一致')
