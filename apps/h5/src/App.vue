<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { useProgressStore } from '@/stores/progress'
import { isLoggedIn, syncNow } from '@/utils/api'

const progress = useProgressStore()
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  // 启动时同步一次；之后每 5 分钟有未同步改动再同步
  if (isLoggedIn()) void syncNow()
  timer = setInterval(
    () => {
      if (isLoggedIn() && progress.dirty) void syncNow()
    },
    5 * 60 * 1000,
  )
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-md bg-slate-50 shadow-xl">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>
</template>
