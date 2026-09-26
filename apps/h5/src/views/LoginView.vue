<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import { changePassword, isLoggedIn, login, logout, syncNow } from '@/utils/api'

const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// —— 修改密码 ——
const oldPassword = ref('')
const newPassword = ref('')
const changing = ref(false)
const pwdMsg = ref('')
const pwdOk = ref(false)

async function onChangePassword() {
  if (!oldPassword.value || !newPassword.value) {
    pwdMsg.value = '请输入旧密码和新密码'
    pwdOk.value = false
    return
  }
  changing.value = true
  pwdMsg.value = ''
  try {
    await changePassword(oldPassword.value, newPassword.value)
    pwdMsg.value = '✅ 密码修改成功'
    pwdOk.value = true
    oldPassword.value = ''
    newPassword.value = ''
  } catch (err) {
    pwdMsg.value = err instanceof Error ? err.message : '修改失败，请稍后再试'
    pwdOk.value = false
  } finally {
    changing.value = false
  }
}

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

function onLogout() {
  logout()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="账号登录" @back="router.back()" />

    <div class="mt-6 px-5">
      <div
        v-if="isLoggedIn()"
        class="rounded-3xl bg-white p-5 text-center shadow-sm"
      >
        <p class="text-lg font-bold text-slate-700">已登录</p>
        <p class="mt-1 text-sm text-slate-400">进度会自动同步到服务器</p>

        <form
          class="mt-5 border-t border-slate-100 pt-4 text-left"
          @submit.prevent="onChangePassword"
        >
          <p class="text-sm font-bold text-slate-500">修改密码</p>
          <input
            v-model="oldPassword"
            type="password"
            autocomplete="current-password"
            placeholder="旧密码"
            class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
          />
          <input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            placeholder="新密码（至少 4 位）"
            class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
          />
          <p
            v-if="pwdMsg"
            class="mt-2 text-sm"
            :class="pwdOk ? 'text-emerald-500' : 'text-rose-500'"
          >
            {{ pwdMsg }}
          </p>
          <div class="mt-3">
            <AppButton :disabled="changing" type="submit" color="ghost" class="py-2 text-base">
              {{ changing ? '提交中…' : '确认修改' }}
            </AppButton>
          </div>
        </form>

        <div class="mt-4 border-t border-slate-100 pt-4">
          <AppButton color="ghost" @click="onLogout">退出登录</AppButton>
        </div>
      </div>

      <form
        v-else
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
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="请输入密码"
          class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg outline-none focus:border-sky-400"
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
