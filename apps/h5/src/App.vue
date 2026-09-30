<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

import { useProgressStore } from '@/stores/progress'
import { isLoggedIn, syncNow } from '@/utils/api'

const progress = useProgressStore()
let timer: ReturnType<typeof setInterval> | undefined
let debounce: ReturnType<typeof setTimeout> | undefined

// 从后台回到前台时补一次同步：后台期间定时器会被系统挂起，可能攒下未上传的改动
function onVisibilityChange() {
  if (document.visibilityState === 'visible' && isLoggedIn() && progress.dirty) {
    void syncNow()
  }
}

onMounted(() => {
  // 启动时同步一次；之后每 5 分钟有未同步改动再同步
  if (isLoggedIn()) void syncNow()
  timer = setInterval(
    () => {
      if (isLoggedIn() && progress.dirty) void syncNow()
    },
    5 * 60 * 1000,
  )
  document.addEventListener('visibilitychange', onVisibilityChange)
  // 任何进度改动（答题/得星/完成单元）都会置 dirty，安静 3 秒后自动上传
  watch(
    () => progress.dirty,
    (dirty) => {
      if (!dirty) return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (isLoggedIn() && progress.dirty) void syncNow()
      }, 3000)
    },
  )
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (debounce) clearTimeout(debounce)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-md bg-slate-50 shadow-xl">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>
</template>
