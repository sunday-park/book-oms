import { describe, expect, it } from 'vitest'
import { createBook, deleteBook, deletePublisher, listBooks, listPublishers, savePublisher } from '@/lib/repo/master'
import { AppError, wrap } from '@/lib/result'
import { seed } from './helpers'

describe('도서코드', () => {
  it('출판사별 서수로 자동 부여한다', () => {
    const { db } = seed()
    expect(listBooks(db).map((b) => b.code)).toEqual(['P01-0001', 'P01-0002', 'P02-0001'])
  })
  it('삭제된 번호를 재사용하지 않는다', () => {
    const { db, p1, b2 } = seed()
    deleteBook(db, b2)
    const id = createBook(db, { publisher_id: p1, name: '새 책', list_price: 10000 })
    expect(listBooks(db, p1).find((b) => b.id === id)?.code).toBe('P01-0003')
  })
  it('출판사를 고르지 않으면 거절한다', () => {
    const { db } = seed()
    expect(() => createBook(db, { publisher_id: null, name: 'x', list_price: 0 })).toThrow('출판사')
  })
})

describe('출판사', () => {
  it('사업자번호 빈값은 null 로 저장한다', () => {
    const { db } = seed()
    const id = savePublisher(db, { code: 'P03', name: '새출판', phone: '', fax: '', biz_no: '  ' })
    expect(listPublishers(db).find((p) => p.id === id)?.biz_no).toBeNull()
  })
  it('수정 시 출판사코드는 바뀌지 않는다', () => {
    const { db, p1 } = seed()
    savePublisher(db, { code: 'ZZZ', name: '한빛미디어', phone: '', fax: '', biz_no: null }, p1)
    expect(listPublishers(db).find((p) => p.id === p1)).toMatchObject({ code: 'P01', name: '한빛미디어' })
  })
  it('중복 코드는 안내 문구로 거절한다', async () => {
    const { db } = seed()
    const r = await wrap(() => savePublisher(db, { code: 'P01', name: 'x', phone: '', fax: '', biz_no: null }))
    expect(r).toEqual({ ok: false, error: '이미 등록된 코드입니다.' })
  })
  it('필수값이 없으면 거절한다', () => {
    const { db } = seed()
    expect(() => savePublisher(db, { code: 'P09', name: ' ', phone: '', fax: '', biz_no: null })).toThrow('출판사명')
  })
  it('소속 도서가 있으면 삭제를 막는다', () => {
    const { db, p1 } = seed()
    expect(() => deletePublisher(db, p1)).toThrow(AppError)
  })
})

describe('도서 조회', () => {
  it('출판사별로 도서코드 순 조회', () => {
    const { db, p2 } = seed()
    expect(listBooks(db, p2).map((b) => [b.code, b.name, b.publisher_name])).toEqual([['P02-0001', '파이썬 기초', '길벗']])
  })
})
