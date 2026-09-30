<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  word: string
  letters: string[]
  /** 被挖掉的位置（下标升序），filled 与它一一对应 */
  blankIndexes: number[]
  locked: boolean
}>()

const emit = defineEmits<{ done: [filledWord: string] }>()

const filled = ref<(string | null)[]>(Array(props.blankIndexes.length).fill(null))
const used = ref<boolean[]>(Array(props.letters.length).fill(false))

/** 把填好的字母放回挖空位置，还原成完整单词（判分方比较的是整词） */
function assemble(): string {
  const chars = props.word.split('')
  props.blankIndexes.forEach((pos, slot) => {
    chars[pos] = filled.value[slot] as string
  })
  return chars.join('')
}

function tapLetter(i: number) {
  if (props.locked || used.value[i]) return
  const slot = filled.value.indexOf(null)
  if (slot === -1) return
  filled.value[slot] = props.letters[i]
  used.value[i] = true
  if (!filled.value.includes(null)) {
    emit('done', assemble())
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
  filled.value = Array(props.blankIndexes.length).fill(null)
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
