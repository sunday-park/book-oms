'use client'

import { useEffect, useMemo, useState } from 'react'
import { type Column, DataTable } from '@/components/data-table'
import { EntityCombobox } from '@/components/entity-combobox'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { SearchInput } from '@/components/search-input'
import { StockQty } from '@/components/status'
import { Code } from '@/components/table-helpers'
import { none, useQuery } from '@/hooks/use-query'
import { listStock } from '@/lib/actions/inventory'
import { listPublishers } from '@/lib/actions/master'
import { won } from '@/lib/format'
import { pubOptions } from '@/lib/options'
import type { Publisher } from '@/lib/repo/master'
import type { StockRow } from '@/lib/repo/reports'

const COLUMNS: Column<StockRow>[] = [
  { id: 'code', header: '도서코드', kind: 'code', cell: (r) => <Code>{r.code}</Code> },
  { id: 'name', header: '도서명', kind: 'name', className: 'font-semibold', title: (r) => r.name, cell: (r) => r.name },
  { id: 'received', header: '입고', kind: 'qty', cell: (r) => won(r.received) },
  { id: 'shipped', header: '출고', kind: 'qty', cell: (r) => won(r.shipped) },
  { id: 'returned', header: '반품', kind: 'qty', cell: (r) => won(r.returned) },
  { id: 'stock', header: '현재고', kind: 'qty', cell: (r) => <StockQty value={r.stock} /> },
]

export default function StockStatusPage() {
  const pubs = useQuery(listPublishers, [], [] as Publisher[], 'publishers')
  const [pubId, setPubId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState('')
  useEffect(() => {
    if (pubId === null && pubs.data.length) setPubId(pubs.data[0].id)
  }, [pubs.data, pubId])

  const stock = useQuery(() => (pubId ? listStock(pubId) : none([] as StockRow[])), [pubId], [] as StockRow[], 'stock')
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
        <DataTable tableId="stock" columns={COLUMNS} rows={rows} rowKey={(r) => r.book_id} />
      </ListCard>
    </>
  )
}
