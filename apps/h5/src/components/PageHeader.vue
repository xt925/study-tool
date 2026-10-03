<script setup lang="ts">
import { inAppShell } from '@/utils/shell'

defineProps<{
  title: string
}>()

const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <!-- uni-app 外壳里只留返回键：标题由外壳原生导航栏展示（自动跟随 document.title），避免两个标题栏叠在一起 -->
  <header class="flex items-center gap-2 px-3 pt-3">
    <button
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-base text-slate-600 shadow-sm"
      aria-label="返回"
      @click="emit('back')"
    >
      ←
    </button>
    <h1 v-if="!inAppShell" class="truncate text-base font-bold text-slate-800">{{ title }}</h1>
  </header>
</template>
