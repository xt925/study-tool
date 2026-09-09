/**
 * 平台能力抽象：core 只依赖这些接口，各端（h5 / uni-app）注入自己的实现。
 */

/** 持久化存储适配器（h5: localStorage；uni-app: uni.getStorageSync/setStorageSync） */
export interface StorageAdapter {
  get(key: string): string | null
  set(key: string, value: string): void
}

/** 语音朗读（TTS / 音频播放） */
export interface SpeakAdapter {
  speak(text: string, opts?: { rate?: number }): void
  stop(): void
}

/** 录音（跟读打分预留） */
export interface RecordAdapter {
  startRecord(): Promise<void>
  stopRecord(): Promise<string>
}

/** 平台能力集合，各端在启动时组装并注入 */
export interface Platform {
  speak: SpeakAdapter
  record?: RecordAdapter
  storage: StorageAdapter
}
