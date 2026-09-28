import { RotateCcw, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 검색 카드 안의 입력칸·선택칸은 한 단계 크게 (컴포넌트 자체는 그대로 두고 여기서만 키운다)
const FIELD_STYLES =
  '[&_[data-slot=input]]:h-11 [&_[data-slot=input]]:bg-white [&_[data-slot=input]]:text-[17px] [&_[role=combobox]]:h-11 [&_[role=combobox]]:bg-white [&_[role=combobox]]:text-[17px]'

export function SearchBar({ onReset, onSearch, children }: { onReset: () => void; onSearch: () => void; children: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-end gap-3 rounded-2xl border bg-card px-6 py-5 shadow-sm print:hidden', FIELD_STYLES)}>
      {children}
      <div className="ml-auto flex gap-2.5">
        <Button className="h-11 gap-2 px-5 text-[17px] font-semibold" onClick={onSearch}>
          <Search />
          조회
        </Button>
        <Button variant="outline" className="h-11 gap-2 bg-white px-5 text-[17px] font-semibold" onClick={onReset}>
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
