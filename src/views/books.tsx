'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EntityCombobox } from '@/components/entity-combobox'
import { FormDialog } from '@/components/form-dialog'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { SearchInput } from '@/components/search-input'
import { AddButton, Code, ColHead, EditButton, EmptyRow, SelectableRow } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { useQuery } from '@/hooks/use-query'
import { createBook, deleteBook, listBooks, listPublishers, updateBook } from '@/lib/actions/master'
import { won } from '@/lib/format'
import { josa } from '@/lib/josa'
import { pubOptions } from '@/lib/options'
import type { Book, Publisher } from '@/lib/repo/master'

type Form = { id?: number; publisher_id: number | null; name: string; list_price: number }

export default function BooksPage() {
  const pubs = useQuery(listPublishers, [], [] as Publisher[], 'publishers')
  // undefined = 아직 첫 출판사로 초기화 전, null = 전체
  const [pubId, setPubId] = useState<number | null | undefined>(undefined)
  const [keyword, setKeyword] = useState('')
  useEffect(() => {
    if (pubId === undefined && pubs.data.length) setPubId(pubs.data[0].id)
  }, [pubs.data, pubId])

  const books = useQuery(() => listBooks(pubId ?? undefined), [pubId], [] as Book[], 'books/list')
  const rows = useMemo(() => {
    const kw = keyword.toLowerCase()
    return books.data.filter((b) => b.name.toLowerCase().includes(kw) || b.code.toLowerCase().includes(kw))
  }, [books.data, keyword])
  // 출판사별 묶음 (목록은 도서코드 순이라 출판사 순서대로 이어져 있다)
  const groups = useMemo(() => {
    const m = new Map<number, Book[]>()
    for (const b of rows) m.set(b.publisher_id, [...(m.get(b.publisher_id) ?? []), b])
    return [...m.values()]
  }, [rows])
  const [selId, setSelId] = useState<number | null>(null)
  const selected = rows.find((b) => b.id === selId)

  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const patch = (p: Partial<Form>) => setForm((f) => f && { ...f, ...p })
  const open = (f: Form) => {
    setError('')
    setForm(f)
  }

  async function save() {
    if (!form) return
    const input = { name: form.name, list_price: form.list_price }
    const r = form.id ? await updateBook(form.id, input) : await createBook({ ...input, publisher_id: form.publisher_id })
    if (!r.ok) return setError(r.error)
    toast.success('저장했습니다.')
    setForm(null)
    books.reload()
  }
  async function remove(b: Book) {
    if (!confirm(`'${b.name}'${josa(b.name, '을', '를')} 삭제할까요?`)) return
    const r = await deleteBook(b.id)
    if (!r.ok) return setError(r.error)
    toast.success('삭제했습니다.')
    setForm(null)
    setSelId(null)
    books.reload()
  }

  return (
    <>
      <PageHeader title="도서 관리" />
      <SearchBar
        onReset={() => {
          setPubId(pubs.data[0]?.id ?? null)
          setKeyword('')
        }}
        onSearch={books.reload}
      >
        <Field label="출판사 선택 *" className="[&_[role=combobox]]:w-72">
          <EntityCombobox label="출판사" allLabel="전체 출판사" options={pubOptions(pubs.data)} value={pubId ?? null} onChange={setPubId} />
        </Field>
        <Field label="도서명" className="flex-1">
          <SearchInput value={keyword} onChange={setKeyword} suggestions={books.data.map((b) => b.name)} placeholder="도서명 검색" />
        </Field>
      </SearchBar>
      <ListCard
        title="등록된 도서 목록"
        count={`${rows.length}종`}
        actions={
          <>
            <EditButton
              disabled={!selected}
              onClick={() => selected && open({ id: selected.id, publisher_id: selected.publisher_id, name: selected.name, list_price: selected.list_price })}
            />
            <AddButton onClick={() => open({ publisher_id: pubId ?? null, name: '', list_price: 0 })} />
          </>
        }
      >
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[84px]" />
            <col className="w-[195px]" />
            <col />
            <col className="w-[240px]" />
          </colgroup>
          {groups.map((g) => (
            <TableBody key={g[0].publisher_id}>
              <TableRow className="hover:bg-transparent">
                {/* 묶음 머리행·열 머리행은 스크롤 시 위에 고정되고, 다음 묶음이 올라오며 덮는다 */}
                <TableCell colSpan={4} className="sticky top-0 z-10 h-[50px]! border-r-0! bg-group-head">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-emphasis">{g[0].publisher_name}</span>
                    <span className="rounded-md border bg-card px-2 py-0.5 text-xs text-muted-foreground tabular-nums">{g[0].publisher_code}</span>
                    <span className="ml-auto text-[15px] text-muted-foreground">{g.length}종</span>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <ColHead className="top-[50px]!">순번</ColHead>
                <ColHead className="top-[50px]!">도서코드</ColHead>
                <ColHead className="top-[50px]!">도서명</ColHead>
                <ColHead className="top-[50px]! text-right">정가</ColHead>
              </TableRow>
              {g.map((b) => (
                <SelectableRow key={b.id} selected={b.id === selId} onSelect={() => setSelId(b.id)}>
                  <TableCell className="text-center">{b.seq}</TableCell>
                  <TableCell><Code>{b.code}</Code></TableCell>
                  <TableCell className="truncate font-bold">{b.name}</TableCell>
                  <TableCell className="text-right">{won(b.list_price)}원</TableCell>
                </SelectableRow>
              ))}
            </TableBody>
          ))}
          {rows.length === 0 && (
            <TableBody>
              <EmptyRow show cols={4} />
            </TableBody>
          )}
        </Table>
      </ListCard>
      <FormDialog
        open={!!form}
        title={form?.id ? '도서 수정' : '도서 등록'}
        error={error}
        onClose={() => setForm(null)}
        onSave={save}
        onDelete={form?.id && selected ? () => remove(selected) : undefined}
      >
        {form && (
          <>
            <Field label="출판사 *">
              <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={form.publisher_id} onChange={(v) => patch({ publisher_id: v })} disabled={!!form.id} />
            </Field>
            <p className="text-sm text-muted-foreground">도서코드는 저장 시 출판사별 순번으로 자동 부여됩니다.</p>
            <Field label="도서명 *">
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="정가 *">
              <Input type="number" min={0} value={form.list_price} onChange={(e) => patch({ list_price: Number(e.target.value) })} />
            </Field>
          </>
        )}
      </FormDialog>
    </>
  )
}
