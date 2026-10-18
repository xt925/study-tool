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

/** 单次复习上限：到期词再多也一次只做这么多，避免被一大串待复习吓退 */
const SESSION_SIZE = 20

// 进入页面时把到期单词快照下来，复习中不再随进度变动而增删（否则答完就从队列里消失）
const queue = ref<Word[]>(
  progress.dueReviewIds
    .slice(0, SESSION_SIZE)
    .map((id) => getWordById(id))
    .filter((w): w is Word => !!w),
)
const totalDue = ref(progress.dueReviewCount)

const index = ref(0)
const answered = ref(false)
const wasCorrect = ref(false)
const picked = ref('')
const correctCount = ref(0)
const finished = ref(false)

const current = computed(() => queue.value[index.value])

// 每个词的选项（正确释义 + 3 个干扰项），随 current 变化重新洗牌
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

function choose(option: string) {
  if (answered.value || !current.value) return
  picked.value = option
  answered.value = true
  wasCorrect.value = option === meaningOf(current.value)
  progress.markReviewed(current.value.id, wasCorrect.value) // 对 +5⭐ / 错回到最初
  if (wasCorrect.value) correctCount.value += 1
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
    <PageHeader title="🔁 复习" @back="router.back()" />

    <!-- 没有到期单词 -->
    <div v-if="queue.length === 0" class="mt-16 px-6 text-center">
      <div class="text-6xl">🎉</div>
      <p class="mt-4 text-lg font-bold text-slate-700">今天没有需要复习的单词</p>
      <p class="mt-1 text-sm text-slate-400">
        学过的单词会按间隔自动排进复习队列，明天再来看看吧
      </p>
      <AppButton class="mt-6" @click="router.back()">返回</AppButton>
    </div>

    <template v-else>
      <div class="px-6 pt-4">
        <ProgressDots :total="queue.length" :filled="index + 1" />
        <p class="mt-2 text-center text-xs text-slate-400">
          第 {{ index + 1 }} / {{ queue.length }} 个 · 待复习共 {{ totalDue }} 个
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
          <p class="mt-2 text-sm text-slate-400">它还认识你吗？选出它的意思</p>
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
            {{ wasCorrect ? '✅ 记得，+5⭐' : '📌 忘了，记下它再复习' }}
          </div>
          <AppButton class="mt-3" @click="next">
            {{ index < queue.length - 1 ? '下一个' : '完成复习' }}
          </AppButton>
        </div>
      </main>
    </template>

    <RewardOverlay
      :show="finished"
      title="复习完成！"
      :message="`本次复习 ${queue.length} 个单词，记得 ${correctCount} 个。忘掉的会在稍后再次出现。`"
      button-text="返回首页"
      @close="router.push('/')"
    />
  </div>
</template>
