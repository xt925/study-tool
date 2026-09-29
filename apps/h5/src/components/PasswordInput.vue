<script setup lang="ts">
import { ref } from 'vue'

/**
 * 带「显示/隐藏密码」眼睛按钮的输入框。
 * 按钮必须是 type="button"，否则点眼睛会顺带提交表单。
 */
withDefaults(
  defineProps<{
    placeholder?: string
    autocomplete?: string
    /** 追加到 input 上的额外 class，如 text-lg */
    inputClass?: string
  }>(),
  { placeholder: '', autocomplete: 'current-password', inputClass: '' },
)

const model = defineModel<string>({ required: true })

const visible = ref(false)
</script>

<template>
  <div class="relative">
    <input
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      class="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 outline-none focus:border-sky-400"
      :class="inputClass"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-lg transition active:scale-90"
      :aria-label="visible ? '隐藏密码' : '显示密码'"
      @click="visible = !visible"
    >
      {{ visible ? '🙈' : '👁️' }}
    </button>
  </div>
</template>
