'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { SearchInput } from '@/components/search-input'
import { AddButton, Code, ColHead, EditButton, EmptyRow, SelectableRow } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery } from '@/hooks/use-query'
import { deletePublisher, listPublishers, savePublisher } from '@/lib/actions/master'
import { josa } from '@/lib/josa'
import type { Publisher, PublisherInput } from '@/lib/repo/master'

const EMPTY: PublisherInput = { code: '', name: '', phone: '', fax: '', biz_no: '' }

export default function PublishersPage() {
  const [keyword, setKeyword] = useState('')
  const { data, reload } = useQuery(listPublishers, [], [] as Publisher[], 'publishers')
  const rows = useMemo(() => {
    const kw = keyword.toLowerCase()
    return data.filter((p) => p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw))
  }, [data, keyword])
  const [selId, setSelId] = useState<number | null>(null)
  const selected = rows.find((p) => p.id === selId)

  const [edit, setEdit] = useState<{ id?: number; form: PublisherInput } | null>(null)
  const [error, setError] = useState('')
  const setForm = (patch: Partial<PublisherInput>) => setEdit((e) => e && { ...e, form: { ...e.form, ...patch } })
  const open = (id?: number, form: PublisherInput = EMPTY) => {
    setError('')
    setEdit({ id, form })
  }

  async function save() {
    if (!edit) return
    const r = await savePublisher(edit.form, edit.id)
    if (!r.ok) return setError(r.error)
    toast.success('저장했습니다.')
    setEdit(null)
    reload()
  }
  async function remove(p: Publisher) {
    if (!confirm(`'${p.name}'${josa(p.name, '을', '를')} 삭제할까요?`)) return
    const r = await deletePublisher(p.id)
    if (!r.ok) return setError(r.error)
    toast.success('삭제했습니다.')
    setEdit(null)
    setSelId(null)
    reload()
  }

  return (
    <>
      <PageHeader title="출판사 관리" />
      <SearchBar onReset={() => setKeyword('')} onSearch={reload}>
        <Field label="출판사" className="flex-1">
          <SearchInput value={keyword} onChange={setKeyword} suggestions={data.map((p) => p.name)} placeholder="출판사명 또는 코드" />
        </Field>
      </SearchBar>
      <ListCard
        title="등록된 출판사 목록"
        count={`${rows.length}곳`}
        actions={
          <>
            <EditButton disabled={!selected} onClick={() => selected && open(selected.id, { ...selected, biz_no: selected.biz_no ?? '' })} />
            <AddButton onClick={() => open()} />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ColHead>출판사코드</ColHead>
              <ColHead>출판사명</ColHead>
              <ColHead>전화번호</ColHead>
              <ColHead>팩스번호</ColHead>
              <ColHead>사업자번호</ColHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <SelectableRow key={p.id} selected={p.id === selId} onSelect={() => setSelId(p.id)}>
                <TableCell><Code>{p.code}</Code></TableCell>
                <TableCell className="font-semibold">{p.name}</TableCell>
                <TableCell className="tabular-nums">{p.phone}</TableCell>
                <TableCell className="tabular-nums">{p.fax}</TableCell>
                <TableCell className="tabular-nums">{p.biz_no}</TableCell>
              </SelectableRow>
            ))}
            <EmptyRow show={rows.length === 0} cols={5} />
          </TableBody>
        </Table>
      </ListCard>
      <FormDialog
        open={!!edit}
        title={edit?.id ? '출판사 수정' : '출판사 등록'}
        error={error}
        onClose={() => setEdit(null)}
        onSave={save}
        onDelete={edit?.id && selected ? () => remove(selected) : undefined}
      >
        {edit && (
          <>
            <Field label="출판사코드 *">
              <Input value={edit.form.code} disabled={!!edit.id} onChange={(e) => setForm({ code: e.target.value })} />
            </Field>
            <Field label="출판사명 *">
              <Input value={edit.form.name} onChange={(e) => setForm({ name: e.target.value })} />
            </Field>
            <Field label="전화번호">
              <Input value={edit.form.phone} onChange={(e) => setForm({ phone: e.target.value })} />
            </Field>
            <Field label="팩스번호">
              <Input value={edit.form.fax} onChange={(e) => setForm({ fax: e.target.value })} />
            </Field>
            <Field label="사업자번호 (선택)">
              <Input value={edit.form.biz_no ?? ''} onChange={(e) => setForm({ biz_no: e.target.value })} />
            </Field>
          </>
        )}
      </FormDialog>
    </>
  )
}
