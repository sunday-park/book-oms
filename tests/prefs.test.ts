import { describe, expect, it } from 'vitest'
import { mergeColumnOrder } from '@/lib/columns'
import { openDb } from '@/lib/db'
import { getColumnOrder, getColumnOrders, resetColumnOrders, saveColumnOrder } from '@/lib/repo/prefs'

describe('열 순서 저장 (ui_prefs)', () => {
  it('저장한 순서를 표별로 다시 읽는다', () => {
    const db = openDb(':memory:')
    expect(getColumnOrder(db, 'books')).toBeNull()
    saveColumnOrder(db, 'books', ['name', 'code', 'price'])
    saveColumnOrder(db, 'receipts', ['qty', 'date'])
    expect(getColumnOrder(db, 'books')).toEqual(['name', 'code', 'price'])
    expect(getColumnOrders(db)).toEqual({ books: ['name', 'code', 'price'], receipts: ['qty', 'date'] })
  })

  it('같은 표를 다시 저장하면 덮어쓴다', () => {
    const db = openDb(':memory:')
    saveColumnOrder(db, 'books', ['a', 'b'])
    saveColumnOrder(db, 'books', ['b', 'a'])
    expect(getColumnOrder(db, 'books')).toEqual(['b', 'a'])
  })

  it('초기화하면 모든 표의 열 순서를 지운다 (다른 설정 키는 남긴다)', () => {
    const db = openDb(':memory:')
    saveColumnOrder(db, 'books', ['a'])
    saveColumnOrder(db, 'stock', ['b'])
    db.exec("INSERT INTO ui_prefs (key, value) VALUES ('other:x', '1')")
    resetColumnOrders(db)
    expect(getColumnOrders(db)).toEqual({})
    expect(db.prepare("SELECT value FROM ui_prefs WHERE key = 'other:x'").get()).toEqual({ value: '1' })
  })

  it('잘못된 표 이름·열 목록은 거절한다', () => {
    const db = openDb(':memory:')
    expect(() => saveColumnOrder(db, "x'; DROP", ['a'])).toThrow()
    expect(() => saveColumnOrder(db, 'books', 'a' as unknown as string[])).toThrow()
    expect(() => saveColumnOrder(db, 'books', [1 as unknown as string])).toThrow()
    expect(() => saveColumnOrder(db, 'books', ['a', 'a'])).toThrow()
  })

  it('저장된 값이 깨져 있으면 없는 것으로 본다', () => {
    const db = openDb(':memory:')
    db.exec("INSERT INTO ui_prefs (key, value) VALUES ('columns:books', 'not json'), ('columns:stock', '{\"a\":1}')")
    expect(getColumnOrder(db, 'books')).toBeNull()
    expect(getColumnOrders(db)).toEqual({})
  })
})

describe('열 순서 병합 (mergeColumnOrder)', () => {
  const cols = [{ id: 'no', pinned: 'start' as const }, { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'del', pinned: 'end' as const }]

  it('저장된 순서가 없으면 기본 순서', () => {
    expect(mergeColumnOrder(undefined, cols)).toEqual(['no', 'a', 'b', 'c', 'del'])
  })
  it('저장된 순서를 따른다', () => {
    expect(mergeColumnOrder(['c', 'a', 'b'], cols)).toEqual(['no', 'c', 'a', 'b', 'del'])
  })
  it('없어진 열 id 는 버린다', () => {
    expect(mergeColumnOrder(['c', 'gone', 'a', 'b'], cols)).toEqual(['no', 'c', 'a', 'b', 'del'])
  })
  it('새로 생긴 열은 기본 위치(앞 열 바로 뒤)에 끼운다', () => {
    expect(mergeColumnOrder(['c', 'a'], cols)).toEqual(['no', 'c', 'a', 'b', 'del'])
    expect(mergeColumnOrder(['c', 'b'], cols)).toEqual(['no', 'a', 'c', 'b', 'del'])
  })
  it('고정 열은 저장된 순서와 상관없이 제자리', () => {
    expect(mergeColumnOrder(['del', 'b', 'no', 'a', 'c'], cols)).toEqual(['no', 'b', 'a', 'c', 'del'])
  })
  it('중복 id 는 한 번만', () => {
    expect(mergeColumnOrder(['b', 'b', 'a', 'c'], cols)).toEqual(['no', 'b', 'a', 'c', 'del'])
  })
})
