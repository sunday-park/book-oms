'use client'

import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Notice, PrintSheet } from '@/components/print-sheet'
import { Field, SearchBar } from '@/components/search-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { none, useQuery } from '@/hooks/use-query'
import { listDispatch } from '@/lib/actions/inventory'
import { listPublishers } from '@/lib/actions/master'
import { today, won } from '@/lib/format'
import type { Publisher } from '@/lib/repo/master'
import type { DispatchGroup } from '@/lib/repo/reports'

export default function DispatchPage() {
  const [date, setDate] = useState(today)
  const pubs = useQuery(listPublishers, [], [] as Publisher[])
  const [pubId, setPubId] = useState<number | null>(null)
  useEffect(() => {
    if (pubId === null && pubs.data.length) setPubId(pubs.data[0].id)
  }, [pubs.data, pubId])
  const groups = useQuery(() => (pubId ? listDispatch(date, pubId) : none([] as DispatchGroup[])), [date, pubId], [] as DispatchGroup[])
  const pub = pubs.data.find((p) => p.id === pubId)
  const grand = groups.data.reduce((s, g) => s + g.total, 0)

  return (
    <>
      <PageHeader title="출고증">
        <Button className="h-10 gap-1.5 px-4 text-[15px] font-semibold" onClick={() => window.print()} disabled={groups.data.length === 0}>
          <Printer />
          출력
        </Button>
      </PageHeader>
      <SearchBar
        onReset={() => {
          setDate(today())
          setPubId(pubs.data[0]?.id ?? null)
        }}
        onSearch={groups.reload}
      >
        <Field label="날짜">
          <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="출판사 *">
          <Select value={pubId ? String(pubId) : ''} onValueChange={(v) => setPubId(Number(v))}>
            <SelectTrigger className="w-56" aria-label="출판사">
              <SelectValue placeholder="출판사 선택" />
            </SelectTrigger>
            <SelectContent>
              {pubs.data.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </SearchBar>
      {!pub ? (
        <Notice>출판사를 선택하세요.</Notice>
      ) : groups.data.length === 0 ? (
        <Notice>출고 내역이 없습니다.</Notice>
      ) : (
        <PrintSheet
          title="출고증"
          meta={
            <div className="flex justify-between">
              <span>출판사: {pub.name}</span>
              <span>일자: {date}</span>
            </div>
          }
        >
          {groups.data.map((g) => (
            <div key={g.bookstore_id} className="space-y-1 break-inside-avoid">
              <h3 className="font-semibold">
                {g.bookstore_name} <span className="text-sm font-normal text-muted-foreground">({g.region})</span>
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>도서코드</TableHead>
                    <TableHead>도서명</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead className="text-right">부수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.book_code}</TableCell>
                      <TableCell>{it.book_name}</TableCell>
                      <TableCell>{it.kind}</TableCell>
                      <TableCell className="text-right">{won(it.qty)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>소계</TableCell>
                    <TableCell className="text-right">{won(g.total)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ))}
          <p className="text-right font-semibold">총 출고부수 {won(grand)}부</p>
        </PrintSheet>
      )}
    </>
  )
}
