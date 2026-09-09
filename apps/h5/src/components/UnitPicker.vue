<script setup lang="ts">
import { ref } from 'vue'

import AppButton from '@/components/AppButton.vue'
import { grades, type Unit } from '@study/core'

const emit = defineEmits<{ select: [unit: Unit] }>()

const gradeId = ref(grades[0].id)
const unitId = ref(grades[0].units[0].id)

function onGradeChange() {
  const g = grades.find((x) => x.id === gradeId.value)
  unitId.value = g?.units[0]?.id ?? ''
}

function confirm() {
  const g = grades.find((x) => x.id === gradeId.value)
  const u = g?.units.find((x) => x.id === unitId.value)
  if (u) emit('select', u)
}
</script>

<template>
  <div class="rounded-3xl bg-white p-5 shadow-sm">
    <h3 class="mb-3 font-bold text-slate-700">1️⃣ 选择年级</h3>
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="g in grades"
        :key="g.id"
        class="rounded-2xl border-2 py-3 font-bold transition active:scale-95"
        :class="
          gradeId === g.id
            ? 'border-sky-400 bg-sky-50 text-sky-700'
            : 'border-slate-200 bg-white text-slate-500'
        "
        @click="gradeId = g.id; onGradeChange()"
      >
        {{ g.emoji }} {{ g.name }}
      </button>
    </div>

    <h3 class="mb-3 mt-5 font-bold text-slate-700">2️⃣ 选择单元</h3>
    <div class="flex flex-col gap-2">
      <button
        v-for="u in grades.find((x) => x.id === gradeId)?.units"
        :key="u.id"
        class="rounded-2xl border-2 px-4 py-3 text-left font-semibold transition active:scale-95"
        :class="
          unitId === u.id
            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-white text-slate-500'
        "
        @click="unitId = u.id"
      >
        {{ u.title }}{{ u.name ? ' · ' + u.name : '' }}
        <span class="float-right text-xs text-slate-400"
          >{{ u.words.length }} 词</span
        >
      </button>
    </div>

    <AppButton class="mt-5" @click="confirm">🚀 开始</AppButton>
  </div>
</template>
