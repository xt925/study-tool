<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import PasswordInput from '@/components/PasswordInput.vue'
import { changePassword, isLoggedIn } from '@/utils/api'

const router = useRouter()

// isLoggedIn 读的是 localStorage、不是响应式，进页面时读一次即可
const loggedIn = ref(isLoggedIn())

const oldPassword = ref('')
const newPassword = ref('')
const changing = ref(false)
const pwdMsg = ref('')
const pwdOk = ref(false)

async function onSubmit() {
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
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="修改密码" @back="router.back()" />

    <div class="mt-6 px-5">
      <div
        v-if="!loggedIn"
        class="rounded-3xl bg-white p-5 text-center shadow-sm"
      >
        <p class="text-4xl">🔒</p>
        <p class="mt-2 font-bold text-slate-700">请先登录</p>
        <p class="mt-1 text-sm text-slate-400">登录后才能修改密码</p>
        <AppButton class="mt-4" @click="router.push('/login')">👤 去登录</AppButton>
      </div>

      <form
        v-else
        class="rounded-3xl bg-white p-5 shadow-sm"
        @submit.prevent="onSubmit"
      >
        <label class="block text-sm font-bold text-slate-500">旧密码</label>
        <PasswordInput
          v-model="oldPassword"
          class="mt-1"
          autocomplete="current-password"
          placeholder="请输入旧密码"
        />
        <label class="mt-4 block text-sm font-bold text-slate-500">新密码</label>
        <PasswordInput
          v-model="newPassword"
          class="mt-1"
          autocomplete="new-password"
          placeholder="至少 4 位"
        />
        <p
          v-if="pwdMsg"
          class="mt-3 text-sm"
          :class="pwdOk ? 'text-emerald-500' : 'text-rose-500'"
        >
          {{ pwdMsg }}
        </p>
        <div class="mt-5">
          <AppButton type="submit" :disabled="changing">
            {{ changing ? '提交中…' : '确认修改' }}
          </AppButton>
        </div>
      </form>
    </div>
  </div>
</template>
