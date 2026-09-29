'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function FormDialog({ open, title, error, onClose, onSave, onDelete, children }: {
  open: boolean
  title: string
  error: string
  onClose: () => void
  onSave: () => void
  /** 수정 다이얼로그에서만 [삭제] 버튼을 보인다 */
  onDelete?: () => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-5 p-6 sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">{children}</div>
        <DialogFooter className="-mx-6 -mb-6 items-center gap-2 px-6 py-4">
          <div className="mr-auto flex items-center gap-2">
            {onDelete && (
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onDelete}>
                삭제
              </Button>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={onSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
