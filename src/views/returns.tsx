'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { type Column, DataTable } from '@/components/data-table'
import { EntityCombobox } from '@/components/entity-combobox'
import { FormDialog } from '@/components/form-dialog'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { TONE_TEXT } from '@/components/status'
import { AddButton, Code, DeleteButton } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { none, useQuery } from '@/hooks/use-query'
import { createReturn, deleteReturn, listReturns } from '@/lib/actions/inventory'
import { listBookstores, listBooks, listPublishers } from '@/lib/actions/master'
import { confirmOddDate } from '@/lib/confirm-date'
import { rangeReady, setRange } from '@/lib/date-range'
import { today, won } from '@/lib/format'
import { bookOptions, pubOptions, storeOptions } from '@/lib/options'
import type { ReturnRow } from '@/lib/repo/inventory'
import type { Book, Bookstore, Publisher } from '@/lib/repo/master'

const initFilter = () => ({ from: today(), to: today(), pubId: null as number | null, storeId: null as number | null })
type Form = { date: string; publisher_id: number | null; bookstore_id: number | null; book_id: number | null; qty: number }

const COLUMNS: Column<ReturnRow>[] = [
  { id: 'date', header: '반품날짜', kind: 'date', cell: (r) => r.date },
  { id: 'publisher', header: '출판사', kind: 'text', title: (r) => r.publisher_name, cell: (r) => r.publisher_name },
  { id: 'bookstore', header: '서점', kind: 'text', title: (r) => r.bookstore_name, cell: (r) => r.bookstore_name },
  { id: 'book_code', header: '도서코드', kind: 'code', cell: (r) => <Code>{r.book_code}</Code> },
  { id: 'book_name', header: '도서명', kind: 'name', className: 'font-semibold', title: (r) => r.book_name, cell: (r) => r.book_name },
  { id: 'qty', header: '부수', kind: 'qty', className: `font-semibold ${TONE_TEXT.return}`, cell: (r) => won(r.qty) },
]

export default function ReturnsPage() {
  const [f, setF] = useState(initFilter)
  const pubs = useQuery(listPublishers, [], [] as Publisher[], 'publishers')
  const stores = useQuery(listBookstores, [], [] as Bookstore[], 'bookstores')
  const list = useQuery(
    () => (rangeReady(f) ? listReturns({ from: f.from, to: f.to, publisherId: f.pubId ?? undefined, bookstoreId: f.storeId ?? undefined }) : none([] as ReturnRow[])),
    [f],
    [] as ReturnRow[],
    'returns',
  )
  const total = useMemo(() => list.data.reduce((s, r) => s + r.qty, 0), [list.data])
  const columns = useMemo(() => COLUMNS.map((c) => (c.id === 'qty' ? { ...c, footer: won(total) } : c)), [total])
  const [selId, setSelId] = useState<number | null>(null)
  const selected = list.data.find((r) => r.id === selId)

  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const formBooks = useQuery(() => (form?.publisher_id ? listBooks(form.publisher_id) : none([] as Book[])), [form?.publisher_id], [] as Book[])
  const patch = (p: Partial<Form>) => setForm((x) => x && { ...x, ...p })

  async function save() {
    if (!form || !confirmOddDate(form.date)) return
    const r = await createReturn(form)
    if (!r.ok) return setError(r.error)
    toast.success('저장했습니다.')
    setForm(null)
    // 등록한 날짜가 현재 조회 기간 밖이면 새 행이 보이도록 기간을 넓힌다
    setF((prev) =>
      form.date >= prev.from && form.date <= prev.to
        ? prev
        : { ...prev, from: form.date < prev.from ? form.date : prev.from, to: form.date > prev.to ? form.date : prev.to },
    )
    list.reload()
  }
  async function remove(r: ReturnRow) {
    if (!confirm(`${r.date} '${r.book_name}' ${r.qty}부 반품을 삭제할까요?`)) return
    const res = await deleteReturn(r.id)
    if (!res.ok) return toast.error(res.error)
    setSelId(null)
    list.reload()
  }

  return (
    <>
      <PageHeader title="반품 관리" />
      <SearchBar onReset={() => setF(initFilter())} onSearch={list.reload}>
        <Field label="시작일">
          <Input type="date" className="w-40" value={f.from} max={f.to} onChange={(e) => setRange(f, { from: e.target.value }, setF)} />
        </Field>
        <Field label="종료일">
          <Input type="date" className="w-40" value={f.to} min={f.from} onChange={(e) => setRange(f, { to: e.target.value }, setF)} />
        </Field>
        <Field label="출판사">
          <EntityCombobox label="출판사" allLabel="전체" options={pubOptions(pubs.data)} value={f.pubId} onChange={(v) => setF({ ...f, pubId: v })} />
        </Field>
        <Field label="서점">
          <EntityCombobox label="서점" allLabel="전체" options={storeOptions(stores.data)} value={f.storeId} onChange={(v) => setF({ ...f, storeId: v })} />
        </Field>
      </SearchBar>
      <ListCard
        title="반품 내역"
        count={`${list.data.length}건`}
        actions={
          <>
            <DeleteButton disabled={!selected} onClick={() => selected && remove(selected)} />
            <AddButton
              onClick={() => {
                setError('')
                setForm({ date: today(), publisher_id: f.pubId, bookstore_id: f.storeId, book_id: null, qty: 0 })
              }}
            />
          </>
        }
      >
        <DataTable
          tableId="returns"
          columns={columns}
          rows={list.data}
          rowKey={(r) => r.id}
          selectedKey={selId}
          onSelect={(r) => setSelId(r.id)}
          footerLabel="총 반품부수"
        />
      </ListCard>
      <FormDialog open={!!form} title="반품 등록" error={error} onClose={() => setForm(null)} onSave={save}>
        {form && (
          <>
            <Field label="반품일자 *">
              <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
            </Field>
            <Field label="출판사 *">
              <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={form.publisher_id} onChange={(v) => patch({ publisher_id: v, book_id: null })} />
            </Field>
            <Field label="서점 *">
              <EntityCombobox label="서점" options={storeOptions(stores.data)} value={form.bookstore_id} onChange={(v) => patch({ bookstore_id: v })} />
            </Field>
            <Field label="도서 *">
              <EntityCombobox label="도서" placeholder="출판사 먼저 선택" options={bookOptions(formBooks.data)} value={form.book_id} onChange={(v) => patch({ book_id: v })} />
            </Field>
            <Field label="부수 *">
              <Input type="number" min={1} value={form.qty} onChange={(e) => patch({ qty: Number(e.target.value) })} />
            </Field>
            <p className="text-sm text-muted-foreground">반품 부수는 재고에 합산됩니다.</p>
          </>
        )}
      </FormDialog>
    </>
  )
}
