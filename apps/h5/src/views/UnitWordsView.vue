<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import { getUnit } from '@study/core'
import { useProgressStore } from '@/stores/progress'

const route = useRoute()
const router = useRouter()
const progress = useProgressStore()

const found = computed(() =>
  getUnit(route.params.gradeId as string, route.params.unitId as string),
)
const unit = computed(() => found.value?.unit)
const grade = computed(() => found.value?.grade)

function openWord(index: number) {
  router.push({
    name: 'learn',
    params: { gradeId: route.params.gradeId, unitId: route.params.unitId },
    query: { i: index },
  })
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader
      :title="unit ? `${unit.title}${unit.name ? ' · ' + unit.name : ''}` : '单词表'"
      @back="router.back()"
    />

    <template v-if="unit">
      <div class="px-5 pt-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-slate-800">📖 单词表</h2>
          <span
            v-if="progress.isUnitCompleted(unit.id)"
            class="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-600"
            >✓ 已完成</span
          >
        </div>
        <p class="mt-1 text-sm text-slate-400">
          {{ grade?.name }} · 共 {{ unit.words.length }} 个单词
        </p>
      </div>

      <div class="px-5 pt-4">
        <AppButton @click="openWord(0)">▶ 从头开始学习</AppButton>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2 px-5">
        <button
          v-for="(w, i) in unit.words"
          :key="w.id"
          class="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-left shadow-sm transition active:scale-95"
          @click="openWord(i)"
        >
          <span
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500"
            >{{ i + 1 }}</span
          >
          <span class="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{{
            w.word
          }}</span>
          <span v-if="progress.isLearnedWord(w.id)" class="shrink-0 text-xs text-emerald-500"
            >✓</span
          >
        </button>
      </div>
    </template>

    <p v-else class="mt-10 text-center text-slate-400">单元不存在 😢</p>
  </div>
</template>
