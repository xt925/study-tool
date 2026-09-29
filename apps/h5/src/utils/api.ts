import { ref } from 'vue'

import { useProgressStore } from '@/stores/progress'

// dev 时 base 为 '/'，构建后为 '/english-study/'；API 始终挂在 base 下的 api/
const API_BASE = import.meta.env.BASE_URL + 'api'
const AUTH_KEY = 'english-h5-auth'

export interface Auth {
  token: string
  role: string
  username: string
}

export interface AdminSummaryItem {
  username: string
  stars: number
  level: number
  learnedCount: number
  completedUnitCount: number
  lastActive: string | null
}

export function getAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as Auth) : null
  } catch {
    return null
  }
}

export function isLoggedIn(): boolean {
  return getAuth() !== null
}

function setAuth(auth: Auth | null): void {
  if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
  else localStorage.removeItem(AUTH_KEY)
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.auth) {
    const auth = getAuth()
    if (!auth) throw new Error('未登录')
    headers['Authorization'] = `Bearer ${auth.token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (res.status === 401) {
    // token 失效，清掉登录态
    if (options.auth) setAuth(null)
    throw new Error('登录已过期')
  }
  if (!res.ok) {
    // 服务端会带 { error } 说明原因（如未配置密钥），优先展示它
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? `请求失败：${res.status}`)
  }
  return (await res.json()) as T
}

export async function login(username: string, password: string): Promise<Auth> {
  const res = await request<{ token: string; role: string }>('/login', {
    method: 'POST',
    body: { username, password },
  }).catch((err: unknown) => {
    // request 对 401 统一抛「登录已过期」，登录场景下 401 意味着凭证错误
    if (err instanceof Error && err.message === '登录已过期')
      throw new Error('账号或密码错误')
    throw err
  })
  const auth: Auth = { token: res.token, role: res.role, username }
  setAuth(auth)
  return auth
}

export function logout(): void {
  setAuth(null)
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  // 旧密码错误时服务端返回 400 + { error }，request 会把它抛出来，这里不用再改写
  await request('/change-password', {
    method: 'POST',
    body: { oldPassword, newPassword },
    auth: true,
  })
}

type ProgressSnapshot = ReturnType<
  ReturnType<typeof useProgressStore>['exportProgress']
>

export async function postProgress(
  progress: ProgressSnapshot,
): Promise<ProgressSnapshot> {
  const res = await request<{ progress: ProgressSnapshot }>('/progress', {
    method: 'POST',
    body: { progress },
    auth: true,
  })
  return res.progress
}

export async function getAdminSummary(): Promise<AdminSummaryItem[]> {
  const res = await request<{ users: AdminSummaryItem[] }>('/admin/summary', {
    auth: true,
  })
  return res.users
}

export interface SpeechToken {
  url: string
  voiceId: string
}

/** 取腾讯口语评测的已签名连接地址（密钥留在服务端） */
export async function getSpeechToken(
  text: string,
  mode: 'word' | 'sentence',
): Promise<SpeechToken> {
  return request<SpeechToken>('/speech/token', {
    method: 'POST',
    body: { text, mode },
    auth: true,
  })
}

/** 同步状态：给首页小按钮展示用 */
export const syncState = ref<'idle' | 'syncing' | 'ok'>('idle')

/** 已登录则上传本地进度并用服务器合并结果落地；断网/失败静默处理 */
export async function syncNow(): Promise<boolean> {
  if (!isLoggedIn()) return false
  const progress = useProgressStore()
  syncState.value = 'syncing'
  try {
    const merged = await postProgress(progress.exportProgress())
    progress.importProgress(merged)
    syncState.value = 'ok'
    return true
  } catch {
    // 静默失败：断网不打扰用户
    syncState.value = 'idle'
    return false
  }
}
