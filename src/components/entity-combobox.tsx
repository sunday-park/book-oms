'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Option } from '@/lib/options'
import { cn } from '@/lib/utils'

/** 출판사·서점·도서 자동완성 선택 */
export function EntityCombobox({ label, options, value, onChange, placeholder = '선택', allLabel, disabled }: {
  label: string
  options: Option[]
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  allLabel?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const choose = (v: number | null) => {
    onChange(v)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label={label} disabled={disabled} className="w-56 justify-between px-3.5 text-[17px] font-normal disabled:bg-muted disabled:text-slate-600 disabled:opacity-100 disabled:saturate-100">
          <span className={cn('truncate', !selected && !(allLabel && value === null) && 'text-placeholder')}>
            {selected ? selected.label : allLabel && value === null ? allLabel : placeholder}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="검색..." />
          <CommandList>
            <CommandEmpty>결과 없음</CommandEmpty>
            <CommandGroup>
              {allLabel && <CommandItem value={allLabel} onSelect={() => choose(null)}>{allLabel}</CommandItem>}
              {options.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ''} ${o.value}`} onSelect={() => choose(o.value)}>
                  <Check className={cn('size-4', o.value === value ? 'opacity-100' : 'opacity-0')} />
                  {o.label}
                  {o.hint && <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
