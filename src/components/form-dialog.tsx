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
      <DialogContent className="gap-6 p-7 text-base sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 [&_[role=combobox]]:w-full">{children}</div>
        <DialogFooter className="-mx-7 -mb-7 items-center gap-2.5 px-7 py-5">
          <div className="mr-auto flex items-center gap-2">
            {onDelete && (
              <Button variant="danger" onClick={onDelete}>
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
