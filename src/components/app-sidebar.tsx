'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { hasUnsaved } from '@/lib/unsaved'
import { cn } from '@/lib/utils'

// 관리 메뉴는 [도서·서점·출판사] / [입고·반품] 두 묶음 사이에 희미한 구분선
const MENU = [
  {
    title: '관리',
    groups: [
      [
        { href: '/books', label: '도서 관리' },
        { href: '/bookstores', label: '서점 관리' },
        { href: '/publishers', label: '출판사 관리' },
      ],
      [
        { href: '/receipts', label: '입고 관리' },
        { href: '/returns', label: '반품 관리' },
      ],
    ],
  },
  {
    title: '현황',
    groups: [[
      { href: '/status/shipments', label: '출고 현황' },
      { href: '/status/stock', label: '재고 현황' },
    ]],
  },
  {
    title: '명세서',
    groups: [[
      { href: '/statements/entry', label: '출고 입력' },
      { href: '/statements/print', label: '명세서 출력' },
      { href: '/statements/ledger', label: '재고 원장' },
      { href: '/statements/dispatch', label: '출고증' },
    ]],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 shrink-0 border-r bg-muted/40 p-4 print:hidden">
      <div className="mb-6 px-2 text-lg font-bold">Book OMS</div>
      <nav className="space-y-6">
        {MENU.map((m) => (
          <div key={m.title}>
            <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">{m.title}</div>
            {m.groups.map((items, gi) => (
              <div key={gi} className={cn(gi > 0 && 'mt-2 border-t border-border/50 pt-2')}>
                {items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={(e) => {
                      if (hasUnsaved() && !confirm('저장하지 않은 변경 내용이 있습니다. 버리고 이동할까요?')) e.preventDefault()
                    }}
                    className={cn('block rounded-md px-2 py-1.5 text-sm hover:bg-accent', pathname === it.href && 'bg-accent font-medium')}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
