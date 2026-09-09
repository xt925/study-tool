<script setup lang="ts">
defineProps<{
  title: string
}>()

const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <header class="flex items-center gap-3 px-4 pt-5">
    <button
      class="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-slate-600 shadow"
      aria-label="返回"
      @click="emit('back')"
    >
      ←
    </button>
    <h1 class="text-xl font-bold text-slate-800">{{ title }}</h1>
  </header>
</template>
