<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import { ACHIEVEMENTS } from '@study/core'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()

const items = computed(() => {
  const ctx = progress.achievementContext
  return ACHIEVEMENTS.map((def) => {
    const unlockedAt = progress.achievements[def.id] ?? ''
    const current = Math.min(def.measure(ctx), def.goal)
    return {
      def,
      unlockedAt,
      current,
      percent: Math.min(100, Math.round((current / def.goal) * 100)),
    }
  })
})

const unlockedCount = computed(
  () => items.value.filter((item) => item.unlockedAt).length,
)
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="🏆 成就" @back="router.back()" />

    <div class="mt-4 px-5">
      <div class="rounded-3xl bg-gradient-to-r from-amber-400 to-orange-400 p-5 text-white shadow-sm">
        <p class="text-sm text-white/80">已解锁徽章</p>
        <p class="mt-1 text-3xl font-extrabold">
          {{ unlockedCount }} <span class="text-lg font-bold text-white/80">/ {{ items.length }}</span>
        </p>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/30">
          <div
            class="h-full rounded-full bg-white transition-all"
            :style="{ width: `${Math.round((unlockedCount / items.length) * 100)}%` }"
          ></div>
        </div>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-3 px-5">
      <div
        v-for="item in items"
        :key="item.def.id"
        class="rounded-3xl p-4 text-center shadow-sm"
        :class="
          item.unlockedAt
            ? 'bg-white ring-2 ring-amber-200'
            : 'bg-slate-100'
        "
      >
        <div
          class="text-4xl transition"
          :class="{ 'opacity-30 grayscale': !item.unlockedAt }"
        >
          {{ item.def.emoji }}
        </div>
        <p
          class="mt-2 text-sm font-bold"
          :class="item.unlockedAt ? 'text-slate-800' : 'text-slate-400'"
        >
          {{ item.def.name }}
        </p>
        <p class="mt-0.5 text-xs leading-4 text-slate-400">
          {{ item.def.description }}
        </p>

        <template v-if="item.unlockedAt">
          <p class="mt-2 text-xs font-bold text-amber-500">
            已解锁 · {{ item.unlockedAt.slice(0, 10) }}
          </p>
        </template>
        <template v-else>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              class="h-full rounded-full bg-slate-400"
              :style="{ width: `${item.percent}%` }"
            ></div>
          </div>
          <p class="mt-1 text-[11px] text-slate-400">
            {{ item.current }} / {{ item.def.goal }}
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
