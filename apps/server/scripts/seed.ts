/**
 * 种子脚本：创建/更新账号。
 * 用法：
 *   npm run seed --workspace apps/server -- --user waisheng --pass xxx --role user
 * 也可用环境变量：SEED_USER / SEED_PASS / SEED_ROLE
 * 重复执行同用户名会更新密码（和角色），幂等。
 * 另外保证存在一个 admin 账号：密码取 ADMIN_PASS，未设置则随机生成并打印一次。
 */
import { hashPassword, genSalt } from '../src/auth.js'
import { db, now } from '../src/db.js'
import type { UserRow } from '../src/db.js'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function upsertUser(username: string, password: string, role: string): void {
  const salt = genSalt()
  const hash = hashPassword(password, salt)
  db.prepare(
    `INSERT INTO users (username, pass_hash, salt, role, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET pass_hash = excluded.pass_hash, salt = excluded.salt, role = excluded.role`,
  ).run(username, hash, salt, role, now())
  console.log(`✔ 用户 ${username}（${role}）已创建/更新密码`)
}

const user = arg('user') ?? process.env.SEED_USER
const pass = arg('pass') ?? process.env.SEED_PASS
const role = arg('role') ?? process.env.SEED_ROLE ?? 'user'

if (user && pass) {
  upsertUser(user, pass, role)
} else if (user || pass) {
  console.error('错误：--user 和 --pass 必须同时提供')
  process.exit(1)
}

// 幂等默认 admin：已存在则不动
const admin = db
  .prepare<[string], UserRow>('SELECT * FROM users WHERE username = ?')
  .get('admin')
if (!admin) {
  const pass =
    process.env.ADMIN_PASS ??
    Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('-')
  upsertUser('admin', pass, 'admin')
  if (!process.env.ADMIN_PASS) {
    console.log(`⚠ 未设置 ADMIN_PASS，已生成随机 admin 密码（只显示这一次）：${pass}`)
  }
} else {
  console.log('admin 账号已存在，跳过')
}
