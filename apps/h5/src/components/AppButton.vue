<script setup lang="ts">
withDefaults(
  defineProps<{
    color?: 'primary' | 'green' | 'orange' | 'ghost'
    disabled?: boolean
  }>(),
  { color: 'primary', disabled: false },
)
</script>

<template>
  <button
    :disabled="disabled"
    class="w-full rounded-2xl px-6 py-4 text-lg font-bold shadow-md transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    :class="{
      'bg-sky-500 text-white hover:bg-sky-600': color === 'primary',
      'bg-emerald-500 text-white hover:bg-emerald-600': color === 'green',
      'bg-orange-500 text-white hover:bg-orange-600': color === 'orange',
      'bg-slate-200 text-slate-600 hover:bg-slate-300': color === 'ghost',
    }"
  >
    <slot />
  </button>
</template>
