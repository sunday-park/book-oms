'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EntityCombobox } from '@/components/entity-combobox'
import { FormDialog } from '@/components/form-dialog'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { TONE_TEXT } from '@/components/status'
import { AddButton, Code, ColHead, DeleteButton, EmptyRow, SelectableRow } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table'
import { none, useQuery } from '@/hooks/use-query'
import { createReceipt, deleteReceipt, listReceipts } from '@/lib/actions/inventory'
import { listBooks, listPublishers } from '@/lib/actions/master'
import { today, won } from '@/lib/format'
import { bookOptions, pubOptions } from '@/lib/options'
import type { Receipt } from '@/lib/repo/inventory'
import type { Book, Publisher } from '@/lib/repo/master'

const initFilter = () => ({ from: today(), to: today(), pubId: null as number | null, bookId: null as number | null })
type Form = { date: string; publisher_id: number | null; book_id: number | null; qty: number }

export default function ReceiptsPage() {
  const [f, setF] = useState(initFilter)
  const pubs = useQuery(listPublishers, [], [] as Publisher[])
  const books = useQuery(() => listBooks(f.pubId ?? undefined), [f.pubId], [] as Book[])
  const list = useQuery(
    () => listReceipts({ from: f.from, to: f.to, publisherId: f.pubId ?? undefined, bookId: f.bookId ?? undefined }),
    [f],
    [] as Receipt[],
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
    const r = await createReceipt({ date: form.date, book_id: form.book_id, qty: form.qty })
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
  async function remove(r: Receipt) {
    if (!confirm(`${r.date} '${r.book_name}' ${r.qty}부 입고를 삭제할까요?`)) return
    const res = await deleteReceipt(r.id)
    if (!res.ok) return toast.error(res.error)
    setSelId(null)
    list.reload()
  }

  return (
    <>
      <PageHeader title="입고 관리" />
      <SearchBar onReset={() => setF(initFilter())} onSearch={list.reload}>
        <Field label="시작일">
          <Input type="date" className="w-40" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </Field>
        <Field label="종료일">
          <Input type="date" className="w-40" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </Field>
        <Field label="출판사">
          <EntityCombobox label="출판사" allLabel="전체" options={pubOptions(pubs.data)} value={f.pubId} onChange={(v) => setF({ ...f, pubId: v, bookId: null })} />
        </Field>
        <Field label="도서">
          <EntityCombobox label="도서" allLabel="전체" options={bookOptions(books.data)} value={f.bookId} onChange={(v) => setF({ ...f, bookId: v })} />
        </Field>
      </SearchBar>
      <ListCard
        title="입고 내역"
        count={`${list.data.length}건`}
        actions={
          <>
            <DeleteButton disabled={!selected} onClick={() => selected && remove(selected)} />
            <AddButton
              onClick={() => {
                setError('')
                setForm({ date: today(), publisher_id: f.pubId, book_id: null, qty: 0 })
              }}
            />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ColHead>입고일자</ColHead>
              <ColHead>출판사</ColHead>
              <ColHead>도서코드</ColHead>
              <ColHead>도서명</ColHead>
              <ColHead className="text-right">입고부수</ColHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((r) => (
              <SelectableRow key={r.id} selected={r.id === selId} onSelect={() => setSelId(r.id)}>
                <TableCell className="font-mono text-sm">{r.date}</TableCell>
                <TableCell>{r.publisher_name}</TableCell>
                <TableCell><Code>{r.book_code}</Code></TableCell>
                <TableCell className="font-semibold">{r.book_name}</TableCell>
                <TableCell className={`text-right font-semibold ${TONE_TEXT.receipt}`}>{won(r.qty)}</TableCell>
              </SelectableRow>
            ))}
            <EmptyRow show={list.data.length === 0} cols={5} />
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>총 입고부수</TableCell>
              <TableCell className="text-right">{won(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </ListCard>
      <FormDialog open={!!form} title="입고 등록" error={error} onClose={() => setForm(null)} onSave={save}>
        {form && (
          <>
            <Field label="입고일자 *">
              <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
            </Field>
            <Field label="출판사 *">
              <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={form.publisher_id} onChange={(v) => patch({ publisher_id: v, book_id: null })} />
            </Field>
            <Field label="도서 *">
              <EntityCombobox label="도서" placeholder="출판사 먼저 선택" options={bookOptions(formBooks.data)} value={form.book_id} onChange={(v) => patch({ book_id: v })} />
            </Field>
            <Field label="입고부수 *">
              <Input type="number" min={1} value={form.qty} onChange={(e) => patch({ qty: Number(e.target.value) })} />
            </Field>
          </>
        )}
      </FormDialog>
    </>
  )
}
