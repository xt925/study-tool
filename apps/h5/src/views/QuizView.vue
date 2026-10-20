<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import QuizRunner from '@/components/QuizRunner.vue'
import { generateQuiz, getUnit, type Question } from '@study/core'

const route = useRoute()
const router = useRouter()

const unit = computed(() =>
  getUnit(route.params.gradeId as string, route.params.unitId as string)?.unit,
)

const questions = ref<Question[]>([])
const round = ref(0)

function start() {
  if (!unit.value) return
  questions.value = generateQuiz(unit.value, 8)
  round.value += 1
}
start()
</script>

<template>
  <div class="flex min-h-screen flex-col pb-10">
    <PageHeader
      :title="unit ? `练习 · ${unit.name ?? unit.title}` : '练习'"
      @back="router.back()"
    />

    <QuizRunner
      v-if="unit"
      :key="round"
      :questions="questions"
      @replay="start"
      @exit="router.back()"
    />

    <p v-else class="mt-10 text-center text-slate-400">单元不存在 😢</p>
  </div>
</template>
