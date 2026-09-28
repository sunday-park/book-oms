'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EntityCombobox } from '@/components/entity-combobox'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { SearchInput } from '@/components/search-input'
import { EmptyRow, RowActions } from '@/components/table-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery } from '@/hooks/use-query'
import { createBook, deleteBook, listBooks, listPublishers, updateBook } from '@/lib/actions/master'
import { won } from '@/lib/format'
import { josa } from '@/lib/josa'
import { pubOptions } from '@/lib/options'
import type { Book, Publisher } from '@/lib/repo/master'

type Form = { id?: number; publisher_id: number | null; name: string; list_price: number }

export default function BooksPage() {
  const pubs = useQuery(listPublishers, [], [] as Publisher[])
  // undefined = 아직 첫 출판사로 초기화 전, null = 전체
  const [pubId, setPubId] = useState<number | null | undefined>(undefined)
  const [keyword, setKeyword] = useState('')
  useEffect(() => {
    if (pubId === undefined && pubs.data.length) setPubId(pubs.data[0].id)
  }, [pubs.data, pubId])

  const books = useQuery(() => listBooks(pubId ?? undefined), [pubId], [] as Book[])
  const rows = useMemo(() => {
    const kw = keyword.toLowerCase()
    return books.data.filter((b) => b.name.toLowerCase().includes(kw) || b.code.toLowerCase().includes(kw))
  }, [books.data, keyword])

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
    if (!r.ok) return toast.error(r.error)
    books.reload()
  }

  return (
    <>
      <PageHeader title="도서 관리">
        <Button onClick={() => open({ publisher_id: pubId ?? null, name: '', list_price: 0 })}>+ 도서 등록</Button>
      </PageHeader>
      <SearchBar
        onReset={() => {
          setPubId(pubs.data[0]?.id ?? null)
          setKeyword('')
        }}
        onSearch={books.reload}
      >
        <Field label="출판사">
          <EntityCombobox label="출판사" allLabel="전체" options={pubOptions(pubs.data)} value={pubId ?? null} onChange={setPubId} />
        </Field>
        <Field label="도서">
          <SearchInput value={keyword} onChange={setKeyword} suggestions={books.data.map((b) => b.name)} placeholder="도서명 또는 코드" />
        </Field>
      </SearchBar>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>도서코드</TableHead>
            <TableHead>도서명</TableHead>
            <TableHead>출판사</TableHead>
            <TableHead className="text-right">정가</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id}>
              <TableCell>{b.code}</TableCell>
              <TableCell>{b.name}</TableCell>
              <TableCell>{b.publisher_name}</TableCell>
              <TableCell className="text-right">{won(b.list_price)}</TableCell>
              <TableCell>
                <RowActions onEdit={() => open({ id: b.id, publisher_id: b.publisher_id, name: b.name, list_price: b.list_price })} onDelete={() => remove(b)} />
              </TableCell>
            </TableRow>
          ))}
          <EmptyRow show={rows.length === 0} cols={5} />
        </TableBody>
      </Table>
      <FormDialog open={!!form} title={form?.id ? '도서 수정' : '도서 등록'} error={error} onClose={() => setForm(null)} onSave={save}>
        {form && (
          <>
            <Field label="출판사 *">
              <EntityCombobox label="출판사" options={pubOptions(pubs.data)} value={form.publisher_id} onChange={(v) => patch({ publisher_id: v })} disabled={!!form.id} />
            </Field>
            <p className="text-xs text-muted-foreground">도서코드는 저장 시 출판사별 순번으로 자동 부여됩니다.</p>
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
