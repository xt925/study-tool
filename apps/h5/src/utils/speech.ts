import { getSpeechToken, type SpeechAttempt } from '@/utils/api'

/**
 * 跟读评测：浏览器录音 → 转成 16k/16bit/单声道 PCM → 直连腾讯云 SOE 推流 → 返回分数。
 * 连接地址由服务端签名下发，SecretKey 不落前端。
 */

/** 腾讯 SOE 要求的采样率 */
const TARGET_RATE = 16000
const MAX_RECORDING_SECONDS = 10

export interface PhonemeScore {
  /** 参考音素（标准发音），可能为空 */
  reference: string
  /** 实际识别到的音素 */
  phone: string
  accuracy: number
}

export interface WordScore {
  word: string
  accuracy: number
  /** 0 匹配 / 1 多读 / 2 漏读 / 3 错读 / 4 未录入 */
  matchTag: number
  phonemes: PhonemeScore[]
}

export interface SpeechScore {
  /** 建议总分 0-100 */
  total: number
  /** 精准度 0-100 */
  accuracy: number
  /** 流利度 0-100 */
  fluency: number
  /** 完整度 0-100 */
  completion: number
  words: WordScore[]
}

export interface PreparedSpeech {
  pcm: ArrayBuffer
  audioHash: string
}

export function createSpeechAttemptId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []

/** 开始录音；需在用户手势里调用（HTTPS 环境） */
export async function startRecording(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前环境不支持录音')
  }
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  chunks = []
  recorder = new MediaRecorder(stream)
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start()
}

/** 结束录音并返回 16k 单声道 PCM（Int16） */
export async function stopRecording(): Promise<ArrayBuffer> {
  const current = recorder
  if (!current) throw new Error('没有正在进行的录音')
  const blob = await new Promise<Blob>((resolve) => {
    current.onstop = () => resolve(new Blob(chunks, { type: current.mimeType }))
    current.stop()
  })
  releaseMic()
  const pcm = await toPcm16k(blob)
  inspectSpeech(pcm)
  return pcm
}

/** 录音中途放弃（如离开页面） */
export function cancelRecording(): void {
  try {
    recorder?.stop()
  } catch {
    // 已经停止，忽略
  }
  releaseMic()
}

function releaseMic() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  recorder = null
  chunks = []
}

/** 浏览器录出来的 webm/mp4 → 解码 → 重采样为 16k 单声道 → Int16 PCM */
async function toPcm16k(blob: Blob): Promise<ArrayBuffer> {
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    if (decoded.duration < 0.2) throw new Error('录音太短了，再试一次')
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * TARGET_RATE),
      TARGET_RATE,
    )
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    return floatToPcm16(rendered.getChannelData(0))
  } finally {
    void ctx.close()
  }
}

function floatToPcm16(samples: Float32Array): ArrayBuffer {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out.buffer
}

/**
 * 判定为静音的归一化 RMS 阈值（0~1）。
 * 取 0.005（约 -46 dBFS），只挡真正的无声/麦克风没录到东西，
 * 正常朗读一般在 0.02 以上。太严会误伤小声说话，调大需谨慎。
 */
const SILENCE_RMS = 0.005
const VOICED_FRAME_RMS = 0.008

/** 16bit 单声道 PCM 的归一化 RMS（0~1） */
export function pcmRms(pcm: ArrayBuffer): number {
  const samples = new Int16Array(pcm)
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] / 0x8000
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}

function inspectSpeech(pcm: ArrayBuffer): void {
  const samples = new Int16Array(pcm)
  const duration = samples.length / TARGET_RATE
  if (duration < 0.25) throw new Error('录音太短了，请读完整个单词再结束')
  if (duration > MAX_RECORDING_SECONDS) {
    throw new Error(`录音超过 ${MAX_RECORDING_SECONDS} 秒，请重新录制`)
  }
  if (pcmRms(pcm) < SILENCE_RMS) {
    throw new Error('几乎没有检测到声音，请靠近麦克风清楚地读一遍')
  }

  const frameSize = Math.round(TARGET_RATE * 0.02)
  let voicedFrames = 0
  let totalFrames = 0
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(start + frameSize, samples.length)
    let sum = 0
    for (let i = start; i < end; i += 1) {
      const sample = samples[i] / 0x8000
      sum += sample * sample
    }
    const frameRms = Math.sqrt(sum / (end - start))
    if (frameRms >= VOICED_FRAME_RMS) voicedFrames += 1
    totalFrames += 1
  }
  if (voicedFrames < 5 || voicedFrames / totalFrames < 0.025) {
    throw new Error('有效声音太少，请对着麦克风完整、清楚地读一遍')
  }
}

async function fingerprint(pcm: ArrayBuffer): Promise<string> {
  if (!crypto.subtle) throw new Error('当前环境不支持音频安全校验，请更新应用后重试')
  const digest = await crypto.subtle.digest('SHA-256', pcm)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function prepareRecording(recording: Blob): Promise<PreparedSpeech> {
  const pcm = await toPcm16k(recording)
  inspectSpeech(pcm)
  return { pcm, audioHash: await fingerprint(pcm) }
}

interface SoeMessage {
  code: number
  message?: string
  final?: number
  result?: unknown
}

/** 推流评测：一句话/一个词只发一段音频（服务端参数已设 rec_mode=1） */
export function evaluatePreparedSpeech(
  text: string,
  prepared: PreparedSpeech,
  mode: 'word' | 'sentence',
  attempt: Omit<SpeechAttempt, 'audioHash'>,
): Promise<SpeechScore> {
  return new Promise<SpeechScore>((resolve, reject) => {
    void getSpeechToken(text, mode, { ...attempt, audioHash: prepared.audioHash }).then(
      ({ url }) => {
        const ws = new WebSocket(url)
        ws.binaryType = 'arraybuffer'
        let latest: unknown = null
        let settled = false

        const timer = window.setTimeout(() => {
          finish(() => reject(new Error('评测超时，请重试')))
        }, 15000)

        function finish(fn: () => void) {
          if (settled) return
          settled = true
          window.clearTimeout(timer)
          try {
            ws.close()
          } catch {
            // 已关闭，忽略
          }
          fn()
        }

        ws.onopen = () => {
          ws.send(prepared.pcm)
          ws.send(JSON.stringify({ type: 'end' }))
        }
        ws.onmessage = (ev) => {
          const msg = JSON.parse(String(ev.data)) as SoeMessage
          if (msg.code !== 0) {
            finish(() => reject(new Error(soeErrorText(msg.code, msg.message))))
            return
          }
          if (msg.result) latest = msg.result
          if (msg.final === 1) {
            if (!latest) {
              finish(() => reject(new Error('没有识别到有效发音，再读一次吧')))
              return
            }
            finish(() => {
              try {
                resolve(normalizeScore(latest))
              } catch (e) {
                reject(e as Error)
              }
            })
          }
        }
        ws.onerror = () => finish(() => reject(new Error('连接评测服务失败')))
        ws.onclose = () => {
          if (!latest) {
            finish(() => reject(new Error('连接已断开，请重试')))
            return
          }
          finish(() => {
            try {
              resolve(normalizeScore(latest))
            } catch (e) {
              reject(e as Error)
            }
          })
        }
      },
      (err: unknown) => reject(err instanceof Error ? err : new Error('获取评测授权失败')),
    )
  })
}

function normalizeScore(raw: unknown): SpeechScore {
  let r: Record<string, unknown>
  if (typeof raw === 'string') {
    r = JSON.parse(raw) as Record<string, unknown>
  } else if (raw && typeof raw === 'object') {
    r = raw as Record<string, unknown>
  } else {
    throw new Error('评测结果为空')
  }

  const num = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback)
  const words = Array.isArray(r.Words) ? (r.Words as unknown[]) : []

  return {
    total: round1(num(r.SuggestedScore)),
    accuracy: round1(num(r.PronAccuracy)),
    // 流利度/完整度返回 0-1，统一折算成百分制方便展示
    fluency: round1(num(r.PronFluency) * 100),
    completion: round1(num(r.PronCompletion) * 100),
    words: words.map((w) => {
      const item = w as Record<string, unknown>
      const phones = Array.isArray(item.PhoneInfos) ? (item.PhoneInfos as unknown[]) : []
      return {
        word: String(item.Word ?? ''),
        accuracy: round1(num(item.PronAccuracy, -1)),
        matchTag: num(item.MatchTag),
        phonemes: phones.map((p) => {
          const ph = p as Record<string, unknown>
          return {
            reference: String(ph.ReferencePhone ?? ''),
            phone: String(ph.Phone ?? ''),
            accuracy: round1(num(ph.PronAccuracy, -1)),
          }
        }),
      }
    }),
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/** 常见错误码换成对用户友好一点的提示 */
function soeErrorText(code: number, message?: string): string {
  switch (code) {
    case 4004:
      return '评测次数已用完，请到腾讯云控制台续购'
    case 4006:
      return '当前评测并发超限，稍后再试'
    case 4105:
    case 4108:
      return '没有听到声音，靠近麦克风再读一次'
    case 4104:
      return '文本太长了，换个短一点的'
    case 4002:
      return '评测鉴权失败，请检查服务端密钥配置'
    default:
      return message ? `评测失败：${message}` : '评测失败，请重试'
  }
}
