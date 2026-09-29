'use client'

import { Search } from 'lucide-react'
import { useId } from 'react'
import { Input } from '@/components/ui/input'

/** 입력 즉시 필터링 + 자동완성 후보(datalist) */
export function SearchInput({ value, onChange, suggestions, placeholder }: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
}) {
  const listId = useId()
  return (
    <div className="relative w-full min-w-64">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-placeholder" />
      <Input className="pl-10" value={value} onChange={(e) => onChange(e.target.value)} list={listId} placeholder={placeholder} />
      <datalist id={listId}>
        {[...new Set(suggestions)].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}
