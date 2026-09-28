'use client'

import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EntityCombobox } from '@/components/entity-combobox'
import { PageHeader } from '@/components/page-header'
import { Notice } from '@/components/print-sheet'
import { Field, SearchBar } from '@/components/search-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { none, useQuery } from '@/hooks/use-query'
import { deleteShipment, getShipment, saveShipment } from '@/lib/actions/inventory'
import { listBookstores, listBooks, listPublishers } from '@/lib/actions/master'
import { calcAmount, calcUnitPrice, DEFAULT_RATE, SHIP_KINDS, type ShipKind } from '@/lib/domain'
import { today, won } from '@/lib/format'
import { bookOptions, pubOptions, storeOptions } from '@/lib/options'
import type { Book, Bookstore, Publisher } from '@/lib/repo/master'

type Row = {
  key: string
  id?: number
  book_id: number | null
  rate: number
  kind: ShipKind
  qty: number
  snapshot?: { book_id: number; list_price: number }
  printed: boolean
}
const newRow = (): Row => ({ key: crypto.randomUUID(), book_id: null, rate: DEFAULT_RATE, kind: '위탁', qty: 0, printed: false })

export default function ShipmentEntryPage() {
  const [date, setDate] = useState(today)
  const [pubId, setPubId] = useState<number | null>(null)
  const [storeId, setStoreId] = useState<number | null>(null)
  const [shipmentId, setShipmentId] = useState<number | null>(null)
  const [rows, setRows] = useState<Row[]>(() => [newRow()])
  const [error, setError] = useState('')
  const pubs = useQuery(listPublishers, [], [] as Publisher[])
  const stores = useQuery(listBookstores, [], [] as Bookstore[])
  const books = useQuery(() => (pubId ? listBooks(pubId) : none([] as Book[])), [pubId], [] as Book[])
  const bookMap = useMemo(() => new Map(books.data.map((b) => [b.id, b])), [books.data])

  // 같은 날짜·출판사·서점 출고가 있으면 불러와 이어서 편집
  const load = useCallback(async () => {
    setError('')
    if (!pubId || !storeId) {
      setShipmentId(null)
      setRows([newRow()])
      return
    }
    const r = await getShipment(date, pubId, storeId)
    if (!r.ok) return void toast.error(r.error)
    setShipmentId(r.data?.id ?? null)
    setRows(
      r.data?.items.length
        ? r.data.items.map((it) => ({
            key: String(it.id),
            id: it.id,
            book_id: it.book_id,
            rate: it.rate,
            kind: it.kind,
            qty: it.qty,
            snapshot: { book_id: it.book_id, list_price: it.list_price },
            printed: !!it.printed_at,
          }))
        : [newRow()],
    )
  }, [date, pubId, storeId])
  useEffect(() => {
    void load()
  }, [load])

  // 기존 행은 저장 당시 정가, 새 행·도서를 바꾼 행은 현재 정가
  const priceOf = (r: Row) =>
    r.snapshot && r.snapshot.book_id === r.book_id ? r.snapshot.list_price : r.book_id ? (bookMap.get(r.book_id)?.list_price ?? 0) : 0
  const calc = rows.map((r) => {
    const listPrice = priceOf(r)
    const unit = calcUnitPrice(listPrice, r.rate)
    return { listPrice, unit, amount: calcAmount(unit, r.qty) }
  })
  const totalQty = rows.reduce((s, r) => s + r.qty, 0)
  const totalAmount = calc.reduce((s, c) => s + c.amount, 0)
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function save() {
    const r = await saveShipment({
      date,
      publisher_id: pubId,
      bookstore_id: storeId,
      items: rows.map(({ id, book_id, rate, kind, qty }) => ({ id, book_id, rate, kind, qty })),
    })
    if (!r.ok) return setError(r.error)
    toast.success('저장했습니다.')
    r.data.warnings.forEach((w) => toast.warning(`재고 부족 — ${w}`))
    void load()
  }
  async function remove() {
    if (!shipmentId) return setRows([newRow()])
    if (!confirm('이 출고 명세를 삭제할까요?')) return
    const r = await deleteShipment(shipmentId)
    if (!r.ok) return toast.error(r.error)
    toast.success('삭제했습니다.')
    void load()
  }

  return (
    <>
      <PageHeader title="출고 입력" />
      <SearchBar
        onReset={() => {
          setDate(today())
          setPubId(null)
          setStoreId(null)
        }}
        onSearch={load}
      >
        <Field label="날짜">
          <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="출판사">
          <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={pubId} onChange={setPubId} />
        </Field>
        <Field label="서점">
          <EntityCombobox label="서점" options={storeOptions(stores.data)} value={storeId} onChange={setStoreId} />
        </Field>
      </SearchBar>
      {!pubId || !storeId ? (
        <Notice>출판사와 서점을 선택하세요.</Notice>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">No</TableHead>
                <TableHead>도서코드</TableHead>
                <TableHead>도서명</TableHead>
                <TableHead className="text-right">정가</TableHead>
                <TableHead className="w-24">출고율(%)</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead className="w-28">구분</TableHead>
                <TableHead className="w-24">부수</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.key}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    {r.book_id ? bookMap.get(r.book_id)?.code : ''}
                    {r.printed && <Badge variant="secondary" className="ml-2">인쇄됨</Badge>}
                  </TableCell>
                  <TableCell>
                    <EntityCombobox label={`${i + 1}행 도서`} placeholder="도서 선택" options={bookOptions(books.data)} value={r.book_id} onChange={(v) => update(r.key, { book_id: v })} />
                  </TableCell>
                  <TableCell className="text-right">{won(calc[i].listPrice)}</TableCell>
                  <TableCell>
                    <Input aria-label={`${i + 1}행 출고율`} type="number" min={0} max={100} step="0.1" value={r.rate} onChange={(e) => update(r.key, { rate: Number(e.target.value) })} />
                  </TableCell>
                  <TableCell className="text-right">{won(calc[i].unit)}</TableCell>
                  <TableCell className="text-right">{won(calc[i].amount)}</TableCell>
                  <TableCell>
                    <Select value={r.kind} onValueChange={(v) => update(r.key, { kind: v as ShipKind })}>
                      <SelectTrigger aria-label={`${i + 1}행 구분`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIP_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`${i + 1}행 부수`} type="number" min={0} value={r.qty} onChange={(e) => update(r.key, { qty: Number(e.target.value) })} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${i + 1}행 삭제`}
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [newRow()]))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6}>합계</TableCell>
                <TableCell className="text-right">{won(totalAmount)}</TableCell>
                <TableCell />
                <TableCell>총 {won(totalQty)}부</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setRows((rs) => [...rs, newRow()])}>+ 행 추가</Button>
            <div className="ml-auto flex items-center gap-2">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button variant="outline" onClick={load}>취소</Button>
              <Button variant="outline" className="text-destructive" onClick={remove}>삭제</Button>
              <Button onClick={save}>저장</Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
