import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'

// 번들러가 node:sqlite 를 해석하지 못하는 문제를 피하려고 런타임에 불러온다
const sqlite = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')

export type DB = DatabaseSync

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS publishers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  fax TEXT NOT NULL DEFAULT '',
  biz_no TEXT,
  book_seq INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bookstores (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  publisher_id INTEGER NOT NULL REFERENCES publishers(id),
  code TEXT NOT NULL UNIQUE,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  list_price INTEGER NOT NULL,
  UNIQUE (publisher_id, seq)
);
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  book_id INTEGER NOT NULL REFERENCES books(id),
  qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  publisher_id INTEGER NOT NULL REFERENCES publishers(id),
  bookstore_id INTEGER NOT NULL REFERENCES bookstores(id),
  UNIQUE (date, publisher_id, bookstore_id)
);
CREATE TABLE IF NOT EXISTS shipment_items (
  id INTEGER PRIMARY KEY,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id),
  list_price INTEGER NOT NULL,
  rate REAL NOT NULL,
  unit_price INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT '위탁' CHECK (kind IN ('위탁', '탁송')),
  qty INTEGER NOT NULL,
  printed_at TEXT
);
CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  publisher_id INTEGER NOT NULL REFERENCES publishers(id),
  bookstore_id INTEGER NOT NULL REFERENCES bookstores(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  qty INTEGER NOT NULL
);
`

export function openDb(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new sqlite.DatabaseSync(file)
  db.exec(SCHEMA)
  // 새 DB(version 0)면 현재 스키마 버전으로 표시해둔다 — 이후 마이그레이션이 필요해지면 이 값으로 분기한다
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  if (version === 0) db.exec('PRAGMA user_version = 1')
  return db
}

// dev 서버 HMR 때 연결이 여러 개 생기지 않도록 전역에 보관
const g = globalThis as unknown as { __bookOmsDb?: DB }

export function getDb(): DB {
  g.__bookOmsDb ??= openDb(path.resolve(process.env.BOOK_OMS_DB ?? 'data/book-oms.db'))
  return g.__bookOmsDb
}

// node:sqlite 행은 null-prototype 객체라 React 직렬화가 거부한다 → 평범한 객체로 복사
export function all<T>(db: DB, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params).map((r) => ({ ...r }) as unknown as T)
}

export function get<T>(db: DB, sql: string, ...params: SQLInputValue[]): T | undefined {
  const r = db.prepare(sql).get(...params)
  return r ? ({ ...r } as unknown as T) : undefined
}

export function run(db: DB, sql: string, ...params: SQLInputValue[]): number {
  return Number(db.prepare(sql).run(...params).lastInsertRowid)
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
