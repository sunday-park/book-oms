'use client'

import { Printer } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EntityCombobox } from '@/components/entity-combobox'
import { PageHeader } from '@/components/page-header'
import { Notice, PrintSheet } from '@/components/print-sheet'
import { Field, SearchBar } from '@/components/search-bar'
import { KindBadge } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { none, useQuery } from '@/hooks/use-query'
import { listUnprinted, markPrinted } from '@/lib/actions/inventory'
import { listBookstores, listPublishers } from '@/lib/actions/master'
import { today, won } from '@/lib/format'
import { pubOptions, storeOptions } from '@/lib/options'
import type { ShipmentItem } from '@/lib/repo/inventory'
import type { Bookstore, Publisher } from '@/lib/repo/master'

export default function StatementPrintPage() {
  const [date, setDate] = useState(today)
  const [pubId, setPubId] = useState<number | null>(null)
  const [storeId, setStoreId] = useState<number | null>(null)
  const pubs = useQuery(listPublishers, [], [] as Publisher[], 'publishers')
  const stores = useQuery(listBookstores, [], [] as Bookstore[], 'bookstores')
  const items = useQuery(
    () => (pubId && storeId ? listUnprinted(date, pubId, storeId) : none([] as ShipmentItem[])),
    [date, pubId, storeId],
    [] as ShipmentItem[],
    'unprinted',
  )
  const pub = pubs.data.find((p) => p.id === pubId)
  const store = stores.data.find((s) => s.id === storeId)
  const totalQty = items.data.reduce((s, i) => s + i.qty, 0)
  const totalAmount = items.data.reduce((s, i) => s + i.amount, 0)

  async function print() {
    window.print()
    if (!confirm('인쇄를 마쳤나요? 확인하면 이 도서들은 다음 출력에서 제외됩니다.')) return
    const r = await markPrinted(items.data.map((i) => i.id))
    if (!r.ok) return toast.error(r.error)
    items.reload()
  }

  return (
    <>
      <PageHeader title="명세서 출력">
        <Button onClick={print} disabled={items.data.length === 0}>
          <Printer />
          출력
        </Button>
      </PageHeader>
      <SearchBar
        onReset={() => {
          setDate(today())
          setPubId(null)
          setStoreId(null)
        }}
        onSearch={items.reload}
      >
        <Field label="날짜">
          <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="출판사 *">
          <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={pubId} onChange={setPubId} />
        </Field>
        <Field label="서점 *">
          <EntityCombobox label="서점" options={storeOptions(stores.data)} value={storeId} onChange={setStoreId} />
        </Field>
      </SearchBar>
      {!pub || !store ? (
        <Notice>출판사와 서점을 선택하세요.</Notice>
      ) : items.data.length === 0 ? (
        <Notice>새로 추가된 도서 없음</Notice>
      ) : (
        <PrintSheet title="거래명세서" meta={<div className="text-right">일자: {date}</div>}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded border p-3">
              <div className="mb-1 font-semibold">공급자</div>
              <div>{pub.name}</div>
              <div>전화 {pub.phone || '-'} / 팩스 {pub.fax || '-'}</div>
              {pub.biz_no && <div>사업자번호 {pub.biz_no}</div>}
            </div>
            <div className="rounded border p-3">
              <div className="mb-1 font-semibold">공급받는자</div>
              <div>{store.name}</div>
              <div>{store.region}</div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>도서코드</TableHead>
                <TableHead>도서명</TableHead>
                <TableHead className="text-right">정가</TableHead>
                <TableHead className="text-right">출고율</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">부수</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>구분</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.data.map((it, i) => (
                <TableRow key={it.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{it.book_code}</TableCell>
                  <TableCell>{it.book_name}</TableCell>
                  <TableCell className="text-right">{won(it.list_price)}</TableCell>
                  <TableCell className="text-right">{it.rate}%</TableCell>
                  <TableCell className="text-right">{won(it.unit_price)}</TableCell>
                  <TableCell className="text-right">{won(it.qty)}</TableCell>
                  <TableCell className="text-right">{won(it.amount)}</TableCell>
                  <TableCell><KindBadge kind={it.kind} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6}>합계</TableCell>
                <TableCell className="text-right">{won(totalQty)}</TableCell>
                <TableCell className="text-right text-base">{won(totalAmount)}원</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </PrintSheet>
      )}
    </>
  )
}
