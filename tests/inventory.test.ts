import { describe, expect, it } from 'vitest'
import { all } from '@/lib/db'
import {
  createReceipt, createReturn, deleteReceipt, deleteReturn, deleteShipment, getShipment, listReceipts, listReturns, listUnprinted, markPrinted,
  saveShipment,
} from '@/lib/repo/inventory'
import { deleteBook, deleteBookstore, updateBook } from '@/lib/repo/master'
import { getStock } from '@/lib/repo/reports'
import { AppError } from '@/lib/result'
import { seed } from './helpers'

const D = '2026-09-28'
const item = (book_id: number, qty = 10, rate = 60) => ({ book_id, rate, kind: '위탁' as const, qty })
/** 재고가 넉넉한 상태(도서마다 1000부 입고) — 재고 검사와 무관한 출고 테스트용 */
const stocked = () => {
  const s = seed()
  for (const b of [s.b1, s.b2, s.b3]) createReceipt(s.db, { date: D, book_id: b, qty: 1000 })
  return s
}

describe('입고', () => {
  it('기간·출판사로 조회한다', () => {
    const { db, p1, b1, b3 } = seed()
    createReceipt(db, { date: '2026-09-27', book_id: b1, qty: 10 })
    createReceipt(db, { date: D, book_id: b1, qty: 20 })
    createReceipt(db, { date: D, book_id: b3, qty: 30 })
    expect(listReceipts(db, { from: D, to: D }).map((r) => r.qty)).toEqual([20, 30])
    expect(listReceipts(db, { from: '2026-09-01', to: D, publisherId: p1 }).map((r) => r.qty)).toEqual([10, 20])
  })
  it('시작일이 종료일보다 늦으면 입고·반품 조회를 거절한다', () => {
    const { db } = seed()
    expect(() => listReceipts(db, { from: '2026-09-29', to: D })).toThrow('시작일은 종료일보다 늦을 수 없습니다.')
    expect(() => listReturns(db, { from: '2026-09-29', to: D })).toThrow('시작일은 종료일보다 늦을 수 없습니다.')
    expect(listReceipts(db, { from: D, to: D })).toEqual([])
  })
  it('부수가 0 이하면 거절한다', () => {
    const { db, b1 } = seed()
    expect(() => createReceipt(db, { date: D, book_id: b1, qty: 0 })).toThrow(AppError)
  })
  it('입고 이력이 있는 도서는 삭제할 수 없다', () => {
    const { db, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 1 })
    expect(() => deleteBook(db, b1)).toThrow('이력')
  })
})

describe('입고 삭제', () => {
  it('삭제하면 재고가 음수가 되는 입고는 삭제할 수 없다', () => {
    const { db, p1, s1, b1 } = seed()
    const r1 = createReceipt(db, { date: D, book_id: b1, qty: 10 })
    const r2 = createReceipt(db, { date: D, book_id: b1, qty: 5 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 12)] })
    expect(() => deleteReceipt(db, r1)).toThrow("입고를 삭제하면 '리액트 입문' 재고가 2026-09-28에 -7부가 되어 삭제할 수 없습니다.")
    expect(getStock(db, b1)).toBe(3)
    expect(() => deleteReceipt(db, r2)).toThrow('재고가 2026-09-28에 -2부가 되어')
  })
  it('재고가 0 이상으로 남으면 삭제할 수 있다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    const r2 = createReceipt(db, { date: D, book_id: b1, qty: 5 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 10)] })
    deleteReceipt(db, r2)
    expect(getStock(db, b1)).toBe(0)
  })
})

describe('반품 삭제', () => {
  it('삭제하면 재고가 음수가 되는 반품은 삭제할 수 없다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 10)] })
    const ret = createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 3 })
    saveShipment(db, { date: '2026-09-29', publisher_id: p1, bookstore_id: s1, items: [item(b1, 2)] })
    expect(() => deleteReturn(db, ret)).toThrow("반품을 삭제하면 '리액트 입문' 재고가 2026-09-29에 -2부가 되어 삭제할 수 없습니다.")
    expect(getStock(db, b1)).toBe(1)
  })
  it('재고가 0 이상으로 남으면 삭제할 수 있다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 5)] })
    const ret = createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 3 })
    deleteReturn(db, ret)
    expect(getStock(db, b1)).toBe(5)
  })
})

describe('반품', () => {
  it('다른 출판사 도서는 거절한다', () => {
    const { db, p1, s1, b3 } = seed()
    expect(() => createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b3, qty: 1 })).toThrow('선택한 출판사의 도서가 아닙니다')
  })
})

describe('출고', () => {
  it('단가·금액을 계산해 저장한다', () => {
    const { db, p1, s1, b1 } = stocked()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 30, 60)] })
    expect(getShipment(db, D, p1, s1)!.items[0]).toMatchObject({ list_price: 20000, unit_price: 12000, amount: 360000, kind: '위탁', qty: 30 })
  })
  it('같은 날짜·출판사·서점은 하나의 출고로 이어서 저장한다', () => {
    const { db, p1, s1, b1, b2 } = stocked()
    const a = saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1)] })
    const first = getShipment(db, D, p1, s1)!.items[0]
    const b = saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1), id: first.id }, item(b2)] })
    expect(b.id).toBe(a.id)
    expect(getShipment(db, D, p1, s1)!.items).toHaveLength(2)
  })
  it('정가가 바뀌어도 기존 행은 저장 당시 정가를 유지한다', () => {
    const { db, p1, s1, b1 } = stocked()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1)] })
    updateBook(db, b1, { name: '리액트 입문', list_price: 25000 })
    const first = getShipment(db, D, p1, s1)!.items[0]
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1, 20), id: first.id }] })
    expect(getShipment(db, D, p1, s1)!.items[0]).toMatchObject({ list_price: 20000, qty: 20 })
  })
  it('인쇄된 행을 그대로 두고 재저장하면 새 행만 미인쇄로 남는다', () => {
    const { db, p1, s1, b1, b2 } = stocked()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1)] })
    const first = getShipment(db, D, p1, s1)!.items[0]
    markPrinted(db, [first.id], '2026-09-28T10:00:00.000Z')
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1), id: first.id }, item(b2)] })
    expect(listUnprinted(db, D, p1, s1).map((i) => i.book_id)).toEqual([b2])
  })
  it('인쇄된 행의 부수를 바꾸면 거절한다', () => {
    const { db, p1, s1, b1 } = stocked()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1)] })
    const first = getShipment(db, D, p1, s1)!.items[0]
    markPrinted(db, [first.id], '2026-09-28T10:00:00.000Z')
    expect(() =>
      saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1, 999), id: first.id }] }),
    ).toThrow('이미 인쇄된 행은 수정할 수 없습니다')
  })
  it('인쇄된 행의 도서를 바꾸면 거절한다', () => {
    const { db, p1, s1, b1, b2 } = stocked()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1)] })
    const first = getShipment(db, D, p1, s1)!.items[0]
    markPrinted(db, [first.id], '2026-09-28T10:00:00.000Z')
    expect(() =>
      saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b2), id: first.id }] }),
    ).toThrow('이미 인쇄된 행은 수정할 수 없습니다')
  })
  it('인쇄된 행을 입력에서 빼면(삭제 시도) 거절한다', () => {
    const { db, p1, s1, b1, b2 } = stocked()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1), item(b2)] })
    const [first] = getShipment(db, D, p1, s1)!.items
    markPrinted(db, [first.id], '2026-09-28T10:00:00.000Z')
    expect(() =>
      saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b2)] }),
    ).toThrow('삭제할 수 없습니다')
  })
  it('인쇄된 행이 있는 출고는 삭제할 수 없다', () => {
    const { db, p1, s1, b1 } = stocked()
    const { id } = saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1)] })
    const first = getShipment(db, D, p1, s1)!.items[0]
    markPrinted(db, [first.id], '2026-09-28T10:00:00.000Z')
    expect(() => deleteShipment(db, id)).toThrow('이미 인쇄된 명세가 있어 삭제할 수 없습니다')
  })
  it('입력에서 빠진 행은 삭제한다', () => {
    const { db, p1, s1, b1, b2 } = stocked()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1), item(b2)] })
    const [first] = getShipment(db, D, p1, s1)!.items
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1), id: first.id }] })
    expect(getShipment(db, D, p1, s1)!.items.map((i) => i.book_id)).toEqual([b1])
  })
  it('잘못된 입력은 행 번호와 함께 거절한다', () => {
    const { db, p1, s1, b1, b3 } = stocked()
    const base = { date: D, publisher_id: p1, bookstore_id: s1 }
    expect(() => saveShipment(db, { ...base, items: [] })).toThrow('1권 이상')
    expect(() => saveShipment(db, { ...base, items: [item(b1, 0)] })).toThrow('1행: 부수')
    expect(() => saveShipment(db, { ...base, items: [item(b1), item(b1, 5, 0)] })).toThrow('2행: 출고율')
    expect(() => saveShipment(db, { ...base, items: [item(b3)] })).toThrow('선택한 출판사의 도서가 아닙니다')
    expect(() => saveShipment(db, { ...base, bookstore_id: null, items: [item(b1)] })).toThrow('서점')
  })
  it('도서를 선택하지 않으면 행 번호와 함께 거절한다', () => {
    const { db, p1, s1 } = stocked()
    const base = { date: D, publisher_id: p1, bookstore_id: s1 }
    expect(() => saveShipment(db, { ...base, items: [{ book_id: null, rate: 60, kind: '위탁' as const, qty: 10 }] })).toThrow('1행')
    expect(() => saveShipment(db, { ...base, items: [{ book_id: null, rate: 60, kind: '위탁' as const, qty: 10 }] })).toThrow(
      '도서를 선택하세요',
    )
  })
  it('재고를 넘는 출고는 행 번호·출고 가능 부수와 함께 거절하고 아무것도 저장하지 않는다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 15)] })).toThrow(
      "1행: '리액트 입문' 2026-09-28 기준 출고 가능 10부, 입력 15부",
    )
    expect(getShipment(db, D, p1, s1)).toBeNull()
    expect(getStock(db, b1)).toBe(10)
  })
  it('입고가 없으면 출고할 수 없다', () => {
    const { db, p1, s1, b1, b2 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 5), item(b2, 1)] })).toThrow(
      "2행: '타입스크립트' 2026-09-28 기준 출고 가능 0부, 입력 1부",
    )
    expect(getShipment(db, D, p1, s1)).toBeNull()
  })
  it('재고와 같은 부수는 출고할 수 있다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 10)] })
    expect(getStock(db, b1)).toBe(0)
  })
  it('저장된 출고를 같은 부수로 다시 저장하면 이중으로 세지 않는다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 10)] })
    const first = getShipment(db, D, p1, s1)!.items[0]
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1, 10), id: first.id }] })
    expect(getShipment(db, D, p1, s1)!.items.map((i) => i.qty)).toEqual([10])
  })
  it('저장된 출고의 부수를 출고 가능 부수 넘게 늘리면 거절하고 원래 값을 유지한다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 8)] })
    const first = getShipment(db, D, p1, s1)!.items[0]
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1, 11), id: first.id }] })).toThrow(
      "1행: '리액트 입문' 2026-09-28 기준 출고 가능 10부, 입력 11부",
    )
    expect(getShipment(db, D, p1, s1)!.items.map((i) => i.qty)).toEqual([8])
  })
  it('같은 도서가 여러 행이면 합계로 비교한다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 6), item(b1, 5)] })).toThrow(
      "'리액트 입문' 2026-09-28 기준 출고 가능 10부, 입력 11부",
    )
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 6), item(b1, 4)] })
    expect(getStock(db, b1)).toBe(0)
  })
  it('이미 재고가 음수인 기존 데이터도 부수를 늘리지 않으면 다시 저장할 수 있다', () => {
    const { db, p1, s1, b1, b2 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    createReceipt(db, { date: D, book_id: b2, qty: 5 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 10)] })
    db.exec(`DELETE FROM receipts WHERE book_id = ${b1}`) // 규칙 도입 전 데이터처럼 재고 -10
    const first = getShipment(db, D, p1, s1)!.items[0]
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1, 10), id: first.id }, item(b2, 5)] })
    expect(getShipment(db, D, p1, s1)!.items).toHaveLength(2)
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [{ ...item(b1, 11), id: first.id }] })).toThrow(
      "1행: '리액트 입문' 2026-09-28 기준 출고 가능 0부, 입력 11부",
    )
  })
  it('다른 서점 출고분은 출고 가능 부수에서 빠진다', () => {
    const { db, p1, s1, s2, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s2, items: [item(b1, 7)] })
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 4)] })).toThrow(
      "1행: '리액트 입문' 2026-09-28 기준 출고 가능 3부, 입력 4부",
    )
  })
  it('출고 삭제 시 행도 함께 삭제한다', () => {
    const { db, p1, s1, b1 } = stocked()
    const { id } = saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1)] })
    deleteShipment(db, id)
    expect(getShipment(db, D, p1, s1)).toBeNull()
    expect(all(db, 'SELECT id FROM shipment_items')).toEqual([])
  })
  it('출고 이력이 있는 서점은 삭제할 수 없다', () => {
    const { db, p1, s1, b1 } = stocked()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1)] })
    expect(() => deleteBookstore(db, s1)).toThrow('이력')
  })
})
