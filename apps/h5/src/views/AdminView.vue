<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import { getAdminSummary, getAuth } from '@/utils/api'
import type { AdminSummaryItem } from '@/utils/api'

const router = useRouter()

const isAdmin = getAuth()?.role === 'admin'
const users = ref<AdminSummaryItem[]>([])
const loading = ref(false)
const errorMsg = ref('')

function formatTime(iso: string | null): string {
  if (!iso) return '从未同步'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

onMounted(async () => {
  if (!isAdmin) return
  loading.value = true
  try {
    users.value = await getAdminSummary()
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="家长中心" @back="router.back()" />

    <div class="mt-6 px-5">
      <div
        v-if="!isAdmin"
        class="rounded-3xl bg-white p-5 text-center shadow-sm"
      >
        <p class="text-4xl">🔒</p>
        <p class="mt-2 font-bold text-slate-700">此页面仅家长账号可见</p>
        <p class="mt-1 text-sm text-slate-400">请使用管理员账号登录后访问</p>
      </div>

      <template v-else>
        <p v-if="loading" class="text-center text-slate-400">加载中…</p>
        <p v-else-if="errorMsg" class="text-center text-rose-500">
          {{ errorMsg }}
        </p>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="u in users"
            :key="u.username"
            class="rounded-3xl bg-white p-5 shadow-sm"
          >
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold text-slate-800">{{
                u.username
              }}</span>
              <span class="text-sm text-slate-400">{{
                formatTime(u.lastActive)
              }}</span>
            </div>
            <div class="mt-3 grid grid-cols-4 gap-2 text-center">
              <div class="rounded-2xl bg-amber-50 py-2">
                <p class="text-lg font-bold text-amber-500">⭐{{ u.stars }}</p>
                <p class="text-xs text-slate-400">星星</p>
              </div>
              <div class="rounded-2xl bg-sky-50 py-2">
                <p class="text-lg font-bold text-sky-500">Lv.{{ u.level }}</p>
                <p class="text-xs text-slate-400">等级</p>
              </div>
              <div class="rounded-2xl bg-emerald-50 py-2">
                <p class="text-lg font-bold text-emerald-500">
                  {{ u.learnedCount }}
                </p>
                <p class="text-xs text-slate-400">已学单词</p>
              </div>
              <div class="rounded-2xl bg-violet-50 py-2">
                <p class="text-lg font-bold text-violet-500">
                  {{ u.completedUnitCount }}
                </p>
                <p class="text-xs text-slate-400">完成单元</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
