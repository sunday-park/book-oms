import { describe, expect, it } from 'vitest'
import { createReceipt, createReturn, saveShipment } from '@/lib/repo/inventory'
import { listDispatch, listShipmentStatus, listStock } from '@/lib/repo/reports'
import { seed } from './helpers'

const D = '2026-09-28'
const ship = (db: ReturnType<typeof seed>['db'], date: string, publisher_id: number, bookstore_id: number, lines: [number, number][]) =>
  saveShipment(db, { date, publisher_id, bookstore_id, items: lines.map(([book_id, qty]) => ({ book_id, qty, rate: 60, kind: '위탁' as const })) })

describe('재고', () => {
  it('입고(여러 날) − 출고 + 반품', () => {
    const { db, p1, s1, b1, b2 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 60 })
    createReceipt(db, { date: '2026-09-29', book_id: b1, qty: 40 })
    ship(db, D, p1, s1, [[b1, 30]])
    createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 5 })
    expect(listStock(db, p1)).toEqual([
      { book_id: b1, code: 'P01-0001', name: '리액트 입문', received: 100, shipped: 30, returned: 5, stock: 75 },
      { book_id: b2, code: 'P01-0002', name: '타입스크립트', received: 0, shipped: 0, returned: 0, stock: 0 },
    ])
  })
})

describe('출고 현황', () => {
  it('날짜로 거르고 도서코드 → 도서명 → 날짜 순으로 정렬', () => {
    const { db, p1, s1, s2, b1, b2 } = seed()
    ship(db, D, p1, s1, [[b2, 3], [b1, 5]])
    ship(db, D, p1, s2, [[b1, 2]])
    ship(db, '2026-09-27', p1, s1, [[b1, 9]])
    expect(listShipmentStatus(db, { date: D }).map((r) => [r.book_code, r.bookstore_name, r.qty])).toEqual([
      ['P01-0001', '교보문고 광화문', 5],
      ['P01-0001', '영풍문고 부산', 2],
      ['P01-0002', '교보문고 광화문', 3],
    ])
    expect(listShipmentStatus(db, { date: D, bookstoreId: s2 })).toHaveLength(1)
  })
})

describe('출고증', () => {
  it('선택한 날짜·출판사만 서점별로 묶고 소계를 낸다', () => {
    const { db, p1, p2, s1, s2, b1, b2, b3 } = seed()
    ship(db, D, p1, s1, [[b1, 5], [b2, 3]])
    ship(db, D, p1, s2, [[b1, 2]])
    ship(db, D, p2, s1, [[b3, 7]])
    expect(listDispatch(db, D, p1).map((g) => [g.bookstore_name, g.total, g.items.length])).toEqual([
      ['교보문고 광화문', 8, 2],
      ['영풍문고 부산', 2, 1],
    ])
  })
})
