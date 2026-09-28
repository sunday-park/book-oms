import { AppError } from './result'

export function requireText(v: string | null | undefined, label: string) {
  if (!v?.trim()) throw new AppError(`${label}을(를) 입력하세요.`)
  return v.trim()
}

export function requireDate(v: string | null | undefined, label = '날짜') {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new AppError(`${label}를 선택하세요.`)
  return v
}

export function requireQty(v: number, label = '부수') {
  if (!Number.isInteger(v) || v <= 0) throw new AppError(`${label}는 1 이상 정수로 입력하세요.`)
  return v
}

export function requireId(v: number | null | undefined, label: string) {
  if (!v) throw new AppError(`${label}을(를) 선택하세요.`)
  return v
}
