'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EntityCombobox } from '@/components/entity-combobox'
import { FormDialog } from '@/components/form-dialog'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { AddButton, Code, ColHead, DeleteButton, EmptyRow, SelectableRow } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table'
import { none, useQuery } from '@/hooks/use-query'
import { createReturn, deleteReturn, listReturns } from '@/lib/actions/inventory'
import { listBookstores, listBooks, listPublishers } from '@/lib/actions/master'
import { today, won } from '@/lib/format'
import { bookOptions, pubOptions, storeOptions } from '@/lib/options'
import type { ReturnRow } from '@/lib/repo/inventory'
import type { Book, Bookstore, Publisher } from '@/lib/repo/master'

const initFilter = () => ({ from: today(), to: today(), pubId: null as number | null, storeId: null as number | null })
type Form = { date: string; publisher_id: number | null; bookstore_id: number | null; book_id: number | null; qty: number }

export default function ReturnsPage() {
  const [f, setF] = useState(initFilter)
  const pubs = useQuery(listPublishers, [], [] as Publisher[])
  const stores = useQuery(listBookstores, [], [] as Bookstore[])
  const list = useQuery(
    () => listReturns({ from: f.from, to: f.to, publisherId: f.pubId ?? undefined, bookstoreId: f.storeId ?? undefined }),
    [f],
    [] as ReturnRow[],
  )
  const total = useMemo(() => list.data.reduce((s, r) => s + r.qty, 0), [list.data])
  const [selId, setSelId] = useState<number | null>(null)
  const selected = list.data.find((r) => r.id === selId)

  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const formBooks = useQuery(() => (form?.publisher_id ? listBooks(form.publisher_id) : none([] as Book[])), [form?.publisher_id], [] as Book[])
  const patch = (p: Partial<Form>) => setForm((x) => x && { ...x, ...p })

  async function save() {
    if (!form) return
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
          <Input type="date" className="w-40" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </Field>
        <Field label="종료일">
          <Input type="date" className="w-40" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
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
        <Table>
          <TableHeader>
            <TableRow>
              <ColHead>반품날짜</ColHead>
              <ColHead>출판사</ColHead>
              <ColHead>서점</ColHead>
              <ColHead>도서코드</ColHead>
              <ColHead>도서명</ColHead>
              <ColHead>부수</ColHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((r) => (
              <SelectableRow key={r.id} selected={r.id === selId} onSelect={() => setSelId(r.id)}>
                <TableCell className="font-mono text-sm">{r.date}</TableCell>
                <TableCell>{r.publisher_name}</TableCell>
                <TableCell>{r.bookstore_name}</TableCell>
                <TableCell><Code>{r.book_code}</Code></TableCell>
                <TableCell className="font-semibold">{r.book_name}</TableCell>
                <TableCell className="text-right">{won(r.qty)}</TableCell>
              </SelectableRow>
            ))}
            <EmptyRow show={list.data.length === 0} cols={6} />
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>총 반품부수</TableCell>
              <TableCell className="text-right">{won(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
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
            <p className="text-xs text-muted-foreground">반품 부수는 재고에 합산됩니다.</p>
          </>
        )}
      </FormDialog>
    </>
  )
}
