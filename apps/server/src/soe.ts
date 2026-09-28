import { createHmac, randomInt, randomUUID } from 'node:crypto'

/**
 * 腾讯云智聆口语评测（新版）WSS 签名工具。
 * 文档：https://cloud.tencent.com/document/product/1774/107497
 *
 * SecretKey 只留在服务端，前端拿到的是「已签名的连接地址 + 短有效期」，
 * 建立连接后直接推流音频，不用再回服务端。
 */

const SOE_HOST = 'soe.cloud.tencent.com'
const SOE_PATH = '/soe/api'

export type SoeEvalMode = 'word' | 'sentence'

export interface SoeCredentials {
  appId: string
  secretId: string
  secretKey: string
}

/** 从环境变量读密钥；未配置返回 null，接口据此给出明确提示 */
export function readSoeCredentials(): SoeCredentials | null {
  const appId = process.env.SOE_APP_ID
  const secretId = process.env.SOE_SECRET_ID
  const secretKey = process.env.SOE_SECRET_KEY
  if (!appId || !secretId || !secretKey) return null
  return { appId, secretId, secretKey }
}

/**
 * 苛刻度：[1.0, 4.0]，越大打分越严。
 * 1.0 对应最小年龄段（儿童应用），4.0 对应成人严格打分，默认给了偏宽松的 1.5。
 */
function scoreCoeff(): number {
  const raw = Number(process.env.SOE_SCORE_COEFF)
  if (!Number.isFinite(raw) || raw < 1 || raw > 4) return 1.5
  return raw
}

export interface SignedSoeUrl {
  url: string
  voiceId: string
}

/**
 * 生成带签名的评测连接地址：
 * 1. 除 signature 外的参数按 key 字典序拼成 `host/path/appid?k=v&...`（值不做 urlencode）
 * 2. signature = Base64(HmacSha1(secretKey, 上面的原文))
 * 3. signature 需 urlencode 后拼到末尾
 */
export function signSoeUrl(
  cred: SoeCredentials,
  opts: { text: string; mode: SoeEvalMode },
): SignedSoeUrl {
  const voiceId = randomUUID()
  const timestamp = Math.floor(Date.now() / 1000)
  const params: Record<string, string> = {
    secretid: cred.secretId,
    timestamp: String(timestamp),
    // 签名有效期：连接是在签名后立刻发起的，给 5 分钟足够，避免地址被长时间复用
    expired: String(timestamp + 300),
    nonce: String(randomInt(100_000_000, 1_000_000_000)),
    server_engine_type: '16k_en',
    voice_id: voiceId,
    voice_format: '0', // 0=pcm（前端推 16k/16bit/单声道 裸 PCM）
    eval_mode: opts.mode === 'word' ? '0' : '1',
    score_coeff: String(scoreCoeff()),
    text_mode: '0',
    ref_text: opts.text,
    // 录音模式：一次性发送整段音频（≤60s），不用按 1:1 实时率推流
    rec_mode: '1',
    sentence_info_enabled: '0',
  }

  const keys = Object.keys(params).sort()
  const rawQuery = keys.map((k) => `${k}=${params[k]}`).join('&')
  const signature = createHmac('sha1', cred.secretKey)
    .update(`${SOE_HOST}${SOE_PATH}/${cred.appId}?${rawQuery}`)
    .digest('base64')
  const query = keys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&')

  return {
    url: `wss://${SOE_HOST}${SOE_PATH}/${cred.appId}?${query}&signature=${encodeURIComponent(signature)}`,
    voiceId,
  }
}
