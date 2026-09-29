<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import PasswordInput from '@/components/PasswordInput.vue'
import { login, syncNow } from '@/utils/api'

const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function onLogin() {
  if (!username.value || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await login(username.value.trim(), password.value)
    const ok = await syncNow()
    successMsg.value = ok ? '✅ 登录成功，进度已同步！' : '✅ 登录成功（同步失败，稍后会自动重试）'
    setTimeout(() => router.push('/'), 800)
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '登录失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="账号登录" @back="router.back()" />

    <div class="mt-6 px-5">
      <form
        class="rounded-3xl bg-white p-5 shadow-sm"
        @submit.prevent="onLogin"
      >
        <label class="block text-sm font-bold text-slate-500">账号</label>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          placeholder="请输入账号"
          class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg outline-none focus:border-sky-400"
        />
        <label class="mt-4 block text-sm font-bold text-slate-500">密码</label>
        <PasswordInput
          v-model="password"
          class="mt-1"
          input-class="text-lg"
          autocomplete="current-password"
          placeholder="请输入密码"
        />
        <p v-if="errorMsg" class="mt-3 text-sm text-rose-500">{{ errorMsg }}</p>
        <p v-if="successMsg" class="mt-3 text-sm text-emerald-500">
          {{ successMsg }}
        </p>
        <div class="mt-5">
          <AppButton :disabled="loading" type="submit">
            {{ loading ? '登录中…' : '登 录' }}
          </AppButton>
        </div>
      </form>
    </div>
  </div>
</template>
