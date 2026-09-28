import type { ReactNode } from 'react'

/** 인쇄되는 문서 영역 (사이드바·검색바는 print:hidden 이라 이것만 인쇄됨) */
export function PrintSheet({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-4xl space-y-4 rounded-lg border bg-white p-8 text-black print:max-w-none print:border-0 print:p-0">
      <h2 className="text-center text-2xl font-bold tracking-[0.3em]">{title}</h2>
      {meta && <div className="text-sm">{meta}</div>}
      {children}
    </section>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="py-12 text-center text-muted-foreground">{children}</p>
}
