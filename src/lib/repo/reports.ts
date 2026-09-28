import { type DB, all, get } from '@/lib/db'
import { calcStock, type ShipKind } from '@/lib/domain'

export type StockRow = { book_id: number; code: string; name: string; received: number; shipped: number; returned: number; stock: number }

const STOCK_SELECT = `SELECT b.id AS book_id, b.code, b.name,
  COALESCE((SELECT SUM(qty) FROM receipts WHERE book_id = b.id), 0) AS received,
  COALESCE((SELECT SUM(qty) FROM shipment_items WHERE book_id = b.id), 0) AS shipped,
  COALESCE((SELECT SUM(qty) FROM returns WHERE book_id = b.id), 0) AS returned
  FROM books b`

const withStock = (r: Omit<StockRow, 'stock'>): StockRow => ({ ...r, stock: calcStock(r.received, r.shipped, r.returned) })

export function listStock(db: DB, publisherId: number) {
  return all<Omit<StockRow, 'stock'>>(db, `${STOCK_SELECT} WHERE b.publisher_id = ? ORDER BY b.code`, publisherId).map(withStock)
}

export function getStock(db: DB, bookId: number) {
  const r = get<Omit<StockRow, 'stock'>>(db, `${STOCK_SELECT} WHERE b.id = ?`, bookId)
  return r ? withStock(r).stock : 0
}

export type ShipmentStatusFilter = { date: string; publisherId?: number; bookstoreId?: number }
export type ShipmentStatusRow = {
  id: number
  date: string
  book_code: string
  book_name: string
  publisher_name: string
  bookstore_name: string
  kind: ShipKind
  qty: number
}

export function listShipmentStatus(db: DB, f: ShipmentStatusFilter) {
  return all<ShipmentStatusRow>(
    db,
    `SELECT i.id, s.date, b.code AS book_code, b.name AS book_name, p.name AS publisher_name, st.name AS bookstore_name, i.kind, i.qty
     FROM shipment_items i
     JOIN shipments s ON s.id = i.shipment_id
     JOIN books b ON b.id = i.book_id
     JOIN publishers p ON p.id = s.publisher_id
     JOIN bookstores st ON st.id = s.bookstore_id
     WHERE s.date = ? AND (? IS NULL OR s.publisher_id = ?) AND (? IS NULL OR s.bookstore_id = ?)
     ORDER BY b.code, b.name, s.date, st.code`,
    f.date,
    f.publisherId ?? null,
    f.publisherId ?? null,
    f.bookstoreId ?? null,
    f.bookstoreId ?? null,
  )
}

export type DispatchGroup = {
  bookstore_id: number
  bookstore_code: string
  bookstore_name: string
  region: string
  items: { id: number; book_code: string; book_name: string; kind: ShipKind; qty: number }[]
  total: number
}

export function listDispatch(db: DB, date: string, publisherId: number) {
  const rows = all<Omit<DispatchGroup, 'items' | 'total'> & DispatchGroup['items'][number]>(
    db,
    `SELECT st.id AS bookstore_id, st.code AS bookstore_code, st.name AS bookstore_name, st.region,
            i.id, b.code AS book_code, b.name AS book_name, i.kind, i.qty
     FROM shipment_items i
     JOIN shipments s ON s.id = i.shipment_id
     JOIN books b ON b.id = i.book_id
     JOIN bookstores st ON st.id = s.bookstore_id
     WHERE s.date = ? AND s.publisher_id = ?
     ORDER BY st.code, b.code, i.id`,
    date,
    publisherId,
  )
  const groups = new Map<number, DispatchGroup>()
  for (const r of rows) {
    let g = groups.get(r.bookstore_id)
    if (!g) {
      g = { bookstore_id: r.bookstore_id, bookstore_code: r.bookstore_code, bookstore_name: r.bookstore_name, region: r.region, items: [], total: 0 }
      groups.set(r.bookstore_id, g)
    }
    g.items.push({ id: r.id, book_code: r.book_code, book_name: r.book_name, kind: r.kind, qty: r.qty })
    g.total += r.qty
  }
  return [...groups.values()]
}
