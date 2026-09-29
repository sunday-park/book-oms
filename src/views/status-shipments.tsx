'use client'

import { useMemo, useState } from 'react'
import { type Column, DataTable } from '@/components/data-table'
import { EntityCombobox } from '@/components/entity-combobox'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { KindBadge, TONE_TEXT } from '@/components/status'
import { Code } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { useQuery } from '@/hooks/use-query'
import { listShipmentStatus } from '@/lib/actions/inventory'
import { listBookstores, listPublishers } from '@/lib/actions/master'
import { today, won } from '@/lib/format'
import { pubOptions, storeOptions } from '@/lib/options'
import type { Bookstore, Publisher } from '@/lib/repo/master'
import type { ShipmentStatusRow } from '@/lib/repo/reports'

const initFilter = () => ({ date: today(), pubId: null as number | null, storeId: null as number | null })

const COLUMNS: Column<ShipmentStatusRow>[] = [
  { id: 'book_code', header: '도서코드', kind: 'code', cell: (r) => <Code>{r.book_code}</Code> },
  { id: 'book_name', header: '도서명', kind: 'name', className: 'font-semibold', title: (r) => r.book_name, cell: (r) => r.book_name },
  { id: 'date', header: '날짜', kind: 'date', cell: (r) => r.date },
  { id: 'publisher', header: '출판사', kind: 'text', title: (r) => r.publisher_name, cell: (r) => r.publisher_name },
  { id: 'bookstore', header: '서점', kind: 'text', title: (r) => r.bookstore_name, cell: (r) => r.bookstore_name },
  { id: 'kind', header: '구분', kind: 'badge', cell: (r) => <KindBadge kind={r.kind} /> },
  { id: 'qty', header: '출고부수', kind: 'qty', className: `font-semibold ${TONE_TEXT.ship}`, cell: (r) => won(r.qty) },
]

export default function ShipmentStatusPage() {
  const [f, setF] = useState(initFilter)
  const pubs = useQuery(listPublishers, [], [] as Publisher[], 'publishers')
  const stores = useQuery(listBookstores, [], [] as Bookstore[], 'bookstores')
  const list = useQuery(
    () => listShipmentStatus({ date: f.date, publisherId: f.pubId ?? undefined, bookstoreId: f.storeId ?? undefined }),
    [f],
    [] as ShipmentStatusRow[],
    'shipment-status',
  )
  const total = useMemo(() => list.data.reduce((s, r) => s + r.qty, 0), [list.data])
  const columns = useMemo(() => COLUMNS.map((c) => (c.id === 'qty' ? { ...c, footer: won(total) } : c)), [total])

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
        <DataTable tableId="shipment-status" columns={columns} rows={list.data} rowKey={(r) => r.id} footerLabel="총 출고부수" />
      </ListCard>
    </>
  )
}
