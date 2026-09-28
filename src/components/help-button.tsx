'use client'

import { usePathname } from 'next/navigation'
import { findNav } from '@/components/nav'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function HelpButton() {
  const item = findNav(usePathname())?.item
  if (!item) return null
  return (
    <Popover>
      <PopoverTrigger
        aria-label="도움말"
        className="fixed right-4 bottom-4 z-40 flex size-11 items-center justify-center rounded-full border bg-white text-xl text-slate-700 shadow-md hover:bg-slate-50 print:hidden"
      >
        ?
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-96 break-keep print:hidden">
        <div className="font-semibold">{item.label} 도움말</div>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          {item.help.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
