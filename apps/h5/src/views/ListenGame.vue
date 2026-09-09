<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import UnitPicker from '@/components/UnitPicker.vue'
import RewardOverlay from '@/components/RewardOverlay.vue'
import { getAllWords, shuffle, type Unit, type Word } from '@study/core'
import { useProgressStore } from '@/stores/progress'
import { speak } from '@/utils/audio'

const router = useRouter()
const progress = useProgressStore()

const TOTAL = 5
const selectedUnit = ref<Unit | null>(null)
const questions = ref<Word[]>([])
const options = ref<string[][]>([])
const index = ref(0)
const streak = ref(0)
const bestStreak = ref(0)
const answered = ref(false)
const wasCorrect = ref(false)
const picked = ref('')
const showReward = ref(false)

function start(unit: Unit) {
  selectedUnit.value = unit
  const all = getAllWords()
  questions.value = shuffle(unit.words).slice(0, TOTAL)
  options.value = questions.value.map((w) => {
    const distractors = shuffle(
      all.filter((x) => x.id !== w.id && x.word !== w.word),
    ).slice(0, 2)
    return shuffle([w.word, ...distractors.map((d) => d.word)])
  })
  index.value = 0
  streak.value = 0
  bestStreak.value = 0
  answered.value = false
  wasCorrect.value = false
  picked.value = ''
}

function play() {
  const q = questions.value[index.value]
  if (q) speak(q.word)
}

function choose(opt: string) {
  if (answered.value) return
  picked.value = opt
  answered.value = true
  const q = questions.value[index.value]
  wasCorrect.value = opt === q?.word
  if (wasCorrect.value) {
    streak.value += 1
    bestStreak.value = Math.max(bestStreak.value, streak.value)
    progress.addStars(10) // 连对加分
  } else {
    streak.value = 0
  }
}

function next() {
  if (index.value < questions.value.length - 1) {
    index.value += 1
    answered.value = false
    wasCorrect.value = false
    picked.value = ''
  } else {
    showReward.value = true
  }
}

function restart() {
  selectedUnit.value = null
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="🎧 听音选词" @back="router.back()" />

    <div v-if="!selectedUnit" class="mt-6 px-5">
      <UnitPicker @select="start" />
    </div>

    <template v-else>
      <div class="mt-4 px-5 text-center">
        <p class="text-sm text-slate-400">
          第 {{ index + 1 }} / {{ TOTAL }} 题 · 当前连对 🔥{{ streak }}
        </p>
      </div>

      <div class="mt-4 px-5 text-center">
        <button
          class="rounded-full bg-amber-100 px-10 py-4 text-3xl shadow-sm transition active:scale-90"
          aria-label="播放发音"
          @click="play"
        >
          🔊
        </button>
        <p class="mt-2 text-xs text-slate-400">点击喇叭听发音</p>
      </div>

      <div class="mt-6 flex flex-col gap-3 px-5">
        <AppButton
          v-for="opt in options[index]"
          :key="opt"
          :color="
            answered
              ? opt === picked
                ? wasCorrect
                  ? 'green'
                  : 'orange'
                : opt === questions[index]?.word
                  ? 'green'
                  : 'ghost'
              : 'ghost'
          "
          @click="choose(opt)"
        >
          {{ opt }}
        </AppButton>
      </div>

      <div v-if="answered" class="mt-4 px-5">
        <div
          class="rounded-2xl p-4 text-center font-bold"
          :class="
            wasCorrect
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-500'
          "
        >
          {{ wasCorrect ? '🎉 答对 +10⭐' : `😅 正确答案是 ${questions[index]?.word}` }}
        </div>
        <AppButton class="mt-3" @click="next">
          {{ index < TOTAL - 1 ? '下一题' : '完成' }}
        </AppButton>
      </div>

      <div class="mt-4 px-5">
        <AppButton color="ghost" class="py-2 text-base" @click="restart"
          >↺ 换一个单元</AppButton
        >
      </div>
    </template>

    <RewardOverlay
      :show="showReward"
      title="挑战完成！"
      :message="`5 题结束，最高连对 🔥${bestStreak}，继续加油！`"
      button-text="🔄 再玩一次"
      @close="showReward = false; restart()"
    />
  </div>
</template>
