<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import { meaningOf, searchWords, type WordHit } from '@study/core'

const router = useRouter()

const keyword = ref('')
const query = computed(() => keyword.value.trim())
const results = computed(() => searchWords(query.value))

function openWord(hit: WordHit) {
  router.push({
    name: 'learn',
    params: { gradeId: hit.gradeId, unitId: hit.unitId },
    query: { i: hit.index },
  })
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="查单词" @back="router.back()" />

    <div class="px-5 pt-4">
      <div class="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
        <span class="text-lg">🔍</span>
        <input
          v-model="keyword"
          type="text"
          inputmode="search"
          placeholder="输入单词、音标或中文释义"
          class="min-w-0 flex-1 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-300"
        />
        <button
          v-if="keyword"
          class="text-slate-300 transition active:scale-90"
          aria-label="清空"
          @click="keyword = ''"
        >
          ✕
        </button>
      </div>
    </div>

    <div v-if="query" class="mt-4 px-5">
      <p v-if="results.length === 0" class="mt-10 text-center text-slate-400">
        没有找到「{{ query }}」😢
      </p>
      <template v-else>
        <p class="mb-2 text-xs text-slate-400">共找到 {{ results.length }} 个结果</p>
        <div class="flex flex-col gap-2">
          <button
            v-for="hit in results"
            :key="`${hit.unitId}:${hit.word.id}`"
            class="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 text-left shadow-sm transition active:scale-95"
            @click="openWord(hit)"
          >
            <span class="shrink-0 text-base font-bold text-slate-800">{{ hit.word.word }}</span>
            <span class="min-w-0 flex-1 truncate text-right text-sm text-slate-500">
              {{ meaningOf(hit.word) }}
            </span>
          </button>
        </div>
      </template>
    </div>

    <p v-else class="mt-16 px-5 text-center text-sm text-slate-400">
      输入关键词，即可在全部课本词表中查找 🔍
    </p>
  </div>
</template>
