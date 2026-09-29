import type { ShipKind } from '@/lib/domain'
import { won } from '@/lib/format'
import { cn } from '@/lib/utils'

// 상태 표시는 색 + 글자를 함께 쓴다 (흑백 인쇄·색각 이상에서도 구분되도록)
const PILL = 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold print:border print:border-current'

/** 재고 수량 — 음수는 빨강 '부족', 0 은 주황 '품절', 양수는 기본색 */
export function StockQty({ value }: { value: number }) {
  if (value > 0) return <span className="font-semibold">{won(value)}</span>
  const neg = value < 0
  return (
    <span className={cn(PILL, neg ? 'bg-neg-bg text-neg' : 'bg-zero-bg text-zero')}>
      {won(value)}
      <span className="text-[0.8em]">{neg ? '부족' : '품절'}</span>
    </span>
  )
}

/** 출고 구분 — 위탁 파랑, 탁송 보라 */
export function KindBadge({ kind, className }: { kind: ShipKind; className?: string }) {
  return (
    <span className={cn(PILL, 'text-[0.9em]', kind === '위탁' ? 'bg-consign-bg text-consign' : 'bg-delivery-bg text-delivery', className)}>
      {kind}
    </span>
  )
}

export function PrintedBadge() {
  return <span className={cn(PILL, 'ml-2 bg-ok-bg text-sm text-ok')}>인쇄됨</span>
}

/** 거래 종류별 강조색 — 입고 파랑, 출고 남색, 반품 주황 */
export type Tone = 'receipt' | 'ship' | 'return'
export const TONE_TEXT: Record<Tone, string> = {
  receipt: 'text-tx-receipt',
  ship: 'text-tx-ship',
  return: 'text-tx-return',
}
export const TONE_TILE: Record<Tone, string> = {
  receipt: 'bg-tx-receipt-bg text-tx-receipt',
  ship: 'bg-tx-ship-bg text-tx-ship',
  return: 'bg-tx-return-bg text-tx-return',
}
