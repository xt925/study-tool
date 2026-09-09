<script setup lang="ts">
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'

const router = useRouter()

const games = [
  {
    to: '/games/listen',
    emoji: '🎧',
    name: '听音选词',
    desc: '听发音，从 3 个选项中选出正确的单词',
  },
  {
    to: '/games/match',
    emoji: '🧩',
    name: '单词配对',
    desc: '把英文和中文两列配对起来',
  },
  {
    to: '/games/battle',
    emoji: '⚔️',
    name: '打怪游戏',
    desc: '答对题目攻击怪物，3 次打中即 KO',
  },
]
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="游戏乐园" @back="router.back()" />

    <div class="mt-6 flex flex-col gap-4 px-5">
      <button
        v-for="g in games"
        :key="g.to"
        class="flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-sm transition active:scale-95"
        @click="router.push(g.to)"
      >
        <span class="text-4xl">{{ g.emoji }}</span>
        <div class="flex-1">
          <h2 class="text-lg font-bold text-slate-800">{{ g.name }}</h2>
          <p class="mt-0.5 text-sm text-slate-400">{{ g.desc }}</p>
        </div>
        <span class="text-slate-300">›</span>
      </button>
    </div>
  </div>
</template>
