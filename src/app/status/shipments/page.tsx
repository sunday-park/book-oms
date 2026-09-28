'use client'

import { useMemo, useState } from 'react'
import { EntityCombobox } from '@/components/entity-combobox'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { Code, ColHead, EmptyRow } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery } from '@/hooks/use-query'
import { listShipmentStatus } from '@/lib/actions/inventory'
import { listBookstores, listPublishers } from '@/lib/actions/master'
import { today, won } from '@/lib/format'
import { pubOptions, storeOptions } from '@/lib/options'
import type { Bookstore, Publisher } from '@/lib/repo/master'
import type { ShipmentStatusRow } from '@/lib/repo/reports'

const initFilter = () => ({ date: today(), pubId: null as number | null, storeId: null as number | null })

export default function ShipmentStatusPage() {
  const [f, setF] = useState(initFilter)
  const pubs = useQuery(listPublishers, [], [] as Publisher[])
  const stores = useQuery(listBookstores, [], [] as Bookstore[])
  const list = useQuery(
    () => listShipmentStatus({ date: f.date, publisherId: f.pubId ?? undefined, bookstoreId: f.storeId ?? undefined }),
    [f],
    [] as ShipmentStatusRow[],
  )
  const total = useMemo(() => list.data.reduce((s, r) => s + r.qty, 0), [list.data])

  return (
    <>
      <PageHeader title="출고 현황" />
      <SearchBar onReset={() => setF(initFilter())} onSearch={list.reload}>
        <Field label="날짜">
          <Input type="date" className="w-40" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="출판사">
          <EntityCombobox label="출판사" allLabel="전체" options={pubOptions(pubs.data)} value={f.pubId} onChange={(v) => setF({ ...f, pubId: v })} />
        </Field>
        <Field label="서점">
          <EntityCombobox label="서점" allLabel="전체" options={storeOptions(stores.data)} value={f.storeId} onChange={(v) => setF({ ...f, storeId: v })} />
        </Field>
      </SearchBar>
      <ListCard title="출고 내역" count={`${list.data.length}건`}>
        <Table>
          <TableHeader>
            <TableRow>
              <ColHead>도서코드</ColHead>
              <ColHead>도서명</ColHead>
              <ColHead>날짜</ColHead>
              <ColHead>출판사</ColHead>
              <ColHead>서점</ColHead>
              <ColHead>구분</ColHead>
              <ColHead>출고부수</ColHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Code>{r.book_code}</Code></TableCell>
                <TableCell className="font-semibold">{r.book_name}</TableCell>
                <TableCell className="font-mono text-sm">{r.date}</TableCell>
                <TableCell>{r.publisher_name}</TableCell>
                <TableCell>{r.bookstore_name}</TableCell>
                <TableCell>{r.kind}</TableCell>
                <TableCell className="text-right">{won(r.qty)}</TableCell>
              </TableRow>
            ))}
            <EmptyRow show={list.data.length === 0} cols={7} />
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6}>총 출고부수</TableCell>
              <TableCell className="text-right">{won(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </ListCard>
    </>
  )
}
