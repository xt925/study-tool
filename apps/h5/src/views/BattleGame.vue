<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import RewardOverlay from '@/components/RewardOverlay.vue'
import UnitPicker from '@/components/UnitPicker.vue'
import { getAllWords, meaningOf, posOf, shuffle, type Unit, type Word } from '@study/core'
import { useProgressStore } from '@/stores/progress'

const MONSTER_MAX_HP = 30

const router = useRouter()
const progress = useProgressStore()

const selectedUnit = ref<Unit | null>(null)
const question = ref<Word | null>(null)
const options = ref<string[]>([])
const hp = ref(MONSTER_MAX_HP)
const hits = ref(0)
const answered = ref(false)
const wasCorrect = ref(false)
const picked = ref('')
const showReward = ref(false)

const hpPercent = computed(() => (hp.value / MONSTER_MAX_HP) * 100)
const ko = computed(() => hp.value <= 0)

function nextQuestion() {
  if (!selectedUnit.value) return
  const all = getAllWords()
  question.value = shuffle(selectedUnit.value.words)[0]
  const distractors = shuffle(
    all.filter((w) => w.id !== question.value?.id && w.word !== question.value?.word),
  ).slice(0, 3)
  options.value = shuffle([
    question.value.word,
    ...distractors.map((d) => d.word),
  ])
  answered.value = false
  wasCorrect.value = false
  picked.value = ''
}

function start(unit: Unit) {
  selectedUnit.value = unit
  hp.value = MONSTER_MAX_HP
  hits.value = 0
  nextQuestion()
}

function choose(opt: string) {
  if (answered.value || !question.value) return
  picked.value = opt
  answered.value = true
  wasCorrect.value = opt === question.value.word
  if (wasCorrect.value) {
    hp.value = Math.max(0, hp.value - 10) // 每答对一题 -10 HP
    hits.value += 1
    if (hp.value <= 0) {
      progress.addStars(30) // KO 奖励
      showReward.value = true
    }
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="⚔️ 打怪游戏" @back="router.back()" />

    <div v-if="!selectedUnit" class="mt-6 px-5">
      <UnitPicker @select="start" />
    </div>

    <template v-else>
      <!-- 怪物状态 -->
      <div class="mx-5 mt-4 rounded-3xl bg-white p-5 text-center shadow-sm">
        <div class="text-6xl transition" :class="{ 'opacity-30': ko }">👾</div>
        <div class="mx-auto mt-3 h-4 w-4/5 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="hpPercent > 50 ? 'bg-emerald-400' : hpPercent > 0 ? 'bg-orange-400' : 'bg-slate-200'"
            :style="{ width: `${hpPercent}%` }"
          ></div>
        </div>
        <p class="mt-1 text-sm font-bold text-slate-500">
          {{ ko ? '💥 KO！怪物被打败了！' : `怪物 HP ${hp} / ${MONSTER_MAX_HP} · 已击中 ${hits} 次` }}
        </p>
      </div>

      <template v-if="!ko && question">
        <div class="mx-5 mt-4 rounded-3xl bg-white p-6 text-center shadow-sm">
          <p class="text-xs font-bold uppercase tracking-widest text-violet-400">
            选出正确的单词
          </p>
          <h2 class="mt-2 text-2xl font-extrabold text-slate-800">
            {{ meaningOf(question) }}
          </h2>
          <p v-if="posOf(question)" class="mt-1 text-sm text-sky-500">{{ posOf(question) }}</p>
        </div>

        <div class="mt-4 flex flex-col gap-3 px-5">
          <AppButton
            v-for="opt in options"
            :key="opt"
            :color="
              answered
                ? opt === picked
                  ? wasCorrect
                    ? 'green'
                    : 'orange'
                  : opt === question.word
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
            {{
              wasCorrect
                ? '⚔️ 命中！怪物 -10 HP'
                : `😅 正确答案是 ${question.word}`
            }}
          </div>
          <AppButton class="mt-3" @click="nextQuestion">继续攻击</AppButton>
        </div>
      </template>

      <div class="mt-6 px-5">
        <AppButton color="ghost" class="py-2 text-base" @click="selectedUnit = null"
          >↺ 换一个单元</AppButton
        >
      </div>
    </template>

    <RewardOverlay
      :show="showReward"
      title="胜利 +30⭐！"
      message="你打败了怪物，真是太厉害了！"
      button-text="🔄 再战一场"
      @close="showReward = false; selectedUnit = null"
    />
  </div>
</template>
