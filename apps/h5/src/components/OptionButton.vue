<script setup lang="ts">
defineProps<{
  state?: 'idle' | 'correct' | 'wrong' | 'disabled'
  selected?: boolean
}>()
</script>

<template>
  <button
    class="w-full rounded-2xl border-2 px-4 py-3.5 text-left text-base font-semibold transition active:scale-95"
    :class="{
      'border-slate-200 bg-white text-slate-700 hover:border-sky-300':
        state === 'idle' && !selected,
      'border-sky-400 bg-sky-50 text-sky-700': state === 'idle' && selected,
      'border-emerald-400 bg-emerald-50 text-emerald-700': state === 'correct',
      'border-rose-400 bg-rose-50 text-rose-600': state === 'wrong',
      'border-slate-200 bg-slate-100 text-slate-400 opacity-60':
        state === 'disabled',
    }"
  >
    <slot />
  </button>
</template>
