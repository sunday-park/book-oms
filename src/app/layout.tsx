import type { Metadata } from 'next'
import { AppSidebar } from '@/components/app-sidebar'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// 오늘 날짜 기본값이 빌드 시점으로 굳지 않도록 매 요청 렌더
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Book OMS' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 space-y-4 p-6 print:p-0">{children}</main>
        </div>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
