'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { type Column, DataTable } from '@/components/data-table'
import { FormDialog } from '@/components/form-dialog'
import { ListCard } from '@/components/list-card'
import { PageHeader } from '@/components/page-header'
import { Field, SearchBar } from '@/components/search-bar'
import { SearchInput } from '@/components/search-input'
import { AddButton, Code, EditButton } from '@/components/table-helpers'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@/hooks/use-query'
import { deleteBookstore, listBookstores, saveBookstore } from '@/lib/actions/master'
import { REGIONS } from '@/lib/format'
import { josa } from '@/lib/josa'
import type { Bookstore, BookstoreInput } from '@/lib/repo/master'

const EMPTY: BookstoreInput = { code: '', name: '', region: '' }
const ALL = '__all'

const COLUMNS: Column<Bookstore>[] = [
  { id: 'code', header: '서점코드', kind: 'code', cell: (s) => <Code>{s.code}</Code> },
  { id: 'name', header: '서점명', kind: 'name', className: 'font-semibold', title: (s) => s.name, cell: (s) => s.name },
  { id: 'region', header: '지역', kind: 'text', title: (s) => s.region, cell: (s) => s.region },
]

export default function BookstoresPage() {
  const [keyword, setKeyword] = useState('')
  const [region, setRegion] = useState(ALL)
  const { data, reload } = useQuery(listBookstores, [], [] as Bookstore[], 'bookstores')
  const rows = useMemo(() => {
    const kw = keyword.toLowerCase()
    return data.filter((s) => (region === ALL || s.region === region) && (s.name.toLowerCase().includes(kw) || s.code.toLowerCase().includes(kw)))
  }, [data, keyword, region])
  const [selId, setSelId] = useState<number | null>(null)
  const selected = rows.find((s) => s.id === selId)

  const [edit, setEdit] = useState<{ id?: number; form: BookstoreInput } | null>(null)
  const [error, setError] = useState('')
  const setForm = (patch: Partial<BookstoreInput>) => setEdit((e) => e && { ...e, form: { ...e.form, ...patch } })
  const open = (id?: number, form: BookstoreInput = EMPTY) => {
    setError('')
    setEdit({ id, form })
  }

  async function save() {
    if (!edit) return
    const r = await saveBookstore(edit.form, edit.id)
    if (!r.ok) return setError(r.error)
    toast.success('저장했습니다.')
    setEdit(null)
    reload()
  }
  async function remove(s: Bookstore) {
    if (!confirm(`'${s.name}'${josa(s.name, '을', '를')} 삭제할까요?`)) return
    const r = await deleteBookstore(s.id)
    if (!r.ok) return setError(r.error)
    toast.success('삭제했습니다.')
    setEdit(null)
    setSelId(null)
    reload()
  }

  return (
    <>
      <PageHeader title="서점 관리" />
      <SearchBar
        onReset={() => {
          setKeyword('')
          setRegion(ALL)
        }}
        onSearch={reload}
      >
        <Field label="지역">
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-56" aria-label="지역 필터">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="서점" className="flex-1">
          <SearchInput value={keyword} onChange={setKeyword} suggestions={data.map((s) => s.name)} placeholder="서점명 또는 코드" />
        </Field>
      </SearchBar>
      <ListCard
        title="등록된 서점 목록"
        count={`${rows.length}곳`}
        actions={
          <>
            <EditButton disabled={!selected} onClick={() => selected && open(selected.id, selected)} />
            <AddButton onClick={() => open()} />
          </>
        }
      >
        <DataTable tableId="bookstores" columns={COLUMNS} rows={rows} rowKey={(s) => s.id} selectedKey={selId} onSelect={(s) => setSelId(s.id)} />
      </ListCard>
      <FormDialog
        open={!!edit}
        title={edit?.id ? '서점 수정' : '서점 등록'}
        error={error}
        onClose={() => setEdit(null)}
        onSave={save}
        onDelete={edit?.id && selected ? () => remove(selected) : undefined}
      >
        {edit && (
          <>
            <Field label="서점코드 *">
              <Input value={edit.form.code} onChange={(e) => setForm({ code: e.target.value })} />
            </Field>
            <Field label="서점명 *">
              <Input value={edit.form.name} onChange={(e) => setForm({ name: e.target.value })} />
            </Field>
            <Field label="지역 *">
              <Select value={edit.form.region} onValueChange={(v) => setForm({ region: v })}>
                <SelectTrigger className="w-full" aria-label="지역">
                  <SelectValue placeholder="시·도 선택" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
      </FormDialog>
    </>
  )
}
