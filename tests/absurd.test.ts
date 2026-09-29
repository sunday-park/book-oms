import { describe, expect, it } from 'vitest'
import { all } from '@/lib/db'
import {
  createReceipt, createReturn, deleteReceipt, deleteReturn, deleteShipment, getShipment, listReturns, saveShipment,
} from '@/lib/repo/inventory'
import {
  createBook, deleteBook, deleteBookstore, deletePublisher, listBooks, listBookstores, listPublishers, saveBookstore, savePublisher, updateBook,
} from '@/lib/repo/master'
import { getStock } from '@/lib/repo/reports'
import { seed } from './helpers'

// "말도 안 되는 입력·업무 상황" 모음 — 화면으로 재현하기 어려운 경우(서버 동작 직접 호출 등)를 여기서 확인한다.
const D = '2026-09-28'
const item = (book_id: number, qty = 10, rate = 60) => ({ book_id, rate, kind: '위탁' as const, qty })
const pub = (code: string, name = '출판사') => ({ code, name, phone: '', fax: '', biz_no: null })

describe('A1 부수', () => {
  const bad = [0, -1, 1.5, 1e12, Number.NaN]
  it.each(bad)('입고 부수 %s 는 거절한다', (qty) => {
    const { db, b1 } = seed()
    expect(() => createReceipt(db, { date: D, book_id: b1, qty })).toThrow('입고부수는 1 이상 999,999 이하 정수로 입력하세요.')
  })
  it.each(bad)('반품 부수 %s 는 거절한다', (qty) => {
    const { db, p1, s1, b1 } = seed()
    expect(() => createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty })).toThrow('부수는 1 이상 999,999 이하')
  })
  it.each(bad)('출고 부수 %s 는 행 번호와 함께 거절한다', (qty) => {
    const { db, p1, s1, b1 } = seed()
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, qty)] })).toThrow('1행: 부수는 1 이상 999,999 이하')
  })
  it('999,999 부는 허용한다', () => {
    const { db, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 999_999 })
    expect(getStock(db, b1)).toBe(999_999)
  })
})

describe('A2 정가·출고율', () => {
  it.each([-1, 1.5, 1e12])('정가 %s 는 거절한다', (list_price) => {
    const { db, p1, b1 } = seed()
    expect(() => createBook(db, { publisher_id: p1, name: 'x', list_price })).toThrow('정가는 0 이상 9,999,999 이하 정수로 입력하세요.')
    expect(() => updateBook(db, b1, { name: 'x', list_price })).toThrow('정가는')
  })
  it.each([0, -5, 100.1, 150])('출고율 %s 는 거절한다', (rate) => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 100 })
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 1, rate)] })).toThrow('1행: 출고율')
  })
  it('출고율 62.5 는 허용하고 단가를 반올림한다', () => {
    const { db, p1, s1, b2 } = seed()
    createReceipt(db, { date: D, book_id: b2, qty: 100 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b2, 2, 62.5)] })
    expect(getShipment(db, D, p1, s1)!.items[0]).toMatchObject({ rate: 62.5, unit_price: 9375, amount: 18750 })
  })
})

describe('A3 날짜', () => {
  it.each(['', '2026-02-30', '2026-13-01', '2026-00-10', '2026-9-1', '20260928'])('날짜 "%s" 는 거절한다', (date) => {
    const { db, p1, s1, b1 } = seed()
    expect(() => createReceipt(db, { date, book_id: b1, qty: 1 })).toThrow('입고일자')
    expect(() => saveShipment(db, { date, publisher_id: p1, bookstore_id: s1, items: [item(b1, 1)] })).toThrow('날짜')
  })
  it('윤년 2월 29일은 허용한다', () => {
    const { db, b1 } = seed()
    createReceipt(db, { date: '2028-02-29', book_id: b1, qty: 1 })
    expect(getStock(db, b1)).toBe(1)
  })
  it('먼 과거·미래(1900, 2999)도 서버는 허용한다 (화면에서 확인을 받는다)', () => {
    const { db, b1 } = seed()
    createReceipt(db, { date: '1900-01-01', book_id: b1, qty: 1 })
    createReceipt(db, { date: '2999-12-31', book_id: b1, qty: 1 })
    expect(getStock(db, b1)).toBe(2)
  })
})

describe('A4 이름·코드', () => {
  it('공백만 있으면 거절하고, 앞뒤 공백은 잘라 저장한다', () => {
    const { db, p1 } = seed()
    expect(() => savePublisher(db, pub('Q99', '   '))).toThrow('출판사명을 입력하세요.')
    expect(() => saveBookstore(db, { code: '  ', name: 'x', region: '서울특별시' })).toThrow('서점코드를 입력하세요.')
    const id = savePublisher(db, pub('  Q98  ', '  공백출판  '))
    expect(listPublishers(db).find((p) => p.id === id)).toMatchObject({ code: 'Q98', name: '공백출판' })
    const b = createBook(db, { publisher_id: p1, name: '  공백 도서  ', list_price: 1000 })
    expect(listBooks(db, p1).find((x) => x.id === b)?.name).toBe('공백 도서')
  })
  it('너무 긴 이름·코드는 거절한다', () => {
    const { db, p1, b1 } = seed()
    const long = '가'.repeat(101)
    expect(() => savePublisher(db, pub('Q97', long))).toThrow('출판사명은 100자 이하로 입력하세요.')
    expect(() => savePublisher(db, pub('Q'.repeat(21)))).toThrow('출판사코드는 20자 이하로 입력하세요.')
    expect(() => saveBookstore(db, { code: 'T97', name: long, region: '서울특별시' })).toThrow('서점명은 100자 이하')
    expect(() => saveBookstore(db, { code: 'T'.repeat(21), name: 'x', region: '서울특별시' })).toThrow('서점코드는 20자 이하')
    expect(() => createBook(db, { publisher_id: p1, name: long, list_price: 0 })).toThrow('도서명은 100자 이하')
    expect(() => updateBook(db, b1, { name: long, list_price: 0 })).toThrow('도서명은 100자 이하')
    const ok = savePublisher(db, pub('Q96', '가'.repeat(100)))
    expect(listPublishers(db).find((p) => p.id === ok)?.name).toHaveLength(100)
  })
  it('스크립트·이모지 문자열은 글자 그대로 저장한다', () => {
    const { db } = seed()
    const id = savePublisher(db, pub('Q95', '<script>alert(1)</script> 📚'))
    expect(listPublishers(db).find((p) => p.id === id)?.name).toBe('<script>alert(1)</script> 📚')
  })
})

describe('A5 코드 중복', () => {
  it('대소문자만 다른 출판사코드는 중복으로 거절한다', () => {
    const { db } = seed()
    expect(() => savePublisher(db, pub('p01'))).toThrow('이미 등록된 코드입니다.')
  })
  it('대소문자만 다른 서점코드는 중복으로 거절한다 (수정 포함, 자기 자신은 허용)', () => {
    const { db, s1, s2 } = seed()
    expect(() => saveBookstore(db, { code: 's01', name: 'x', region: '서울특별시' })).toThrow('이미 등록된 코드입니다.')
    expect(() => saveBookstore(db, { code: 's01', name: 'x', region: '서울특별시' }, s2)).toThrow('이미 등록된 코드입니다.')
    saveBookstore(db, { code: 's01', name: '교보문고 광화문', region: '서울특별시' }, s1)
    expect(listBookstores(db).find((s) => s.id === s1)?.code).toBe('s01')
  })
})

describe('B1 반품 부수는 그 서점에 출고한 부수를 넘을 수 없다', () => {
  it('출고한 적 없는 서점·도서의 반품은 거절한다', () => {
    const { db, p1, s1, b1 } = seed()
    expect(() => createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 1 })).toThrow(
      "'리액트 입문'은 '교보문고 광화문'에 2026-09-28까지 반품 가능한 부수가 0부입니다.",
    )
    expect(getStock(db, b1)).toBe(0)
  })
  it('출고 5부인데 반품 10부는 거절하고, 이전 반품까지 빼고 계산한다', () => {
    const { db, p1, s1, s2, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 20 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 5)] })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s2, items: [item(b1, 7)] })
    expect(() => createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 10 })).toThrow('반품 가능한 부수가 5부입니다.')
    createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 3 })
    expect(() => createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 3 })).toThrow('반품 가능한 부수가 2부입니다.')
    createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 2 })
    expect(listReturns(db, { from: D, to: D }).map((r) => r.qty)).toEqual([3, 2])
  })
})

describe('B2 날짜 역전 (🔧 날짜 기준으로 막음)', () => {
  it('내년 입고로 오늘 출고할 수 없다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: '2027-09-28', book_id: b1, qty: 10 })
    expect(() => saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 10)] })).toThrow(
      "1행: '리액트 입문' 2026-09-28 기준 출고 가능 0부, 입력 10부",
    )
    expect(getStock(db, b1)).toBe(10)
  })
  it('반품일이 출고일보다 이전이면 거절한다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 5)] })
    expect(() => createReturn(db, { date: '2026-01-01', publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 2 })).toThrow(
      "'리액트 입문'은 '교보문고 광화문'에 2026-01-01까지 반품 가능한 부수가 0부입니다.",
    )
    expect(getStock(db, b1)).toBe(5)
  })
})

describe('B6 없는 id 로 수정·삭제하면 조용히 넘어가지 않고 알린다', () => {
  const NO = 9999
  it.each([
    ['출판사 수정', (db: ReturnType<typeof seed>['db']) => savePublisher(db, pub('X'), NO), '출판사를 찾을 수 없습니다.'],
    ['출판사 삭제', (db: ReturnType<typeof seed>['db']) => deletePublisher(db, NO), '출판사를 찾을 수 없습니다.'],
    ['서점 수정', (db: ReturnType<typeof seed>['db']) => saveBookstore(db, { code: 'X', name: 'x', region: '서울특별시' }, NO), '서점을 찾을 수 없습니다.'],
    ['서점 삭제', (db: ReturnType<typeof seed>['db']) => deleteBookstore(db, NO), '서점을 찾을 수 없습니다.'],
    ['도서 수정', (db: ReturnType<typeof seed>['db']) => updateBook(db, NO, { name: 'x', list_price: 0 }), '도서를 찾을 수 없습니다.'],
    ['도서 삭제', (db: ReturnType<typeof seed>['db']) => deleteBook(db, NO), '도서를 찾을 수 없습니다.'],
    ['입고 삭제', (db: ReturnType<typeof seed>['db']) => deleteReceipt(db, NO), '입고 내역을 찾을 수 없습니다.'],
    ['반품 삭제', (db: ReturnType<typeof seed>['db']) => deleteReturn(db, NO), '반품 내역을 찾을 수 없습니다.'],
    ['출고 삭제', (db: ReturnType<typeof seed>['db']) => deleteShipment(db, NO), '출고 명세를 찾을 수 없습니다.'],
  ] as const)('%s', (_, fn, msg) => {
    const { db } = seed()
    expect(() => fn(db)).toThrow(msg)
  })
})

describe('B7 출고 100행', () => {
  it('한 번에 저장하고 합계가 맞는다', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 1000 })
    const t = performance.now()
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: Array.from({ length: 100 }, (_, i) => item(b1, (i % 5) + 1)) })
    expect(performance.now() - t).toBeLessThan(1000)
    expect(getShipment(db, D, p1, s1)!.items).toHaveLength(100)
    expect(getStock(db, b1)).toBe(1000 - 300)
  })
})

describe('B8 이력이 있으면 삭제를 막는다', () => {
  it('출판사(소속 도서)·서점(반품만 있어도)·도서(출고)', () => {
    const { db, p1, s1, b1 } = seed()
    createReceipt(db, { date: D, book_id: b1, qty: 10 })
    saveShipment(db, { date: D, publisher_id: p1, bookstore_id: s1, items: [item(b1, 5)] })
    createReturn(db, { date: D, publisher_id: p1, bookstore_id: s1, book_id: b1, qty: 1 })
    expect(() => deletePublisher(db, p1)).toThrow('소속 도서가 있어 삭제할 수 없습니다.')
    expect(() => deleteBookstore(db, s1)).toThrow('이력이 있어 삭제할 수 없습니다.')
    expect(() => deleteBook(db, b1)).toThrow('이력이 있어 삭제할 수 없습니다.')
    expect(all(db, 'SELECT id FROM books WHERE id = ?', b1)).toHaveLength(1)
  })
})
