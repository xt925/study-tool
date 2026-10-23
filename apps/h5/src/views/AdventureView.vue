<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import type { Chapter, ChapterNode } from '@study/core'
import { grades } from '@study/core'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()

// 默认落在「当前应该继续的章节」所在分册，并展开这一章
const activeGradeId = ref(
  progress.currentChapter?.grade.id ?? grades[0]?.id ?? '',
)
const expandedUnitId = ref(progress.currentChapter?.unit.id ?? '')

const grade = computed(
  () => grades.find((item) => item.id === activeGradeId.value) ?? grades[0],
)
const chapters = computed(() =>
  grade.value
    ? progress.chapters.filter((item) => item.grade.id === grade.value.id)
    : [],
)
const currentUnitId = computed(() => progress.currentChapter?.unit.id ?? '')

function selectGrade(gradeId: string) {
  activeGradeId.value = gradeId
  expandedUnitId.value = ''
}

function toggle(unitId: string) {
  expandedUnitId.value = expandedUnitId.value === unitId ? '' : unitId
}

function openNode(chapter: Chapter, node: ChapterNode) {
  if (!node.unlocked) return
  const { grade: g, unit } = chapter
  if (node.id === 'learn') {
    router.push(`/learn/${g.id}/${unit.id}`)
    return
  }
  if (node.id === 'challenge') {
    router.push(`/quiz/${g.id}/${unit.id}`)
    return
  }
  // 复习和听力都按单元进入，只处理这一章的词
  router.push({
    path: node.id === 'review' ? '/review' : '/games/listen',
    query: { unit: unit.id },
  })
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="🗺 冒险地图" @back="router.back()" />

    <div class="mt-4 px-5">
      <section
        class="rounded-3xl bg-gradient-to-br from-indigo-500 to-sky-500 p-5 text-white shadow-sm"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-white/75">知识印记</p>
            <p class="mt-0.5 text-3xl font-extrabold">
              🧠 {{ progress.knowledgeMarks }}
            </p>
          </div>
          <span class="text-4xl">🔮</span>
        </div>
        <p class="mt-2 text-xs leading-5 text-white/85">
          复习到「掌握」的单词会点亮一枚印记，每个单词只能产出一次。
          听力挑战与综合挑战需要印记足够才能通过。
        </p>
        <div v-if="progress.currentChapter" class="mt-3 rounded-2xl bg-white/15 p-3">
          <p class="text-[11px] text-white/75">下一站</p>
          <p class="truncate text-sm font-bold">
            {{ progress.currentChapter.unit.title
            }}{{ progress.currentChapter.unit.name ? ' · ' + progress.currentChapter.unit.name : '' }}
            <span class="font-normal text-white/75">
              · 已学 {{ progress.currentChapter.learned }}/{{
                progress.currentChapter.total
              }}
            </span>
          </p>
        </div>
        <p v-else class="mt-3 rounded-2xl bg-white/15 p-3 text-sm font-bold">
          🎉 所有章节都已完成，去复习里守住成果吧
        </p>
      </section>
    </div>

    <!-- 分册切换 -->
    <div class="mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
      <button
        v-for="g in grades"
        :key="g.id"
        class="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition active:scale-95"
        :class="
          g.id === activeGradeId
            ? 'bg-sky-500 text-white shadow-sm'
            : 'bg-white text-slate-500 shadow-sm'
        "
        @click="selectGrade(g.id)"
      >
        {{ g.emoji }} {{ g.name }}
      </button>
    </div>

    <div class="mt-4 flex flex-col gap-3 px-5">
      <div
        v-for="chapter in chapters"
        :key="chapter.unit.id"
        class="overflow-hidden rounded-3xl bg-white shadow-sm"
        :class="{ 'ring-2 ring-sky-300': chapter.unit.id === currentUnitId }"
      >
        <button
          class="flex w-full items-center gap-3 p-4 text-left"
          @click="toggle(chapter.unit.id)"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold"
            :class="
              chapter.completed
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-sky-50 text-sky-600'
            "
          >
            {{ chapter.completed ? '✓' : chapter.unit.title.replace(/[^\d]/g, '') }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-base font-bold text-slate-800">
              {{ chapter.unit.title
              }}<span v-if="chapter.unit.name" class="text-slate-500">
                · {{ chapter.unit.name }}</span
              >
            </p>
            <p class="mt-0.5 text-xs text-slate-400">
              已学 {{ chapter.learned }}/{{ chapter.total }} · 掌握
              {{ chapter.mastered }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <span
              v-if="chapter.completed"
              class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-600"
              >已点亮</span
            >
            <span v-else class="text-[11px] font-bold text-slate-400">
              {{ chapter.doneCount }}/4
            </span>
            <p class="mt-1 text-[11px] text-slate-300">
              {{ expandedUnitId === chapter.unit.id ? '收起' : '展开' }}
            </p>
          </div>
        </button>

        <div class="h-1 bg-slate-100">
          <div
            class="h-full bg-gradient-to-r from-sky-300 to-emerald-400 transition-all"
            :style="{
              width: `${chapter.total ? Math.round((chapter.learned / chapter.total) * 100) : 0}%`,
            }"
          ></div>
        </div>

        <div v-if="expandedUnitId === chapter.unit.id" class="grid grid-cols-2 gap-2 p-3 pt-2">
          <button
            v-for="node in chapter.nodes"
            :key="node.id"
            class="rounded-2xl border-2 p-2.5 text-left transition active:scale-95"
            :class="
              node.done
                ? 'border-emerald-200 bg-emerald-50'
                : node.unlocked
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-100 bg-slate-50 opacity-60'
            "
            :disabled="!node.unlocked"
            @click="openNode(chapter, node)"
          >
            <p class="flex items-center gap-1 text-sm font-bold text-slate-700">
              <span>{{ node.done ? '✅' : node.unlocked ? node.emoji : '🔒' }}</span>
              <span>{{ node.title }}</span>
            </p>
            <p class="mt-0.5 text-[11px] text-slate-400">{{ node.detail }}</p>
          </button>
        </div>

        <p
          v-if="chapter.completed && expandedUnitId === chapter.unit.id"
          class="px-3 pb-3 text-center text-xs font-bold text-emerald-500"
        >
          🎉 章节已点亮，这一章贡献了 {{ chapter.mastered }} 枚知识印记
        </p>
      </div>
    </div>
  </div>
</template>
