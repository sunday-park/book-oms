'use client'

import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV } from '@/components/nav'
import { today } from '@/lib/format'
import { hasUnsaved } from '@/lib/unsaved'
import { cn } from '@/lib/utils'

export function AppSidebar() {
  const pathname = usePathname()
  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground print:hidden">
      <div className="flex items-center gap-3.5 border-b border-sidebar-border px-5 py-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-sidebar-primary text-white">
          <BookOpen className="size-5" />
        </div>
        <div>
          <div className="text-lg leading-tight font-bold text-white">도서 재고관리</div>
          <div className="mt-1 font-mono text-xs text-slate-400" suppressHydrationWarning>{today()}</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((m, si) => (
          <div key={m.title} className={cn('pt-[clamp(8px,1.6vh,20px)]', si > 0 && 'mt-[clamp(2px,0.6vh,8px)]')}>
            <div className="mb-2 px-3.5 text-[13px] font-medium text-slate-500">{m.title}</div>
            {m.groups.map((items, gi) => (
              <div key={gi} className="space-y-1">
                {gi > 0 && <div className="mx-3.5 my-[clamp(4px,1vh,12px)] border-t border-sidebar-border" />}
                {items.map((it) => {
                  const Icon = it.icon
                  const active = pathname === it.href
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={(e) => {
                        if (hasUnsaved() && !confirm('저장하지 않은 변경 내용이 있습니다. 버리고 이동할까요?')) e.preventDefault()
                      }}
                      className={cn(
                        'flex h-[clamp(34px,4.4vh,50px)] items-center gap-3 rounded-lg px-3.5 text-lg font-semibold transition-colors',
                        active ? 'bg-sidebar-primary text-white' : 'hover:bg-sidebar-accent hover:text-white',
                      )}
                    >
                      <Icon className="size-5 shrink-0" strokeWidth={1.8} />
                      {it.label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-3 font-mono text-xs text-slate-500">v1.0.0</div>
    </aside>
  )
}
