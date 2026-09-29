import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { createBackup } from '@/lib/backup'

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
  version INTEGER NOT NULL DEFAULT 0,
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
  let fresh: boolean
  try {
    // 테이블이 하나도 없으면 새 파일 — 마이그레이션 전 안전 백업이 필요 없다
    fresh = !db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table'").get()
    db.exec(SCHEMA)
  } catch (e) {
    db.close() // SQLite 파일이 아니면 파일을 잡은 채로 두지 않는다 (Windows 파일 잠금)
    throw e
  }
  migrate(db, file, fresh)
  return db
}

/** 현재 스키마 버전 (PRAGMA user_version) */
const SCHEMA_VERSION = 3

// v3: 화면 설정 (목록 표 열 순서 등). 기존 파일에 새로 만드는 테이블이라 SCHEMA 가 아니라 마이그레이션에서 만든다.
const UI_PREFS = 'CREATE TABLE IF NOT EXISTS ui_prefs (key TEXT PRIMARY KEY, value TEXT NOT NULL)'

/**
 * 스키마 버전을 올린다. 여러 번 불러도 안전하다(이미 최신이면 아무것도 하지 않음).
 * v2: shipments.version (출고 명세 동시 수정 차단), v3: ui_prefs 테이블.
 * 바꿀 것이 있는 기존 DB 파일이면 먼저 안전 백업(-before-migrate-v3)을 한 번 만든다.
 */
export function migrate(db: DB, file: string, fresh = false) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  if (version >= SCHEMA_VERSION) return
  const cols = db.prepare('PRAGMA table_info(shipments)').all() as { name: string }[]
  const needVersionCol = !cols.some((c) => c.name === 'version')
  const needPrefs = !db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ui_prefs'").get()
  if ((needVersionCol || needPrefs) && !fresh && file !== ':memory:') createBackup(db, file, new Date(), `-before-migrate-v${SCHEMA_VERSION}`)
  tx(db, () => {
    if (needVersionCol) db.exec('ALTER TABLE shipments ADD COLUMN version INTEGER NOT NULL DEFAULT 0')
    if (needPrefs) db.exec(UI_PREFS)
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  })
}

// dev 서버 HMR 때 연결이 여러 개 생기지 않도록 전역에 보관
const g = globalThis as unknown as { __bookOmsDb?: DB }

/** 앱이 쓰는 DB 파일의 절대 경로 */
export const dbPath = () => path.resolve(process.env.BOOK_OMS_DB ?? 'data/book-oms.db')

// dev 서버 HMR 뒤에는 캐시된(예전 코드로 연) 연결을 그대로 쓰므로, 모듈이 새로 올라올 때마다 한 번 마이그레이션을 확인한다
let migrated = false

export function getDb(): DB {
  if (!g.__bookOmsDb) {
    g.__bookOmsDb = openDb(dbPath())
    migrated = true
  } else if (!migrated) {
    migrate(g.__bookOmsDb, dbPath())
    migrated = true
  }
  return g.__bookOmsDb
}

/** 캐시된 연결을 닫는다 (복원으로 파일을 바꾸기 전). 다음 getDb() 가 새로 연다. */
export function closeDb() {
  g.__bookOmsDb?.close()
  g.__bookOmsDb = undefined
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
