'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { findNav } from '@/components/nav'

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  const item = findNav(usePathname())?.item
  const Icon = item?.icon
  return (
    <div className="flex items-center gap-4 print:hidden">
      {Icon && (
        <div className="flex size-[50px] shrink-0 items-center justify-center rounded-xl bg-[#dfe5ee] text-slate-700">
          <Icon className="size-6" strokeWidth={1.8} />
        </div>
      )}
      <div>
        <h1 className="text-[26px] leading-tight font-bold">{title}</h1>
        {item && <p className="mt-1 text-base text-muted-foreground">{item.desc}</p>}
      </div>
      {children && <div className="ml-auto flex gap-2">{children}</div>}
    </div>
  )
}
