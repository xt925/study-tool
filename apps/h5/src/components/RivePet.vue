<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { Rive as RiveInstance } from '@rive-app/canvas'
// 自托管 wasm，避免国内网络访问 unpkg / jsdelivr 失败
import riveWasmUrl from '@rive-app/canvas/rive.wasm?url'

const props = withDefaults(
  defineProps<{
    src: string
    artboard?: string
    stateMachine?: string
    wasmUrl?: string
    size?: number
  }>(),
  { size: 224 },
)

const emit = defineEmits<{ loading: []; loaded: []; error: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let rive: RiveInstance | null = null
let disposed = false

function destroy() {
  rive?.cleanup()
  rive = null
}

async function load() {
  destroy()
  if (!canvas.value) return
  emit('loading')
  try {
    // 按需加载运行时，没配置 Rive 的宠物不会把这部分打进首屏
    const { Rive, RuntimeLoader } = await import('@rive-app/canvas')
    if (disposed || !canvas.value) return
    RuntimeLoader.setWasmUrl(props.wasmUrl ?? riveWasmUrl)

    rive = new Rive({
      src: props.src,
      canvas: canvas.value,
      artboard: props.artboard,
      stateMachine: props.stateMachine,
      autoplay: true,
      // 自动绑定 .riv 里的默认 View Model，换装属性才能生效
      autoBind: true,
      // 点击由外层按钮统一处理，避免 canvas 抢走触摸事件
      shouldDisableRiveListeners: true,
      onLoad: () => {
        rive?.resizeDrawingSurfaceToCanvas()
        emit('loaded')
      },
      onLoadError: () => emit('error'),
    })
  } catch {
    emit('error')
  }
}

/** 触发状态机里的 trigger（例如互动时的 happy） */
function trigger(name: string) {
  if (!rive || !props.stateMachine) return
  rive
    .stateMachineInputs(props.stateMachine)
    ?.find((input) => input.name === name)
    ?.fire()
}

/** 写入状态机里的 number / boolean 输入（例如心情值、换装索引） */
function setInput(name: string, value: boolean | number) {
  if (!rive || !props.stateMachine) return
  const input = rive
    .stateMachineInputs(props.stateMachine)
    ?.find((item) => item.name === name)
  if (input) input.value = value
}

/** 写入 View Model 的 number 属性（换装透明度、心情值等） */
function setViewModelNumber(name: string, value: number) {
  const property = rive?.viewModelInstance?.number(name)
  if (property) property.value = value
}

/** 写入 View Model 的 boolean 属性（状态机的 happy 开关） */
function setViewModelBoolean(name: string, value: boolean) {
  const property = rive?.viewModelInstance?.boolean(name)
  if (property) property.value = value
}

function onResize() {
  rive?.resizeDrawingSurfaceToCanvas()
}

onMounted(() => {
  void load()
  window.addEventListener('resize', onResize)
})

watch(
  () => [props.src, props.artboard, props.stateMachine, props.wasmUrl],
  () => void load(),
)

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('resize', onResize)
  destroy()
})

defineExpose({ trigger, setInput, setViewModelNumber, setViewModelBoolean })
</script>

<template>
  <canvas
    ref="canvas"
    class="block select-none"
    style="touch-action: manipulation"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-label="宠物动画"
  />
</template>
