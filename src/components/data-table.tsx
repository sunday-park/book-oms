'use client'

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Fragment, useMemo, useRef, type ReactNode } from 'react'
import { useColumnPrefs } from '@/components/column-prefs'
import { EmptyRow, SelectableRow } from '@/components/table-helpers'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { COLUMN_KINDS, type ColumnKind, mergeColumnOrder, NAME_MIN_WIDTH, type Pin } from '@/lib/columns'
import { cn } from '@/lib/utils'

export type Column<T> = {
  id: string
  /** 머리칸 제목 (끌기 손잡이 이름 `'제목' 열 이동` 에도 쓴다) */
  header: string
  kind: ColumnKind
  cell: (row: T, index: number) => ReactNode
  /** 칸 추가 클래스 */
  className?: string
  /** 긴 글자: 말줄임 + 마우스를 올리면 전체 (title) */
  title?: (row: T) => string
  /** 합계행에 이 열 아래 들어갈 내용 */
  footer?: ReactNode
  /** 고정 열 — 옮길 수 없고 맨 앞/맨 뒤에 머문다 */
  pinned?: Pin
  /** 머리칸 제목을 화면에서 숨긴다 (스크린리더에는 읽힘) */
  hideHeader?: boolean
}

const ALIGN = { left: '', center: 'text-center', right: 'text-right tabular-nums' } as const
// No·아이콘 버튼 열은 좁아서 칸 여백을 줄인다
const TIGHT: Partial<Record<ColumnKind, string>> = { no: 'px-2!', action: 'px-2!' }

// A4 세로 인쇄 영역 너비(약 190mm)
const PRINT_WIDTH = 720

/**
 * 열 종류별 너비 (colgroup).
 * print: 인쇄 문서 — 규칙 너비 합이 인쇄 폭을 넘으면 같은 비율(%)로 줄여 한 장 폭에 맞춘다.
 */
export function ColGroup({ kinds, print }: { kinds: ColumnKind[]; print?: boolean }) {
  const total = minWidthOf(kinds)
  const scale = print && total > PRINT_WIDTH
  return (
    <colgroup>
      {kinds.map((k, i) => {
        const w = COLUMN_KINDS[k].width
        return <col key={i} style={w ? { width: scale ? `${((w / total) * 100).toFixed(2)}%` : w } : undefined} />
      })}
    </colgroup>
  )
}

/** 표의 최소 너비 — 고정 열 합 + 이름 열 최소 */
function minWidthOf(kinds: ColumnKind[]) {
  return kinds.reduce((s, k) => s + (COLUMN_KINDS[k].width ?? NAME_MIN_WIDTH), 0)
}

// 가로로만 움직인다
const horizontalOnly: Modifier = ({ transform }) => ({ ...transform, y: 0 })

/**
 * 키보드 ←/→ 한 번에 한 칸씩 — 같은 머리행의 바로 옆 열 가운데로 옮긴다.
 * (기본 sortableKeyboardCoordinates 는 열 너비가 크게 다르면 넓은 이름 열을 건너뛴다)
 */
const neighborColumn: KeyboardCoordinateGetter = (event, { active, currentCoordinates, context: { over, collisionRect, droppableRects, droppableContainers } }) => {
  if ((event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') || !collisionRect) return undefined
  event.preventDefault()
  const scope = scopeOf(active)
  const rects = droppableContainers
    .getEnabled()
    .filter((c) => scopeOf(c.id) === scope)
    .map((c) => ({ id: c.id, rect: droppableRects.get(c.id) }))
    .filter((x) => x.rect)
    .sort((a, b) => a.rect!.left - b.rect!.left)
  const at = rects.findIndex((x) => x.id === (over?.id ?? active))
  const target = rects[at + (event.code === 'ArrowLeft' ? -1 : 1)]?.rect
  if (at < 0 || !target) return undefined
  const dx = target.left + target.width / 2 - (collisionRect.left + collisionRect.width / 2)
  return { x: currentCoordinates.x + dx, y: currentCoordinates.y }
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable: '열 순서를 바꾸려면 스페이스바를 눌러 열을 들고, 왼쪽·오른쪽 화살표로 옮긴 뒤 스페이스바로 놓으세요. Esc 를 누르면 취소합니다.',
}

type Group<T> = { key: string | number; header: ReactNode; rows: T[] }

type Props<T> = {
  /** 열 순서 저장 키 (columns:<tableId>) */
  tableId: string
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  /** 묶음 없이 행만 */
  rows?: T[]
  /** 묶음 머리행(모든 열에 걸침) + 묶음마다 열 머리행 */
  groups?: Group<T>[]
  /** 주면 행을 클릭·Enter/Space 로 선택 */
  onSelect?: (row: T) => void
  selectedKey?: string | number | null
  /** 합계행 제목 — 합계가 없는 첫 열 묶음(이름 등 글자 열)에 들어간다 */
  footerLabel?: string
  empty?: string
}

export function DataTable<T>({ tableId, columns, rowKey, rows, groups, onSelect, selectedKey, footerLabel, empty }: Props<T>) {
  const { orders, setOrder } = useColumnPrefs()
  const saved = orders[tableId]
  const cols = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]))
    return mergeColumnOrder(saved, columns).map((id) => byId.get(id)!)
  }, [columns, saved])
  const kinds = cols.map((c) => c.kind)
  const movable = cols.filter((c) => !c.pinned).map((c) => c.id)
  const allRows = groups ? groups.flatMap((g) => g.rows) : (rows ?? [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: neighborColumn }),
  )
  const label = (id: UniqueIdentifier) => {
    const colId = colIdOf(id)
    return cols.find((c) => c.id === colId)?.header ?? colId
  }
  const pos = (id: UniqueIdentifier) => movable.indexOf(colIdOf(id)) + 1
  // 든 직후 제자리 위에 있다는 알림이 '들었습니다' 안내를 덮지 않도록, 자리가 바뀔 때만 알린다
  const lastOver = useRef<UniqueIdentifier | null>(null)
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      lastOver.current = active.id
      return `'${label(active.id)}' 열을 들었습니다. 옮길 수 있는 ${movable.length}개 열 중 ${pos(active.id)}번째입니다.`
    },
    onDragOver: ({ active, over }) => {
      if ((over?.id ?? null) === lastOver.current) return undefined
      lastOver.current = over?.id ?? null
      return over ? `'${label(active.id)}' 열이 ${pos(over.id)}번째 자리로 옮겨졌습니다.` : `'${label(active.id)}' 열이 놓을 수 있는 자리 밖에 있습니다.`
    },
    onDragEnd: ({ active, over }) =>
      over ? `'${label(active.id)}' 열을 ${pos(over.id)}번째 자리에 놓았습니다.` : `'${label(active.id)}' 열을 제자리에 놓았습니다.`,
    onDragCancel: ({ active }) => `'${label(active.id)}' 열 옮기기를 취소했습니다.`,
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    // 묶음 표는 묶음마다 머리행이 있다 — 같은 머리행 안에서 놓은 것만
    if (!over || active.id === over.id || scopeOf(active.id) !== scopeOf(over.id)) return
    const next = arrayMove(movable, movable.indexOf(colIdOf(active.id)), movable.indexOf(colIdOf(over.id)))
    const ids = cols.filter((c) => c.pinned === 'start').map((c) => c.id)
    setOrder(tableId, [...ids, ...next, ...cols.filter((c) => c.pinned === 'end').map((c) => c.id)])
  }

  const header = (scope: string, top?: string) => <HeaderRow key={`h-${scope}`} scope={scope} cols={cols} movable={movable} top={top} />
  const body = (list: T[]) =>
    list.map((row, i) => {
      const k = rowKey(row)
      const cells = cols.map((c) => (
        <TableCell
          key={c.id}
          data-col={c.id}
          title={c.title?.(row)}
          className={cn(ALIGN[COLUMN_KINDS[c.kind].align], TIGHT[c.kind], c.title && 'truncate', c.className)}
        >
          {c.cell(row, i)}
        </TableCell>
      ))
      return onSelect ? (
        <SelectableRow key={k} selected={k === selectedKey} onSelect={() => onSelect(row)}>
          {cells}
        </SelectableRow>
      ) : (
        <TableRow key={k}>{cells}</TableRow>
      )
    })

  const hasFooter = footerLabel !== undefined || cols.some((c) => c.footer !== undefined)

  // DndContext 는 스크린리더 안내 문구(div)를 자식 옆에 그리므로 표 바깥을 감싼다
  return (
    <DndContext
      id={`dnd-${tableId}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[horizontalOnly]}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
    >
      <Table className="table-fixed" style={{ minWidth: minWidthOf(kinds) }}>
        <ColGroup kinds={kinds} />
        {groups ? (
          <>
            {groups.map((g) => (
              <TableBody key={g.key}>
                <TableRow className="hover:bg-transparent">
                  {/* 묶음 머리행·열 머리행은 스크롤 시 위에 고정되고, 다음 묶음이 올라오며 덮는다 */}
                  <TableCell colSpan={cols.length} className="sticky top-0 z-10 h-[50px]! border-r-0! bg-group-head">
                    {g.header}
                  </TableCell>
                </TableRow>
                {header(String(g.key), 'top-[50px]!')}
                {body(g.rows)}
              </TableBody>
            ))}
            {allRows.length === 0 && (
              <TableBody>
                <EmptyRow show cols={cols.length} text={empty} />
              </TableBody>
            )}
          </>
        ) : (
          <>
            <TableHeader>{header('head')}</TableHeader>
            <TableBody>
              {body(allRows)}
              <EmptyRow show={allRows.length === 0} cols={cols.length} text={empty} />
            </TableBody>
          </>
        )}
        {hasFooter && (
          <TableFooter>
            <TableRow>
              <FooterCells cols={cols} label={footerLabel} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </DndContext>
  )
}

/**
 * 합계행 칸 — 합계가 있는 열은 제 열 아래, 합계 없는 이웃 열들은 한 칸으로 합친다.
 * 제목은 합친 칸 중 글자 열(No·버튼 열이 아닌)이 든 첫 칸에 넣는다.
 */
function FooterCells<T>({ cols, label }: { cols: Column<T>[]; label?: string }) {
  const cells: { key: string; span: number; content?: ReactNode; col?: Column<T>; labelable: boolean }[] = []
  for (const c of cols) {
    const last = cells.at(-1)
    if (c.footer !== undefined) cells.push({ key: c.id, span: 1, content: c.footer, col: c, labelable: false })
    else if (last && !last.col) {
      last.span++
      last.labelable ||= c.kind !== 'no' && c.kind !== 'action' && c.kind !== 'button'
    } else cells.push({ key: c.id, span: 1, labelable: c.kind !== 'no' && c.kind !== 'action' && c.kind !== 'button' })
  }
  const labelAt = label === undefined ? -1 : cells.findIndex((x) => x.labelable)
  return cells.map((x, i) => (
    <TableCell
      key={x.key}
      colSpan={x.span > 1 ? x.span : undefined}
      data-col={x.col?.id}
      className={cn(x.col && ALIGN[COLUMN_KINDS[x.col.kind].align], 'truncate')}
    >
      {i === labelAt ? label : x.content}
    </TableCell>
  ))
}

// 머리행마다(묶음 표는 묶음마다) 항목 id 앞에 범위를 붙여 한 DndContext 안에서 겹치지 않게 한다
const itemId = (scope: string, colId: string) => `${scope}|${colId}`
const scopeOf = (id: UniqueIdentifier) => String(id).split('|')[0]
const colIdOf = (id: UniqueIdentifier) => String(id).split('|').slice(1).join('|')

function HeaderRow<T>({ scope, cols, movable, top }: { scope: string; cols: Column<T>[]; movable: string[]; top?: string }) {
  return (
    <SortableContext id={scope} items={movable.map((id) => itemId(scope, id))} strategy={horizontalListSortingStrategy}>
      <TableRow className="hover:bg-transparent">
        {cols.map((c) => (
          <Fragment key={c.id}>{c.pinned ? <StaticHead col={c} top={top} /> : <SortableHead col={c} id={itemId(scope, c.id)} top={top} />}</Fragment>
        ))}
      </TableRow>
    </SortableContext>
  )
}

function HeadLabel<T>({ col }: { col: Column<T> }) {
  return col.hideHeader ? <span className="sr-only">{col.header}</span> : <>{col.header}</>
}

function StaticHead<T>({ col, top }: { col: Column<T>; top?: string }) {
  return (
    <TableHead data-col={col.id} data-kind={col.kind} className={cn(ALIGN[COLUMN_KINDS[col.kind].align], TIGHT[col.kind], top)}>
      <HeadLabel col={col} />
    </TableHead>
  )
}

function SortableHead<T>({ col, id, top }: { col: Column<T>; id: string; top?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <TableHead
      ref={setNodeRef}
      data-col={col.id}
      data-kind={col.kind}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // 손잡이는 왼쪽 여백 안에 둔다 — 좁은 열(100px)에서도 제목이 들어가도록
      className={cn(
        'relative truncate pr-3! pl-[22px]!',
        ALIGN[COLUMN_KINDS[col.kind].align],
        top,
        isDragging && 'z-30! bg-selected! text-selected-foreground! shadow-lg',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-roledescription="이동할 수 있는 열"
        aria-label={`'${col.header}' 열 이동`}
        title="끌어서 열 순서 바꾸기"
        className={cn(
          'absolute top-1/2 left-[3px] flex h-8 w-[18px] -translate-y-1/2 touch-none items-center justify-center rounded text-line-strong outline-none hover:bg-secondary hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <GripVertical aria-hidden className="size-3.5" />
      </button>
      <HeadLabel col={col} />
    </TableHead>
  )
}
