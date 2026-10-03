<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import {
  getAllWords,
  grades,
  meaningOf,
  shuffle,
  type Word,
} from '@study/core'
import { useProgressStore } from '@/stores/progress'
import { speak, stopSpeak } from '@/utils/audio'

const LANES = 4
const LANE_DIRS = [1, -1, 1, -1] // 相邻两层荷叶漂动方向相反
const BASE_SPEEDS = [26, 34, 29, 36] // px/s，每层不同速
const FROGS_TO_WIN = 4
const START_LIVES = 3
const AUTO_HOP_MS = 700 // 跳上顶层荷叶后停留这么久自动上岸

interface Pad {
  id: number
  lane: number
  x: number // 左边缘，相对河面容器的 px
  w: number
  word: Word
}

const router = useRouter()
const progress = useProgressStore()

// ---------- 词库范围选择 ----------
type RangeMode = 'all' | 'grade' | 'unit'
const mode = ref<RangeMode>('all')
const gradeId = ref(grades[0].id)
const unitId = ref(grades[0].units[0].id)

const pool = computed<Word[]>(() => {
  let words: Word[]
  if (mode.value === 'all') {
    words = getAllWords()
  } else if (mode.value === 'grade') {
    words = (grades.find((g) => g.id === gradeId.value)?.units ?? []).flatMap(
      (u) => u.words,
    )
  } else {
    const g = grades.find((x) => x.id === gradeId.value)
    words = g?.units.find((u) => u.id === unitId.value)?.words ?? []
  }
  // 荷叶上逐字母打字，只保留纯字母单词（过滤词组和带符号的词）
  return words.filter((w) => /^[a-zA-Z]+$/.test(w.word))
})

function onGradeChange() {
  const g = grades.find((x) => x.id === gradeId.value)
  unitId.value = g?.units[0]?.id ?? ''
}

// ---------- 游戏状态 ----------
const phase = ref<'pick' | 'playing' | 'won' | 'lost'>('pick')
const pads = ref<Pad[]>([])
const frog = ref({ lane: -1, padId: null as number | null, x: 180 })
const typed = ref('')
const targetId = ref<number | null>(null)
const lives = ref(START_LIVES)
const crossed = ref(0)
const wordsDone = ref(0)
const mistakes = ref(0)
const lastWord = ref<Word | null>(null)
const splash = ref<{ x: number; lane: number } | null>(null)
const flashWrong = ref(false)
const jumping = ref(false)
const earnedStars = ref(0)

const riverEl = ref<HTMLElement | null>(null)
const riverWidth = ref(360)

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

let activePool: Word[] = []
let wordBag: Word[] = []
let padSeq = 0
let rafId = 0
let lastTs = 0
const timeouts: number[] = []

function laneTop(lane: number): string {
  // LANES = 4 → lane 4 = 对岸，-1 = 出发岸
  const tops: Record<number, number> = {
    4: 24,
    3: 72,
    2: 128,
    1: 184,
    0: 240,
    [-1]: 296,
  }
  return `${tops[lane] ?? 296}px`
}

function padCenter(p: Pad): number {
  return p.x + p.w / 2
}

function nextWord(): Word {
  if (wordBag.length === 0) wordBag = shuffle(activePool)
  return wordBag.pop()!
}

function spawn(lane: number) {
  const word = nextWord()
  const w = Math.max(72, word.word.length * 11 + 30)
  const x = LANE_DIRS[lane] === 1 ? -w : riverWidth.value
  pads.value.push({ id: padSeq++, lane, x, w, word })
}

function maybeSpawn(lane: number) {
  const dir = LANE_DIRS[lane]
  const lanePads = pads.value.filter((p) => p.lane === lane)
  const gap = 70 + Math.random() * 90
  if (dir === 1) {
    const rear = lanePads.length ? Math.min(...lanePads.map((p) => p.x)) : Infinity
    if (rear > gap) spawn(lane)
  } else {
    const rearRight = lanePads.length
      ? Math.max(...lanePads.map((p) => p.x + p.w))
      : -Infinity
    if (rearRight < riverWidth.value - gap) spawn(lane)
  }
}

function tick(ts: number) {
  const dt = Math.min((ts - lastTs) / 1000, 0.05)
  lastTs = ts
  const speedScale = 1 + crossed.value * 0.05

  for (const p of pads.value) {
    p.x += LANE_DIRS[p.lane] * BASE_SPEEDS[p.lane] * speedScale * dt
  }

  // 漂出屏幕的荷叶移除；青蛙站在上面则掉水
  const W = riverWidth.value
  const gone = pads.value.filter((p) =>
    LANE_DIRS[p.lane] === 1 ? p.x > W + 10 : p.x + p.w < -10,
  )
  if (gone.length) {
    const doomed = gone.find((p) => p.id === frog.value.padId)
    pads.value = pads.value.filter((p) => !gone.includes(p))
    if (doomed) loseLife(padCenter(doomed), doomed.lane)
  }

  // 青蛙跟着所站荷叶移动
  if (frog.value.padId !== null) {
    const host = pads.value.find((p) => p.id === frog.value.padId)
    if (host) frog.value.x = padCenter(host)
  }

  for (let lane = 0; lane < LANES; lane++) maybeSpawn(lane)

  if (phase.value === 'playing') rafId = requestAnimationFrame(tick)
}

function startLoop() {
  cancelAnimationFrame(rafId)
  lastTs = performance.now()
  rafId = requestAnimationFrame(tick)
}

function handleChar(raw: string) {
  if (phase.value !== 'playing') return
  if (frog.value.lane >= LANES - 1) return // 已在顶层或对岸，等自动上岸
  const ch = raw.toLowerCase()
  if (!/^[a-z]$/.test(ch)) return
  const next = typed.value + ch
  const nextLane = frog.value.lane + 1
  const candidates = pads.value.filter(
    (p) => p.lane === nextLane && p.word.word.toLowerCase().startsWith(next),
  )
  if (candidates.length === 0) {
    mistakes.value += 1
    typed.value = ''
    targetId.value = null
    flashWrong.value = false
    requestAnimationFrame(() => {
      flashWrong.value = true
    })
    return
  }
  typed.value = next
  const exact = candidates.find((p) => p.word.word.toLowerCase() === next)
  const target =
    exact ??
    [...candidates].sort(
      (a, b) => Math.abs(padCenter(a) - frog.value.x) - Math.abs(padCenter(b) - frog.value.x),
    )[0]
  targetId.value = target.id
  if (exact) jumpTo(exact)
}

function jumpTo(pad: Pad) {
  frog.value.lane = pad.lane
  frog.value.padId = pad.id
  frog.value.x = padCenter(pad)
  typed.value = ''
  targetId.value = null
  wordsDone.value += 1
  lastWord.value = pad.word
  speak(pad.word.word)
  jumping.value = false
  requestAnimationFrame(() => {
    jumping.value = true
  })
  if (pad.lane === LANES - 1) {
    const id = pad.id
    timeouts.push(
      window.setTimeout(() => {
        if (phase.value === 'playing' && frog.value.padId === id) reachBank()
      }, AUTO_HOP_MS),
    )
  }
}

function reachBank() {
  crossed.value += 1
  frog.value = { lane: LANES, padId: null, x: frog.value.x }
  jumping.value = false
  requestAnimationFrame(() => {
    jumping.value = true
  })
  if (crossed.value >= FROGS_TO_WIN) {
    endGame(true)
    return
  }
  timeouts.push(
    window.setTimeout(() => {
      if (phase.value === 'playing') {
        frog.value = { lane: -1, padId: null, x: riverWidth.value / 2 }
      }
    }, 700),
  )
}

function loseLife(x: number, lane: number) {
  lives.value -= 1
  splash.value = { x: Math.min(Math.max(x, 24), riverWidth.value - 24), lane }
  frog.value = { lane: -1, padId: null, x: riverWidth.value / 2 }
  typed.value = ''
  targetId.value = null
  timeouts.push(
    window.setTimeout(() => {
      splash.value = null
    }, 800),
  )
  if (lives.value <= 0) endGame(false)
}

function endGame(won: boolean) {
  phase.value = won ? 'won' : 'lost'
  cancelAnimationFrame(rafId)
  earnedStars.value = won
    ? 10 + FROGS_TO_WIN * 3
    : Math.min(wordsDone.value, 15)
  if (earnedStars.value > 0) progress.addStars(earnedStars.value)
}

function start() {
  if (pool.value.length === 0) return
  activePool = pool.value
  wordBag = []
  pads.value = []
  typed.value = ''
  targetId.value = null
  lives.value = START_LIVES
  crossed.value = 0
  wordsDone.value = 0
  mistakes.value = 0
  lastWord.value = null
  splash.value = null
  frog.value = { lane: -1, padId: null, x: riverWidth.value / 2 }
  phase.value = 'playing'
  void nextTick(() => {
    riverWidth.value = riverEl.value?.clientWidth ?? 360
    startLoop()
  })
}

function backToPick() {
  phase.value = 'pick'
  cancelAnimationFrame(rafId)
  timeouts.forEach((t) => window.clearTimeout(t))
  timeouts.length = 0
  stopSpeak()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key.length === 1) handleChar(e.key)
}

function onResize() {
  if (phase.value === 'playing') {
    riverWidth.value = riverEl.value?.clientWidth ?? riverWidth.value
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(rafId)
  timeouts.forEach((t) => window.clearTimeout(t))
  stopSpeak()
})
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="🐸 打字过河" @back="router.back()" />

    <!-- 词库范围选择 -->
    <div v-if="phase === 'pick'" class="mt-6 px-5">
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <h3 class="mb-3 font-bold text-slate-700">1️⃣ 单词范围</h3>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="m in [
              { id: 'all', label: '🌍 全部单词' },
              { id: 'grade', label: '📚 按年级' },
              { id: 'unit', label: '📖 按单元' },
            ]"
            :key="m.id"
            class="rounded-2xl border-2 py-3 font-bold transition active:scale-95"
            :class="
              mode === m.id
                ? 'border-sky-400 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-500'
            "
            @click="mode = m.id as RangeMode"
          >
            {{ m.label }}
          </button>
        </div>

        <template v-if="mode !== 'all'">
          <h3 class="mb-3 mt-5 font-bold text-slate-700">2️⃣ 选择年级</h3>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="g in grades"
              :key="g.id"
              class="rounded-2xl border-2 py-3 font-bold transition active:scale-95"
              :class="
                gradeId === g.id
                  ? 'border-sky-400 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-white text-slate-500'
              "
              @click="gradeId = g.id; onGradeChange()"
            >
              {{ g.emoji }} {{ g.name }}
            </button>
          </div>
        </template>

        <template v-if="mode === 'unit'">
          <h3 class="mb-3 mt-5 font-bold text-slate-700">3️⃣ 选择单元</h3>
          <div class="flex flex-col gap-2">
            <button
              v-for="u in grades.find((x) => x.id === gradeId)?.units"
              :key="u.id"
              class="rounded-2xl border-2 px-4 py-3 text-left font-semibold transition active:scale-95"
              :class="
                unitId === u.id
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
              "
              @click="unitId = u.id"
            >
              {{ u.title }}{{ u.name ? ' · ' + u.name : '' }}
              <span class="float-right text-xs text-slate-400">{{ u.words.length }} 词</span>
            </button>
          </div>
        </template>

        <AppButton class="mt-5" :disabled="pool.length === 0" @click="start">
          🚀 开始（{{ pool.length }} 词可用）
        </AppButton>
        <p class="mt-3 text-center text-xs leading-5 text-slate-400">
          荷叶会漂走！在荷叶消失前打出上面的单词，青蛙才能跳上去。<br />
          青蛙站着的荷叶漂出屏幕就会掉水里，{{ START_LIVES }} 条命帮 {{ FROGS_TO_WIN }} 只青蛙过河。
        </p>
      </div>
    </div>

    <template v-else>
      <!-- 河面 -->
      <div
        ref="riverEl"
        class="relative mx-4 mt-4 h-80 select-none overflow-hidden rounded-3xl bg-gradient-to-b from-sky-300 via-sky-400 to-sky-300 shadow-sm transition-shadow"
        :class="{ 'river-wrong': flashWrong }"
      >
        <!-- 两岸 -->
        <div class="absolute inset-x-0 top-0 flex h-12 items-center justify-center gap-1 bg-emerald-200/90 text-xl">
          <!-- <span>🏁</span> -->
          <span v-for="i in crossed" :key="i">🐸</span>
          <span class="ml-1 text-sm font-bold text-emerald-700">{{ crossed }}/{{ FROGS_TO_WIN }}</span>
        </div>
        <div class="absolute inset-x-0 bottom-0 flex h-12 items-center justify-between bg-emerald-200/90 text-sm font-bold text-emerald-700 px-1">
          <span>
            {{ '❤️'.repeat(lives) || '💔' }}
          </span>
          <span>
            打对 {{ wordsDone }} 词 · 打错 {{ mistakes }} 次
          </span>
        </div>

        <!-- 荷叶 -->
        <div
          v-for="p in pads"
          :key="p.id"
          class="absolute flex h-10 -translate-y-1/2 items-center justify-center rounded-full border-2 font-bold shadow-sm transition-colors"
          :class="
            p.id === targetId
              ? 'border-yellow-300 bg-emerald-500 text-white'
              : 'border-emerald-600/40 bg-emerald-400/90 text-emerald-950'
          "
          :style="{ left: `${p.x}px`, width: `${p.w}px`, top: laneTop(p.lane) }"
        >
          <template v-if="p.id === targetId && typed">
            <span class="text-yellow-200">{{ p.word.word.slice(0, typed.length) }}</span>
            <span>{{ p.word.word.slice(typed.length) }}</span>
          </template>
          <template v-else>{{ p.word.word }}</template>
        </div>

        <!-- 落水水花 -->
        <div
          v-if="splash"
          class="absolute -translate-x-1/2 -translate-y-1/2 text-3xl"
          :style="{ left: `${splash.x}px`, top: laneTop(splash.lane) }"
        >
          💦
        </div>

        <!-- 青蛙 -->
        <div
          class="absolute -translate-x-1/2 -translate-y-1/2 text-3xl"
          :class="{ 'frog-jump': jumping }"
          :style="{ left: `${frog.x}px`, top: laneTop(frog.lane) }"
        >
          🐸
        </div>
      </div>

      <!-- <p class="mt-2 text-center text-xs text-slate-400">
        从下往上跳：打出下一层荷叶上的单词，青蛙就会跳过去
      </p> -->

      <!-- 刚完成单词的释义条（打完即展示 + 自动发音） -->
      <div
        class="mx-4 mt-2 flex items-baseline gap-2 rounded-2xl border border-amber-200 bg-amber-50 flex justify-between px-3 py-[2px] min-h-8 shadow-sm"
      >
        <span class="shrink-0 text-lg font-extrabold text-slate-800">{{ lastWord?.word }}</span>
        <span class="min-w-0 text-sm text-slate-600">{{ lastWord ? meaningOf(lastWord) : '' }}</span>
      </div>

      <!-- <div class="mt-4 px-5">
        <AppButton color="ghost" class="py-2 text-base" @click="backToPick">↺ 换单词范围</AppButton>
      </div> -->

      <!-- 屏幕小键盘（手机点按输入；桌面端实体键盘同样可用） -->
      <template v-if="phase === 'playing'">
        <!-- <div class="h-40"></div> -->
        <div class="inset-x-0 z-10 bg-slate-100/95 px-2 pb-3 pt-2 backdrop-blur mt-2">
          <div
            v-for="(row, ri) in KEY_ROWS"
            :key="row"
            class="mx-auto flex max-w-md justify-center gap-1"
            :class="{ 'mb-1.5': ri < KEY_ROWS.length - 1 }"
          >
            <button
              v-for="k in row"
              :key="k"
              class="h-11 w-8 shrink-0 rounded-lg bg-white text-base font-bold uppercase text-slate-700 shadow active:scale-90 active:bg-sky-100"
              @pointerdown.prevent="handleChar(k)"
            >
              {{ k }}
            </button>
          </div>
        </div>
      </template>
    </template>

    <!-- 结算 -->
    <Teleport to="body">
      <div
        v-if="phase === 'won' || phase === 'lost'"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6"
      >
        <div class="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
          <div class="mb-2 text-6xl">{{ phase === 'won' ? '🎉' : '💦' }}</div>
          <h2 class="mb-1 text-xl font-bold text-slate-800">
            {{ phase === 'won' ? `全部过河 +${earnedStars}⭐！` : `青蛙掉水里了 +${earnedStars}⭐` }}
          </h2>
          <p class="mb-5 text-slate-500">
            {{
              phase === 'won'
                ? `${FROGS_TO_WIN} 只青蛙全部安全到达对岸，太厉害了！`
                : `送过去 ${crossed} 只，打对 ${wordsDone} 个单词，再接再厉！`
            }}
          </p>
          <AppButton @click="start">🔄 再来一局</AppButton>
          <AppButton color="ghost" class="mt-2 py-2 text-base" @click="backToPick">
            ↺ 换单词范围
          </AppButton>
          <AppButton color="ghost" class="mt-2 py-2 text-base" @click="router.push('/games')">
            🏠 不玩了，返回游戏乐园
          </AppButton>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.frog-jump {
  animation: frog-jump 0.45s ease-in-out;
}

@keyframes frog-jump {
  50% {
    transform: translate(-50%, -160%) scale(1.15);
  }
}

.river-wrong {
  animation: river-wrong 0.3s;
}

@keyframes river-wrong {
  50% {
    box-shadow: inset 0 0 0 4px rgb(244 63 94 / 0.7);
  }
}
</style>
