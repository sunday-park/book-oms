'use client'

import { useEffect, useMemo, useState } from 'react'
import { EntityCombobox } from '@/components/entity-combobox'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { SearchInput } from '@/components/search-input'
import { StockQty } from '@/components/status'
import { Code, ColHead, EmptyRow } from '@/components/table-helpers'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { none, useQuery } from '@/hooks/use-query'
import { listStock } from '@/lib/actions/inventory'
import { listPublishers } from '@/lib/actions/master'
import { won } from '@/lib/format'
import { pubOptions } from '@/lib/options'
import type { Publisher } from '@/lib/repo/master'
import type { StockRow } from '@/lib/repo/reports'

export default function StockStatusPage() {
  const pubs = useQuery(listPublishers, [], [] as Publisher[])
  const [pubId, setPubId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState('')
  useEffect(() => {
    if (pubId === null && pubs.data.length) setPubId(pubs.data[0].id)
  }, [pubs.data, pubId])

  const stock = useQuery(() => (pubId ? listStock(pubId) : none([] as StockRow[])), [pubId], [] as StockRow[])
  const rows = useMemo(() => {
    const kw = keyword.toLowerCase()
    return stock.data.filter((r) => r.name.toLowerCase().includes(kw) || r.code.toLowerCase().includes(kw))
  }, [stock.data, keyword])

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
        <Field label="출판사 *">
          <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={pubId} onChange={setPubId} />
        </Field>
        <Field label="도서" className="flex-1">
          <SearchInput value={keyword} onChange={setKeyword} suggestions={stock.data.map((r) => r.name)} placeholder="도서명 또는 코드" />
        </Field>
      </SearchBar>
      <ListCard title="도서별 재고" count={`${rows.length}종`}>
        <Table>
          <TableHeader>
            <TableRow>
              <ColHead>도서코드</ColHead>
              <ColHead>도서명</ColHead>
              <ColHead className="text-right">입고</ColHead>
              <ColHead className="text-right">출고</ColHead>
              <ColHead className="text-right">반품</ColHead>
              <ColHead className="text-right">현재고</ColHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.book_id}>
                <TableCell><Code>{r.code}</Code></TableCell>
                <TableCell className="font-semibold">{r.name}</TableCell>
                <TableCell className="text-right">{won(r.received)}</TableCell>
                <TableCell className="text-right">{won(r.shipped)}</TableCell>
                <TableCell className="text-right">{won(r.returned)}</TableCell>
                <TableCell className="text-right"><StockQty value={r.stock} /></TableCell>
              </TableRow>
            ))}
            <EmptyRow show={rows.length === 0} cols={6} />
          </TableBody>
        </Table>
      </ListCard>
    </>
  )
}
