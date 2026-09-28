'use client'

import { useEffect, useMemo, useState } from 'react'
import { EntityCombobox } from '@/components/entity-combobox'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { SearchInput } from '@/components/search-input'
import { EmptyRow } from '@/components/table-helpers'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { none, useQuery } from '@/hooks/use-query'
import { listStock } from '@/lib/actions/inventory'
import { listPublishers } from '@/lib/actions/master'
import { won } from '@/lib/format'
import { pubOptions } from '@/lib/options'
import type { Publisher } from '@/lib/repo/master'
import type { StockRow } from '@/lib/repo/reports'
import { cn } from '@/lib/utils'

export default function StockStatusPage() {
  const pubs = useQuery(listPublishers, [], [] as Publisher[])
  const [pubId, setPubId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState('')
  useEffect(() => {
    if (pubId === null && pubs.data.length) setPubId(pubs.data[0].id)
  }, [pubs.data, pubId])

  const stock = useQuery(() => (pubId ? listStock(pubId) : none([] as StockRow[])), [pubId], [] as StockRow[])
  const rows = useMemo(() => stock.data.filter((r) => r.name.includes(keyword) || r.code.includes(keyword)), [stock.data, keyword])

  return (
    <>
      <PageHeader title="재고 현황" />
      <SearchBar
        onReset={() => {
          setPubId(pubs.data[0]?.id ?? null)
          setKeyword('')
        }}
        onSearch={stock.reload}
      >
        <Field label="출판사">
          <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={pubId} onChange={setPubId} />
        </Field>
        <Field label="도서">
          <SearchInput value={keyword} onChange={setKeyword} suggestions={stock.data.map((r) => r.name)} placeholder="도서명 또는 코드" />
        </Field>
      </SearchBar>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>도서코드</TableHead>
            <TableHead>도서명</TableHead>
            <TableHead className="text-right">입고</TableHead>
            <TableHead className="text-right">출고</TableHead>
            <TableHead className="text-right">반품</TableHead>
            <TableHead className="text-right">현재고</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.book_id}>
              <TableCell>{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell className="text-right">{won(r.received)}</TableCell>
              <TableCell className="text-right">{won(r.shipped)}</TableCell>
              <TableCell className="text-right">{won(r.returned)}</TableCell>
              <TableCell className={cn('text-right font-semibold', r.stock < 0 && 'text-destructive')}>{won(r.stock)}</TableCell>
            </TableRow>
          ))}
          <EmptyRow show={rows.length === 0} cols={6} />
        </TableBody>
      </Table>
    </>
  )
}
