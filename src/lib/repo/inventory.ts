import { type DB, all, get, run, tx } from '@/lib/db'
import { calcAmount, calcUnitPrice, SHIP_KINDS, type ShipKind } from '@/lib/domain'
import { josa } from '@/lib/josa'
import { getBook } from '@/lib/repo/master'
import { AppError } from '@/lib/result'
import { requireDate, requireId, requireQty, requireRange } from '@/lib/validate'

function requireBookOf(db: DB, bookId: number | null, publisherId: number) {
  const book = getBook(db, requireId(bookId, '도서'))
  if (book.publisher_id !== publisherId) throw new AppError(`'${book.name}'${josa(book.name, '은', '는')} 선택한 출판사의 도서가 아닙니다.`)
  return book
}

// ── 날짜 기준 무결성 검사 ──
// 같은 날에는 늘어나는 쪽(재고: 입고·반품 / 반품 가능 부수: 출고)을 먼저 센다. 그래서 하루 중 가장 낮은 값은 그날 끝의 누계이고,
// "날짜별 누계가 한 번도 0 아래로 내려가지 않는다"만 확인하면 된다.
type Point = { date: string; total: number }

/** 날짜순 증감 → 날짜별 누계 */
function cumulate(rows: { date: string; delta: number }[]): Point[] {
  let total = 0
  return rows.map((r) => ({ date: r.date, total: (total += r.delta) }))
}

/** date 시점과 그 뒤 모든 날짜의 누계 중 최솟값 = date 에 더 뺄 수 있는 최대치 */
function minFrom(points: Point[], date: string) {
  let min = 0
  for (const p of points) min = p.date <= date ? p.total : Math.min(min, p.total)
  return min
}

/** from 이후(포함) 누계가 처음 음수가 되는 날짜 */
const firstNegative = (points: Point[], from: string) => points.find((p) => p.date >= from && p.total < 0)

/** 도서별 날짜별 재고 증감(입고·반품 +, 출고 −). excludeShipmentId 명세의 행은 뺀다. */
function stockDeltas(db: DB, where: { bookId?: number; publisherId?: number }, excludeShipmentId: number | null = null) {
  const rows = all<{ book_id: number; date: string; delta: number }>(
    db,
    `SELECT e.book_id, e.date, SUM(e.delta) AS delta FROM (
       SELECT book_id, date, qty AS delta FROM receipts
       UNION ALL SELECT book_id, date, qty FROM returns
       UNION ALL SELECT i.book_id, s.date, -i.qty FROM shipment_items i JOIN shipments s ON s.id = i.shipment_id WHERE s.id IS NOT ?
     ) e JOIN books b ON b.id = e.book_id
     WHERE (? IS NULL OR b.id = ?) AND (? IS NULL OR b.publisher_id = ?)
     GROUP BY e.book_id, e.date ORDER BY e.book_id, e.date`,
    excludeShipmentId,
    where.bookId ?? null,
    where.bookId ?? null,
    where.publisherId ?? null,
    where.publisherId ?? null,
  )
  const byBook = new Map<number, { date: string; delta: number }[]>()
  for (const r of rows) {
    const list = byBook.get(r.book_id) ?? []
    list.push(r)
    byBook.set(r.book_id, list)
  }
  return byBook
}

const stockTimeline = (db: DB, bookId: number, excludeShipmentId: number | null = null) =>
  cumulate(stockDeltas(db, { bookId }, excludeShipmentId).get(bookId) ?? [])

/** 재고가 from 이후 처음 음수가 되는 날짜·부수 (없으면 undefined) */
export function findNegativeStock(db: DB, bookId: number, from = '') {
  return firstNegative(stockTimeline(db, bookId), from)
}

/** 출고 입력 화면용: 출판사 도서별 date 기준 출고 가능 부수 (그 날짜·서점 명세에 저장된 부수는 되돌린 것으로 본다) */
export function listAvailable(db: DB, date: string, publisherId: number, bookstoreId: number) {
  const exclude = findShipment(db, date, publisherId, bookstoreId)?.id ?? null
  const deltas = stockDeltas(db, { publisherId }, exclude)
  return all<{ id: number }>(db, 'SELECT id FROM books WHERE publisher_id = ? ORDER BY code', publisherId).map((b) => ({
    book_id: b.id,
    available: Math.max(0, minFrom(cumulate(deltas.get(b.id) ?? []), date)),
  }))
}

/** 서점×도서의 날짜별 (출고 − 반품) 누계 — 반품은 그 서점에 이미 나간 부수만큼만 */
function coverTimeline(db: DB, bookstoreId: number, bookId: number) {
  return cumulate(
    all<{ date: string; delta: number }>(
      db,
      `SELECT date, SUM(delta) AS delta FROM (
         SELECT s.date, i.qty AS delta FROM shipment_items i JOIN shipments s ON s.id = i.shipment_id WHERE s.bookstore_id = ? AND i.book_id = ?
         UNION ALL SELECT date, -qty FROM returns WHERE bookstore_id = ? AND book_id = ?
       ) GROUP BY date ORDER BY date`,
      bookstoreId, bookId, bookstoreId, bookId,
    ),
  )
}

/** 출고를 줄이거나 지운 뒤에도 반품이 출고를 넘지 않는지 — 넘으면 그 서점에 반품된 부수와 함께 거절 */
function assertReturnsCovered(db: DB, bookstoreId: number, bookId: number, from: string, verb: '저장할' | '삭제할') {
  const bad = firstNegative(coverTimeline(db, bookstoreId, bookId), from)
  if (!bad) return
  const { store, book, returned } = get<{ store: string; book: string; returned: number }>(
    db,
    `SELECT (SELECT name FROM bookstores WHERE id = ?) AS store, (SELECT name FROM books WHERE id = ?) AS book,
            COALESCE((SELECT SUM(qty) FROM returns WHERE bookstore_id = ? AND book_id = ? AND date <= ?), 0) AS returned`,
    bookstoreId, bookId, bookstoreId, bookId, bad.date,
  )!
  throw new AppError(`'${store}'에 반품된 '${book}' ${returned}부보다 출고가 적어져 ${verb} 수 없습니다.`)
}

// ── 입고 ──
export type Receipt = {
  id: number
  date: string
  book_id: number
  book_code: string
  book_name: string
  publisher_id: number
  publisher_name: string
  qty: number
}
export type ReceiptFilter = { from: string; to: string; publisherId?: number; bookId?: number }

export function listReceipts(db: DB, f: ReceiptFilter) {
  requireRange(f.from, f.to)
  return all<Receipt>(
    db,
    `SELECT r.id, r.date, r.book_id, b.code AS book_code, b.name AS book_name, b.publisher_id, p.name AS publisher_name, r.qty
     FROM receipts r JOIN books b ON b.id = r.book_id JOIN publishers p ON p.id = b.publisher_id
     WHERE r.date BETWEEN ? AND ? AND (? IS NULL OR b.publisher_id = ?) AND (? IS NULL OR r.book_id = ?)
     ORDER BY r.date, b.code, r.id`,
    f.from,
    f.to,
    f.publisherId ?? null,
    f.publisherId ?? null,
    f.bookId ?? null,
    f.bookId ?? null,
  )
}

export function createReceipt(db: DB, input: { date: string; book_id: number | null; qty: number }) {
  const date = requireDate(input.date, '입고일자')
  const book = getBook(db, requireId(input.book_id, '도서'))
  const qty = requireQty(input.qty, '입고부수')
  return run(db, 'INSERT INTO receipts (date, book_id, qty) VALUES (?, ?, ?)', date, book.id, qty)
}

type StockInRow = { id: number; date: string; book_id: number; book_name: string }

/** 입고·반품을 지우면 그 날짜부터 재고가 줄어든다 — 어느 날짜든 음수가 되면 거절(롤백) */
function deleteStockIn(db: DB, what: '입고' | '반품', table: 'receipts' | 'returns', row: StockInRow) {
  tx(db, () => {
    run(db, `DELETE FROM ${table} WHERE id = ?`, row.id)
    const bad = findNegativeStock(db, row.book_id, row.date)
    if (bad) throw new AppError(`${what}${josa(what, '을', '를')} 삭제하면 '${row.book_name}' 재고가 ${bad.date}에 ${bad.total}부가 되어 삭제할 수 없습니다.`)
  })
}

export function deleteReceipt(db: DB, id: number) {
  const row = get<StockInRow>(
    db,
    'SELECT r.id, r.date, r.book_id, b.name AS book_name FROM receipts r JOIN books b ON b.id = r.book_id WHERE r.id = ?',
    id,
  )
  if (!row) throw new AppError('입고 내역을 찾을 수 없습니다.')
  deleteStockIn(db, '입고', 'receipts', row)
}

// ── 반품 ──
export type ReturnRow = {
  id: number
  date: string
  publisher_id: number
  publisher_name: string
  bookstore_id: number
  bookstore_name: string
  book_id: number
  book_code: string
  book_name: string
  qty: number
}
export type ReturnFilter = { from: string; to: string; publisherId?: number; bookstoreId?: number }

export function listReturns(db: DB, f: ReturnFilter) {
  requireRange(f.from, f.to)
  return all<ReturnRow>(
    db,
    `SELECT r.id, r.date, r.publisher_id, p.name AS publisher_name, r.bookstore_id, st.name AS bookstore_name,
            r.book_id, b.code AS book_code, b.name AS book_name, r.qty
     FROM returns r
     JOIN publishers p ON p.id = r.publisher_id
     JOIN bookstores st ON st.id = r.bookstore_id
     JOIN books b ON b.id = r.book_id
     WHERE r.date BETWEEN ? AND ? AND (? IS NULL OR r.publisher_id = ?) AND (? IS NULL OR r.bookstore_id = ?)
     ORDER BY r.date, b.code, r.id`,
    f.from,
    f.to,
    f.publisherId ?? null,
    f.publisherId ?? null,
    f.bookstoreId ?? null,
    f.bookstoreId ?? null,
  )
}

export function createReturn(
  db: DB,
  input: { date: string; publisher_id: number | null; bookstore_id: number | null; book_id: number | null; qty: number },
) {
  const date = requireDate(input.date, '반품일자')
  const publisherId = requireId(input.publisher_id, '출판사')
  const bookstoreId = requireId(input.bookstore_id, '서점')
  const book = requireBookOf(db, input.book_id, publisherId)
  const qty = requireQty(input.qty)
  // 그 날짜까지 그 서점에 출고한 부수 − 반품한 부수까지만 반품할 수 있다 (반품이 재고를 부풀리지 않도록).
  // 뒤 날짜 반품이 이미 쓴 부수도 빼야 하므로 그 날짜 이후 누계의 최솟값을 쓴다.
  const store = get<{ name: string }>(db, 'SELECT name FROM bookstores WHERE id = ?', bookstoreId)
  if (!store) throw new AppError('서점을 찾을 수 없습니다.')
  const n = Math.max(0, minFrom(coverTimeline(db, bookstoreId, book.id), date))
  if (qty > n) throw new AppError(`'${book.name}'${josa(book.name, '은', '는')} '${store.name}'에 ${date}까지 반품 가능한 부수가 ${n}부입니다.`)
  return run(db, 'INSERT INTO returns (date, publisher_id, bookstore_id, book_id, qty) VALUES (?, ?, ?, ?, ?)', date, publisherId, bookstoreId, book.id, qty)
}

export function deleteReturn(db: DB, id: number) {
  const row = get<StockInRow>(
    db,
    'SELECT r.id, r.date, r.book_id, b.name AS book_name FROM returns r JOIN books b ON b.id = r.book_id WHERE r.id = ?',
    id,
  )
  if (!row) throw new AppError('반품 내역을 찾을 수 없습니다.')
  deleteStockIn(db, '반품', 'returns', row)
}

// ── 출고 ──
export type ShipmentItemInput = { id?: number; book_id: number | null; rate: number; kind: ShipKind; qty: number }
export type ShipmentInput = {
  date: string
  publisher_id: number | null
  bookstore_id: number | null
  items: ShipmentItemInput[]
  /** 화면이 불러온 명세 버전 (null = 명세가 없었음). 생략하면 버전 검사를 하지 않는다. */
  version?: number | null
}
export type ShipmentItem = {
  id: number
  shipment_id: number
  book_id: number
  book_code: string
  book_name: string
  list_price: number
  rate: number
  unit_price: number
  amount: number
  kind: ShipKind
  qty: number
  printed_at: string | null
}

const ITEM_SELECT = `SELECT i.id, i.shipment_id, i.book_id, b.code AS book_code, b.name AS book_name,
  i.list_price, i.rate, i.unit_price, i.amount, i.kind, i.qty, i.printed_at
  FROM shipment_items i JOIN books b ON b.id = i.book_id`

function findShipment(db: DB, date: string, publisherId: number, bookstoreId: number) {
  return get<{ id: number; version: number }>(
    db,
    'SELECT id, version FROM shipments WHERE date = ? AND publisher_id = ? AND bookstore_id = ?',
    date, publisherId, bookstoreId,
  )
}

const LOCK_MESSAGE = '다른 곳에서 이 출고 명세가 먼저 수정되었습니다. [취소]를 눌러 새로 불러온 뒤 다시 입력하세요.'

/**
 * 낙관적 잠금: 화면이 불러온 버전(null = 명세가 없었음)과 지금 저장된 버전이 다르면 거절.
 * expected 가 undefined 면 검사하지 않는다(서버 동작은 항상 값을 넘긴다 — 내부·테스트용).
 */
function checkVersion(current: number | undefined, expected: number | null | undefined) {
  if (expected === undefined) return
  if ((current ?? null) !== expected) throw new AppError(LOCK_MESSAGE)
}

export function getShipment(db: DB, date: string, publisherId: number, bookstoreId: number) {
  const s = findShipment(db, date, publisherId, bookstoreId)
  if (!s) return null
  return { id: s.id, version: s.version, items: all<ShipmentItem>(db, `${ITEM_SELECT} WHERE i.shipment_id = ? ORDER BY i.id`, s.id) }
}

export function saveShipment(db: DB, input: ShipmentInput): { id: number } {
  const date = requireDate(input.date)
  const publisherId = requireId(input.publisher_id, '출판사')
  const bookstoreId = requireId(input.bookstore_id, '서점')
  if (input.items.length === 0) throw new AppError('도서를 1권 이상 추가하세요.')
  const rows = input.items.map((it, i) => {
    try {
      const book = requireBookOf(db, it.book_id, publisherId)
      if (!(it.rate > 0 && it.rate <= 100)) throw new AppError('출고율은 0 초과 100 이하로 입력하세요.')
      if (!SHIP_KINDS.includes(it.kind)) throw new AppError('구분을 선택하세요.')
      requireQty(it.qty, '부수')
      return { ...it, book, rowNum: i + 1 }
    } catch (e) {
      if (e instanceof AppError) throw new AppError(`${i + 1}행: ${e.message}`)
      throw e
    }
  })

  const id = tx(db, () => {
    const found = findShipment(db, date, publisherId, bookstoreId)
    checkVersion(found?.version, input.version)
    const shipmentId = found?.id ?? run(db, 'INSERT INTO shipments (date, publisher_id, bookstore_id) VALUES (?, ?, ?)', date, publisherId, bookstoreId)
    run(db, 'UPDATE shipments SET version = version + 1 WHERE id = ?', shipmentId)
    const existing = new Map(
      all<{ id: number; book_id: number; list_price: number; rate: number; kind: ShipKind; qty: number; printed_at: string | null }>(
        db,
        'SELECT id, book_id, list_price, rate, kind, qty, printed_at FROM shipment_items WHERE shipment_id = ?',
        shipmentId,
      ).map((r) => [r.id, r]),
    )
    const kept = new Set<number>()
    for (const r of rows) {
      const prev = r.id ? existing.get(r.id) : undefined
      if (prev?.printed_at) {
        // 인쇄된 행은 읽기 전용 — 값이 그대로면 유지, 바뀌었으면 거절
        if (prev.book_id !== r.book.id || prev.rate !== r.rate || prev.kind !== r.kind || prev.qty !== r.qty) {
          throw new AppError(`${r.rowNum}행: 이미 인쇄된 행은 수정할 수 없습니다. 추가분은 새 행으로 입력하세요.`)
        }
        kept.add(prev.id)
        continue
      }
      // 같은 도서면 저장 당시 정가 유지, 새 행이거나 도서가 바뀌면 현재 정가
      const listPrice = prev && prev.book_id === r.book.id ? prev.list_price : r.book.list_price
      const unit = calcUnitPrice(listPrice, r.rate)
      const amount = calcAmount(unit, r.qty)
      if (prev) {
        run(
          db,
          `UPDATE shipment_items SET book_id = ?, list_price = ?, rate = ?, unit_price = ?, amount = ?, kind = ?, qty = ? WHERE id = ?`,
          r.book.id, listPrice, r.rate, unit, amount, r.kind, r.qty, prev.id,
        )
        kept.add(prev.id)
      } else {
        run(
          db,
          'INSERT INTO shipment_items (shipment_id, book_id, list_price, rate, unit_price, amount, kind, qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          shipmentId, r.book.id, listPrice, r.rate, unit, amount, r.kind, r.qty,
        )
      }
    }
    for (const prevId of existing.keys()) {
      if (kept.has(prevId)) continue
      if (existing.get(prevId)!.printed_at) throw new AppError('이미 인쇄된 행은 삭제할 수 없습니다.')
      run(db, 'DELETE FROM shipment_items WHERE id = ?', prevId)
    }

    // 같은 도서 여러 행은 합산해 비교한다.
    const sum = (list: { book_id: number; qty: number }[]) =>
      list.reduce((m, x) => m.set(x.book_id, (m.get(x.book_id) ?? 0) + x.qty), new Map<number, number>())
    const requested = sum(rows.map((r) => ({ book_id: r.book.id, qty: r.qty })))
    const before = sum([...existing.values()])
    // 규칙 1: 부수가 는 도서는 이 날짜 기준 출고 가능 부수(이 날짜와 그 뒤 모든 날짜 재고의 최솟값, 이 명세분 제외) 이내여야 한다.
    // 부수가 늘지 않은 도서는 재고가 줄지 않았으므로 검사하지 않는다(기존 데이터가 이미 음수여도 저장은 가능).
    for (const r of rows) {
      const total = requested.get(r.book.id)!
      if (total <= (before.get(r.book.id) ?? 0)) continue
      const available = Math.max(0, minFrom(stockTimeline(db, r.book.id, shipmentId), date))
      if (total > available) throw new AppError(`${r.rowNum}행: '${r.book.name}' ${date} 기준 출고 가능 ${available}부, 입력 ${total}부`)
    }
    // 규칙 2: 부수가 준 도서는 이 서점 반품이 출고를 넘지 않아야 한다.
    for (const [bookId, qty] of before) {
      if ((requested.get(bookId) ?? 0) < qty) assertReturnsCovered(db, bookstoreId, bookId, date, '저장할')
    }
    return shipmentId
  })
  return { id }
}

export function deleteShipment(db: DB, id: number, version?: number) {
  const s = get<{ date: string; bookstore_id: number; version: number }>(db, 'SELECT date, bookstore_id, version FROM shipments WHERE id = ?', id)
  // 버전을 넘겼다면 화면이 불러온 명세가 그새 다른 곳에서 삭제된 것
  if (!s) throw new AppError(version === undefined ? '출고 명세를 찾을 수 없습니다.' : LOCK_MESSAGE)
  checkVersion(s.version, version)
  if (get(db, 'SELECT 1 FROM shipment_items WHERE shipment_id = ? AND printed_at IS NOT NULL LIMIT 1', id)) {
    throw new AppError('이미 인쇄된 명세가 있어 삭제할 수 없습니다.')
  }
  tx(db, () => {
    const books = all<{ book_id: number }>(db, 'SELECT DISTINCT book_id FROM shipment_items WHERE shipment_id = ?', id)
    run(db, 'DELETE FROM shipments WHERE id = ?', id)
    for (const b of books) assertReturnsCovered(db, s.bookstore_id, b.book_id, s.date, '삭제할')
  })
}

export function listUnprinted(db: DB, date: string, publisherId: number, bookstoreId: number) {
  return all<ShipmentItem>(
    db,
    `${ITEM_SELECT} JOIN shipments s ON s.id = i.shipment_id
     WHERE s.date = ? AND s.publisher_id = ? AND s.bookstore_id = ? AND i.printed_at IS NULL
     ORDER BY b.code, i.id`,
    date,
    publisherId,
    bookstoreId,
  )
}

export function markPrinted(db: DB, ids: number[], at: string) {
  tx(db, () => {
    for (const id of ids) run(db, 'UPDATE shipment_items SET printed_at = ? WHERE id = ? AND printed_at IS NULL', at, id)
  })
}
