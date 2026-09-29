'use client'

import { BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NAV } from '@/components/nav'
import { buttonVariants } from '@/components/ui/button'
import { today } from '@/lib/format'
import { hasUnsaved } from '@/lib/unsaved'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'book-oms:sidebar-collapsed'

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // 접힘 상태는 브라우저에 기억 (저장소를 못 쓰면 펼친 상태로 시작)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {}
  }, [])
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {}
  }

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar shadow-[inset_-1px_0_0_var(--sidebar-edge)] text-sidebar-foreground transition-[width] duration-200 print:hidden',
        collapsed ? 'w-[76px]' : 'w-72',
      )}
    >
      <div className={cn('flex items-center gap-3.5 border-b border-sidebar-border py-6', collapsed ? 'justify-center px-0' : 'px-5')}>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sidebar-logo text-sidebar-logo-foreground">
          <BookOpen className="size-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-lg leading-tight font-bold text-sidebar-heading">도서 재고관리</div>
            <div className="mt-1 font-mono text-xs text-sidebar-muted" suppressHydrationWarning>{today()}</div>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((m, si) => (
          <div key={m.title} className={cn('pt-[clamp(8px,1.6vh,20px)]', si > 0 && 'mt-[clamp(2px,0.6vh,8px)]')}>
            {collapsed ? (
              <div className="mx-3 mb-2 flex h-[19px] items-center" aria-hidden>
                {si > 0 && <div className="w-full border-t border-sidebar-border" />}
              </div>
            ) : (
              <div className="mb-2 px-3.5 text-[13px] font-semibold tracking-wide text-sidebar-muted">{m.title}</div>
            )}
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
                      prefetch={false}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? it.label : undefined}
                      title={collapsed ? it.label : undefined}
                      onClick={(e) => {
                        // 새 탭 열기(휠 클릭·Ctrl/Shift 클릭)는 브라우저 기본 동작에 맡긴다
                        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                        e.preventDefault()
                        if (hasUnsaved() && !confirm('저장하지 않은 변경 내용이 있습니다. 버리고 이동할까요?')) return
                        // 서버 요청 없이 주소만 바꾸면 화면 전환은 [[...slug]] 페이지가 처리한다
                        if (it.href !== pathname) window.history.pushState(null, '', it.href)
                      }}
                      className={cn(
                        'flex h-[clamp(34px,4.4vh,50px)] items-center gap-3 rounded-lg text-lg font-semibold whitespace-nowrap transition-colors',
                        collapsed ? 'justify-center px-0' : 'px-3.5',
                        'outline-none focus-visible:ring-3 focus-visible:ring-sidebar-focus',
                        active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Icon className="size-5 shrink-0" strokeWidth={1.8} />
                      {!collapsed && it.label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className={cn('flex items-center border-t border-sidebar-border py-2', collapsed ? 'justify-center px-0' : 'justify-between pr-2 pl-5')}>
        {!collapsed && <span className="font-mono text-xs text-sidebar-muted">v1.0.0</span>}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
          title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
          aria-expanded={!collapsed}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-sidebar-muted aria-expanded:bg-transparent aria-expanded:text-sidebar-muted enabled:hover:bg-sidebar-accent enabled:hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-focus')}
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </button>
      </div>
    </aside>
  )
}
