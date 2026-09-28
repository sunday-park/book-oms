import { describe, expect, it } from 'vitest'
import { all, openDb } from '@/lib/db'

describe('openDb', () => {
  it('스키마 테이블을 모두 만든다', () => {
    const db = openDb(':memory:')
    const names = all<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map((r) => r.name)
    expect(names).toEqual(['books', 'bookstores', 'publishers', 'receipts', 'returns', 'shipment_items', 'shipments'])
  })

  it('외래키 제약이 켜져 있다', () => {
    const db = openDb(':memory:')
    expect(() => db.exec("INSERT INTO books (publisher_id, code, seq, name, list_price) VALUES (999, 'X', 1, 'x', 0)")).toThrow()
  })
})
