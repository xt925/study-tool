<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import {
  MAX_FAVORITES,
  getWordById,
  grades,
  meaningOf,
  type Word,
} from '@study/core'
import { useProgressStore } from '@/stores/progress'
import { isLoggedIn } from '@/utils/api'
import { speak } from '@/utils/audio'

const router = useRouter()
const progress = useProgressStore()

const favorites = computed(() =>
  progress.favoriteWordIds
    .map((id) => getWordById(id))
    .filter((w): w is Word => !!w),
)

const managing = ref(false)
const selected = ref<string[]>([])

// 列表变化（如移除后）时清掉已经不存在的选中项
watch(
  () => favorites.value.map((w) => w.id),
  (ids) => {
    selected.value = selected.value.filter((id) => ids.includes(id))
    if (ids.length === 0) managing.value = false
  },
)

const allSelected = computed(
  () => favorites.value.length > 0 && selected.value.length === favorites.value.length,
)

function toggleManage() {
  managing.value = !managing.value
  if (!managing.value) selected.value = []
}

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id]
}

function toggleAll() {
  selected.value = allSelected.value ? [] : favorites.value.map((w) => w.id)
}

function locate(wordId: string) {
  for (const g of grades) {
    for (const u of g.units) {
      const index = u.words.findIndex((w) => w.id === wordId)
      if (index >= 0) return { gradeId: g.id, unitId: u.id, index }
    }
  }
  return null
}

function openWord(wordId: string) {
  if (managing.value) {
    toggle(wordId)
    return
  }
  const loc = locate(wordId)
  if (!loc) return
  router.push({
    name: 'learn',
    params: { gradeId: loc.gradeId, unitId: loc.unitId },
    query: { i: loc.index },
  })
}

function removeSelected() {
  if (selected.value.length === 0) return
  if (!confirm(`取消收藏选中的 ${selected.value.length} 个单词？`)) return
  progress.removeFavorites(selected.value)
  selected.value = []
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="⭐ 我的收藏" @back="router.back()" />

    <div v-if="favorites.length === 0" class="mt-16 px-6 text-center">
      <div class="text-6xl">⭐</div>
      <p class="mt-4 text-lg font-bold text-slate-700">还没有收藏的单词</p>
      <p class="mt-1 text-sm text-slate-400">
        在单词详情页点右上角的星星，就能把单词收进这里随时回顾
      </p>
      <AppButton class="mt-6" @click="router.back()">返回</AppButton>
    </div>

    <template v-else>
      <div class="mt-4 flex items-center justify-between px-5">
        <p class="text-sm text-slate-400">
          已收藏 {{ favorites.length }} / {{ MAX_FAVORITES }} 个
        </p>
        <button class="text-sm font-bold text-sky-500" @click="toggleManage">
          {{ managing ? '完成' : '批量管理' }}
        </button>
      </div>
      <p v-if="!isLoggedIn()" class="mt-1 px-5 text-xs text-amber-500">
        当前未登录，收藏暂存在本机；登录后会自动同步到服务器
      </p>

      <div class="mt-4 flex flex-col gap-3 px-5">
        <div
          v-for="w in favorites"
          :key="w.id"
          class="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition active:scale-95"
        >
          <button
            v-if="managing"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs"
            :class="
              selected.includes(w.id)
                ? 'border-sky-400 bg-sky-400 text-white'
                : 'border-slate-300 text-transparent'
            "
            :aria-label="selected.includes(w.id) ? '取消选择' : '选择'"
            @click="toggle(w.id)"
          >
            ✓
          </button>
          <button class="min-w-0 flex-1 text-left" @click="openWord(w.id)">
            <p class="text-lg font-bold text-slate-800">
              {{ w.word }}
              <span v-if="w.phonetic" class="ml-1 text-sm font-normal text-slate-400">{{
                w.phonetic
              }}</span>
            </p>
            <p class="mt-0.5 truncate text-sm text-slate-500">{{ meaningOf(w) }}</p>
          </button>
          <button
            class="shrink-0 text-xl transition active:scale-90"
            aria-label="发音"
            @click="speak(w.word)"
          >
            🔊
          </button>
        </div>
      </div>

      <div v-if="managing" class="mt-6 px-5">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm text-slate-500">已选 {{ selected.length }} 个</span>
          <button class="text-sm font-bold text-sky-500" @click="toggleAll">
            {{ allSelected ? '取消全选' : '全选' }}
          </button>
        </div>
        <AppButton color="ghost" :disabled="selected.length === 0" @click="removeSelected">
          🗑 取消收藏（{{ selected.length }}）
        </AppButton>
      </div>
    </template>
  </div>
</template>
