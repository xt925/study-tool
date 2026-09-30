<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import ProgressDots from '@/components/ProgressDots.vue'
import RewardOverlay from '@/components/RewardOverlay.vue'
import { getUnit } from '@study/core'
import { useProgressStore } from '@/stores/progress'
import { speak, stopSpeak } from '@/utils/audio'
import { ApiError, getSpeechQuota, syncNow, type SpeechQuota } from '@/utils/api'
import {
  createSpeechAttemptId,
  evaluatePreparedSpeech,
  prepareRecording,
  type SpeechScore,
} from '@/utils/speech'
import { loadRecording, saveRecording, type SavedRecording } from '@/utils/recordingStorage'

const route = useRoute()
const router = useRouter()
const progress = useProgressStore()

const found = computed(() =>
  getUnit(route.params.gradeId as string, route.params.unitId as string),
)
const unit = computed(() => found.value?.unit)
const index = ref(0)
const current = computed(() => unit.value?.words[index.value])
const learnedThisUnit = ref(0)
const showComplete = ref(false)

const isRecording = ref(false)
const hasRecording = ref(false)
const isPlayingBack = ref(false)
const isScoring = ref(false)
const score = ref<SpeechScore | null>(null)
const scoreError = ref('')
const quota = ref<SpeechQuota | null>(null)
const quotaError = ref('')
const quotaLoading = ref(false)
const recordingBlob = ref<Blob | null>(null)
const recordingAttemptId = ref('')
const scoreSubmitted = ref(false)
const MAX_RECORDING_MS = 10_000
let recorder: MediaRecorder | null = null
let recordingStream: MediaStream | null = null
let chunks: Blob[] = []
let playbackUrl = ''
let playbackAudio: HTMLAudioElement | null = null
let recordingTimer: ReturnType<typeof setTimeout> | undefined

const recordingKey = computed(() =>
  unit.value && current.value ? `${unit.value.id}:${current.value.id}` : '',
)
const unitAverage = computed(() => {
  const scores = progress.speechScores.filter((item) => item.unitId === unit.value?.id)
  if (scores.length === 0) return null
  return Math.round(scores.reduce((sum, item) => sum + item.total, 0) / scores.length)
})

function toSpeechScore(saved: (typeof progress.speechScores)[number]): SpeechScore {
  return {
    total: saved.total,
    accuracy: saved.accuracy,
    fluency: saved.fluency,
    completion: saved.completion,
    words: [],
  }
}

async function refreshSpeechQuota(wordId: string, key: string) {
  quotaLoading.value = true
  try {
    const latest = await getSpeechQuota(wordId)
    if (recordingKey.value === key) quota.value = latest
  } catch (e) {
    if (recordingKey.value === key) {
      quotaError.value = e instanceof Error ? e.message : '无法读取评分次数'
    }
  } finally {
    if (recordingKey.value === key) quotaLoading.value = false
  }
}

watch(
  recordingKey,
  async (key) => {
    hasRecording.value = false
    score.value = null
    scoreError.value = ''
    quotaError.value = ''
    quota.value = null
    recordingBlob.value = null
    recordingAttemptId.value = ''
    scoreSubmitted.value = false
    quotaLoading.value = false
    if (!key) return

    const word = current.value
    if (word) void refreshSpeechQuota(word.id, key)
    const savedScore = [...progress.speechScores]
      .reverse()
      .find((item) => item.unitId === unit.value?.id && item.wordId === word?.id)
    if (savedScore) score.value = toSpeechScore(savedScore)

    try {
      const saved = await loadRecording(key)
      if (recordingKey.value !== key || !saved) return
      recordingBlob.value = saved.blob
      recordingAttemptId.value = saved.attemptId
      setPlaybackRecording(saved.blob)
      const exactScore = progress.speechScores.find((item) => item.id === saved.attemptId)
      if (exactScore) score.value = toSpeechScore(exactScore)
    } catch {
      if (recordingKey.value === key) scoreError.value = '读取本地录音失败，请重新录制'
    }
  },
  { immediate: true },
)

function setPlaybackRecording(blob: Blob) {
  if (playbackUrl) URL.revokeObjectURL(playbackUrl)
  playbackUrl = URL.createObjectURL(blob)
  hasRecording.value = true
}

async function startRecord() {
  if (isRecording.value || isScoring.value) return
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    alert('当前环境不支持录音 😢\n请确认通过 https:// 开头访问（http 下浏览器会禁用麦克风）')
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recordingStream = stream
    chunks = []
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      recordingStream = null
      const blob = new Blob(chunks, { type: recorder?.mimeType })
      const word = current.value
      const key = recordingKey.value
      if (!word || !key) return

      const saved: SavedRecording = {
        blob,
        attemptId: createSpeechAttemptId(),
      }
      recordingBlob.value = blob
      recordingAttemptId.value = saved.attemptId
      scoreSubmitted.value = false
      score.value = null
      scoreError.value = ''
      setPlaybackRecording(blob)
      void saveRecording(key, saved).catch(() => {
        scoreError.value = '录音暂时无法保存到本机，下次进入可能需要重录'
      })
    }
    recorder.start()
    isRecording.value = true
    recordingTimer = setTimeout(() => {
      if (!isRecording.value) return
      stopRecord()
      alert('单词录音最长 10 秒，已自动停止。')
    }, MAX_RECORDING_MS)
  } catch (e) {
    const name = (e as DOMException).name
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      alert('麦克风权限被拒绝了，请到浏览器设置中允许本站使用麦克风后重试。')
    } else if (name === 'NotFoundError') {
      alert('没有检测到可用的麦克风 😢')
    } else {
      alert(`录音失败：${(e as Error).message || '未知错误'}`)
    }
  }
}

async function rateRecording() {
  const word = current.value
  const unitId = unit.value?.id
  const key = recordingKey.value
  const blob = recordingBlob.value
  const attemptId = recordingAttemptId.value
  if (!word || !unitId || !key || !blob || !attemptId || scoreSubmitted.value) return

  isScoring.value = true
  scoreError.value = ''
  try {
    const prepared = await prepareRecording(blob)
    // 服务端一受理就占掉这段录音今天的机会；成功后按钮由 score 接管显隐
    scoreSubmitted.value = true
    const result = await evaluatePreparedSpeech(word.word, prepared, 'word', {
      wordId: word.id,
      attemptId,
    })
    if (recordingAttemptId.value !== attemptId) return
    score.value = result
    progress.recordSpeechScore({
      id: attemptId,
      unitId,
      wordId: word.id,
      total: result.total,
      accuracy: result.accuracy,
      fluency: result.fluency,
      completion: result.completion,
    })
    void syncNow()
  } catch (e) {
    scoreError.value = e instanceof Error ? e.message : '评测失败，请重试'
    // 服务端有回应说明这次机会已被受理（或被明确拒绝），本会话内不再重试；
    // 纯网络异常下服务端多半没收到，把按钮放出来让用户重试。
    if (!(e instanceof ApiError)) scoreSubmitted.value = false
  } finally {
    isScoring.value = false
    await refreshSpeechQuota(word.id, key)
  }
}

function stopRecord() {
  if (recorder && isRecording.value) {
    if (recordingTimer) clearTimeout(recordingTimer)
    recordingTimer = undefined
    recorder.stop()
    isRecording.value = false
    progress.completeRepeat()
  }
}

function playRecording() {
  if (!playbackUrl) return
  isPlayingBack.value = true
  playbackAudio = new Audio(playbackUrl)
  playbackAudio.onended = () => {
    isPlayingBack.value = false
    playbackAudio = null
  }
  void playbackAudio.play().catch(() => {
    isPlayingBack.value = false
    scoreError.value = '播放录音失败，请重试'
  })
}

function nextWord() {
  if (isRecording.value) {
    alert('请先结束当前录音，再继续下一个单词。')
    return
  }
  if (isScoring.value) {
    alert('本次跟读正在评分，请稍候。')
    return
  }
  if (!hasRecording.value) {
    alert('请先录音跟读当前单词，再继续下一个。')
    return
  }
  if (!current.value || !unit.value) return
  progress.completeWord(current.value.id)
  learnedThisUnit.value += 1
  hasRecording.value = false
  recordingBlob.value = null
  recordingAttemptId.value = ''
  scoreSubmitted.value = false
  score.value = null
  if (index.value < unit.value.words.length - 1) {
    index.value += 1
  } else {
    progress.completeUnit(unit.value.id)
    showComplete.value = true
  }
}

watch(index, () => stopSpeak())
onBeforeUnmount(() => {
  stopSpeak()
  if (recordingTimer) clearTimeout(recordingTimer)
  if (recorder?.state === 'recording') recorder.stop()
  recordingStream?.getTracks().forEach((track) => track.stop())
  playbackAudio?.pause()
  if (playbackUrl) URL.revokeObjectURL(playbackUrl)
})
</script>
<template>
  <div class="flex min-h-screen flex-col pb-10">
    <PageHeader
      :title="unit ? `${unit.title}${unit.name ? ' · ' + unit.name : ''}` : '学习'"
      @back="router.back()"
    />

    <template v-if="unit && current">
      <div class="px-6 pt-4">
        <ProgressDots :total="unit.words.length" :filled="index + 1" />
        <p class="mt-2 text-center text-xs text-slate-400">
          第 {{ index + 1 }} / {{ unit.words.length }} 个
        </p>
      </div>

      <main class="mt-4 flex-1 px-5">
        <div class="rounded-3xl bg-white p-6 text-center shadow-sm">
          <div class="flex items-start justify-center gap-2">
            <h2 class="text-4xl font-extrabold tracking-wide text-slate-800">
              {{ current.word }}
            </h2>
            <button
              class="mt-1 text-2xl transition active:scale-90"
              aria-label="发音"
              @click="speak(current.word)"
            >
              🔊
            </button>
          </div>
          <p v-if="current.phonetic" class="mt-1 text-slate-400">
            {{ current.phonetic }}
          </p>
          <span
            v-if="current.isPhrase"
            class="mt-1 inline-block rounded-full bg-violet-100 px-3 py-0.5 text-xs font-bold text-violet-500"
            >词组</span
          >

          <div class="mt-4 space-y-1.5">
            <p
              v-for="(s, i) in current.senses"
              :key="i"
              class="text-xl font-bold text-slate-700"
            >
              <span v-if="s.pos" class="mr-2 text-sm font-semibold text-sky-500">{{
                s.pos
              }}</span>
              {{ s.meaning }}
            </p>
          </div>

          <button
            v-if="current.example"
            class="mt-5 block w-full rounded-2xl bg-sky-50 p-4 text-left"
            @click="speak(current.example)"
          >
            <p class="text-base font-medium text-slate-700">“{{ current.example }}”</p>
            <p v-if="current.exampleMeaning" class="mt-1 text-sm text-slate-400">
              {{ current.exampleMeaning }}
            </p>
            <p class="mt-1 text-xs text-sky-400">点击播放例句 🔊</p>
          </button>
        </div>

        <div class="mt-4 flex justify-center">
          <AppButton
            v-if="!isRecording"
            color="ghost"
            class="w-auto px-6 py-3 text-base"
            @click="startRecord"
            >🎙 跟我读（录音）</AppButton
          >
          <AppButton
            v-else
            color="orange"
            class="w-auto px-6 py-3 text-base"
            @click="stopRecord"
            >⏹ 停止录音 +5⭐</AppButton
          >
        </div>
        <div v-if="hasRecording && !isRecording" class="mt-3 flex justify-center">
          <AppButton
            color="green"
            class="w-auto px-6 py-3 text-base"
            :disabled="isPlayingBack"
            @click="playRecording"
            >{{ isPlayingBack ? '▶ 播放中…' : '▶ 听听我的录音' }}</AppButton
          >
        </div>
        <div v-if="hasRecording && !isRecording" class="mt-3">
          <p v-if="quota" class="mb-2 text-center text-xs text-slate-400">
            今日评分余量：账号 {{ quota.accountRemaining }}/{{ quota.accountLimit }} · 本词
            {{ quota.wordRemaining }}/{{ quota.wordLimit }}
          </p>
          <p v-else-if="quotaLoading" class="mb-2 text-center text-xs text-slate-400">
            正在读取评分次数…
          </p>
          <p v-if="quotaError" class="mb-2 text-center text-xs text-rose-500">
            {{ quotaError }}
          </p>
          <AppButton
            v-if="!score && !scoreSubmitted"
            color="orange"
            :disabled="isScoring || !quota || quota.accountRemaining === 0 || quota.wordRemaining === 0"
            @click="rateRecording"
          >
            {{ isScoring ? '评分中…' : '⭐ 评分这段录音' }}
          </AppButton>
        </div>
        <p v-if="isScoring" class="mt-3 text-center text-sm text-slate-400">
          正在评测本次跟读…
        </p>
        <div v-if="score" class="mt-3 rounded-2xl bg-sky-50 p-3 text-center">
          <p class="text-sm text-slate-500">本次跟读得分</p>
          <p class="text-3xl font-extrabold text-sky-600">{{ Math.round(score.total) }}</p>
          <p class="mt-1 text-xs text-slate-500">
            准确度 {{ Math.round(score.accuracy) }} · 流利度 {{ Math.round(score.fluency) }} · 完整度 {{ Math.round(score.completion) }}
          </p>
        </div>
        <p v-if="scoreError" class="mt-3 text-center text-sm text-rose-500">
          {{ scoreError }}
        </p>
      </main>

      <footer class="mt-6 px-5">
        <AppButton color="green" @click="nextWord"
          >✅ 学会了 +5⭐（下一个）</AppButton
        >
      </footer>
    </template>

    <p v-else class="mt-10 text-center text-slate-400">单元不存在 😢</p>

    <RewardOverlay
      :show="showComplete"
      title="单元完成 +30⭐！"
      :message="`你学完了 ${unit?.name ?? unit?.title ?? ''} 的全部单词！${unitAverage === null ? '本单元暂无跟读评分。' : `本单元跟读平均分：${unitAverage} 分。`}`"
      button-text="📝 开始练习"
      @close="router.push(`/quiz/${route.params.gradeId}/${route.params.unitId}`)"
    />
  </div>
</template>
