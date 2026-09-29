import { toast } from 'sonner'
import { RANGE_ERROR } from '@/lib/validate'

type Range = { from: string; to: string }

// 달력 칸에 연도를 한 자리씩 입력하는 중에는 0002-… 같은 값이 들어온다 — 그런 값은 검사하지 않는다
const complete = (d: string) => /^[1-9]\d{3}-\d{2}-\d{2}$/.test(d)

/** 조회할 수 있는 기간인지 (입력 중이라 잠시 뒤집힌 기간이면 조회를 미룬다) */
export const rangeReady = (r: Range) => !(r.from && r.to && r.from > r.to)

/** 기간 필터 변경: 시작일 > 종료일이 되는 값은 적용하지 않고 알린다 */
export function setRange<T extends Range>(f: T, patch: Partial<Range>, set: (next: T) => void) {
  const next = { ...f, ...patch }
  if (complete(next.from) && complete(next.to) && next.from > next.to) return void toast.error(RANGE_ERROR)
  set(next)
}
