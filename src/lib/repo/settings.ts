import fs from 'node:fs'
import path from 'node:path'
import { type DB, get } from '@/lib/db'
import { AppError } from '@/lib/result'

/** 백업 파일 이름: book-oms-YYYYMMDD-HHmmss[-N][-before-restore].db */
const BACKUP_NAME_RE = /^book-oms-\d{8}-\d{6}(?:-\d+)?(?:-before-restore)?\.db$/

export type Counts = {
  publishers: number
  bookstores: number
  books: number
  receipts: number
  shipments: number
  shipment_items: number
  returns: number
}
export type DbInfo = { path: string; size: number; mtime: number; counts: Counts }
export type BackupFile = { name: string; size: number; mtime: number }

export const backupDir = (dbPath: string) => path.join(path.dirname(dbPath), 'backups')

const pad = (n: number) => String(n).padStart(2, '0')
export function backupFileName(d: Date, suffix = '') {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `book-oms-${date}-${time}${suffix}.db`
}

const TABLES = ['publishers', 'bookstores', 'books', 'receipts', 'shipments', 'shipment_items', 'returns'] as const

export function countRecords(db: DB): Counts {
  const sql = `SELECT ${TABLES.map((t) => `(SELECT COUNT(*) FROM ${t}) AS ${t}`).join(', ')}`
  return get<Counts>(db, sql)!
}

export function getDbInfo(db: DB, dbPath: string): DbInfo {
  const st = fs.statSync(dbPath)
  return { path: dbPath, size: st.size, mtime: st.mtimeMs, counts: countRecords(db) }
}

/** 연결을 연 채로 VACUUM INTO 로 일관된 사본을 만든다. 만든 파일 이름을 돌려준다. */
export function createBackup(db: DB, dbPath: string, now = new Date(), suffix = '') {
  const dir = backupDir(dbPath)
  fs.mkdirSync(dir, { recursive: true })
  let name = backupFileName(now, suffix)
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = backupFileName(now, `-${n}${suffix}`)
  db.exec(`VACUUM INTO '${path.join(dir, name).replaceAll("'", "''")}'`)
  return name
}

/** 백업 목록 (최신순) */
export function listBackups(dbPath: string): BackupFile[] {
  const dir = backupDir(dbPath)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => BACKUP_NAME_RE.test(name))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name))
      return { name, size: st.size, mtime: st.mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name))
}

/** 백업 이름을 검사해 백업 폴더 안의 절대 경로로 바꾼다 (경로 조작 차단) */
export function resolveBackup(dbPath: string, name: string) {
  const dir = path.resolve(backupDir(dbPath))
  const file = path.resolve(dir, name)
  if (!BACKUP_NAME_RE.test(name) || path.dirname(file) !== dir) throw new AppError('올바른 백업 파일이 아닙니다.')
  if (!fs.existsSync(file)) throw new AppError('백업 파일을 찾을 수 없습니다.')
  return file
}

/**
 * 백업으로 DB 파일을 바꾼다.
 * 1) 현재 DB 를 -before-restore 로 안전 백업 2) 연결 닫기 3) 파일 교체(-wal/-shm 제거)
 * 4) 다시 열어 무결성 검사 — 실패하면 안전 백업으로 되돌리고 오류.
 */
export function restoreBackup(db: DB, dbPath: string, name: string, conn: { close: () => void; reopen: () => DB }, now = new Date()) {
  const src = resolveBackup(dbPath, name)
  const safety = createBackup(db, dbPath, now, '-before-restore')
  const replaceWith = (from: string) => {
    conn.close()
    for (const ext of ['-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true })
    fs.copyFileSync(from, dbPath)
  }
  replaceWith(src)
  try {
    const r = get<{ integrity_check: string }>(conn.reopen(), 'PRAGMA integrity_check')
    if (r?.integrity_check !== 'ok') throw new Error('integrity_check failed')
  } catch {
    replaceWith(path.join(backupDir(dbPath), safety))
    conn.reopen()
    throw new AppError('백업 파일이 손상되어 복원하지 못했습니다. 기존 데이터는 그대로입니다.')
  }
  return { safety }
}
