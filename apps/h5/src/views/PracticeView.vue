<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import QuizRunner from '@/components/QuizRunner.vue'
import {
  generateQuizFromWords,
  getGrade,
  getWordById,
  grades,
  type Question,
  type Word,
} from '@study/core'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()

/** 每次练习的题量 */
const QUIZ_SIZE = 8

const mode = ref<'pick' | 'quiz'>('pick')
const scope = ref<'learned' | 'grade' | 'units'>('learned')
const gradeId = ref(grades[0].id)
const unitIds = ref<string[]>([])

const grade = computed(() => getGrade(gradeId.value))

const learnedWords = computed(() =>
  progress.learnedWords
    .map((id) => getWordById(id))
    .filter((w): w is Word => !!w),
)

const selectedUnits = computed(
  () => grade.value?.units.filter((u) => unitIds.value.includes(u.id)) ?? [],
)

/** 当前范围内可选的全部单词 */
const scopeWords = computed<Word[]>(() => {
  if (scope.value === 'learned') return learnedWords.value
  if (scope.value === 'grade') return grade.value?.units.flatMap((u) => u.words) ?? []
  return selectedUnits.value.flatMap((u) => u.words)
})

const canStart = computed(() => scopeWords.value.length > 0)

const scopeLabel = computed(() => {
  if (scope.value === 'learned') return '全部已学单词'
  if (scope.value === 'grade') return grade.value?.name ?? '整册'
  if (selectedUnits.value.length === 1) {
    const u = selectedUnits.value[0]
    return `${grade.value?.name ?? ''} · ${u.title}`
  }
  return `${grade.value?.name ?? ''} · ${selectedUnits.value.length} 个单元`
})

function changeScope(next: 'learned' | 'grade' | 'units') {
  scope.value = next
  if (next !== 'learned' && unitIds.value.length === 0 && grade.value?.units[0]) {
    unitIds.value = [grade.value.units[0].id]
  }
}

function changeGrade(id: string) {
  gradeId.value = id
  unitIds.value = []
}

function toggleUnit(id: string) {
  unitIds.value = unitIds.value.includes(id)
    ? unitIds.value.filter((x) => x !== id)
    : [...unitIds.value, id]
}

function selectAllUnits() {
  unitIds.value = grade.value?.units.map((u) => u.id) ?? []
}

function clearUnits() {
  unitIds.value = []
}

const questions = ref<Question[]>([])
const round = ref(0)
const quizTitle = ref('')

function start() {
  const words = scopeWords.value
  if (words.length === 0) return
  quizTitle.value = scopeLabel.value
  questions.value = generateQuizFromWords(words, Math.min(QUIZ_SIZE, words.length))
  round.value += 1
  mode.value = 'quiz'
}
</script>

<template>
  <div class="flex min-h-screen flex-col pb-10">
    <PageHeader
      :title="mode === 'quiz' ? `练习 · ${quizTitle}` : '📝 随时练习'"
      @back="mode === 'quiz' ? (mode = 'pick') : router.back()"
    />

    <template v-if="mode === 'pick'">
      <div class="mt-4 px-5">
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="item in [
              { key: 'learned', label: '已学单词', emoji: '📚' },
              { key: 'grade', label: '按年级', emoji: '🏫' },
              { key: 'units', label: '按单元', emoji: '📖' },
            ]"
            :key="item.key"
            class="rounded-2xl border-2 py-3 text-sm font-bold transition active:scale-95"
            :class="
              scope === item.key
                ? 'border-sky-400 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-500'
            "
            @click="changeScope(item.key as 'learned' | 'grade' | 'units')"
          >
            <span class="mr-0.5">{{ item.emoji }}</span>{{ item.label }}
          </button>
        </div>
      </div>

      <div class="mt-4 flex-1 px-5">
        <!-- 已学单词：直接用学习记录里的全部单词 -->
        <div v-if="scope === 'learned'" class="rounded-3xl bg-white p-5 shadow-sm">
          <h3 class="font-bold text-slate-700">📚 全部已学单词</h3>
          <p class="mt-2 text-sm text-slate-400">
            从学过的 {{ learnedWords.length }} 个单词里随机抽题，适合随时检测掌握情况
          </p>
          <p v-if="learnedWords.length === 0" class="mt-3 text-sm font-bold text-amber-500">
            还没有学过的单词，先去学习吧～
          </p>
        </div>

        <template v-else>
          <div class="rounded-3xl bg-white p-5 shadow-sm">
            <h3 class="mb-3 font-bold text-slate-700">1️⃣ 选择年级</h3>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="g in grades"
                :key="g.id"
                class="rounded-2xl border-2 py-2.5 text-sm font-bold transition active:scale-95"
                :class="
                  gradeId === g.id
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500'
                "
                @click="changeGrade(g.id)"
              >
                {{ g.emoji }} {{ g.name }}
              </button>
            </div>
          </div>

          <div
            v-if="scope === 'units'"
            class="mt-3 rounded-3xl bg-white p-5 shadow-sm"
          >
            <div class="mb-3 flex items-center justify-between">
              <h3 class="font-bold text-slate-700">2️⃣ 选择单元</h3>
              <div class="flex gap-3 text-xs font-bold">
                <button class="text-sky-500" @click="selectAllUnits">全选</button>
                <button class="text-slate-400" @click="clearUnits">清空</button>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <button
                v-for="u in grade?.units"
                :key="u.id"
                class="flex items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-left text-sm font-semibold transition active:scale-95"
                :class="
                  unitIds.includes(u.id)
                    ? 'border-sky-400 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-500'
                "
                @click="toggleUnit(u.id)"
              >
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[10px]"
                  :class="
                    unitIds.includes(u.id)
                      ? 'border-sky-400 bg-sky-400 text-white'
                      : 'border-slate-200 text-transparent'
                  "
                  >✓</span
                >
                <span class="min-w-0 flex-1 truncate"
                  >{{ u.title }}{{ u.name ? ' · ' + u.name : '' }}</span
                >
                <span class="shrink-0 text-xs text-slate-400">{{ u.words.length }} 词</span>
              </button>
            </div>
          </div>
        </template>

        <div class="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-500">
          本次范围共 <b class="text-slate-700">{{ scopeWords.length }}</b> 个单词，随机抽
          <b class="text-slate-700">{{ Math.min(QUIZ_SIZE, scopeWords.length) }}</b> 题
        </div>
      </div>

      <div class="mt-6 px-5">
        <AppButton color="green" :disabled="!canStart" @click="start">
          🚀 开始练习
        </AppButton>
      </div>
    </template>

    <QuizRunner
      v-else
      :key="round"
      :questions="questions"
      @replay="start"
      @exit="mode = 'pick'"
    />
  </div>
</template>
