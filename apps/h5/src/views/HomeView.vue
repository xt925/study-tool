<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import ProgressDots from '@/components/ProgressDots.vue'
import { levelProgress, useProgressStore } from '@/stores/progress'
import { getParentNote, isLoggedIn, type ParentNote } from '@/utils/api'

const router = useRouter()
const progress = useProgressStore()

const percent = computed(() =>
  Math.min(100, Math.round(levelProgress(progress.stars) * 100)),
)

// 家长设置的目标与寄语（未登录或未设置时为 null）
const parentNote = ref<ParentNote | null>(null)

onMounted(async () => {
  if (!isLoggedIn()) return
  try {
    const note = await getParentNote()
    parentNote.value = note.dailyGoal > 0 || note.message ? note : null
  } catch {
    // 未登录/断网时静默，不影响首页
  }
})

const goalPercent = computed(() => {
  const goal = parentNote.value?.dailyGoal ?? 0
  if (goal <= 0) return 0
  return Math.min(100, Math.round((progress.todayWordCount / goal) * 100))
})

const goalReached = computed(() => {
  const goal = parentNote.value?.dailyGoal ?? 0
  return goal > 0 && progress.todayWordCount >= goal
})
</script>

<template>
  <div class="flex min-h-screen flex-col px-5 pb-10">
    <div class="flex justify-between pt-4">
      <div class="flex gap-2">
        <!-- 全库查单词：输入单词/音标/中文即可检索 -->
        <button
          class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm transition active:scale-95"
          aria-label="查单词"
          @click="router.push('/search')"
        >
          🔍
        </button>
        <!-- 成就徽章 -->
        <button
          class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm transition active:scale-95"
          aria-label="成就"
          @click="router.push('/achievements')"
        >
          🏆
        </button>
      </div>
      <!-- 默认头像，点进个人信息页（家长中心 / 同步 / 退出登录 都在里面） -->
      <button
        class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm transition active:scale-95"
        aria-label="个人信息"
        @click="router.push('/profile')"
      >
        👤
      </button>
    </div>
    <header class="pt-4 text-center">
      <h1 class="text-3xl font-extrabold text-slate-800">🐶 English Adventure</h1>
      <p class="mt-1 text-slate-400">每天学一点，英语大冒险！</p>
    </header>

    <section
      class="mt-4 flex items-center justify-between rounded-3xl bg-gradient-to-r from-orange-400 to-amber-400 px-5 py-4 text-white shadow-sm"
    >
      <div class="flex items-center gap-3">
        <span class="text-3xl">🔥</span>
        <div>
          <p class="text-lg font-extrabold">连续打卡 {{ progress.currentStreak }} 天</p>
          <p class="text-xs text-white/80">
            {{
              progress.checkedInToday
                ? '今天已打卡，继续保持！'
                : '今天还没打卡，学一个单词即可'
            }}
          </p>
        </div>
      </div>
      <div class="text-right text-xs text-white/80">
        <p>最长</p>
        <p class="text-base font-bold text-white">{{ progress.maxStreak }} 天</p>
      </div>
    </section>

    <!-- 家长寄语 / 每日目标 -->
    <section
      v-if="parentNote"
      class="mt-4 rounded-3xl bg-white p-4 shadow-sm"
    >
      <div class="flex items-center gap-2">
        <span class="text-xl">👪</span>
        <span class="text-sm font-bold text-slate-700">家长寄语</span>
      </div>
      <p
        v-if="parentNote.message"
        class="mt-2 rounded-2xl bg-sky-50 p-3 text-sm leading-5 text-slate-600"
      >
        “{{ parentNote.message }}”
      </p>
      <div v-if="parentNote.dailyGoal > 0" class="mt-2">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>今日目标</span>
          <span>{{ progress.todayWordCount }} / {{ parentNote.dailyGoal }} 个</span>
        </div>
        <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full bg-emerald-400 transition-all"
            :style="{ width: `${goalPercent}%` }"
          ></div>
        </div>
        <p v-if="goalReached" class="mt-1 text-xs font-bold text-emerald-500">
          ✅ 今日目标已达成，真棒！
        </p>
      </div>
    </section>

    <section class="mt-6 rounded-3xl bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🏅</span>
          <span class="text-lg font-bold text-slate-700"
            >Lv.{{ progress.level }}</span
          >
        </div>
        <div class="flex items-center gap-1 text-lg font-bold text-amber-500">
          <span>⭐</span>
          <span>{{ progress.stars }}</span>
        </div>
      </div>
      <div class="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all"
          :style="{ width: `${percent}%` }"
        ></div>
      </div>
      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm text-slate-500">今日进度</span>
        <ProgressDots :total="5" :filled="Math.min(5, progress.todayWordCount)" />
      </div>
      <p class="mt-1 text-right text-xs text-slate-400">
        今天已学 {{ progress.todayWordCount }} 个单词
      </p>
    </section>

    <div class="mt-8 flex flex-col gap-3">
      <AppButton @click="router.push('/grades')">📚 开始学习</AppButton>
      <AppButton color="green" @click="router.push('/review')">
        🔁 复习{{ progress.dueReviewCount > 0 ? `（${progress.dueReviewCount}）` : '' }}
      </AppButton>
      <AppButton color="ghost" @click="router.push('/wrong')">
        📕 错题本{{ progress.wrongWordCount > 0 ? `（${progress.wrongWordCount}）` : '' }}
      </AppButton>
      <AppButton color="orange" @click="router.push('/games')"
        >🎮 游戏乐园</AppButton
      >
    </div>
  </div>
</template>
