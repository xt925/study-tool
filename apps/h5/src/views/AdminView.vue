<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import { getAdminSummary, getAuth, setParentNote } from '@/utils/api'
import type { AdminSummaryItem } from '@/utils/api'

const router = useRouter()

const isAdmin = getAuth()?.role === 'admin'
const users = ref<AdminSummaryItem[]>([])
const loading = ref(false)
const errorMsg = ref('')

// 每个孩子的目标/寄语编辑草稿，key 为 username
interface Draft {
  dailyGoal: number
  message: string
}
const drafts = reactive<Record<string, Draft>>({})
const saving = ref('')
const savedUser = ref('')
const saveError = ref('')

// 展开某人的近 7 天报告
const expanded = reactive<Record<string, boolean>>({})

function toggleWeek(username: string) {
  expanded[username] = !expanded[username]
}

function weekday(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
}

function weekMax(days: { words: number }[]): number {
  return Math.max(1, ...days.map((d) => d.words))
}

function barHeight(words: number, max: number): number {
  return Math.max(2, Math.round((words / max) * 60))
}

function formatTime(iso: string | null): string {
  if (!iso) return '从未同步'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

onMounted(async () => {
  if (!isAdmin) return
  loading.value = true
  try {
    users.value = await getAdminSummary()
    for (const u of users.value) {
      drafts[u.username] = { dailyGoal: u.dailyGoal, message: u.message }
    }
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
})

async function save(username: string) {
  const draft = drafts[username]
  if (!draft) return
  const goal = Math.max(0, Math.floor(Number(draft.dailyGoal) || 0))
  saving.value = username
  saveError.value = ''
  try {
    await setParentNote(username, goal, draft.message)
    draft.dailyGoal = goal
    const user = users.value.find((u) => u.username === username)
    if (user) {
      user.dailyGoal = goal
      user.message = draft.message
    }
    savedUser.value = username
    setTimeout(() => {
      if (savedUser.value === username) savedUser.value = ''
    }, 2000)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    saving.value = ''
  }
}
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
          <p
            v-if="saveError"
            class="rounded-2xl bg-rose-50 p-3 text-center text-sm text-rose-500"
          >
            {{ saveError }}
          </p>
          <div
            v-for="u in users"
            :key="u.username"
            class="rounded-3xl bg-white p-5 shadow-sm"
          >
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold text-slate-800">
                {{ u.username }}
                <span
                  v-if="u.role === 'admin'"
                  class="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-400"
                  >家长</span
                >
              </span>
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

            <!-- 今日进度 / 目标 / 连续打卡 -->
            <p class="mt-3 text-center text-sm text-slate-500">
              今日已学
              <b class="text-emerald-500">{{ u.todayWords }}</b> 个
              <template v-if="u.dailyGoal > 0">
                / 目标 <b class="text-slate-700">{{ u.dailyGoal }}</b> 个
              </template>
              · 🔥 连续 {{ u.streak }} 天
            </p>
            <p
              v-if="u.dailyGoal > 0 && u.todayWords >= u.dailyGoal"
              class="mt-1 text-center text-xs font-bold text-emerald-500"
            >
              ✅ 今日目标已达成
            </p>

            <!-- 设置每日目标与寄语 -->
            <div
              v-if="drafts[u.username] && u.role !== 'admin'"
              class="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3"
            >
              <input
                v-model.number="drafts[u.username].dailyGoal"
                type="number"
                min="0"
                max="200"
                class="w-16 shrink-0 rounded-xl border border-slate-200 px-2 py-1.5 text-center text-sm text-slate-700"
                placeholder="目标"
              />
              <span class="shrink-0 text-xs text-slate-400">个/天</span>
              <input
                v-model="drafts[u.username].message"
                maxlength="100"
                class="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
                placeholder="写一句鼓励的话…"
              />
              <button
                class="shrink-0 rounded-xl bg-sky-500 px-3 py-1.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
                :disabled="saving === u.username"
                @click="save(u.username)"
              >
                {{
                  saving === u.username
                    ? '…'
                    : savedUser === u.username
                      ? '✓ 已存'
                      : '保存'
                }}
              </button>
            </div>

            <!-- 近 7 天学习报告 -->
            <button
              class="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 py-2 text-sm font-bold text-slate-600 transition active:scale-95"
              @click="toggleWeek(u.username)"
            >
              📊
              {{ expanded[u.username] ? '收起近 7 天报告' : '查看近 7 天报告' }}
            </button>

            <div v-if="expanded[u.username]" class="mt-2 rounded-2xl bg-slate-50 p-3">
              <div class="flex items-end justify-between gap-1">
                <div
                  v-for="d in u.week.days"
                  :key="d.date"
                  class="flex flex-1 flex-col items-center"
                >
                  <span class="mb-1 h-4 text-[10px] font-bold text-slate-500">{{
                    d.words || ''
                  }}</span>
                  <div class="flex h-16 w-full items-end justify-center rounded-md bg-slate-100">
                    <div
                      class="w-3/4 rounded-t-md bg-emerald-400"
                      :style="{
                        height: `${barHeight(d.words, weekMax(u.week.days))}px`,
                      }"
                    ></div>
                  </div>
                  <span class="mt-1 text-[10px] text-slate-400">{{
                    weekday(d.date)
                  }}</span>
                </div>
              </div>

              <div class="mt-3 grid grid-cols-4 gap-2 text-center">
                <div class="rounded-xl bg-white py-2">
                  <p class="text-base font-bold text-slate-700">
                    {{ u.week.totalWords }}
                  </p>
                  <p class="text-[10px] text-slate-400">7 天词数</p>
                </div>
                <div class="rounded-xl bg-white py-2">
                  <p class="text-base font-bold text-emerald-500">
                    {{ u.week.activeDays }}
                  </p>
                  <p class="text-[10px] text-slate-400">活跃天数</p>
                </div>
                <div class="rounded-xl bg-white py-2">
                  <p class="text-base font-bold text-sky-500">
                    {{ u.week.reviewedWords }}
                  </p>
                  <p class="text-[10px] text-slate-400">复习词数</p>
                </div>
                <div class="rounded-xl bg-white py-2">
                  <p class="text-base font-bold text-violet-500">
                    {{ u.week.speechCount }}
                  </p>
                  <p class="text-[10px] text-slate-400">跟读次数</p>
                </div>
              </div>

              <p
                v-if="u.dailyGoal > 0"
                class="mt-2 text-center text-xs text-slate-500"
              >
                近 7 天有
                <b class="text-emerald-500">{{ u.week.goalMetDays }}</b>
                天达成每日目标
              </p>
              <p v-else class="mt-2 text-center text-xs text-slate-400">
                设置每日目标后，这里会统计达标天数
              </p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
