import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import Database from 'better-sqlite3'

const dbPath = resolve(process.env.DB_PATH ?? './data/app.db')
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- 去重按「天」为界：同一天内同一次提交或同一段音频只计一次，
-- 但跨天允许重评同一段录音，避免一次瞬时失败就把录音永久作废
CREATE TABLE IF NOT EXISTS speech_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  word_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  audio_hash TEXT NOT NULL,
  quota_day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, quota_day, attempt_id),
  UNIQUE(user_id, quota_day, audio_hash)
);
CREATE INDEX IF NOT EXISTS speech_attempts_daily
  ON speech_attempts(user_id, quota_day, word_id);
`)

export interface UserRow {
  id: number
  username: string
  pass_hash: string
  salt: string
  role: string
  created_at: string
}

export interface TokenRow {
  token: string
  user_id: number
  created_at: string
}

export interface ProgressRow {
  user_id: number
  data: string
  updated_at: string
}

export function now(): string {
  return new Date().toISOString()
}
