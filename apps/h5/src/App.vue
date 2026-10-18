<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { ACHIEVEMENTS } from '@study/core'
import { useProgressStore } from '@/stores/progress'
import { isLoggedIn, syncNow } from '@/utils/api'

const progress = useProgressStore()
let timer: ReturnType<typeof setInterval> | undefined
let debounce: ReturnType<typeof setTimeout> | undefined

// 成就解锁轻提示
const unlockedToast = ref<{ emoji: string; name: string } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
// 启动时已有的成就算「已知」，刷新/启动不会把历史成就再弹一遍
let knownAchievements: Record<string, string> = { ...progress.achievements }

watch(
  () => progress.achievements,
  (next) => {
    const newly = Object.keys(next).filter((id) => !knownAchievements[id])
    knownAchievements = { ...next }
    if (newly.length === 0) return
    const def = ACHIEVEMENTS.find((a) => a.id === newly[newly.length - 1])
    if (!def) return
    unlockedToast.value = { emoji: def.emoji, name: def.name }
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      unlockedToast.value = null
    }, 2800)
  },
  { deep: true },
)

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
  if (toastTimer) clearTimeout(toastTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-md bg-slate-50 shadow-xl">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>

    <Transition name="ach-toast">
      <div
        v-if="unlockedToast"
        class="fixed left-1/2 top-4 z-[60] w-[82%] max-w-xs -translate-x-1/2 rounded-2xl bg-slate-900/90 px-5 py-3 text-center text-white shadow-xl"
      >
        <p class="text-xs font-bold text-amber-300">🏆 解锁成就</p>
        <p class="mt-0.5 text-base font-bold">
          {{ unlockedToast.emoji }} {{ unlockedToast.name }}
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ach-toast-enter-active,
.ach-toast-leave-active {
  transition: opacity 0.25s ease;
}
.ach-toast-enter-from,
.ach-toast-leave-to {
  opacity: 0;
}
</style>
