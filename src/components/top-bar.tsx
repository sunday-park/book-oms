'use client'

import { usePathname } from 'next/navigation'
import { findNav } from '@/components/nav'
import { TONE_TILE } from '@/components/status'
import { today } from '@/lib/format'
import { cn } from '@/lib/utils'

/** 화면별 머리 버튼(예: [출력])이 PageHeader 에서 포털로 들어오는 자리 */
export const TOPBAR_ACTIONS_ID = 'topbar-actions'

function DatePill() {
  return (
    <div className="flex items-center gap-2 rounded-full bg-secondary px-3.5 py-1.5 font-mono text-sm text-muted-foreground">
      <span className="size-2 rounded-full bg-live" />
      <span suppressHydrationWarning>{today()}</span>
    </div>
  )
}

/** 상단바: 화면 아이콘 · 위치(대메뉴) · 화면 제목 · 설명 + 머리 버튼 · 날짜 */
export function TopBar() {
  const nav = findNav(usePathname())
  const Icon = nav?.item.icon
  return (
    <header className="sticky top-0 z-30 flex h-[76px] shrink-0 items-center gap-4 border-b bg-topbar px-7 shadow-[0_1px_3px_rgba(15,23,42,0.06)] print:hidden">
      {nav && Icon && (
        <div className="flex min-w-0 items-center gap-3.5">
          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-[10px]', nav.item.tone ? TONE_TILE[nav.item.tone] : 'bg-tile text-tile-foreground')}>
            <Icon className="size-5" strokeWidth={1.8} />
          </div>
          <nav aria-label="현재 위치" className="min-w-0">
            <div className="text-[13px] leading-none text-muted-foreground">{nav.section}</div>
            <div className="mt-1.5 flex items-baseline gap-3 whitespace-nowrap">
              <span aria-current="page" className="text-[22px] leading-none font-bold">{nav.item.label}</span>
              <span className="truncate text-sm text-muted-foreground">{nav.item.desc}</span>
            </div>
          </nav>
        </div>
      )}
      <div id={TOPBAR_ACTIONS_ID} className="ml-auto flex gap-2" />
      <DatePill />
    </header>
  )
}
