<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import RewardOverlay from '@/components/RewardOverlay.vue'
import UnitPicker from '@/components/UnitPicker.vue'
import { meaningOf, shuffle, type Unit, type Word } from '@study/core'
import { useProgressStore } from '@/stores/progress'
import { speak, stopSpeak } from '@/utils/audio'
import {
  cancelRecording,
  evaluateSpeech,
  startRecording,
  stopRecording,
  type SpeechScore,
} from '@/utils/speech'

const router = useRouter()
const progress = useProgressStore()

const TOTAL = 5

/** idle 未录音 / recording 录音中 / scoring 评分中 / done 已出分 */
type Phase = 'idle' | 'recording' | 'scoring' | 'done'

const selectedUnit = ref<Unit | null>(null)
const words = ref<Word[]>([])
const index = ref(0)
const phase = ref<Phase>('idle')
const score = ref<SpeechScore | null>(null)
const error = ref('')
const bestScore = ref(0)
const showReward = ref(false)

const current = computed(() => words.value[index.value])

/** 读得不准的音素，用来给针对性提示 */
const weakPhonemes = computed(() => {
  const s = score.value
  if (!s) return []
  const seen = new Set<string>()
  const out: { phone: string; accuracy: number }[] = []
  for (const w of s.words) {
    if (w.matchTag !== 0) continue
    for (const p of w.phonemes) {
      const label = p.reference || p.phone
      if (!label || p.accuracy < 0 || p.accuracy >= 70 || seen.has(label)) continue
      seen.add(label)
      out.push({ phone: label, accuracy: p.accuracy })
    }
  }
  return out.sort((a, b) => a.accuracy - b.accuracy).slice(0, 4)
})

function start(unit: Unit) {
  selectedUnit.value = unit
  words.value = shuffle(unit.words).slice(0, TOTAL)
  index.value = 0
  bestScore.value = 0
  resetTurn()
}

function resetTurn() {
  phase.value = 'idle'
  score.value = null
  error.value = ''
}

function playWord() {
  if (current.value) speak(current.value.word)
}

async function toggleRecord() {
  if (phase.value === 'recording') {
    phase.value = 'scoring'
    try {
      const pcm = await stopRecording()
      const result = await evaluateSpeech(current.value!.word, pcm, 'word')
      score.value = result
      phase.value = 'done'
      bestScore.value = Math.max(bestScore.value, result.total)
      if (result.total >= 80) progress.addStars(10)
      else if (result.total >= 60) progress.addStars(5)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '评测失败，请重试'
      phase.value = 'idle'
    }
    return
  }

  error.value = ''
  score.value = null
  stopSpeak()
  try {
    await startRecording()
    phase.value = 'recording'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法使用麦克风'
  }
}

function retry() {
  resetTurn()
}

function next() {
  if (index.value < words.value.length - 1) {
    index.value += 1
    resetTurn()
  } else {
    showReward.value = true
  }
}

function restart() {
  selectedUnit.value = null
}

function scoreClass(v: number): string {
  if (v >= 85) return 'text-emerald-600'
  if (v >= 60) return 'text-amber-500'
  return 'text-rose-500'
}

function advice(total: number): string {
  if (total >= 85) return '🎉 读得很棒！'
  if (total >= 60) return '👍 不错，再读顺一点更好'
  return '💪 慢一点，跟着发音再读一次'
}

onUnmounted(cancelRecording)
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="🎤 跟读打分" @back="router.back()" />

    <div v-if="!selectedUnit" class="mt-6 px-5">
      <UnitPicker @select="start" />
    </div>

    <template v-else>
      <div class="mt-4 px-5 text-center text-sm text-slate-400">
        第 {{ index + 1 }} / {{ Math.min(TOTAL, words.length) }} 个词
      </div>

      <div class="mt-4 rounded-3xl bg-white p-6 text-center shadow-sm mx-5">
        <p class="text-3xl font-bold text-slate-800">
          {{ current?.word }}
        </p>
        <p v-if="current?.phonetic" class="mt-1 text-slate-400">
          /{{ current.phonetic }}/
        </p>
        <p class="mt-2 text-slate-500">{{ current ? meaningOf(current) : '' }}</p>
        <button
          class="mt-4 rounded-full bg-amber-100 px-8 py-3 text-2xl shadow-sm transition active:scale-90"
          aria-label="播放标准发音"
          @click="playWord"
        >
          🔊
        </button>
        <p class="mt-1 text-xs text-slate-400">先听一遍，再点下面录音跟读</p>
      </div>

      <div class="mt-6 px-5 text-center">
        <button
          class="h-24 w-24 rounded-full text-4xl text-white shadow-lg transition active:scale-90 disabled:opacity-50"
          :class="phase === 'recording' ? 'bg-rose-500' : 'bg-sky-500'"
          :disabled="phase === 'scoring'"
          :aria-label="phase === 'recording' ? '结束录音' : '开始录音'"
          @click="toggleRecord"
        >
          {{ phase === 'recording' ? '⏹' : '🎤' }}
        </button>
        <p class="mt-2 text-sm text-slate-400">
          {{
            phase === 'recording'
              ? '读完点一下结束'
              : phase === 'scoring'
                ? '评分中…'
                : '点一下开始录音'
          }}
        </p>
      </div>

      <p v-if="error" class="mt-4 px-5 text-center text-rose-500">{{ error }}</p>

      <div v-if="score" class="mt-5 px-5">
        <div class="rounded-3xl bg-white p-5 shadow-sm">
          <div class="text-center">
            <p class="text-5xl font-bold" :class="scoreClass(score.total)">
              {{ Math.round(score.total) }}
            </p>
            <p class="mt-1 text-sm text-slate-400">{{ advice(score.total) }}</p>
          </div>

          <div class="mt-4 flex flex-col gap-2">
            <div
              v-for="dim in [
                { label: '准确度', value: score.accuracy },
                { label: '流利度', value: score.fluency },
                { label: '完整度', value: score.completion },
              ]"
              :key="dim.label"
              class="flex items-center gap-3"
            >
              <span class="w-14 shrink-0 text-sm text-slate-500">{{ dim.label }}</span>
              <span class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  class="block h-full rounded-full bg-sky-400"
                  :style="{ width: `${Math.max(0, Math.min(100, dim.value))}%` }"
                />
              </span>
              <span class="w-10 shrink-0 text-right text-sm text-slate-500">
                {{ Math.round(dim.value) }}
              </span>
            </div>
          </div>

          <p v-if="weakPhonemes.length" class="mt-4 text-sm text-slate-500">
            需要练习的音：
            <span
              v-for="p in weakPhonemes"
              :key="p.phone"
              class="mr-2 rounded-lg bg-rose-50 px-2 py-0.5 font-mono text-rose-500"
            >
              /{{ p.phone }}/
            </span>
          </p>
        </div>

        <div class="mt-3 flex gap-3">
          <AppButton color="ghost" @click="retry">↺ 再读一次</AppButton>
          <AppButton @click="next">
            {{ index < words.length - 1 ? '下一个词' : '完成' }}
          </AppButton>
        </div>
      </div>

      <div class="mt-4 px-5">
        <AppButton color="ghost" class="py-2 text-base" @click="restart"
          >↺ 换一个单元</AppButton
        >
      </div>
    </template>

    <RewardOverlay
      :show="showReward"
      title="跟读完成！"
      :message="`最高分 ${Math.round(bestScore)}，继续加油！`"
      button-text="🔄 再玩一次"
      @close="showReward = false; restart()"
    />
  </div>
</template>
