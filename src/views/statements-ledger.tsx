'use client'

import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EntityCombobox } from '@/components/entity-combobox'
import { PageHeader } from '@/components/page-header'
import { Notice, PrintSheet } from '@/components/print-sheet'
import { Field, SearchBar } from '@/components/search-bar'
import { StockQty } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { none, useQuery } from '@/hooks/use-query'
import { listStock } from '@/lib/actions/inventory'
import { listPublishers } from '@/lib/actions/master'
import { won } from '@/lib/format'
import { pubOptions } from '@/lib/options'
import type { Publisher } from '@/lib/repo/master'
import type { StockRow } from '@/lib/repo/reports'

export default function LedgerPage() {
  const pubs = useQuery(listPublishers, [], [] as Publisher[], 'publishers')
  const [pubId, setPubId] = useState<number | null>(null)
  useEffect(() => {
    if (pubId === null && pubs.data.length) setPubId(pubs.data[0].id)
  }, [pubs.data, pubId])
  const stock = useQuery(() => (pubId ? listStock(pubId) : none([] as StockRow[])), [pubId], [] as StockRow[], 'stock')
  const pub = pubs.data.find((p) => p.id === pubId)
  const total = stock.data.reduce((s, r) => s + r.stock, 0)

  return (
    <>
      <PageHeader title="재고 원장">
        <Button onClick={() => window.print()} disabled={stock.data.length === 0}>
          <Printer />
          출력
        </Button>
      </PageHeader>
      <SearchBar onReset={() => setPubId(pubs.data[0]?.id ?? null)} onSearch={stock.reload}>
        <Field label="출판사 *">
          <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={pubId} onChange={setPubId} />
        </Field>
      </SearchBar>
      {!pub ? (
        <Notice>출판사를 선택하세요.</Notice>
      ) : (
        <PrintSheet
          title="재고 원장"
          meta={
            <div className="flex justify-between">
              <span>출판사: {pub.name}</span>
              <span>기준: {new Date().toLocaleString('ko-KR')}</span>
            </div>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>도서코드</TableHead>
                <TableHead>도서명</TableHead>
                <TableHead className="text-right">입고</TableHead>
                <TableHead className="text-right">출고</TableHead>
                <TableHead className="text-right">반품</TableHead>
                <TableHead className="text-right">재고부수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.data.map((r) => (
                <TableRow key={r.book_id}>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{won(r.received)}</TableCell>
                  <TableCell className="text-right">{won(r.shipped)}</TableCell>
                  <TableCell className="text-right">{won(r.returned)}</TableCell>
                  <TableCell className="text-right"><StockQty value={r.stock} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>총 재고부수</TableCell>
                <TableCell className="text-right text-base">{won(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </PrintSheet>
      )}
    </>
  )
}
