import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type DB, openDb } from '@/lib/db'
import { createReceipt } from '@/lib/repo/inventory'
import { createBook, saveBookstore, savePublisher } from '@/lib/repo/master'
import {
  backupDir,
  backupFileName,
  countRecords,
  createBackup,
  getDbInfo,
  listBackups,
  resolveBackup,
  restoreBackup,
} from '@/lib/repo/settings'

let tmp: string
let dbPath: string
let db: DB | undefined

// 앱의 getDb/closeDb 흉내: 한 파일에 연결 하나를 두고 닫았다 다시 연다
const conn = {
  close: () => {
    db?.close()
    db = undefined
  },
  reopen: () => (db ??= openDb(dbPath)),
}

function seedFile() {
  const d = conn.reopen()
  const p = savePublisher(d, { code: 'P01', name: '한빛출판', phone: '', fax: '', biz_no: null })
  saveBookstore(d, { code: 'S01', name: '교보문고', region: '서울특별시' })
  const b = createBook(d, { publisher_id: p, name: '리액트 입문', list_price: 20000 })
  createReceipt(d, { date: '2026-09-01', book_id: b, qty: 10 })
  return { d, p, b }
}

beforeEach(() => {
  // 작은따옴표가 든 경로에서도 VACUUM INTO 가 동작하는지 함께 확인
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "book-oms-o'test-"))
  dbPath = path.join(tmp, 'data', 'book-oms.db')
})
afterEach(() => {
  conn.close()
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('백업 파일 이름', () => {
  it('book-oms-YYYYMMDD-HHmmss.db 형식이다', () => {
    expect(backupFileName(new Date(2026, 8, 5, 7, 3, 9))).toBe('book-oms-20260905-070309.db')
    expect(backupFileName(new Date(2026, 8, 5, 7, 3, 9), '-before-restore')).toBe('book-oms-20260905-070309-before-restore.db')
  })
  it('백업 폴더는 DB 파일 옆 backups 이다', () => {
    expect(backupDir(dbPath)).toBe(path.join(tmp, 'data', 'backups'))
  })
})

describe('레코드 수', () => {
  it('테이블별 건수를 센다', () => {
    const { d } = seedFile()
    expect(countRecords(d)).toEqual({ publishers: 1, bookstores: 1, books: 1, receipts: 1, shipments: 0, shipment_items: 0, returns: 0 })
  })
  it('DB 정보에 경로·크기·수정 시각을 담는다', () => {
    const { d } = seedFile()
    const info = getDbInfo(d, dbPath)
    expect(info.path).toBe(dbPath)
    expect(info.size).toBeGreaterThan(0)
    expect(info.mtime).toBeGreaterThan(0)
    expect(info.counts.books).toBe(1)
  })
})

describe('백업', () => {
  it('VACUUM INTO 로 같은 내용의 사본을 만든다 (폴더가 없으면 만든다)', () => {
    const { d } = seedFile()
    const name = createBackup(d, dbPath, new Date(2026, 8, 29, 10, 0, 0))
    expect(name).toBe('book-oms-20260929-100000.db')
    const copy = openDb(path.join(backupDir(dbPath), name))
    expect(countRecords(copy)).toEqual(countRecords(d))
    copy.close()
  })
  it('같은 초에 두 번 백업해도 덮어쓰지 않는다', () => {
    const { d } = seedFile()
    const now = new Date(2026, 8, 29, 10, 0, 0)
    const a = createBackup(d, dbPath, now)
    const b = createBackup(d, dbPath, now)
    expect(a).not.toBe(b)
    expect(listBackups(dbPath)).toHaveLength(2)
  })
  it('목록은 최신순이고 백업 이름 형식이 아닌 파일은 뺀다', () => {
    const { d } = seedFile()
    const old = createBackup(d, dbPath, new Date(2026, 8, 1, 9, 0, 0))
    const recent = createBackup(d, dbPath, new Date(2026, 8, 2, 9, 0, 0))
    fs.utimesSync(path.join(backupDir(dbPath), old), new Date(2026, 8, 1), new Date(2026, 8, 1))
    fs.utimesSync(path.join(backupDir(dbPath), recent), new Date(2026, 8, 2), new Date(2026, 8, 2))
    fs.writeFileSync(path.join(backupDir(dbPath), 'memo.txt'), 'x')
    const list = listBackups(dbPath)
    expect(list.map((b) => b.name)).toEqual([recent, old])
    expect(list[0].size).toBeGreaterThan(0)
  })
  it('백업 폴더가 없으면 빈 목록', () => {
    expect(listBackups(dbPath)).toEqual([])
  })
})

describe('백업 파일 확인 (경로 조작 차단)', () => {
  it('형식에 맞지 않거나 폴더 밖을 가리키면 거절한다', () => {
    seedFile()
    for (const bad of ['../book-oms.db', '..\\book-oms.db', 'book-oms.db', '/etc/passwd', 'book-oms-20260929-100000.db/../../x.db', 'C:\\book-oms-20260929-100000.db', '']) {
      expect(() => resolveBackup(dbPath, bad)).toThrow('올바른 백업 파일')
    }
  })
  it('없는 백업은 거절한다', () => {
    expect(() => resolveBackup(dbPath, 'book-oms-20260929-100000.db')).toThrow('찾을 수 없습니다')
  })
  it('폴더 안의 백업은 절대 경로를 돌려준다', () => {
    const { d } = seedFile()
    const name = createBackup(d, dbPath)
    expect(resolveBackup(dbPath, name)).toBe(path.join(backupDir(dbPath), name))
  })
})

describe('복원', () => {
  it('안전 백업을 만든 뒤 백업 내용으로 바꾼다', () => {
    const { d, b } = seedFile()
    const name = createBackup(d, dbPath, new Date(2026, 8, 29, 10, 0, 0))
    createReceipt(d, { date: '2026-09-02', book_id: b, qty: 5 }) // 백업 뒤 추가된 데이터
    fs.writeFileSync(`${dbPath}-wal`, 'stale')
    const r = restoreBackup(db!, dbPath, name, conn, new Date(2026, 8, 29, 11, 0, 0))
    expect(r.safety).toBe('book-oms-20260929-110000-before-restore.db')
    expect(countRecords(db!).receipts).toBe(1)
    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false)
    // 안전 백업에는 복원 직전 데이터(입고 2건)가 남아 있다
    const safety = openDb(path.join(backupDir(dbPath), r.safety))
    expect(countRecords(safety).receipts).toBe(2)
    safety.close()
  })
  it('손상된 백업이면 원래 데이터로 되돌리고 오류를 알린다', () => {
    seedFile()
    const bad = 'book-oms-20260101-000000.db'
    fs.mkdirSync(backupDir(dbPath), { recursive: true })
    fs.writeFileSync(path.join(backupDir(dbPath), bad), 'this is not a sqlite database'.repeat(200))
    expect(() => restoreBackup(db!, dbPath, bad, conn)).toThrow('복원하지 못했습니다')
    expect(countRecords(conn.reopen())).toMatchObject({ publishers: 1, books: 1, receipts: 1 })
  })
  it('경로 조작 이름은 아무것도 바꾸지 않고 거절한다', () => {
    const { d } = seedFile()
    expect(() => restoreBackup(d, dbPath, '../book-oms.db', conn)).toThrow('올바른 백업 파일')
    expect(listBackups(dbPath)).toEqual([])
    expect(countRecords(d).books).toBe(1)
  })
})
