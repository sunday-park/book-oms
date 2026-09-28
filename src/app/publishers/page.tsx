'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { SearchInput } from '@/components/search-input'
import { EmptyRow, RowActions } from '@/components/table-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery } from '@/hooks/use-query'
import { deletePublisher, listPublishers, savePublisher } from '@/lib/actions/master'
import { josa } from '@/lib/josa'
import type { Publisher, PublisherInput } from '@/lib/repo/master'

const EMPTY: PublisherInput = { code: '', name: '', phone: '', fax: '', biz_no: '' }

export default function PublishersPage() {
  const [keyword, setKeyword] = useState('')
  const { data, reload } = useQuery(listPublishers, [], [] as Publisher[])
  const rows = useMemo(() => {
    const kw = keyword.toLowerCase()
    return data.filter((p) => p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw))
  }, [data, keyword])

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
    if (!r.ok) return toast.error(r.error)
    reload()
  }

  return (
    <>
      <PageHeader title="출판사 관리">
        <Button onClick={() => open()}>+ 출판사 등록</Button>
      </PageHeader>
      <SearchBar onReset={() => setKeyword('')} onSearch={reload}>
        <Field label="출판사">
          <SearchInput value={keyword} onChange={setKeyword} suggestions={data.map((p) => p.name)} placeholder="출판사명 또는 코드" />
        </Field>
      </SearchBar>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>출판사코드</TableHead>
            <TableHead>출판사명</TableHead>
            <TableHead>전화번호</TableHead>
            <TableHead>팩스번호</TableHead>
            <TableHead>사업자번호</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.code}</TableCell>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.phone}</TableCell>
              <TableCell>{p.fax}</TableCell>
              <TableCell>{p.biz_no}</TableCell>
              <TableCell>
                <RowActions onEdit={() => open(p.id, { ...p, biz_no: p.biz_no ?? '' })} onDelete={() => remove(p)} />
              </TableCell>
            </TableRow>
          ))}
          <EmptyRow show={rows.length === 0} cols={6} />
        </TableBody>
      </Table>
      <FormDialog open={!!edit} title={edit?.id ? '출판사 수정' : '출판사 등록'} error={error} onClose={() => setEdit(null)} onSave={save}>
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
