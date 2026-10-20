<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import AppButton from '@/components/AppButton.vue'
import OptionButton from '@/components/OptionButton.vue'
import ProgressDots from '@/components/ProgressDots.vue'
import SpellFill from '@/components/SpellFill.vue'
import { meaningOf, posOf, type Question } from '@study/core'
import { useProgressStore } from '@/stores/progress'
import { speak, stopSpeak } from '@/utils/audio'

const props = defineProps<{ questions: Question[] }>()
const emit = defineEmits<{ replay: []; exit: [] }>()

const progress = useProgressStore()

const index = ref(0)
const selected = ref<string | null>(null)
const answered = ref(false)
const wasCorrect = ref(false)
const correctCount = ref(0)
const finished = ref(false)

const current = computed(() => props.questions[index.value])

function isChoice(type: string): boolean {
  return type === 'en2zh' || type === 'zh2en' || type === 'listen'
}

function choose(option: string) {
  if (answered.value || !current.value) return
  selected.value = option
  answered.value = true
  const ok =
    current.value.type === 'en2zh'
      ? option === meaningOf(current.value.word)
      : option === current.value.word.word
  wasCorrect.value = ok
  if (ok) {
    correctCount.value += 1
    progress.answerCorrect() // 答对 +10⭐
  } else {
    progress.recordWrong(current.value.word.id) // 记进错题本
  }
}

function next() {
  if (index.value < props.questions.length - 1) {
    index.value += 1
    selected.value = null
    answered.value = false
    wasCorrect.value = false
  } else {
    finished.value = true
  }
}

onBeforeUnmount(stopSpeak)
</script>

<template>
  <div v-if="!finished" class="flex flex-1 flex-col px-5 pt-4">
    <ProgressDots :total="questions.length" :filled="index + 1" />
    <p class="mt-2 text-center text-xs text-slate-400">
      第 {{ index + 1 }} / {{ questions.length }} 题 · 已得
      {{ correctCount * 10 }} 分
    </p>

    <div v-if="current" class="mt-4 flex-1">
      <div class="rounded-3xl bg-white p-6 text-center shadow-sm">
        <template v-if="current.type === 'en2zh'">
          <p class="text-xs font-bold uppercase tracking-widest text-sky-400">
            看英文选中文
          </p>
          <h2 class="mt-2 text-3xl font-extrabold text-slate-800">
            {{ current.word.word }}
          </h2>
          <p class="mt-1 text-sm text-slate-400">{{ current.word.phonetic }}</p>
          <button
            class="mt-1 text-xl"
            aria-label="发音"
            @click="speak(current.word.word)"
          >
            🔊
          </button>
        </template>

        <template v-else-if="current.type === 'zh2en'">
          <p class="text-xs font-bold uppercase tracking-widest text-emerald-400">
            看中文选英文
          </p>
          <h2 class="mt-2 text-3xl font-extrabold text-slate-800">
            {{ meaningOf(current.word) }}
          </h2>
          <p v-if="posOf(current.word)" class="mt-1 text-sm text-sky-500">
            {{ posOf(current.word) }}
          </p>
        </template>

        <template v-else-if="current.type === 'listen'">
          <p class="text-xs font-bold uppercase tracking-widest text-amber-500">
            听音选词
          </p>
          <button
            class="mt-3 rounded-full bg-amber-100 px-8 py-3 text-2xl"
            aria-label="播放发音"
            @click="speak(current.word.word)"
          >
            🔊 播放
          </button>
        </template>

        <template v-else>
          <p class="text-xs font-bold uppercase tracking-widest text-violet-500">
            拼写补全
          </p>
          <h2 class="mt-2 text-2xl font-bold text-slate-700">
            {{ meaningOf(current.word) }}
          </h2>
          <p
            class="mt-3 font-mono text-3xl font-extrabold tracking-[0.3em] text-slate-800"
          >
            {{ current.masked }}
          </p>
          <p class="mt-1 text-sm text-slate-400">点击下面的字母补全单词</p>
        </template>
      </div>

      <div v-if="isChoice(current.type)" class="mt-4 grid grid-cols-1 gap-3">
        <OptionButton
          v-for="opt in current.options"
          :key="opt"
          :state="
            answered
              ? opt === selected
                ? wasCorrect
                  ? 'correct'
                  : 'wrong'
                : opt ===
                    (current.type === 'en2zh'
                      ? meaningOf(current.word)
                      : current.word.word)
                  ? 'correct'
                  : 'disabled'
              : 'idle'
          "
          @click="choose(opt)"
        >
          {{ opt }}
        </OptionButton>
      </div>

      <SpellFill
        v-else
        :key="index"
        :word="current.word.word"
        :letters="current.options"
        :blank-indexes="current.blankIndexes ?? []"
        :locked="answered"
        @done="(w: string) => choose(w)"
      />

      <div v-if="answered" class="mt-4">
        <div
          class="rounded-2xl p-4 text-center font-bold"
          :class="
            wasCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
          "
        >
          {{ wasCorrect ? '🎉 答对啦 +10⭐' : `😅 正确答案是 ${current.word.word}` }}
        </div>
        <AppButton class="mt-3" @click="next">
          {{ index < questions.length - 1 ? '下一题' : '查看结果' }}
        </AppButton>
      </div>
    </div>
  </div>

  <div v-else class="px-5 pt-10 text-center">
    <div class="text-6xl">{{ correctCount >= questions.length * 0.75 ? '🏆' : '💪' }}</div>
    <h2 class="mt-3 text-2xl font-extrabold text-slate-800">练习完成！</h2>
    <p class="mt-2 text-slate-500">
      答对 {{ correctCount }} / {{ questions.length }} 题 · 得分
      {{ correctCount * 10 }}
    </p>
    <div class="mt-8 flex flex-col gap-3">
      <AppButton color="green" @click="emit('replay')">🔁 再练一次</AppButton>
      <AppButton color="ghost" @click="emit('exit')">← 返回</AppButton>
    </div>
  </div>
</template>
