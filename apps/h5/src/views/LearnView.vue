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

// —— 跟读录音 ——
const isRecording = ref(false)
const hasRecording = ref(false)
const isPlayingBack = ref(false)
let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
let playbackUrl = ''

async function startRecord() {
  if (isRecording.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunks = []
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      if (playbackUrl) URL.revokeObjectURL(playbackUrl)
      playbackUrl = URL.createObjectURL(new Blob(chunks, { type: recorder?.mimeType }))
      hasRecording.value = true
    }
    recorder.start()
    isRecording.value = true
  } catch {
    alert('无法使用麦克风，请检查浏览器权限 🔇')
  }
}

function stopRecord() {
  if (recorder && isRecording.value) {
    recorder.stop()
    isRecording.value = false
    progress.completeRepeat() // 跟读完成 +5⭐
  }
}

function playRecording() {
  if (!playbackUrl) return
  isPlayingBack.value = true
  const audio = new Audio(playbackUrl)
  audio.onended = () => (isPlayingBack.value = false)
  audio.play()
}

function nextWord() {
  if (!current.value || !unit.value) return
  progress.completeWord(current.value.id) // 完成单词 +5⭐
  learnedThisUnit.value += 1
  hasRecording.value = false
  if (index.value < unit.value.words.length - 1) {
    index.value += 1
  } else {
    progress.completeUnit(unit.value.id) // 完成单元 +30⭐
    showComplete.value = true
  }
}

watch(index, () => stopSpeak())
onBeforeUnmount(() => {
  stopSpeak()
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
      :message="`你学完了 ${unit?.name ?? unit?.title ?? ''} 的全部单词！`"
      button-text="📝 开始练习"
      @close="router.push(`/quiz/${route.params.gradeId}/${route.params.unitId}`)"
    />
  </div>
</template>
