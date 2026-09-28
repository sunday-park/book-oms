'use client'

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
    <>
      <Input className="w-56" value={value} onChange={(e) => onChange(e.target.value)} list={listId} placeholder={placeholder} />
      <datalist id={listId}>
        {[...new Set(suggestions)].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  )
}
