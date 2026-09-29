import { josa } from './josa'
import { AppError } from './result'

export function requireText(v: string | null | undefined, label: string, maxLen = 100) {
  if (!v?.trim()) throw new AppError(`${label}${josa(label, '을', '를')} 입력하세요.`)
  if (v.trim().length > maxLen) throw new AppError(`${label}${josa(label, '은', '는')} ${maxLen}자 이하로 입력하세요.`)
  return v.trim()
}

export function requireDate(v: string | null | undefined, label = '날짜') {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new AppError(`${label}${josa(label, '을', '를')} 선택하세요.`)
  // 2026-02-30 처럼 형식만 맞고 달력에 없는 날짜 거절
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw new AppError(`${label}${josa(label, '이', '가')} 올바르지 않습니다.`)
  return v
}

const MAX_QTY = 999_999

export function requireQty(v: number, label = '부수') {
  if (!Number.isInteger(v) || v <= 0 || v > MAX_QTY) throw new AppError(`${label}${josa(label, '은', '는')} 1 이상 999,999 이하 정수로 입력하세요.`)
  return v
}

export function requireId(v: number | null | undefined, label: string) {
  if (!v) throw new AppError(`${label}${josa(label, '을', '를')} 선택하세요.`)
  return v
}

export const RANGE_ERROR = '시작일은 종료일보다 늦을 수 없습니다.'

/** 기간 조회: 시작일이 종료일보다 늦으면 거절 (둘 중 하나가 비어 있으면 검사하지 않는다) */
export function requireRange(from: string, to: string) {
  if (from && to && from > to) throw new AppError(RANGE_ERROR)
}
