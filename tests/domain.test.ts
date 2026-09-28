import { describe, expect, it } from 'vitest'
import { calcAmount, calcStock, calcUnitPrice, formatBookCode } from '@/lib/domain'

describe('domain', () => {
  it('도서코드는 출판사코드-4자리 순번', () => {
    expect(formatBookCode('P01', 1)).toBe('P01-0001')
    expect(formatBookCode('P01', 12)).toBe('P01-0012')
  })
  it('단가는 정가×출고율을 원 단위 반올림', () => {
    expect(calcUnitPrice(20000, 60)).toBe(12000)
    expect(calcUnitPrice(15000, 62.5)).toBe(9375)
    expect(calcUnitPrice(9900, 65)).toBe(6435)
    expect(calcUnitPrice(9990, 65)).toBe(6494) // 6493.5 → 6494
  })
  it('금액 = 단가×부수', () => expect(calcAmount(12000, 30)).toBe(360000))
  it('재고 = 입고 − 출고 + 반품', () => expect(calcStock(100, 30, 5)).toBe(75))
})
