import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'

export function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      {onEdit && <Button size="sm" variant="ghost" onClick={onEdit}>수정</Button>}
      <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>삭제</Button>
    </div>
  )
}

export function EmptyRow({ show, cols }: { show: boolean; cols: number }) {
  if (!show) return null
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-24 text-center text-muted-foreground">조회된 데이터가 없습니다.</TableCell>
    </TableRow>
  )
}
