import { RotateCcw, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SearchBar({ onReset, onSearch, children }: { onReset: () => void; onSearch: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card px-6 py-5 shadow-sm print:hidden">
      {children}
      <div className="ml-auto flex gap-2.5">
        <Button onClick={onSearch}>
          <Search />
          조회
        </Button>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw />
          초기화
        </Button>
      </div>
    </div>
  )
}

/** 감싸는 label 이라 getByLabel 로 안쪽 입력칸을 찾을 수 있다 */
export function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('grid gap-2 text-[15px] font-medium text-slate-700', className)}>
      {label}
      {children}
    </label>
  )
}
