<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  OUTFITS,
  OUTFIT_SLOTS,
  PET_FOODS,
  PET_PLAYS,
  PET_STAGE_NAMES,
  PET_TYPES,
  PET_WELCOME_STARS,
  expToNext,
  findOutfit,
  outfitsForSlot,
  petSpeech,
  petStage,
  type OutfitSlot,
  type PetActionResult,
  type PetType,
} from '@study/core'
import PageHeader from '@/components/PageHeader.vue'
import PetAvatar from '@/components/PetAvatar.vue'
import RewardOverlay from '@/components/RewardOverlay.vue'
import RivePet from '@/components/RivePet.vue'
import { RIVE_PETS } from '@/config/rivePets'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()

// 进入页面先结算离线衰减
onMounted(() => progress.tickPet())

onBeforeUnmount(() => {
  if (happyTimer) clearTimeout(happyTimer)
  if (effectTimer) clearTimeout(effectTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (riveHappyTimer) clearTimeout(riveHappyTimer)
})

const pet = computed(() => progress.pet)
const coins = computed(() => progress.coins)
const stage = computed(() => (pet.value ? petStage(pet.value.level) : 0))
const expNeed = computed(() => (pet.value ? expToNext(pet.value.level) : 1))
const expPercent = computed(() =>
  pet.value ? Math.min(100, Math.round((pet.value.exp / expNeed.value) * 100)) : 0,
)
const speech = computed(() => (pet.value ? petSpeech(pet.value) : ''))
const checkedInToday = computed(() => pet.value?.lastCheckInDate === todayKey())

// 有 Rive 资产就用 Rive，加载失败或还没配置时回退到内置 SVG
const riveConfig = computed(() => (pet.value ? RIVE_PETS[pet.value.type] : undefined))
const riveFailed = ref(false)
const riveLoaded = ref(false)
const riveRef = ref<InstanceType<typeof RivePet> | null>(null)
const riveActive = computed(() => !!riveConfig.value && !riveFailed.value)
const wardrobeSupported = computed(
  () => Object.keys(riveConfig.value?.outfitInputs ?? {}).length > 0,
)

const wardrobeSlot = ref<OutfitSlot | null>(null)
const wardrobeSlotDef = computed(() =>
  OUTFIT_SLOTS.find((slot) => slot.id === wardrobeSlot.value),
)
const wardrobeItems = computed(() =>
  wardrobeSlot.value ? outfitsForSlot(wardrobeSlot.value) : [],
)
const equippedInWardrobeSlot = computed(() =>
  wardrobeSlot.value ? progress.equippedOutfits[wardrobeSlot.value] : undefined,
)
const ownedOutfitCount = computed(
  () => OUTFITS.filter((item) => progress.ownedOutfits.includes(item.id)).length,
)

watch(
  () => pet.value?.type,
  () => {
    riveFailed.value = false
    riveLoaded.value = false
  },
)

// 换装：按成长阶段选不同 Artboard（没配置则始终用基础形象）
const riveArtboard = computed(() => {
  const config = riveConfig.value
  if (!config) return undefined
  if (stage.value >= 2 && config.outfits?.crown) return config.outfits.crown
  if (stage.value >= 1 && config.outfits?.scarf) return config.outfits.scarf
  return config.artboard
})

watch(riveArtboard, () => {
  riveLoaded.value = false
})

function syncRiveState() {
  const config = riveConfig.value
  if (!config?.moodInput || !pet.value) return
  riveRef.value?.setInput(config.moodInput, pet.value.mood)
}

/** 把当前穿戴同步到 Rive 的 View Model（0 隐藏 / 100 显示） */
function applyOutfits() {
  const config = riveConfig.value
  if (!config?.outfitInputs) return
  for (const [outfitId, inputName] of Object.entries(config.outfitInputs)) {
    const def = findOutfit(outfitId)
    if (!def) continue
    riveRef.value?.setViewModelNumber(
      inputName,
      progress.equippedOutfits[def.slot] === outfitId ? 100 : 0,
    )
  }
}

watch(
  () => progress.equippedOutfits,
  () => applyOutfits(),
  { deep: true },
)

/** 根据饱食度和心情决定表情 */
const expression = computed<'normal' | 'sad' | 'hungry' | 'joy'>(() => {
  const p = pet.value
  if (!p) return 'normal'
  if (p.fullness <= 25) return 'hungry'
  if (p.mood <= 25) return 'sad'
  if (p.mood >= 85 && p.fullness >= 60) return 'joy'
  return 'normal'
})

function applyExpression() {
  const config = riveConfig.value
  if (!config?.faceInputs) return
  const state = expression.value
  riveRef.value?.setViewModelNumber(
    config.faceInputs.normal,
    state === 'sad' || state === 'hungry' ? 0 : 100,
  )
  riveRef.value?.setViewModelNumber(
    config.faceInputs.eyesOpen,
    state === 'joy' ? 0 : 100,
  )
  riveRef.value?.setViewModelNumber(
    config.faceInputs.sad,
    state === 'sad' ? 100 : 0,
  )
  riveRef.value?.setViewModelNumber(
    config.faceInputs.hungry,
    state === 'hungry' ? 100 : 0,
  )
  riveRef.value?.setViewModelNumber(
    config.faceInputs.joy,
    state === 'joy' ? 100 : 0,
  )
}

watch(expression, () => applyExpression())

function currentOutfit(slot: OutfitSlot) {
  const id = progress.equippedOutfits[slot]
  return id ? findOutfit(id) : undefined
}

function slotStatusLabel(slot: OutfitSlot) {
  const current = currentOutfit(slot)
  if (current) return `${current.emoji} ${current.name}`
  const owned = outfitsForSlot(slot).filter((item) =>
    progress.ownedOutfits.includes(item.id),
  )
  if (owned.length > 0) {
    return `已拥有 ${owned.map((item) => item.emoji).join('')} · 点此穿戴`
  }
  return '还没有装扮'
}

function isEquipped(id: string) {
  return !!wardrobeSlot.value && progress.equippedOutfits[wardrobeSlot.value] === id
}

function chooseOutfit(id: string) {
  const def = findOutfit(id)
  if (!def) return
  if (!progress.ownedOutfits.includes(id)) {
    if (!progress.buyOutfit(id)) {
      notify(`星星不够，需要 ${def.cost} ⭐`)
      return
    }
    notify(`买到啦！已穿上${def.name}`)
    wardrobeSlot.value = null
    return
  }
  progress.equipOutfit(id)
  notify(`已穿上${def.name}`)
  wardrobeSlot.value = null
}

function takeOffOutfit(slot: OutfitSlot) {
  progress.unequipOutfit(slot)
  notify('已经脱下啦')
  wardrobeSlot.value = null
}

function takeOffCurrent() {
  if (wardrobeSlot.value) takeOffOutfit(wardrobeSlot.value)
}

function onRiveLoaded() {
  riveLoaded.value = true
  syncRiveState()
  applyOutfits()
  applyExpression()
  const config = riveConfig.value
  if (config?.happyInput) {
    riveRef.value?.setViewModelBoolean(config.happyInput, false)
  }
}

watch(
  () => pet.value?.mood,
  () => syncRiveState(),
)

const sceneBg = computed(() => {
  if (!pet.value) return 'from-sky-200 via-rose-100 to-amber-100'
  return {
    cat: 'from-orange-200 via-amber-100 to-rose-100',
    dragon: 'from-indigo-200 via-violet-100 to-rose-100',
    penguin: 'from-sky-200 via-indigo-100 to-slate-100',
  }[pet.value.type]
})

// 地面颜色跟着伙伴走，避免绿色的小火龙和草地糊在一起
const hillClasses = computed(() => {
  const green = ['bg-emerald-200/80', 'bg-emerald-300/70']
  if (!pet.value) return green
  return {
    cat: green,
    dragon: ['bg-violet-200/70', 'bg-violet-300/60'],
    penguin: ['bg-sky-200/80', 'bg-sky-300/60'],
  }[pet.value.type]
})

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

// 互动反馈
const sheet = ref<'feed' | 'play' | null>(null)
const happy = ref(false)
const effect = ref('')
const toast = ref('')
const levelUp = ref(false)
const levelUpLevel = ref(1)
const renameOpen = ref(false)
const nameDraft = ref('')

let happyTimer: ReturnType<typeof setTimeout> | undefined
let effectTimer: ReturnType<typeof setTimeout> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined
let riveHappyTimer: ReturnType<typeof setTimeout> | undefined

function notify(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2400)
}

function celebrate(emoji: string) {
  effect.value = emoji
  if (effectTimer) clearTimeout(effectTimer)
  effectTimer = setTimeout(() => (effect.value = ''), 1200)
  const config = riveConfig.value
  if (config?.happyTrigger) riveRef.value?.trigger(config.happyTrigger)
  if (config?.happyInput && riveLoaded.value) {
    const input = config.happyInput
    riveRef.value?.setViewModelBoolean(input, true)
    if (riveHappyTimer) clearTimeout(riveHappyTimer)
    riveHappyTimer = setTimeout(() => {
      riveRef.value?.setViewModelBoolean(input, false)
    }, config.happyDurationMs ?? 700)
  }
  happy.value = false
  window.setTimeout(() => (happy.value = true), 30)
  if (happyTimer) clearTimeout(happyTimer)
  happyTimer = setTimeout(() => (happy.value = false), 1250)
}

function afterAction(result: PetActionResult, emoji: string) {
  if (!result.ok) {
    notify(result.reason ?? '操作失败，请稍后再试')
    return false
  }
  celebrate(emoji)
  if (result.levelUp && result.level) {
    levelUpLevel.value = result.level
    levelUp.value = true
  }
  return true
}

const levelUpMessage = computed(() => {
  if (levelUpLevel.value >= 10) return '你的伙伴成年啦，戴上了闪亮的小皇冠 👑'
  if (levelUpLevel.value >= 5) return '进入成长期啦，它戴上了你送的小围巾！'
  return '它吃饱喝足，又长大了一点点～'
})

function feed(foodId: string) {
  const food = PET_FOODS.find((item) => item.id === foodId)
  const result = progress.feedPet(foodId)
  sheet.value = null
  if (afterAction(result, food?.emoji ?? '🍎') && !result.levelUp) {
    const bonus = result.checkedIn ? ` · 打卡 +${result.earned} ⭐` : ''
    notify(`${food?.name ?? '食物'}真好吃！经验 +${food?.exp ?? 0}${bonus}`)
  }
}

function play(playId: string) {
  const item = PET_PLAYS.find((entry) => entry.id === playId)
  const result = progress.playWithPet(playId)
  sheet.value = null
  if (afterAction(result, item?.emoji ?? '🎾') && !result.levelUp) {
    const bonus = result.checkedIn ? ` · 打卡 +${result.earned} ⭐` : ''
    notify(`玩得超开心！心情 +${item?.mood ?? 0}${bonus}`)
  }
}

function choosePet(type: PetType) {
  if (!pet.value) {
    progress.adoptPet(type)
    const adopted = progress.pet
    notify(
      `欢迎 ${adopted?.name ?? '新伙伴'}！送你 ${PET_WELCOME_STARS} ⭐ 见面礼`,
    )
    celebrate('🎉')
    return
  }
  if (progress.switchPet(type)) notify('已经换成新的伙伴啦')
}

function unlockPet(type: PetType) {
  const def = PET_TYPES.find((item) => item.type === type)
  if (!def) return
  if (!progress.unlockPet(type)) {
    notify(`星星还不够，需要 ${def.unlockCost} ⭐`)
    return
  }
  notify(`解锁成功！${def.name} 来啦`)
  celebrate('🎉')
}

function patPet() {
  if (!pet.value) return
  celebrate('💗')
}

function openRename() {
  nameDraft.value = pet.value?.name ?? ''
  renameOpen.value = true
}

function saveName() {
  const name = nameDraft.value.trim()
  if (!name) {
    notify('名字不能为空哦')
    return
  }
  progress.renamePet(name)
  renameOpen.value = false
  notify('名字改好啦')
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <PageHeader title="我的宠物" @back="router.back()" />

    <!-- 还没有伙伴：领养 -->
    <template v-if="!pet">
      <div class="px-5 pt-5 text-center">
        <h2 class="text-2xl font-extrabold text-slate-800">领养一只学习伙伴</h2>
        <p class="mt-2 text-sm leading-6 text-slate-400">
          学习赚星星，用星星照顾它<br />它会陪你一起慢慢长大
        </p>
      </div>
      <div class="mt-5 flex flex-col gap-3 px-5">
        <button
          v-for="def in PET_TYPES"
          :key="def.type"
          class="flex items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-sm transition active:scale-[0.98]"
          @click="choosePet(def.type)"
        >
          <div class="shrink-0 rounded-2xl bg-gradient-to-b from-sky-50 to-amber-50">
            <PetAvatar :type="def.type" :level="1" :mood="90" :size="104" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-lg font-extrabold text-slate-800">{{ def.name }}</p>
            <p class="mt-0.5 text-xs leading-5 text-slate-400">{{ def.desc }}</p>
            <span
              class="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500"
            >
              免费领养 · 送 {{ PET_WELCOME_STARS }} ⭐
            </span>
          </div>
          <span class="text-slate-300">›</span>
        </button>
      </div>
      <p class="mt-5 px-8 text-center text-[11px] leading-5 text-slate-400">
        💡 学一个单词 +5 ⭐，完成单元 +30 ⭐<br />星星存进小钱包，就能给伙伴买好吃的啦
      </p>
    </template>

    <template v-else>
      <!-- 余额：可用星星会随消费减少，累计星星始终保留 -->
      <div class="mt-3 flex items-center justify-between px-5">
        <div
          class="flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-extrabold text-amber-500 shadow-sm"
        >
          <span>⭐</span>
          <span>{{ coins }}</span>
          <span class="text-[11px] font-medium text-slate-400">可用</span>
        </div>
        <span class="text-xs text-slate-400">累计星星 {{ progress.stars }}</span>
      </div>

      <!-- 宠物场景 -->
      <section
        class="relative mx-5 mt-3 h-[336px] overflow-hidden rounded-[2rem] bg-gradient-to-b shadow-lg"
        :class="sceneBg"
      >
        <div
          class="absolute right-6 top-6 h-14 w-14 rounded-full bg-amber-200/80"
          style="box-shadow: 0 0 44px rgba(253, 230, 138, 0.95)"
        ></div>
        <div class="cloud c1"></div>
        <div class="cloud c2"></div>

        <div class="absolute inset-x-0 bottom-0 h-24">
          <div
            class="absolute -left-10 bottom-0 h-28 w-60 rounded-full"
            :class="hillClasses[0]"
          ></div>
          <div
            class="absolute -right-12 bottom-0 h-24 w-56 rounded-full"
            :class="hillClasses[1]"
          ></div>
        </div>

        <!-- 名字与等级 -->
        <div
          class="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur"
        >
          <span class="max-w-[104px] truncate text-sm font-extrabold text-slate-700">
            {{ pet.name }}
          </span>
          <span
            class="rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-bold text-white"
            >Lv.{{ pet.level }}</span
          >
          <span class="text-[11px] text-slate-400">{{ PET_STAGE_NAMES[stage] }}</span>
          <button class="text-xs transition active:scale-90" aria-label="改名" @click="openRename">
            ✏️
          </button>
        </div>

        <!-- 心情气泡 -->
        <div
          class="absolute left-4 top-16 max-w-[64%] rounded-2xl rounded-tl-md bg-white/85 px-3.5 py-2 text-xs font-medium leading-5 text-slate-600 shadow-sm backdrop-blur"
        >
          {{ speech }}
        </div>

        <!-- 点一下宠物：没有奖励，只是摸摸它 -->
        <button
          class="absolute inset-x-0 bottom-6 flex justify-center border-0 bg-transparent p-0"
          aria-label="摸摸宠物"
          @click="patPet"
        >
          <div class="relative h-[224px] w-[224px]">
            <!-- Rive 加载中先用 SVG 兜底，加载成功后淡入替换 -->
            <PetAvatar
              v-if="!riveActive || !riveLoaded"
              :type="pet.type"
              :level="pet.level"
              :mood="pet.mood"
              :size="224"
              :happy="happy"
              class="absolute inset-0"
            />
            <RivePet
              v-if="riveActive"
              ref="riveRef"
              class="absolute inset-0 transition-opacity duration-300"
              :class="riveLoaded ? 'opacity-100' : 'opacity-0'"
              :src="riveConfig?.src ?? ''"
              :artboard="riveArtboard"
              :state-machine="riveConfig?.stateMachine"
              :wasm-url="riveConfig?.wasmUrl"
              :size="224"
              @loading="riveLoaded = false"
              @loaded="onRiveLoaded"
              @error="riveFailed = true"
            />
          </div>
        </button>

        <Transition name="effect-pop">
          <span
            v-if="effect"
            class="pointer-events-none absolute right-[16%] top-[42%] text-4xl"
            >{{ effect }}</span
          >
        </Transition>
      </section>

      <!-- 状态卡 -->
      <section
        class="relative z-10 mx-6 -mt-7 rounded-[1.75rem] bg-white/95 p-5 shadow-lg ring-1 ring-white/70"
      >
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2 text-sm font-bold text-slate-700">
            <span class="text-base">🍗</span> 饱食度
          </span>
          <span class="text-xs font-bold text-orange-500">{{ pet.fullness }} / 100</span>
        </div>
        <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full bg-gradient-to-r from-orange-300 to-orange-500 transition-all duration-500"
            :style="{ width: `${pet.fullness}%` }"
          ></div>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span class="flex items-center gap-2 text-sm font-bold text-slate-700">
            <span class="text-base">💗</span> 心情
          </span>
          <span class="text-xs font-bold text-rose-400">{{ pet.mood }} / 100</span>
        </div>
        <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full bg-gradient-to-r from-rose-300 to-pink-500 transition-all duration-500"
            :style="{ width: `${pet.mood}%` }"
          ></div>
        </div>

        <div class="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>成长经验</span>
          <span>{{ pet.exp }} / {{ expNeed }}</span>
        </div>
        <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full bg-gradient-to-r from-sky-300 to-sky-500 transition-all duration-500"
            :style="{ width: `${expPercent}%` }"
          ></div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3">
          <button
            class="rounded-2xl bg-gradient-to-br from-orange-400 to-amber-400 py-2.5 text-white shadow-md transition active:scale-95"
            @click="sheet = 'feed'"
          >
            <p class="text-xl leading-6">🍎</p>
            <p class="text-sm font-bold">喂食</p>
            <p class="text-xs font-medium text-white/90">5 ⭐ 起</p>
          </button>
          <button
            class="rounded-2xl bg-gradient-to-br from-rose-400 to-pink-400 py-2.5 text-white shadow-md transition active:scale-95"
            @click="sheet = 'play'"
          >
            <p class="text-xl leading-6">🎾</p>
            <p class="text-sm font-bold">陪它玩</p>
            <p class="text-xs font-medium text-white/90">4 ⭐ 起</p>
          </button>
        </div>

        <div
          v-if="checkedInToday"
          class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-600"
        >
          ✅ 今日已陪伴 · 连续 {{ pet.checkInStreak }} 天
        </div>
        <p
          v-else
          class="mt-3 w-full rounded-2xl bg-slate-50 py-3 text-center text-xs font-medium text-slate-400"
        >
          今天还没照顾它 · 喂食或陪玩就能完成今日打卡
        </p>
      </section>

      <!-- 伙伴图鉴 -->
      <section class="mt-6 px-5">
        <div class="flex items-baseline justify-between">
          <h2 class="text-base font-extrabold text-slate-700">伙伴图鉴</h2>
          <span class="text-[11px] text-slate-400">解锁后随时切换，成长等级共用</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-3">
          <div
            v-for="def in PET_TYPES"
            :key="def.type"
            class="rounded-2xl bg-white p-2 text-center shadow-sm"
            :class="pet.type === def.type ? 'ring-2 ring-sky-300' : ''"
          >
            <div class="relative flex justify-center">
              <PetAvatar
                :type="def.type"
                :level="pet.level"
                :mood="pet.mood"
                :size="82"
                :class="
                  progress.ownedPets.includes(def.type)
                    ? ''
                    : 'opacity-30 grayscale'
                "
              />
              <span
                v-if="!progress.ownedPets.includes(def.type)"
                class="absolute inset-0 flex items-center justify-center text-xl"
                >🔒</span
              >
            </div>
            <p class="mt-0.5 truncate text-xs font-bold text-slate-700">{{ def.name }}</p>
            <button
              v-if="!progress.ownedPets.includes(def.type)"
              class="mt-1 w-full rounded-full bg-amber-50 py-1 text-[11px] font-bold text-amber-600 transition active:scale-95"
              @click="unlockPet(def.type)"
            >
              {{ def.unlockCost }} ⭐ 解锁
            </button>
            <p
              v-else-if="pet.type === def.type"
              class="mt-1 py-1 text-[11px] font-bold text-emerald-500"
            >
              陪伴中
            </p>
            <button
              v-else
              class="mt-1 w-full rounded-full bg-slate-100 py-1 text-[11px] font-bold text-slate-500 transition active:scale-95"
              @click="choosePet(def.type)"
            >
              切换
            </button>
          </div>
        </div>
      </section>

      <!-- 衣橱 -->
      <section v-if="wardrobeSupported" class="mt-6 px-5">
        <div class="flex items-baseline justify-between">
          <h2 class="text-base font-extrabold text-slate-700">衣橱</h2>
          <span class="text-[11px] text-slate-400">
            已拥有 {{ ownedOutfitCount }} / {{ OUTFITS.length }} 件
          </span>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <button
            v-for="slot in OUTFIT_SLOTS"
            :key="slot.id"
            class="flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition active:scale-[0.99]"
            @click="wardrobeSlot = slot.id"
          >
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl"
              >{{ slot.emoji }}</span
            >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold text-slate-700">{{ slot.name }}</p>
              <p class="truncate text-xs text-slate-400">
                {{ slotStatusLabel(slot.id) }}
              </p>
            </div>
            <span class="shrink-0 text-xs font-bold text-sky-500">
              {{ currentOutfit(slot.id) ? '更换' : '穿戴' }}
            </span>
          </button>
        </div>
      </section>

      <p class="mt-6 px-8 text-center text-[11px] leading-5 text-slate-400">
        💡 饱食度和心情会随时间慢慢下降，记得常回来看看它<br />每天第一次喂食或陪玩会自动完成陪伴打卡
      </p>
      <p
        v-if="riveConfig?.credit"
        class="mt-2 px-8 text-center text-[10px] leading-4 text-slate-400"
      >
        宠物动画：{{ riveConfig.credit.title }} ·
        <a
          :href="riveConfig.credit.authorUrl"
          target="_blank"
          rel="noreferrer"
          class="underline"
          >{{ riveConfig.credit.author }}</a
        >
        ·
        <a
          :href="riveConfig.credit.licenseUrl"
          target="_blank"
          rel="noreferrer"
          class="underline"
          >{{ riveConfig.credit.license }}</a
        >
      </p>
    </template>

    <!-- 喂食 / 玩耍面板 -->
    <Teleport to="body">
      <div
        v-if="sheet"
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40"
        @click.self="sheet = null"
      >
        <div class="w-full max-w-md rounded-t-[2rem] bg-white px-5 pb-8 pt-4 shadow-2xl">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200"></div>
          <h3 class="text-lg font-extrabold text-slate-800">
            {{ sheet === 'feed' ? '给它喂点什么？' : '一起玩什么？' }}
          </h3>

          <div v-if="sheet === 'feed'" class="mt-3 flex flex-col gap-2">
            <button
              v-for="food in PET_FOODS"
              :key="food.id"
              :disabled="coins < food.cost"
              class="flex items-center gap-3 rounded-2xl border-2 border-slate-100 p-3 text-left transition active:scale-[0.99] disabled:opacity-40"
              @click="feed(food.id)"
            >
              <span class="text-3xl">{{ food.emoji }}</span>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-slate-700">{{ food.name }}</p>
                <p class="text-[11px] text-slate-400">
                  饱食 +{{ food.fullness }} · 心情 +{{ food.mood }} · 经验 +{{ food.exp }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-500"
                >⭐ {{ food.cost }}</span
              >
            </button>
          </div>

          <div v-else class="mt-3 flex flex-col gap-2">
            <button
              v-for="item in PET_PLAYS"
              :key="item.id"
              :disabled="coins < item.cost"
              class="flex items-center gap-3 rounded-2xl border-2 border-slate-100 p-3 text-left transition active:scale-[0.99] disabled:opacity-40"
              @click="play(item.id)"
            >
              <span class="text-3xl">{{ item.emoji }}</span>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-slate-700">{{ item.name }}</p>
                <p class="text-[11px] text-slate-400">
                  心情 +{{ item.mood }} · 饱食 {{ signed(item.fullness) }} · 经验 +{{ item.exp }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-500"
                >⭐ {{ item.cost }}</span
              >
            </button>
          </div>

          <p class="mt-3 text-center text-xs text-slate-400">当前可用 ⭐ {{ coins }}</p>
          <button
            class="mt-3 w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-500 transition active:scale-95"
            @click="sheet = null"
          >
            取消
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 衣橱面板 -->
    <Teleport to="body">
      <div
        v-if="wardrobeSlot"
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40"
        @click.self="wardrobeSlot = null"
      >
        <div class="w-full max-w-md rounded-t-[2rem] bg-white px-5 pb-8 pt-4 shadow-2xl">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200"></div>
          <h3 class="text-lg font-extrabold text-slate-800">
            {{ wardrobeSlotDef?.name }} · 选择装扮
          </h3>

          <div class="mt-3 flex flex-col gap-2">
            <button
              v-for="item in wardrobeItems"
              :key="item.id"
              :disabled="isEquipped(item.id)"
              class="flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition active:scale-[0.99] disabled:opacity-70"
              :class="
                equippedInWardrobeSlot === item.id
                  ? 'border-sky-300 bg-sky-50'
                  : 'border-slate-100'
              "
              @click="chooseOutfit(item.id)"
            >
              <span class="text-3xl">{{ item.emoji }}</span>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-slate-700">{{ item.name }}</p>
                <p class="text-[11px] text-slate-400">{{ item.desc }}</p>
              </div>
              <span
                v-if="isEquipped(item.id)"
                class="shrink-0 rounded-full bg-sky-500 px-2.5 py-1 text-xs font-bold text-white"
                >已穿戴</span
              >
              <span
                v-else-if="progress.ownedOutfits.includes(item.id)"
                class="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-500"
                >穿上</span
              >
              <span
                v-else
                class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-500"
                >⭐ {{ item.cost }}</span
              >
            </button>
          </div>

          <button
            v-if="equippedInWardrobeSlot"
            class="mt-3 w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-500 transition active:scale-95"
            @click="takeOffCurrent"
          >
            脱下
          </button>
          <button
            class="mt-3 w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-500 transition active:scale-95"
            @click="wardrobeSlot = null"
          >
            取消
          </button>
          <p class="mt-3 text-center text-xs text-slate-400">
            当前可用 ⭐ {{ progress.coins }}
          </p>
        </div>
      </div>
    </Teleport>

    <!-- 改名 -->
    <Teleport to="body">
      <div
        v-if="renameOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6"
        @click.self="renameOpen = false"
      >
        <div class="w-full max-w-sm rounded-3xl bg-white p-5">
          <h3 class="text-lg font-extrabold text-slate-800">给伙伴取个名字</h3>
          <input
            v-model="nameDraft"
            maxlength="12"
            class="mt-3 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-center text-lg font-bold text-slate-700 outline-none focus:border-sky-400"
          />
          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-2xl bg-slate-100 py-3 font-bold text-slate-500 transition active:scale-95"
              @click="renameOpen = false"
            >
              取消
            </button>
            <button
              class="flex-1 rounded-2xl bg-sky-500 py-3 font-bold text-white transition active:scale-95"
              @click="saveName"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 提示 -->
    <Transition name="pet-toast">
      <div
        v-if="toast"
        class="fixed left-1/2 top-4 z-[60] w-[82%] max-w-xs -translate-x-1/2 rounded-2xl bg-slate-900/90 px-4 py-2.5 text-center text-sm font-medium text-white shadow-xl"
      >
        {{ toast }}
      </div>
    </Transition>

    <RewardOverlay
      :show="levelUp"
      :title="`升级到 Lv.${levelUpLevel} 啦！`"
      :message="levelUpMessage"
      button-text="太棒啦"
      @close="levelUp = false"
    />
  </div>
</template>

<style scoped>
.cloud {
  position: absolute;
  width: 64px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  animation: cloud-drift 24s linear infinite;
}

.cloud::before,
.cloud::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: inherit;
}

.cloud::before {
  width: 28px;
  height: 28px;
  left: 8px;
  top: -12px;
}

.cloud::after {
  width: 20px;
  height: 20px;
  right: 10px;
  top: -8px;
}

.cloud.c1 {
  top: 58px;
  left: -80px;
}

.cloud.c2 {
  top: 100px;
  left: -80px;
  width: 48px;
  height: 16px;
  opacity: 0.7;
  animation-duration: 32s;
  animation-delay: -8s;
}

@keyframes cloud-drift {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(500px);
  }
}

.effect-pop-enter-active {
  animation: effect-pop 0.5s ease-out;
}

.effect-pop-leave-active {
  transition: opacity 0.3s ease;
}

.effect-pop-leave-to {
  opacity: 0;
}

@keyframes effect-pop {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.5);
  }
  60% {
    opacity: 1;
    transform: translateY(-8px) scale(1.15);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.pet-toast-enter-active,
.pet-toast-leave-active {
  transition: opacity 0.2s ease;
}

.pet-toast-enter-from,
.pet-toast-leave-to {
  opacity: 0;
}
</style>
