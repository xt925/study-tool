<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import OptionButton from '@/components/OptionButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import ProgressDots from '@/components/ProgressDots.vue'
import RewardOverlay from '@/components/RewardOverlay.vue'
import { getAllWords, getWordById, meaningOf, shuffle, type Word } from '@study/core'
import { useProgressStore } from '@/stores/progress'
import { speak } from '@/utils/audio'

const router = useRouter()
const progress = useProgressStore()

/** 单次重练上限 */
const DRILL_SIZE = 20

const mode = ref<'list' | 'drill'>('list')

// 错题列表：按最近答错排序，wordId 查不到的（词库变动）直接忽略
const wrongWords = computed(() =>
  progress.wrongWordIds
    .map((id) => getWordById(id))
    .filter((w): w is Word => !!w),
)

// 重练用：进入时把错题快照下来，练习中不再随进度变动而增删
const queue = ref<Word[]>([])
const index = ref(0)
const answered = ref(false)
const wasCorrect = ref(false)
const picked = ref('')
const correctCount = ref(0)
const finished = ref(false)

const current = computed(() => queue.value[index.value])

const options = computed(() => {
  const word = current.value
  if (!word) return []
  const distractors = shuffle(
    getAllWords().filter(
      (w) => w.id !== word.id && meaningOf(w) !== meaningOf(word),
    ),
  ).slice(0, 3)
  return shuffle([meaningOf(word), ...distractors.map((d) => meaningOf(d))])
})

function startDrill() {
  queue.value = wrongWords.value.slice(0, DRILL_SIZE)
  index.value = 0
  answered.value = false
  wasCorrect.value = false
  picked.value = ''
  correctCount.value = 0
  finished.value = false
  mode.value = 'drill'
}

function choose(option: string) {
  if (answered.value || !current.value) return
  picked.value = option
  answered.value = true
  wasCorrect.value = option === meaningOf(current.value)
  if (wasCorrect.value) {
    progress.clearWrongWord(current.value.id) // 消灭错题 +5⭐
    correctCount.value += 1
  } else {
    progress.recordWrong(current.value.id) // 又错一次，计数 +1
  }
}

function next() {
  if (index.value < queue.value.length - 1) {
    index.value += 1
    answered.value = false
    wasCorrect.value = false
    picked.value = ''
  } else {
    finished.value = true
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="📕 错题本" @back="router.back()" />

    <!-- 列表模式 -->
    <template v-if="mode === 'list'">
      <div v-if="wrongWords.length === 0" class="mt-16 px-6 text-center">
        <div class="text-6xl">🎉</div>
        <p class="mt-4 text-lg font-bold text-slate-700">错题本是空的</p>
        <p class="mt-1 text-sm text-slate-400">
          测验和游戏里答错的单词会出现在这里，答对就能把它消灭
        </p>
        <AppButton class="mt-6" @click="router.back()">返回</AppButton>
      </div>

      <template v-else>
        <p class="mt-4 px-5 text-center text-sm text-slate-400">
          共 {{ wrongWords.length }} 个错题 · 点单词可听发音
        </p>
        <div class="mt-4 flex flex-col gap-3 px-5">
          <button
            v-for="w in wrongWords"
            :key="w.id"
            class="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition active:scale-95"
            @click="speak(w.word)"
          >
            <div class="min-w-0 flex-1">
              <p class="text-lg font-bold text-slate-800">
                {{ w.word }}
                <span v-if="w.phonetic" class="ml-1 text-sm font-normal text-slate-400">{{
                  w.phonetic
                }}</span>
              </p>
              <p class="mt-0.5 truncate text-sm text-slate-500">{{ meaningOf(w) }}</p>
            </div>
            <span class="shrink-0 text-xl">🔊</span>
          </button>
        </div>

        <div class="mt-6 px-5">
          <AppButton color="green" @click="startDrill">
            ✍️ 开始重练（{{ Math.min(wrongWords.length, DRILL_SIZE) }} 个）
          </AppButton>
        </div>
      </template>
    </template>

    <!-- 重练模式 -->
    <template v-else>
      <div class="px-6 pt-4">
        <ProgressDots :total="queue.length" :filled="index + 1" />
        <p class="mt-2 text-center text-xs text-slate-400">
          第 {{ index + 1 }} / {{ queue.length }} 个 · 答对即消灭
        </p>
      </div>

      <main class="mt-4 px-5">
        <div class="rounded-3xl bg-white p-6 text-center shadow-sm">
          <div class="flex items-start justify-center gap-2">
            <h2 class="text-4xl font-extrabold tracking-wide text-slate-800">
              {{ current?.word }}
            </h2>
            <button
              class="mt-1 text-2xl transition active:scale-90"
              aria-label="发音"
              @click="current && speak(current.word)"
            >
              🔊
            </button>
          </div>
          <p v-if="current?.phonetic" class="mt-1 text-slate-400">
            {{ current.phonetic }}
          </p>
          <p class="mt-2 text-sm text-slate-400">选出它的意思，答对就从错题本移除</p>
        </div>

        <div class="mt-5 flex flex-col gap-3">
          <OptionButton
            v-for="opt in options"
            :key="opt"
            :state="
              !answered
                ? 'idle'
                : opt === meaningOf(current!)
                  ? 'correct'
                  : opt === picked
                    ? 'wrong'
                    : 'disabled'
            "
            @click="choose(opt)"
          >
            {{ opt }}
          </OptionButton>
        </div>

        <div v-if="answered" class="mt-4">
          <div
            class="rounded-2xl p-4 text-center font-bold"
            :class="
              wasCorrect
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-500'
            "
          >
            {{ wasCorrect ? '✅ 答对，已从错题本移除 +5⭐' : '😅 又错了，稍后再来消灭它' }}
          </div>
          <AppButton class="mt-3" @click="next">
            {{ index < queue.length - 1 ? '下一个' : '完成' }}
          </AppButton>
        </div>
      </main>
    </template>

    <RewardOverlay
      :show="finished"
      title="重练完成！"
      :message="`消灭了 ${correctCount} 个错题，还剩 ${progress.wrongWordCount} 个。`"
      button-text="回到错题本"
      @close="finished = false; mode = 'list'"
    />
  </div>
</template>
