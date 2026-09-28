import { getSpeechToken } from '@/utils/api'

/**
 * 跟读评测：浏览器录音 → 转成 16k/16bit/单声道 PCM → 直连腾讯云 SOE 推流 → 返回分数。
 * 连接地址由服务端签名下发，SecretKey 不落前端。
 */

/** 腾讯 SOE 要求的采样率 */
const TARGET_RATE = 16000

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
  return toPcm16k(blob)
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

interface SoeMessage {
  code: number
  message?: string
  final?: number
  result?: unknown
}

/** 推流评测：一句话/一个词只发一段音频（服务端参数已设 rec_mode=1） */
export function evaluateSpeech(
  text: string,
  pcm: ArrayBuffer,
  mode: 'word' | 'sentence' = 'word',
): Promise<SpeechScore> {
  return new Promise<SpeechScore>((resolve, reject) => {
    void getSpeechToken(text, mode).then(
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
          ws.send(pcm)
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
