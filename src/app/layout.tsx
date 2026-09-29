import type { Metadata } from 'next'
import { AppSidebar } from '@/components/app-sidebar'
import { ColumnPrefsProvider } from '@/components/column-prefs'
import { HelpButton } from '@/components/help-button'
import { TopBar } from '@/components/top-bar'
import { Toaster } from '@/components/ui/sonner'
import { getColumnOrders } from '@/lib/actions/prefs'
import './globals.css'

// 오늘 날짜 기본값이 빌드 시점으로 굳지 않도록 매 요청 렌더
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Book OMS' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 목록 표 열 순서 — 첫 화면부터 저장된 순서로 그리도록 서버에서 한 번 읽어 둔다
  const columns = await getColumnOrders()
  return (
    <html lang="ko">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="flex-1 space-y-6 px-7 pt-8 pb-10 print:p-0">
              <ColumnPrefsProvider initial={columns.ok ? columns.data : {}}>{children}</ColumnPrefsProvider>
            </main>
          </div>
        </div>
        <HelpButton />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
