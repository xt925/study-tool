<script setup lang="ts">
import AppButton from '@/components/AppButton.vue'

defineProps<{
  show: boolean
  title: string
  message?: string
  buttonText?: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        <div class="mb-2 text-6xl">🎉</div>
        <h2 class="mb-1 text-xl font-bold text-slate-800">{{ title }}</h2>
        <p v-if="message" class="mb-5 text-slate-500">{{ message }}</p>
        <AppButton @click="emit('close')">{{ buttonText ?? '太棒了！' }}</AppButton>
      </div>
    </div>
  </Teleport>
</template>
