<script setup lang="ts">
defineProps<{
  total: number
  filled: number
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-2">
    <span
      v-for="i in total"
      :key="i"
      class="h-3 w-3 rounded-full transition"
      :class="i <= filled ? 'bg-amber-400' : 'bg-slate-200'"
    ></span>
  </div>
</template>
