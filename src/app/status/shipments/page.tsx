'use client'

import { useMemo, useState } from 'react'
import { EntityCombobox } from '@/components/entity-combobox'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { EmptyRow } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>도서코드</TableHead>
            <TableHead>도서명</TableHead>
            <TableHead>날짜</TableHead>
            <TableHead>출판사</TableHead>
            <TableHead>서점</TableHead>
            <TableHead>구분</TableHead>
            <TableHead className="text-right">출고부수</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.data.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.book_code}</TableCell>
              <TableCell>{r.book_name}</TableCell>
              <TableCell>{r.date}</TableCell>
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
    </>
  )
}
