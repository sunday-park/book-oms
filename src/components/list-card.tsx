import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// 목록 카드 안의 표 스타일 (인쇄용 PrintSheet 표에는 적용되지 않는다)
const TABLE_STYLES = [
  '[&_[data-slot=table-container]]:overflow-visible',
  '[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-[52px] [&_th]:bg-th [&_th]:text-base [&_th]:font-semibold [&_th]:text-muted-foreground',
  '[&_td]:h-14 [&_td]:text-[17px]',
  '[&_th:not(:last-child)]:border-r [&_td:not(:last-child)]:border-r',
  // 합계행: 진한 배경 + 굵은 글자 + 위쪽 2px 선 (sticky 칸은 border 가 따라오지 않아 inset 그림자로 긋는다)
  '[&_tfoot_td]:sticky [&_tfoot_td]:bottom-0 [&_tfoot_td]:bg-total [&_tfoot_td]:font-bold [&_tfoot_td]:text-slate-900 [&_tfoot_td]:shadow-[inset_0_2px_0_#cbd5e1]',
].join(' ')

export function ListCard({ title, count, actions, dense, children, footer }: {
  title: string
  /** 입력칸이 많은 표는 칸 여백을 줄인다 */
  dense?: boolean
  count?: string
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm print:border-0 print:shadow-none">
      <div className="flex min-h-[76px] items-center gap-3 border-b px-6 py-3 print:hidden">
        <h2 className="text-lg font-bold">{title}</h2>
        {count && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-medium text-slate-600">{count}</span>}
        {actions && <div className="ml-auto flex gap-2">{actions}</div>}
      </div>
      <div className={cn('max-h-[max(240px,calc(100vh_-_540px))] overflow-auto print:max-h-none print:overflow-visible', TABLE_STYLES, dense ? '[&_td]:px-2.5 [&_th]:px-2.5' : '[&_td]:px-4 [&_th]:px-4')}>{children}</div>
      {footer && <div className="border-t px-6 py-4 print:hidden">{footer}</div>}
    </section>
  )
}
