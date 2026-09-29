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
        // 선택 막대·포커스 테두리는 globals.css 의 .selectable-row 참고
        'selectable-row cursor-pointer outline-none hover:bg-slate-50 data-[state=selected]:bg-selected data-[state=selected]:font-semibold data-[state=selected]:text-slate-950 data-[state=selected]:hover:bg-selected',
        className,
      )}
      {...props}
    />
  )
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      <Plus />
      등록
    </Button>
  )
}

export function EditButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" disabled={disabled} onClick={onClick}>
      <Pencil />
      수정
    </Button>
  )
}

export function DeleteButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="danger" disabled={disabled} onClick={onClick}>
      <Trash2 />
      삭제
    </Button>
  )
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="font-mono text-sm text-muted-foreground">{children}</span>
}

export function EmptyRow({ show, cols }: { show: boolean; cols: number }) {
  if (!show) return null
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-24! text-center text-muted-foreground">조회된 데이터가 없습니다.</TableCell>
    </TableRow>
  )
}
