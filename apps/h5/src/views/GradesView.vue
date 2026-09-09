<script setup lang="ts">
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import { grades } from '@study/core'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()

function learnedCount(gradeId: string): number {
  const g = grades.find((x) => x.id === gradeId)
  if (!g) return 0
  const total = g.units.flatMap((u) => u.words).length
  const learned = g.units
    .flatMap((u) => u.words)
    .filter((w) => progress.learnedWords.includes(w.id)).length
  return Math.round((learned / total) * 100)
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="选择年级" @back="router.back()" />

    <div class="mt-6 flex flex-col gap-4 px-5">
      <button
        v-for="g in grades"
        :key="g.id"
        class="flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-sm transition active:scale-95"
        @click="router.push(`/grades/${g.id}`)"
      >
        <span class="text-5xl">{{ g.emoji }}</span>
        <div class="flex-1">
          <h2 class="text-xl font-bold text-slate-800">{{ g.name }}</h2>
          <p class="text-sm text-slate-400">{{ g.units.length }} 个单元</p>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-emerald-400"
              :style="{ width: `${learnedCount(g.id)}%` }"
            ></div>
          </div>
        </div>
        <span class="text-slate-300">›</span>
      </button>
    </div>
  </div>
</template>
