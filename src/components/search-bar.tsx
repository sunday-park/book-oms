import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export function SearchBar({ onReset, onSearch, children }: { onReset: () => void; onSearch: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 print:hidden">
      {children}
      <div className="ml-auto flex gap-2">
        <Button variant="outline" onClick={onReset}>초기화</Button>
        <Button onClick={onSearch}>조회</Button>
      </div>
    </div>
  )
}

/** 감싸는 label 이라 getByLabel 로 안쪽 입력칸을 찾을 수 있다 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}
