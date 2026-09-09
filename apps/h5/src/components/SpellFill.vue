<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  word: string
  letters: string[]
  blankCount: number
  locked: boolean
}>()

const emit = defineEmits<{ done: [filledWord: string] }>()

const filled = ref<(string | null)[]>(Array(props.blankCount).fill(null))
const used = ref<boolean[]>(Array(props.letters.length).fill(false))

function tapLetter(i: number) {
  if (props.locked || used.value[i]) return
  const slot = filled.value.indexOf(null)
  if (slot === -1) return
  filled.value[slot] = props.letters[i]
  used.value[i] = true
  if (!filled.value.includes(null)) {
    emit('done', filled.value.join(''))
  }
}

function tapSlot(slot: number) {
  if (props.locked || filled.value[slot] === null) return
  const ch = filled.value[slot] as string
  for (let i = props.letters.length - 1; i >= 0; i--) {
    if (used.value[i] && props.letters[i] === ch) {
      used.value[i] = false
      break
    }
  }
  filled.value[slot] = null
}

defineExpose({ reset: () => {
  filled.value = Array(props.blankCount).fill(null)
  used.value = Array(props.letters.length).fill(false)
} })
</script>

<template>
  <div>
    <div class="mt-4 flex justify-center gap-2">
      <button
        v-for="(ch, i) in filled"
        :key="i"
        class="flex h-12 w-10 items-center justify-center rounded-xl border-2 text-xl font-extrabold"
        :class="
          ch
            ? 'border-sky-400 bg-sky-50 text-sky-700'
            : 'border-dashed border-slate-300 text-slate-300'
        "
        @click="tapSlot(i)"
      >
        {{ ch ?? '?' }}
      </button>
    </div>
    <div class="mt-4 flex flex-wrap justify-center gap-2">
      <button
        v-for="(ch, i) in letters"
        :key="i"
        :disabled="used[i] || locked"
        class="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-700 transition active:scale-90 disabled:opacity-25"
        @click="tapLetter(i)"
      >
        {{ ch }}
      </button>
    </div>
  </div>
</template>
