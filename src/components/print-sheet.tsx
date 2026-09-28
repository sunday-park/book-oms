import type { ReactNode } from 'react'

/** 인쇄되는 문서 영역 (사이드바·검색바는 print:hidden 이라 이것만 인쇄됨) */
export function PrintSheet({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-4xl space-y-4 rounded-2xl border bg-white p-8 text-black shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <h2 className="text-center text-2xl font-bold tracking-[0.3em]">{title}</h2>
      {meta && <div className="text-sm">{meta}</div>}
      {children}
    </section>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground shadow-sm">{children}</p>
}
