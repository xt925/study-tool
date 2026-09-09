interface SpeakOptions {
  rate?: number
}

let cachedVoices: SpeechSynthesisVoice[] = []

function refreshVoices() {
  cachedVoices = window.speechSynthesis?.getVoices() ?? []
}

if ('speechSynthesis' in window) {
  // 语音列表是异步加载的：Chrome 首次调用 getVoices() 往往返回空数组，
  // 必须等 voiceschanged 事件（所以要在页面加载时就监听并预热）
  refreshVoices()
  window.speechSynthesis.onvoiceschanged = refreshVoices
}

/**
 * 音频清单（scripts/generate_audio.py 生成）：文本 -> mp3 路径。
 * 优先播放 MP3，没有对应文件或播放失败时回退到浏览器 TTS。
 */
let manifestPromise: Promise<Record<string, string>> | null = null

function loadManifest(): Promise<Record<string, string>> {
  manifestPromise ??= fetch(import.meta.env.BASE_URL + 'audio/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
  return manifestPromise
}

// 提前加载清单，避免首次点击时还没拉取
if (typeof window !== 'undefined') {
  void loadManifest()
}

function playMp3(src: string, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(import.meta.env.BASE_URL + src)
    audio.playbackRate = rate
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('mp3 播放失败'))
    audio.play().catch(reject)
  })
}

/** 有道免费发音接口（在线备用）：返回美音 MP3 流，无需任何 key */
function youdaoUrl(text: string): string {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`
}

function playRemote(url: string, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)
    audio.playbackRate = rate
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('在线发音播放失败'))
    audio.play().catch(reject)
  })
}

/** 挑选一个可用的英文语音，优先离线（本地）语音，其次再考虑网络语音 */
function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const enVoices = cachedVoices.filter((v) =>
    v.lang.replace('_', '-').toLowerCase().startsWith('en'),
  )
  if (enVoices.length === 0) return null
  return (
    enVoices.find((v) => v.lang === 'en-US' && v.localService) ??
    enVoices.find((v) => v.localService) ??
    enVoices.find((v) => v.lang === 'en-US') ??
    enVoices[0]
  )
}

function speakByTts(text: string, rate: number): void {
  const synth = window.speechSynthesis
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = rate
  utterance.pitch = 1

  const voice = pickEnglishVoice()
  if (voice) {
    utterance.voice = voice
  } else if (cachedVoices.length === 0) {
    // 语音列表还没加载出来（Chrome 常见问题），等 voiceschanged 后再播
    const retry = () => {
      refreshVoices()
      if (cachedVoices.length > 0) {
        synth.removeEventListener?.('voiceschanged', retry)
        synth.speak(utterance)
      }
    }
    synth.addEventListener?.('voiceschanged', retry)
    return
  }

  utterance.onerror = (e) => {
    console.warn('TTS 播放失败：', e.error)
  }

  synth.speak(utterance)
}

/**
 * 统一的发音入口：页面只调用这个函数，不直接触碰 TTS 实现。
 * 优先级：本地 MP3（public/audio/manifest.json）→ 有道在线发音 → 浏览器 TTS。
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  const rate = opts.rate ?? 0.8

  void loadManifest().then((manifest) => {
    const src = manifest[text]
    if (src) {
      playMp3(src, rate).catch(() => playRemote(youdaoUrl(text), rate)).catch(() =>
        speakByTts(text, rate),
      )
      return
    }
    // 有道接口只支持英文内容，中文说明文字直接走浏览器 TTS
    if (/^[\x00-\x7f]+$/.test(text)) {
      playRemote(youdaoUrl(text), rate).catch(() => speakByTts(text, rate))
    } else {
      speakByTts(text, rate)
    }
  })
}

export function stopSpeak(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
