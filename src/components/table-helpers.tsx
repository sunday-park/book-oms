import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

/** 목록 표 머리칸 — 앞의 ⠿ 아이콘은 장식용 */
export function ColHead({ className, children, ...props }: ComponentProps<'th'>) {
  return (
    <TableHead className={className} {...props}>
      <span className="inline-flex items-center gap-2">
        <GripVertical aria-hidden className="size-3.5 text-slate-300" />
        {children}
      </span>
    </TableHead>
  )
}

/** 클릭하거나 포커스 후 Enter/Space 로 선택되는 행 */
export function SelectableRow({ selected, onSelect, className, ...props }: ComponentProps<'tr'> & { selected: boolean; onSelect: () => void }) {
  return (
    <TableRow
      data-state={selected ? 'selected' : undefined}
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'cursor-pointer outline-none hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[state=selected]:bg-[#e6edfb] data-[state=selected]:hover:bg-[#e6edfb]',
        className,
      )}
      {...props}
    />
  )
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button className="h-10 gap-1.5 px-4 text-[15px] font-semibold" onClick={onClick}>
      <Plus />
      등록
    </Button>
  )
}

export function EditButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" className="h-10 gap-1.5 border-[#c9d3e3] px-4 text-[15px] text-slate-700" disabled={disabled} onClick={onClick}>
      <Pencil />
      수정
    </Button>
  )
}

export function DeleteButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" className="h-10 gap-1.5 border-red-200 bg-white px-4 text-[15px] text-red-600 hover:bg-red-50 hover:text-red-700" disabled={disabled} onClick={onClick}>
      <Trash2 />
      삭제
    </Button>
  )
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="font-mono text-sm text-slate-500">{children}</span>
}

export function EmptyRow({ show, cols }: { show: boolean; cols: number }) {
  if (!show) return null
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-24! text-center text-muted-foreground">조회된 데이터가 없습니다.</TableCell>
    </TableRow>
  )
}
