// 목록 표의 열 종류별 너비·정렬 규칙과 열 순서 병합 (화면·서버 양쪽에서 쓴다)

/**
 * 열 종류 — 같은 종류는 어느 표에서나 같은 너비·정렬.
 * name 은 표마다 하나, 남는 너비를 모두 차지한다.
 */
export type ColumnKind = 'no' | 'code' | 'date' | 'datetime' | 'badge' | 'qty' | 'money' | 'rate' | 'text' | 'name' | 'button' | 'action'

export const COLUMN_KINDS: Record<ColumnKind, { width?: number; align: 'left' | 'center' | 'right' }> = {
  no: { width: 64, align: 'center' }, // No·순번
  code: { width: 130, align: 'left' }, // 도서·출판사·서점코드
  date: { width: 130, align: 'left' }, // 입고일자·반품날짜·날짜
  datetime: { width: 170, align: 'left' }, // 날짜+시각
  badge: { width: 100, align: 'center' }, // 구분·상태
  qty: { width: 100, align: 'right' }, // 부수·입고·출고·반품·현재고
  money: { width: 130, align: 'right' }, // 정가·단가·금액
  rate: { width: 100, align: 'right' }, // 출고율
  text: { width: 150, align: 'left' }, // 지역·전화·팩스·사업자번호, 이름이 주가 아닌 출판사·서점
  name: { align: 'left' }, // 주 이름 열 (도서명·서점명·출판사명·파일명)
  button: { width: 100, align: 'center' }, // 글자 있는 행 버튼 (복원)
  action: { width: 56, align: 'center' }, // 아이콘 행 버튼 (행 삭제)
}

/** 이름 열이 최소한 차지할 너비 (표가 이보다 좁아지면 가로 스크롤) */
export const NAME_MIN_WIDTH = 160

export type Pin = 'start' | 'end'

/**
 * 저장된 열 순서를 현재 열 정의에 맞춘다.
 * 없어진 id·중복은 버리고, 새로 생긴 열은 기본 순서에서 바로 앞 열 뒤에 끼우며, 고정 열은 맨 앞/맨 뒤 제자리.
 */
export function mergeColumnOrder(saved: readonly string[] | null | undefined, cols: readonly { id: string; pinned?: Pin }[]): string[] {
  const start = cols.filter((c) => c.pinned === 'start').map((c) => c.id)
  const end = cols.filter((c) => c.pinned === 'end').map((c) => c.id)
  const movable = cols.filter((c) => !c.pinned).map((c) => c.id)
  const order = [...new Set((saved ?? []).filter((id) => movable.includes(id)))]
  movable.forEach((id, i) => {
    if (order.includes(id)) return
    const prev = i === 0 ? -1 : order.indexOf(movable[i - 1])
    order.splice(prev + 1, 0, id)
  })
  return [...start, ...order, ...end]
}

/** 표 id (설정 키 columns:<id>) */
export const TABLE_ID_RE = /^[a-z][a-z0-9-]{0,39}$/
