<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import RewardOverlay from '@/components/RewardOverlay.vue'
import UnitPicker from '@/components/UnitPicker.vue'
import { speak } from '@/utils/audio'
import { meaningOf, shuffle, type Unit, type Word } from '@study/core'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()

interface Card {
  word: Word
  matched: boolean
  wrong: boolean
  color: string
}

interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

// 配对连线的颜色，按单词顺序循环使用
const PALETTE = ['#f472b6', '#38bdf8', '#a78bfa', '#fb923c', '#34d399', '#facc15']

const selectedUnit = ref<Unit | null>(null)
const enCards = ref<Card[]>([])
const zhCards = ref<Card[]>([])
const picked = ref<Card | null>(null)
const matchedCount = ref(0)
const showReward = ref(false)
const lines = ref<Line[]>([])
const boardRef = ref<HTMLElement | null>(null)
const itemRefs: Record<string, HTMLElement | null> = {}
let lock = false

function setRef(kind: 'en' | 'zh', id: string, el: unknown) {
  itemRefs[`${kind}:${id}`] = (el as HTMLElement | null) ?? null
}

function start(unit: Unit) {
  selectedUnit.value = unit
  const words = shuffle(unit.words).slice(0, Math.min(6, unit.words.length))
  enCards.value = words.map((w, i) => ({
    word: w,
    matched: false,
    wrong: false,
    color: PALETTE[i % PALETTE.length],
  }))
  // 中文列单独打乱，保证两列顺序不同
  zhCards.value = shuffle(enCards.value)
  picked.value = null
  matchedCount.value = 0
  lines.value = []
  lock = false
}

/** 根据卡片当前位置计算连线坐标（相对于棋盘容器） */
function measureLines() {
  const board = boardRef.value
  if (!board) return
  const b = board.getBoundingClientRect()
  lines.value = enCards.value
    .filter((c) => c.matched)
    .map((c) => {
      const a = itemRefs[`en:${c.word.id}`]?.getBoundingClientRect()
      const z = itemRefs[`zh:${c.word.id}`]?.getBoundingClientRect()
      if (!a || !z) return null
      return {
        x1: a.right - b.left,
        y1: a.top + a.height / 2 - b.top,
        x2: z.left - b.left,
        y2: z.top + z.height / 2 - b.top,
        color: c.color,
      }
    })
    .filter((l): l is Line => l !== null)
}

function onResize() {
  if (selectedUnit.value) measureLines()
}

onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

function tap(card: Card, kind: 'en' | 'zh') {
  if (lock || card.matched) return
  if (kind === 'en') speak(card.word.word)

  if (!picked.value) {
    picked.value = card
    return
  }
  // 已选同侧：改选当前；点了同一张：取消选择
  const pickedKind = enCards.value.includes(picked.value) ? 'en' : 'zh'
  if (pickedKind === kind) {
    picked.value = picked.value === card ? null : card
    return
  }

  if (picked.value.word.id === card.word.id) {
    picked.value.matched = true
    card.matched = true
    picked.value = null
    matchedCount.value += 1
    void nextTick(measureLines)
    if (matchedCount.value === enCards.value.length) {
      progress.addStars(30) // 全部配对完成奖励
      showReward.value = true
    }
  } else {
    const a = picked.value
    const b = card
    a.wrong = true
    b.wrong = true
    picked.value = null
    lock = true
    setTimeout(() => {
      a.wrong = false
      b.wrong = false
      lock = false
    }, 700)
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="🧩 单词配对" @back="router.back()" />

    <div v-if="!selectedUnit" class="mt-6 px-5">
      <UnitPicker @select="start" />
    </div>

    <template v-else>
      <p class="mt-4 text-center text-sm text-slate-400">
        点击英文听发音，把左右两列一一配对 · 已配对 {{ matchedCount }} /
        {{ enCards.length }}
      </p>

      <div class="mt-4 px-5">
        <div ref="boardRef" class="relative">
          <svg class="pointer-events-none absolute inset-0 h-full w-full">
            <line
              v-for="(l, i) in lines"
              :key="i"
              :x1="l.x1"
              :y1="l.y1"
              :x2="l.x2"
              :y2="l.y2"
              :stroke="l.color"
              stroke-width="4"
              stroke-linecap="round"
              pathLength="1"
              class="connect-line"
            />
          </svg>

          <div class="grid grid-cols-2 gap-x-12 gap-y-3">
            <div class="flex flex-col gap-3">
              <button
                v-for="c in enCards"
                :key="c.word.id"
                :ref="(el) => setRef('en', c.word.id, el)"
                class="rounded-2xl border-2 px-3 py-4 font-bold transition active:scale-95"
                :class="{
                  'text-slate-300 line-through': c.matched,
                  'border-sky-400 bg-sky-50 text-sky-700': picked === c,
                  'border-rose-400 bg-rose-50': c.wrong,
                  'border-slate-200 bg-white text-slate-700':
                    !c.matched && picked !== c && !c.wrong,
                }"
                @click="tap(c, 'en')"
              >
                {{ c.word.word }}
              </button>
            </div>
            <div class="flex flex-col gap-3">
              <button
                v-for="c in zhCards"
                :key="c.word.id"
                :ref="(el) => setRef('zh', c.word.id, el)"
                class="rounded-2xl border-2 px-3 py-4 font-bold transition active:scale-95"
                :class="{
                  'text-slate-300': c.matched,
                  'border-sky-400 bg-sky-50 text-sky-700': picked === c,
                  'border-rose-400 bg-rose-50': c.wrong,
                  'border-slate-200 bg-white text-slate-700':
                    !c.matched && picked !== c && !c.wrong,
                }"
                @click="tap(c, 'zh')"
              >
                {{ meaningOf(c.word) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 px-5">
        <AppButton color="ghost" class="py-2 text-base" @click="selectedUnit = null"
          >↺ 换一个单元</AppButton
        >
      </div>
    </template>

    <RewardOverlay
      :show="showReward"
      title="全部配对成功 +30⭐！"
      message="你的记忆力太棒了！"
      button-text="🔄 再玩一次"
      @close="showReward = false; selectedUnit = null"
    />
  </div>
</template>

<style scoped>
.connect-line {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-line 0.35s ease-out forwards;
}

@keyframes draw-line {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
