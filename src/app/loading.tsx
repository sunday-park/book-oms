'use client'

import { usePathname } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { findNav } from '@/components/nav'

/** 메뉴 이동 중 즉시 보여주는 화면 틀 (클릭 반응을 바로 느끼게) */
export default function Loading() {
  const title = findNav(usePathname())?.item.label ?? ''
  return (
    <div className="space-y-6" aria-busy="true" aria-label="불러오는 중">
      <PageHeader title={title} />
      <div className="h-[116px] animate-pulse rounded-2xl border bg-card" />
      <div className="h-80 animate-pulse rounded-2xl border bg-card" />
    </div>
  )
}
