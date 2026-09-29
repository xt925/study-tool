<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useProgressStore } from '@/stores/progress'
import { getAuth, logout, syncNow, syncState } from '@/utils/api'

const router = useRouter()
const progress = useProgressStore()

// getAuth 读的是 localStorage、不是响应式，所以进页面时读一次存起来
const auth = ref(getAuth())

const roleLabel = computed(() => (auth.value?.role === 'admin' ? '家长' : '学生'))

const syncLabel = computed(() => {
  if (syncState.value === 'syncing') return '同步中…'
  return progress.dirty ? '有改动待同步' : '已同步'
})

function onSync() {
  void syncNow()
}

function onLogout() {
  logout()
  auth.value = null
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="个人信息" @back="router.back()" />

    <div class="mt-6 px-5">
      <section class="rounded-3xl bg-white p-6 text-center shadow-sm">
        <div
          class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-4xl"
        >
          👤
        </div>
        <p class="mt-3 text-xl font-bold text-slate-800">
          {{ auth ? auth.username : '未登录' }}
        </p>
        <p class="mt-1 text-sm text-slate-400">
          {{ auth ? roleLabel : '登录后学习进度会自动同步' }}
        </p>
      </section>

      <section class="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
        <template v-if="auth">
          <button
            class="flex w-full items-center justify-between px-5 py-4 text-left transition active:bg-slate-50"
            @click="onSync"
          >
            <span class="font-semibold text-slate-700">🔄 同步进度</span>
            <span class="text-sm text-slate-400">{{ syncLabel }}</span>
          </button>
          <button
            v-if="auth.role === 'admin'"
            class="flex w-full items-center justify-between border-t border-slate-100 px-5 py-4 text-left transition active:bg-slate-50"
            @click="router.push('/admin')"
          >
            <span class="font-semibold text-slate-700">📊 家长中心</span>
            <span class="text-slate-300">›</span>
          </button>
          <button
            class="flex w-full items-center justify-between border-t border-slate-100 px-5 py-4 text-left transition active:bg-slate-50"
            @click="router.push('/profile/password')"
          >
            <span class="font-semibold text-slate-700">🔑 修改密码</span>
            <span class="text-slate-300">›</span>
          </button>
        </template>

        <button
          v-else
          class="flex w-full items-center justify-between px-5 py-4 text-left transition active:bg-slate-50"
          @click="router.push('/login')"
        >
          <span class="font-semibold text-slate-700">👤 去登录</span>
          <span class="text-slate-300">›</span>
        </button>
      </section>

      <AppButton v-if="auth" color="ghost" class="mt-4" @click="onLogout">
        退出登录
      </AppButton>
    </div>
  </div>
</template>
