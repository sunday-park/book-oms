'use client'

import { ChevronRight } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { findNav } from '@/components/nav'
import { today } from '@/lib/format'

export function TopBar() {
  const nav = findNav(usePathname())
  return (
    <header className="sticky top-0 z-30 flex h-[62px] shrink-0 items-center border-b bg-topbar px-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] print:hidden">
      {nav && (
        <nav aria-label="현재 위치" className="flex items-center gap-2 text-lg">
          <span className="text-muted-foreground">{nav.section}</span>
          <ChevronRight className="size-4 text-muted-foreground/70" />
          <span className="font-bold">{nav.item.label}</span>
        </nav>
      )}
      <div className="ml-auto flex items-center gap-2 rounded-full bg-secondary px-3.5 py-1.5 font-mono text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-live" />
        <span suppressHydrationWarning>{today()}</span>
      </div>
    </header>
  )
}
