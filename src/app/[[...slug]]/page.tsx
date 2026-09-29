'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'
import { FOOTER_NAV, NAV } from '@/components/nav'
import { PageHeader } from '@/components/page-header'
import Books from '@/views/books'
import Bookstores from '@/views/bookstores'
import Publishers from '@/views/publishers'
import Receipts from '@/views/receipts'
import Returns from '@/views/returns'
import Settings from '@/views/settings'
import StatementsDispatch from '@/views/statements-dispatch'
import StatementsEntry from '@/views/statements-entry'
import StatementsLedger from '@/views/statements-ledger'
import StatementsPrint from '@/views/statements-print'
import StatusShipments from '@/views/status-shipments'
import StatusStock from '@/views/status-stock'

// 메뉴 주소 → 화면. 모든 화면을 한 라우트에 두어 메뉴 이동 시 서버 왕복 없이 화면만 바꾼다.
const COMPONENTS: Record<string, ComponentType> = {
  '/books': Books,
  '/bookstores': Bookstores,
  '/publishers': Publishers,
  '/receipts': Receipts,
  '/returns': Returns,
  '/status/shipments': StatusShipments,
  '/status/stock': StatusStock,
  '/statements/entry': StatementsEntry,
  '/statements/print': StatementsPrint,
  '/statements/ledger': StatementsLedger,
  '/statements/dispatch': StatementsDispatch,
  '/settings': Settings,
}
const VIEWS = new Map([...NAV.flatMap((s) => s.groups.flat()), FOOTER_NAV.item].map((it) => [it.href, COMPONENTS[it.href]] as const))

export default function Page() {
  const pathname = usePathname()
  const View = VIEWS.get(pathname)
  if (!View) {
    return (
      <>
        <PageHeader title="페이지를 찾을 수 없습니다" />
        <p className="text-lg text-muted-foreground">
          주소가 올바른지 확인해 주세요.{' '}
          <Link href="/books" className="font-semibold text-primary underline underline-offset-4">
            도서 관리로 이동
          </Link>
        </p>
      </>
    )
  }
  // key: 메뉴를 옮길 때마다 화면 상태를 새로 시작 (실제 페이지 이동과 같게)
  return <View key={pathname} />
}
