import { type DB, all, get, run, tx } from '@/lib/db'
import { calcAmount, calcUnitPrice, SHIP_KINDS, type ShipKind } from '@/lib/domain'
import { josa } from '@/lib/josa'
import { getBook, requireRow } from '@/lib/repo/master'
import { getStock } from '@/lib/repo/reports'
import { AppError } from '@/lib/result'
import { requireDate, requireId, requireQty } from '@/lib/validate'

function requireBookOf(db: DB, bookId: number | null, publisherId: number) {
  const book = getBook(db, requireId(bookId, '도서'))
  if (book.publisher_id !== publisherId) throw new AppError(`'${book.name}'${josa(book.name, '은', '는')} 선택한 출판사의 도서가 아닙니다.`)
  return book
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

/** 입고·반품을 지우면 재고가 그만큼 줄어든다 — 음수가 되면 거절 */
function requireStockAfterRemoval(db: DB, what: string, row: { book_id: number; book_name: string; qty: number }) {
  const resulting = getStock(db, row.book_id) - row.qty
  if (resulting < 0) throw new AppError(`${what}${josa(what, '을', '를')} 삭제하면 '${row.book_name}' 재고가 ${resulting}부가 되어 삭제할 수 없습니다.`)
}

export function deleteReceipt(db: DB, id: number) {
  const row = get<{ book_id: number; book_name: string; qty: number }>(
    db,
    'SELECT r.book_id, b.name AS book_name, r.qty FROM receipts r JOIN books b ON b.id = r.book_id WHERE r.id = ?',
    id,
  )
  if (!row) throw new AppError('입고 내역을 찾을 수 없습니다.')
  requireStockAfterRemoval(db, '입고', row)
  run(db, 'DELETE FROM receipts WHERE id = ?', id)
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
  // 그 서점에 출고한 부수 − 이미 반품한 부수까지만 반품할 수 있다 (반품이 재고를 부풀리지 않도록)
  const store = get<{ name: string }>(db, 'SELECT name FROM bookstores WHERE id = ?', bookstoreId)
  if (!store) throw new AppError('서점을 찾을 수 없습니다.')
  const { shipped, returned } = get<{ shipped: number; returned: number }>(
    db,
    `SELECT COALESCE((SELECT SUM(i.qty) FROM shipment_items i JOIN shipments s ON s.id = i.shipment_id WHERE s.bookstore_id = ? AND i.book_id = ?), 0) AS shipped,
            COALESCE((SELECT SUM(qty) FROM returns WHERE bookstore_id = ? AND book_id = ?), 0) AS returned`,
    bookstoreId, book.id, bookstoreId, book.id,
  )!
  if (qty > shipped - returned) {
    throw new AppError(`'${book.name}'${josa(book.name, '은', '는')} '${store.name}'에 반품 가능한 부수가 ${shipped - returned}부입니다.`)
  }
  return run(db, 'INSERT INTO returns (date, publisher_id, bookstore_id, book_id, qty) VALUES (?, ?, ?, ?, ?)', date, publisherId, bookstoreId, book.id, qty)
}

export function deleteReturn(db: DB, id: number) {
  const row = get<{ book_id: number; book_name: string; qty: number }>(
    db,
    'SELECT r.book_id, b.name AS book_name, r.qty FROM returns r JOIN books b ON b.id = r.book_id WHERE r.id = ?',
    id,
  )
  if (!row) throw new AppError('반품 내역을 찾을 수 없습니다.')
  requireStockAfterRemoval(db, '반품', row)
  run(db, 'DELETE FROM returns WHERE id = ?', id)
}

// ── 출고 ──
export type ShipmentItemInput = { id?: number; book_id: number | null; rate: number; kind: ShipKind; qty: number }
export type ShipmentInput = { date: string; publisher_id: number | null; bookstore_id: number | null; items: ShipmentItemInput[] }
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

function findShipmentId(db: DB, date: string, publisherId: number, bookstoreId: number) {
  return get<{ id: number }>(db, 'SELECT id FROM shipments WHERE date = ? AND publisher_id = ? AND bookstore_id = ?', date, publisherId, bookstoreId)?.id
}

export function getShipment(db: DB, date: string, publisherId: number, bookstoreId: number) {
  const id = findShipmentId(db, date, publisherId, bookstoreId)
  if (!id) return null
  return { id, items: all<ShipmentItem>(db, `${ITEM_SELECT} WHERE i.shipment_id = ? ORDER BY i.id`, id) }
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
    const shipmentId =
      findShipmentId(db, date, publisherId, bookstoreId) ??
      run(db, 'INSERT INTO shipments (date, publisher_id, bookstore_id) VALUES (?, ?, ?)', date, publisherId, bookstoreId)
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

    // 반영 후 재고가 음수가 되는 도서가 있으면 거절(롤백) — 같은 도서 여러 행은 합산해 비교한다.
    // 이 출고에서 부수가 늘지 않은 도서는 재고가 줄지 않았으므로 검사하지 않는다(기존 데이터가 이미 음수여도 저장은 가능).
    const sum = (list: { book_id: number; qty: number }[]) =>
      list.reduce((m, x) => m.set(x.book_id, (m.get(x.book_id) ?? 0) + x.qty), new Map<number, number>())
    const requested = sum(rows.map((r) => ({ book_id: r.book.id, qty: r.qty })))
    const before = sum([...existing.values()])
    for (const r of rows) {
      const total = requested.get(r.book.id)!
      if (total <= (before.get(r.book.id) ?? 0)) continue
      const stock = getStock(db, r.book.id)
      if (stock < 0) throw new AppError(`${r.rowNum}행: '${r.book.name}' 출고 가능 ${stock + total}부, 입력 ${total}부`)
    }
    return shipmentId
  })
  return { id }
}

export function deleteShipment(db: DB, id: number) {
  requireRow(db, 'shipments', id, '출고 명세')
  if (get(db, 'SELECT 1 FROM shipment_items WHERE shipment_id = ? AND printed_at IS NOT NULL LIMIT 1', id)) {
    throw new AppError('이미 인쇄된 명세가 있어 삭제할 수 없습니다.')
  }
  run(db, 'DELETE FROM shipments WHERE id = ?', id)
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
