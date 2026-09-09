<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import ProgressDots from '@/components/ProgressDots.vue'
import { levelProgress, useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()

const percent = computed(() =>
  Math.min(100, Math.round(levelProgress(progress.stars) * 100)),
)
</script>

<template>
  <div class="flex min-h-screen flex-col px-5 pb-10">
    <header class="pt-8 text-center">
      <h1 class="text-3xl font-extrabold text-slate-800">🐶 English Adventure</h1>
      <p class="mt-1 text-slate-400">每天学一点，英语大冒险！</p>
    </header>

    <section class="mt-6 rounded-3xl bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🏅</span>
          <span class="text-lg font-bold text-slate-700"
            >Lv.{{ progress.level }}</span
          >
        </div>
        <div class="flex items-center gap-1 text-lg font-bold text-amber-500">
          <span>⭐</span>
          <span>{{ progress.stars }}</span>
        </div>
      </div>
      <div class="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all"
          :style="{ width: `${percent}%` }"
        ></div>
      </div>
      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm text-slate-500">今日进度</span>
        <ProgressDots :total="5" :filled="Math.min(5, progress.todayWordCount)" />
      </div>
      <p class="mt-1 text-right text-xs text-slate-400">
        今天已学 {{ progress.todayWordCount }} 个单词
      </p>
    </section>

    <div class="mt-8 flex flex-col gap-3">
      <AppButton @click="router.push('/grades')">📚 开始学习</AppButton>
      <AppButton color="orange" @click="router.push('/games')"
        >🎮 游戏乐园</AppButton
      >
    </div>
  </div>
</template>
