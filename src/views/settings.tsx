'use client'

import { Copy, DatabaseBackup, FolderOpen, History } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field } from '@/components/search-bar'
import { ColHead } from '@/components/table-helpers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { clearQueryCache, useQuery } from '@/hooks/use-query'
import { backupNow, getDbInfo, listBackups, openBackupFolder, openDbFolder, restoreBackup } from '@/lib/actions/settings'
import { dateTime, fileSize } from '@/lib/format'
import type { BackupFile, DbInfo } from '@/lib/repo/settings'
import type { Result } from '@/lib/result'

const CONFIRM_WORD = '복원'

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{children}</div>
    </div>
  )
}

/** 실패면 오류 토스트를 띄우고 false */
function ok<T>(r: Result<T>): r is { ok: true; data: T } {
  if (!r.ok) toast.error(r.error)
  return r.ok
}

export default function SettingsPage() {
  const { data: info, reload: reloadInfo } = useQuery(getDbInfo, [], null as DbInfo | null)
  const { data: backups, reload: reloadBackups } = useQuery(listBackups, [], [] as BackupFile[])
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  async function copyPath() {
    if (!info) return
    try {
      await navigator.clipboard.writeText(info.path)
      toast.success('복사했습니다')
    } catch {
      toast.error('복사하지 못했습니다.')
    }
  }

  async function backup() {
    setBusy(true)
    const r = await backupNow()
    setBusy(false)
    if (!ok(r)) return
    toast.success(`백업했습니다: ${r.data}`)
    reloadBackups()
    reloadInfo()
  }

  function askRestore(name: string) {
    if (!confirm(`현재 데이터를 이 백업(${name})으로 바꿉니다.\n복원 직전 데이터는 자동으로 백업됩니다. 계속할까요?`)) return
    setTyped('')
    setRestoring(name)
  }

  async function restore() {
    if (!restoring || typed !== CONFIRM_WORD) return
    setBusy(true)
    const r = await restoreBackup(restoring)
    if (!ok(r)) {
      setBusy(false)
      setRestoring(null)
      reloadBackups()
      return
    }
    clearQueryCache()
    toast.success('복원했습니다')
    // 모든 화면이 새 데이터로 다시 시작하도록 새로고침 (토스트를 잠깐 보여준 뒤)
    setTimeout(() => window.location.reload(), 800)
  }

  const c = info?.counts
  return (
    <>
      <PageHeader title="설정" />
      <ListCard
        title="DB 정보"
        actions={
          <>
            <Button variant="outline" disabled={!info} onClick={copyPath}>
              <Copy />
              경로 복사
            </Button>
            <Button variant="outline" onClick={async () => ok(await openDbFolder())}>
              <FolderOpen />
              폴더 열기
            </Button>
          </>
        }
      >
        <div className="grid gap-5 px-6 py-5">
          <div className="grid gap-2">
            <div className="text-[15px] font-medium text-secondary-foreground">DB 파일 위치</div>
            <code data-testid="db-path" className="rounded-lg border bg-muted px-4 py-3 font-mono text-base break-all select-all">
              {info?.path ?? '…'}
            </code>
            <div className="text-[15px] text-muted-foreground tabular-nums">
              파일 크기 <span className="font-semibold text-foreground">{info ? fileSize(info.size) : '…'}</span>
              <span className="mx-2">·</span>
              마지막 수정 <span className="font-semibold text-foreground">{info ? dateTime(info.mtime) : '…'}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
            <Stat label="출판사">{c?.publishers ?? '…'}</Stat>
            <Stat label="서점">{c?.bookstores ?? '…'}</Stat>
            <Stat label="도서">{c?.books ?? '…'}</Stat>
            <Stat label="입고">{c ? `${c.receipts}건` : '…'}</Stat>
            <Stat label="출고 명세 · 행">{c ? `${c.shipments}건 · ${c.shipment_items}행` : '…'}</Stat>
            <Stat label="반품">{c ? `${c.returns}건` : '…'}</Stat>
          </div>
        </div>
      </ListCard>

      <ListCard
        title="백업"
        count={`${backups.length}개`}
        actions={
          <>
            <Button variant="outline" onClick={async () => ok(await openBackupFolder())}>
              <FolderOpen />
              백업 폴더 열기
            </Button>
            <Button disabled={busy} onClick={backup}>
              <DatabaseBackup />
              지금 백업
            </Button>
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ColHead>파일명</ColHead>
              <ColHead className="w-48">시각</ColHead>
              <ColHead className="w-32">크기</ColHead>
              <ColHead className="w-32">복원</ColHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((b) => (
              <TableRow key={b.name}>
                <TableCell className="font-mono text-base">{b.name}</TableCell>
                <TableCell className="tabular-nums">{dateTime(b.mtime)}</TableCell>
                <TableCell className="text-right tabular-nums">{fileSize(b.size)}</TableCell>
                <TableCell className="text-center">
                  <Button variant="danger" className="h-9 px-3" disabled={busy} onClick={() => askRestore(b.name)}>
                    <History />
                    복원
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {backups.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24! text-center text-muted-foreground">백업이 없습니다.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ListCard>

      <Dialog open={!!restoring} onOpenChange={(o) => !o && !busy && setRestoring(null)}>
        <DialogContent className="gap-6 p-7 text-base sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>백업으로 복원</DialogTitle>
            <DialogDescription className="text-base">
              현재 데이터를 <span className="font-mono font-semibold text-foreground">{restoring}</span> 백업으로 바꿉니다. 되돌리려면 자동으로 만들어지는
              &apos;-before-restore&apos; 백업으로 다시 복원해야 합니다.
            </DialogDescription>
          </DialogHeader>
          <Field label={`계속하려면 '${CONFIRM_WORD}'를 입력하세요`}>
            <Input value={typed} autoFocus onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && restore()} />
          </Field>
          <DialogFooter className="-mx-7 -mb-7 gap-2.5 px-7 py-5">
            <Button variant="outline" disabled={busy} onClick={() => setRestoring(null)}>취소</Button>
            <Button variant="danger" disabled={busy || typed !== CONFIRM_WORD} onClick={restore}>복원</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
