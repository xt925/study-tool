<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import { getGrade } from '@study/core'
import { useProgressStore } from '@/stores/progress'

const route = useRoute()
const router = useRouter()
const progress = useProgressStore()

const grade = computed(() => getGrade(route.params.gradeId as string))
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader
      :title="grade ? `${grade.emoji} ${grade.name}` : '选择单元'"
      @back="router.back()"
    />

    <div v-if="grade" class="mt-6 flex flex-col gap-4 px-5">
      <button
        v-for="u in grade.units"
        :key="u.id"
        class="rounded-3xl bg-white p-5 text-left shadow-sm transition active:scale-95"
        @click="router.push(`/learn/${grade.id}/${u.id}`)"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-slate-800">
              {{ u.title }}{{ u.name ? ' · ' + u.name : '' }}
            </h2>
            <p class="mt-1 text-sm text-slate-400">{{ u.words.length }} 个单词</p>
          </div>
          <span
            v-if="progress.isUnitCompleted(u.id)"
            class="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-600"
            >✓ 已完成</span
          >
          <span v-else class="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-600"
            >开始学习</span
          >
        </div>
      </button>
    </div>

    <p v-else class="mt-10 text-center text-slate-400">年级不存在 😢</p>

    <div v-if="grade && progress.isUnitCompleted(grade.units[0]?.id ?? '')" class="px-5 pt-4">
      <AppButton
        color="orange"
        @click="router.push(`/quiz/${grade.id}/${grade.units[0].id}`)"
        >📝 去练习第一单元</AppButton
      >
    </div>
  </div>
</template>
