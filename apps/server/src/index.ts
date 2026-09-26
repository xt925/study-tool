import { levelFromStars, mergeProgress } from '@study/core'
import Fastify from 'fastify'

import { genSalt, genToken, hashPassword, verifyPassword } from './auth.js'
import { db, now } from './db.js'
import type { ProgressRow, TokenRow, UserRow } from './db.js'

type ProgressState = Parameters<typeof mergeProgress>[0]

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '127.0.0.1'

const app = Fastify({ logger: true })

/** 兜底 normalize，避免脏数据导致 mergeProgress 崩溃 */
function normalizeProgress(raw: unknown): ProgressState {
  const p = (raw ?? {}) as Partial<ProgressState>
  return {
    version: typeof p.version === 'number' ? p.version : 1,
    deviceId: typeof p.deviceId === 'string' ? p.deviceId : 'server',
    dirty: false,
    stars: typeof p.stars === 'number' ? p.stars : 0,
    learnedWords: Array.isArray(p.learnedWords) ? p.learnedWords : [],
    completedUnits: Array.isArray(p.completedUnits) ? p.completedUnits : [],
    dailyWords: p.dailyWords ?? {},
  }
}

// 认证：Authorization: Bearer <token> → 查 tokens 表
app.decorateRequest('user', null)

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow | null
  }
}

function requireAuth(
  req: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply,
  done: (err?: Error) => void,
) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const row = token
    ? db
        .prepare<
          [string],
          TokenRow & Pick<UserRow, 'username' | 'role'>
        >(
          `SELECT t.token, t.user_id, t.created_at, u.username, u.role
           FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?`,
        )
        .get(token)
    : undefined
  if (!row) {
    reply.code(401).send({ error: 'unauthorized' })
    return
  }
  req.user = {
    id: row.user_id,
    username: row.username,
    role: row.role,
  } as UserRow
  done()
}

app.post('/api/login', (req, reply) => {
  const { username, password } = (req.body ?? {}) as {
    username?: string
    password?: string
  }
  if (!username || !password) {
    return reply.code(400).send({ error: 'username and password required' })
  }
  const user = db
    .prepare<[string], UserRow>('SELECT * FROM users WHERE username = ?')
    .get(username)
  if (!user || !verifyPassword(password, user.salt, user.pass_hash)) {
    return reply.code(401).send({ error: 'invalid credentials' })
  }
  const token = genToken()
  db.prepare('INSERT INTO tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(
    token,
    user.id,
    now(),
  )
  return { token, role: user.role }
})

app.post('/api/change-password', { preHandler: requireAuth }, (req, reply) => {
  const { oldPassword, newPassword } = (req.body ?? {}) as {
    oldPassword?: string
    newPassword?: string
  }
  if (!oldPassword || !newPassword) {
    return reply.code(400).send({ error: 'oldPassword and newPassword required' })
  }
  if (newPassword.length < 4) {
    return reply.code(400).send({ error: '新密码至少 4 位' })
  }
  const user = db
    .prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?')
    .get(req.user!.id)
  if (!user || !verifyPassword(oldPassword, user.salt, user.pass_hash)) {
    return reply.code(401).send({ error: '旧密码不正确' })
  }
  const salt = genSalt()
  db.prepare('UPDATE users SET salt = ?, pass_hash = ? WHERE id = ?').run(
    salt,
    hashPassword(newPassword, salt),
    user.id,
  )
  // 改密码后踢掉其他设备的登录态，当前 token 保留
  const currentToken = (req.headers.authorization ?? '').slice(7)
  db.prepare('DELETE FROM tokens WHERE user_id = ? AND token != ?').run(
    user.id,
    currentToken,
  )
  return { ok: true }
})

app.get('/api/progress', { preHandler: requireAuth }, (req) => {
  const row = db
    .prepare<[number], ProgressRow>('SELECT * FROM progress WHERE user_id = ?')
    .get(req.user!.id)
  return { progress: row ? JSON.parse(row.data) : null }
})

app.post('/api/progress', { preHandler: requireAuth }, (req, reply) => {
  const { progress } = (req.body ?? {}) as { progress?: unknown }
  if (!progress || typeof progress !== 'object') {
    return reply.code(400).send({ error: 'progress required' })
  }
  const uploaded = normalizeProgress(progress)
  const row = db
    .prepare<[number], ProgressRow>('SELECT * FROM progress WHERE user_id = ?')
    .get(req.user!.id)
  // 已有记录则用 core 的 mergeProgress 合并（星星取大/单词并集/每日取大）
  const merged = row
    ? mergeProgress(normalizeProgress(JSON.parse(row.data)), uploaded)
    : uploaded
  db.prepare(
    `INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(req.user!.id, JSON.stringify(merged), now())
  return { progress: merged }
})

app.get('/api/admin/summary', { preHandler: requireAuth }, (req, reply) => {
  if (req.user!.role !== 'admin') {
    return reply.code(403).send({ error: 'admin only' })
  }
  const rows = db
    .prepare<
      [],
      { username: string; data: string | null; updated_at: string | null }
    >(
      `SELECT u.username, p.data, p.updated_at
       FROM users u LEFT JOIN progress p ON p.user_id = u.id
       ORDER BY u.id`,
    )
    .all()
  return {
    users: rows.map((r) => {
      const p = r.data ? normalizeProgress(JSON.parse(r.data)) : null
      return {
        username: r.username,
        stars: p?.stars ?? 0,
        level: levelFromStars(p?.stars ?? 0),
        learnedCount: p?.learnedWords.length ?? 0,
        completedUnitCount: p?.completedUnits.length ?? 0,
        lastActive: r.updated_at,
      }
    }),
  }
})

app.listen({ port: PORT, host: HOST }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
