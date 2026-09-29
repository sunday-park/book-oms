import { today } from '@/lib/format'

/**
 * 입력한 날짜가 오늘(로컬)과 1년 넘게 차이 나면 한 번 더 확인한다 (막지는 않는다).
 * 확인을 누르거나 평범한 날짜면 true. 형식이 틀린 날짜는 서버 검사에 맡긴다.
 */
export function confirmOddDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true
  const t = today()
  const shift = (years: number) => `${Number(t.slice(0, 4)) + years}${t.slice(4)}`
  if (date >= shift(-1) && date <= shift(1)) return true
  return confirm(`입력한 날짜(${date})가 오늘과 1년 이상 차이 납니다. 이 날짜가 맞나요?`)
}
