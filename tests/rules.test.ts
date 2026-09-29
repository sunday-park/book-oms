import { describe, expect, it } from 'vitest'
import {
  createReceipt, createReturn, deleteReceipt, deleteReturn, deleteShipment, getShipment, listAvailable, saveShipment, type ShipmentItemInput,
} from '@/lib/repo/inventory'
import { getStock } from '@/lib/repo/reports'
import { seed } from './helpers'

// 재고 무결성 규칙: 날짜 기준 재고 · 반품 인과관계 · 출고 명세 동시 수정 차단
const item = (book_id: number, qty = 10): ShipmentItemInput => ({ book_id, rate: 60, kind: '위탁', qty })
type S = ReturnType<typeof seed>
const ship = (s: S, date: string, store: number, items: ShipmentItemInput[], version?: number | null) =>
  saveShipment(s.db, { date, publisher_id: s.p1, bookstore_id: store, items, version })
const ret = (s: S, date: string, store: number, book: number, qty: number) =>
  createReturn(s.db, { date, publisher_id: s.p1, bookstore_id: store, book_id: book, qty })

describe('규칙 1 — 날짜 기준 재고 (아직 들어오지 않은 재고는 출고할 수 없다)', () => {
  it('미래 입고분은 그 전 날짜에 출고할 수 없고, 입고일 이후엔 출고할 수 있다', () => {
    const s = seed()
    createReceipt(s.db, { date: '2026-10-10', book_id: s.b1, qty: 10 })
    expect(() => ship(s, '2026-09-28', s.s1, [item(s.b1, 5)])).toThrow("1행: '리액트 입문' 2026-09-28 기준 출고 가능 0부, 입력 5부")
    expect(getShipment(s.db, '2026-09-28', s.p1, s.s1)).toBeNull()
    ship(s, '2026-10-10', s.s1, [item(s.b1, 5)])
    ship(s, '2026-10-11', s.s1, [item(s.b1, 5)])
    expect(getStock(s.db, s.b1)).toBe(0)
  })
  it('나중 날짜 출고가 이미 쓰는 재고는 앞 날짜의 새 출고에 쓸 수 없다', () => {
    const s = seed()
    createReceipt(s.db, { date: '2026-09-01', book_id: s.b1, qty: 10 })
    ship(s, '2026-09-20', s.s2, [item(s.b1, 8)])
    expect(() => ship(s, '2026-09-10', s.s1, [item(s.b1, 3)])).toThrow("1행: '리액트 입문' 2026-09-10 기준 출고 가능 2부, 입력 3부")
    ship(s, '2026-09-10', s.s1, [item(s.b1, 2)])
    expect(getStock(s.db, s.b1)).toBe(0)
  })
  it('같은 날에는 입고·반품이 출고보다 먼저다', () => {
    const s = seed()
    const D = '2026-09-28'
    createReceipt(s.db, { date: D, book_id: s.b1, qty: 5 })
    ship(s, D, s.s1, [item(s.b1, 5)])
    ret(s, D, s.s1, s.b1, 2)
    ship(s, D, s.s2, [item(s.b1, 2)]) // 같은 날 반품된 2부를 같은 날 다시 출고
    expect(getStock(s.db, s.b1)).toBe(0)
  })
  it('출고 가능 부수는 선택한 날짜 기준이고, 이 명세에 저장된 부수는 빼고 계산한다', () => {
    const s = seed()
    createReceipt(s.db, { date: '2026-09-01', book_id: s.b1, qty: 10 })
    createReceipt(s.db, { date: '2026-10-01', book_id: s.b1, qty: 5 })
    ship(s, '2026-09-10', s.s1, [item(s.b1, 4)])
    const at = (date: string) => new Map(listAvailable(s.db, date, s.p1, s.s1).map((x) => [x.book_id, x.available]))
    expect(at('2026-09-10').get(s.b1)).toBe(10) // 이 명세의 4부는 되돌려진다
    expect(at('2026-09-05').get(s.b1)).toBe(6) // 9/10 출고 4부가 이미 쓰고 있다
    expect(at('2026-10-01').get(s.b1)).toBe(11)
    expect(at('2026-08-01').get(s.b1)).toBe(0)
    expect(at('2026-09-10').get(s.b2)).toBe(0)
  })
  it('입고를 지우면 그 사이 날짜의 재고가 음수가 되는 경우 막는다 (총합이 0 이상이어도)', () => {
    const s = seed()
    const early = createReceipt(s.db, { date: '2026-09-01', book_id: s.b1, qty: 10 })
    createReceipt(s.db, { date: '2026-09-20', book_id: s.b1, qty: 10 })
    ship(s, '2026-09-10', s.s1, [item(s.b1, 8)])
    expect(() => deleteReceipt(s.db, early)).toThrow("입고를 삭제하면 '리액트 입문' 재고가 2026-09-10에 -8부가 되어 삭제할 수 없습니다.")
    expect(getStock(s.db, s.b1)).toBe(12)
  })
  it('반품을 지우면 그 사이 날짜의 재고가 음수가 되는 경우 막는다', () => {
    const s = seed()
    createReceipt(s.db, { date: '2026-09-01', book_id: s.b1, qty: 10 })
    ship(s, '2026-09-02', s.s1, [item(s.b1, 10)])
    const r = ret(s, '2026-09-05', s.s1, s.b1, 4)
    ship(s, '2026-09-06', s.s2, [item(s.b1, 4)])
    createReceipt(s.db, { date: '2026-09-30', book_id: s.b1, qty: 10 })
    expect(() => deleteReturn(s.db, r)).toThrow("반품을 삭제하면 '리액트 입문' 재고가 2026-09-06에 -4부가 되어 삭제할 수 없습니다.")
    expect(getStock(s.db, s.b1)).toBe(10)
  })
})

describe('규칙 2 — 반품은 그 서점 출고 뒤에만 (서점×도서)', () => {
  it('출고일보다 앞선 날짜의 반품은 막는다', () => {
    const s = seed()
    createReceipt(s.db, { date: '2026-09-01', book_id: s.b1, qty: 10 })
    ship(s, '2026-09-10', s.s1, [item(s.b1, 5)])
    expect(() => ret(s, '2026-09-05', s.s1, s.b1, 1)).toThrow("'리액트 입문'은 '교보문고 광화문'에 2026-09-05까지 반품 가능한 부수가 0부입니다.")
    ret(s, '2026-09-10', s.s1, s.b1, 5)
  })
  it('그 날짜까지 출고한 부수만큼만 반품할 수 있다', () => {
    const s = seed()
    createReceipt(s.db, { date: '2026-09-01', book_id: s.b1, qty: 10 })
    ship(s, '2026-09-10', s.s1, [item(s.b1, 5)])
    ship(s, '2026-09-20', s.s1, [item(s.b1, 5)])
    expect(() => ret(s, '2026-09-15', s.s1, s.b1, 6)).toThrow('2026-09-15까지 반품 가능한 부수가 5부입니다.')
    ret(s, '2026-09-20', s.s1, s.b1, 6)
  })
  it('나중 날짜 반품이 이미 쓴 부수는 앞 날짜 반품에 쓸 수 없다', () => {
    const s = seed()
    createReceipt(s.db, { date: '2026-09-01', book_id: s.b1, qty: 10 })
    ship(s, '2026-09-10', s.s1, [item(s.b1, 5)])
    ret(s, '2026-09-20', s.s1, s.b1, 5)
    expect(() => ret(s, '2026-09-15', s.s1, s.b1, 1)).toThrow('반품 가능한 부수가 0부입니다.')
  })
  it('출고를 반품보다 적게 줄이거나 그 도서 행을 빼면 막는다', () => {
    const s = seed()
    const D = '2026-09-28'
    createReceipt(s.db, { date: D, book_id: s.b1, qty: 20 })
    createReceipt(s.db, { date: D, book_id: s.b2, qty: 20 })
    ship(s, D, s.s1, [item(s.b1, 10)])
    ret(s, D, s.s1, s.b1, 4)
    const id = getShipment(s.db, D, s.p1, s.s1)!.items[0].id
    expect(() => ship(s, D, s.s1, [{ ...item(s.b1, 3), id }])).toThrow(
      "'교보문고 광화문'에 반품된 '리액트 입문' 4부보다 출고가 적어져 저장할 수 없습니다.",
    )
    expect(() => ship(s, D, s.s1, [{ ...item(s.b2, 3), id }])).toThrow('출고가 적어져 저장할 수 없습니다.')
    expect(getShipment(s.db, D, s.p1, s.s1)!.items.map((i) => i.qty)).toEqual([10])
    ship(s, D, s.s1, [{ ...item(s.b1, 4), id }])
  })
  it('반품이 남아 있는 출고 명세는 삭제할 수 없다', () => {
    const s = seed()
    const D = '2026-09-28'
    createReceipt(s.db, { date: D, book_id: s.b1, qty: 20 })
    const { id } = ship(s, D, s.s1, [item(s.b1, 10)])
    ret(s, D, s.s1, s.b1, 1)
    expect(() => deleteShipment(s.db, id)).toThrow("'교보문고 광화문'에 반품된 '리액트 입문' 1부보다 출고가 적어져 삭제할 수 없습니다.")
    expect(getShipment(s.db, D, s.p1, s.s1)).not.toBeNull()
  })
})

describe('출고 명세 동시 수정 차단 (버전)', () => {
  const LOCK = '다른 곳에서 이 출고 명세가 먼저 수정되었습니다. [취소]를 눌러 새로 불러온 뒤 다시 입력하세요.'
  const stocked = () => {
    const s = seed()
    createReceipt(s.db, { date: '2026-09-01', book_id: s.b1, qty: 100 })
    createReceipt(s.db, { date: '2026-09-01', book_id: s.b2, qty: 100 })
    return s
  }
  const D = '2026-09-28'
  it('저장할 때마다 버전이 올라간다', () => {
    const s = stocked()
    ship(s, D, s.s1, [item(s.b1)], null)
    expect(getShipment(s.db, D, s.p1, s.s1)!.version).toBe(1)
    const id = getShipment(s.db, D, s.p1, s.s1)!.items[0].id
    ship(s, D, s.s1, [{ ...item(s.b1), id }, item(s.b2)], 1)
    expect(getShipment(s.db, D, s.p1, s.s1)!.version).toBe(2)
  })
  it('불러온 뒤 다른 곳에서 저장됐으면(버전 불일치) 거절하고 그쪽 내용을 지킨다', () => {
    const s = stocked()
    ship(s, D, s.s1, [item(s.b1)], null)
    const id = getShipment(s.db, D, s.p1, s.s1)!.items[0].id
    ship(s, D, s.s1, [{ ...item(s.b1), id }, item(s.b2)], 1) // 탭 A
    expect(() => ship(s, D, s.s1, [{ ...item(s.b1), id }], 1)).toThrow(LOCK) // 탭 B (오래된 화면)
    expect(getShipment(s.db, D, s.p1, s.s1)!.items).toHaveLength(2)
  })
  it('명세가 없다고 알고 저장했는데(null) 이미 생겼으면 거절한다', () => {
    const s = stocked()
    ship(s, D, s.s1, [item(s.b1)], null)
    expect(() => ship(s, D, s.s1, [item(s.b2)], null)).toThrow(LOCK)
    expect(getShipment(s.db, D, s.p1, s.s1)!.items.map((i) => i.book_id)).toEqual([s.b1])
  })
  it('불러온 명세가 다른 곳에서 삭제됐으면 저장을 거절한다', () => {
    const s = stocked()
    const { id } = ship(s, D, s.s1, [item(s.b1)], null)
    deleteShipment(s.db, id, 1)
    expect(() => ship(s, D, s.s1, [item(s.b1)], 1)).toThrow(LOCK)
    expect(getShipment(s.db, D, s.p1, s.s1)).toBeNull()
  })
  it('삭제도 버전이 다르면 거절한다', () => {
    const s = stocked()
    const { id } = ship(s, D, s.s1, [item(s.b1)], null)
    ship(s, D, s.s1, [item(s.b2)], 1)
    expect(() => deleteShipment(s.db, id, 1)).toThrow(LOCK)
    deleteShipment(s.db, id, 2)
    expect(getShipment(s.db, D, s.p1, s.s1)).toBeNull()
  })
})
