import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { all, get, migrate, openDb } from '@/lib/db'
import { saveShipment, createReceipt } from '@/lib/repo/inventory'
import { createBook, saveBookstore, savePublisher } from '@/lib/repo/master'
import { countRecords, listBackups } from '@/lib/repo/settings'

describe('openDb', () => {
  it('스키마 테이블을 모두 만든다', () => {
    const db = openDb(':memory:')
    const names = all<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map((r) => r.name)
    expect(names).toEqual(['books', 'bookstores', 'publishers', 'receipts', 'returns', 'shipment_items', 'shipments', 'ui_prefs'])
  })

  it('외래키 제약이 켜져 있다', () => {
    const db = openDb(':memory:')
    expect(() => db.exec("INSERT INTO books (publisher_id, code, seq, name, list_price) VALUES (999, 'X', 1, 'x', 0)")).toThrow()
  })
})

describe('마이그레이션 (v2: shipments.version, v3: ui_prefs)', () => {
  let tmp: string
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

  const userVersion = (db: ReturnType<typeof openDb>) => get<{ user_version: number }>(db, 'PRAGMA user_version')!.user_version
  const hasPrefsTable = (db: ReturnType<typeof openDb>) => all(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ui_prefs'").length === 1
  const hasVersionColumn = (db: ReturnType<typeof openDb>) => all<{ name: string }>(db, 'PRAGMA table_info(shipments)').some((c) => c.name === 'version')

  /** version 열이 없고 user_version 이 1 인(이번 변경 이전) DB 파일을 데이터와 함께 만든다 */
  function makeV1(file: string) {
    const db = openDb(file)
    const p = savePublisher(db, { code: 'P01', name: '한빛출판', phone: '', fax: '', biz_no: null })
    const s = saveBookstore(db, { code: 'S01', name: '교보문고', region: '서울특별시' })
    const b = createBook(db, { publisher_id: p, name: '리액트 입문', list_price: 20000 })
    createReceipt(db, { date: '2026-09-01', book_id: b, qty: 10 })
    saveShipment(db, { date: '2026-09-02', publisher_id: p, bookstore_id: s, items: [{ book_id: b, rate: 60, kind: '위탁', qty: 3 }] })
    db.exec('ALTER TABLE shipments DROP COLUMN version; PRAGMA user_version = 1')
    fs.rmSync(path.join(path.dirname(file), 'backups'), { recursive: true, force: true })
    const counts = countRecords(db)
    db.close()
    return counts
  }

  it('v1 파일을 열면 안전 백업 후 version 열을 더하고 최신 버전(3)으로 올린다 (데이터 유지)', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'book-oms-mig-'))
    const file = path.join(tmp, 'data', 'book-oms.db')
    const before = makeV1(file)

    const db = openDb(file)
    expect(userVersion(db)).toBe(3)
    expect(hasVersionColumn(db)).toBe(true)
    expect(countRecords(db)).toEqual(before)
    expect(get<{ version: number }>(db, 'SELECT version FROM shipments')!.version).toBe(0)

    const backups = listBackups(file)
    expect(backups).toHaveLength(1)
    expect(backups[0].name).toMatch(/^book-oms-\d{8}-\d{6}-before-migrate-v3\.db$/)
    const bak = new (process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')).DatabaseSync(path.join(tmp, 'data', 'backups', backups[0].name))
    expect((bak.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(1)
    expect((bak.prepare('SELECT COUNT(*) AS n FROM shipment_items').get() as { n: number }).n).toBe(1)
    bak.close()
    db.close()

    // 두 번째로 열면 아무것도 하지 않는다
    const again = openDb(file)
    expect(userVersion(again)).toBe(3)
    expect(countRecords(again)).toEqual(before)
    expect(listBackups(file)).toHaveLength(1)
    again.close()
  })

  it('새 DB 는 처음부터 version 열이 있고 백업을 만들지 않는다', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'book-oms-mig-'))
    const file = path.join(tmp, 'data', 'book-oms.db')
    const db = openDb(file)
    expect(userVersion(db)).toBe(3)
    expect(hasVersionColumn(db)).toBe(true)
    expect(hasPrefsTable(db)).toBe(true)
    expect(fs.existsSync(path.join(tmp, 'data', 'backups'))).toBe(false)
    db.close()
  })

  /** ui_prefs 가 없고 user_version 이 2 인(열 순서 저장 이전) DB 파일을 데이터와 함께 만든다 */
  function makeV2(file: string) {
    const db = openDb(file)
    const p = savePublisher(db, { code: 'P01', name: '한빛출판', phone: '', fax: '', biz_no: null })
    const b = createBook(db, { publisher_id: p, name: '리액트 입문', list_price: 20000 })
    createReceipt(db, { date: '2026-09-01', book_id: b, qty: 10 })
    db.exec('DROP TABLE ui_prefs; PRAGMA user_version = 2')
    fs.rmSync(path.join(path.dirname(file), 'backups'), { recursive: true, force: true })
    const counts = countRecords(db)
    db.close()
    return counts
  }

  it('v2 파일을 열면 안전 백업 후 ui_prefs 를 만들고 user_version 3 으로 올린다 (데이터 유지, 두 번째는 그대로)', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'book-oms-mig-'))
    const file = path.join(tmp, 'data', 'book-oms.db')
    const before = makeV2(file)

    const db = openDb(file)
    expect(userVersion(db)).toBe(3)
    expect(hasPrefsTable(db)).toBe(true)
    expect(countRecords(db)).toEqual(before)
    const backups = listBackups(file)
    expect(backups.map((b) => b.name)).toEqual([expect.stringMatching(/^book-oms-\d{8}-\d{6}-before-migrate-v3\.db$/)])
    const bak = new (process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')).DatabaseSync(path.join(tmp, 'data', 'backups', backups[0].name))
    expect((bak.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(2)
    expect(bak.prepare("SELECT name FROM sqlite_master WHERE name = 'ui_prefs'").get()).toBeUndefined()
    expect((bak.prepare('SELECT COUNT(*) AS n FROM receipts').get() as { n: number }).n).toBe(1)
    bak.close()
    migrate(db, file) // 이미 최신 → 아무것도 하지 않음
    db.close()

    const again = openDb(file)
    expect(userVersion(again)).toBe(3)
    expect(countRecords(again)).toEqual(before)
    expect(listBackups(file)).toHaveLength(1)
    again.close()
  })

  it('이미 열린 v2 연결(dev 서버 HMR)에 migrate 를 불러도 안전 백업 후 v3 으로 올린다', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'book-oms-mig-'))
    const file = path.join(tmp, 'data', 'book-oms.db')
    const before = makeV2(file)
    const raw = new (process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')).DatabaseSync(file)
    migrate(raw, file)
    migrate(raw, file)
    expect(userVersion(raw)).toBe(3)
    expect(hasPrefsTable(raw)).toBe(true)
    expect(countRecords(raw)).toEqual(before)
    expect(listBackups(file)).toHaveLength(1)
    raw.close()
  })
})
