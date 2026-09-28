import { type DB, all, get, run, tx } from '@/lib/db'
import { formatBookCode } from '@/lib/domain'
import { AppError } from '@/lib/result'
import { requireId, requireText } from '@/lib/validate'

export type Publisher = { id: number; code: string; name: string; phone: string; fax: string; biz_no: string | null }
export type PublisherInput = Omit<Publisher, 'id'>
export type Bookstore = { id: number; code: string; name: string; region: string }
export type BookstoreInput = Omit<Bookstore, 'id'>
export type Book = {
  id: number
  publisher_id: number
  publisher_code: string
  publisher_name: string
  code: string
  name: string
  list_price: number
}
export type BookInput = { publisher_id: number | null; name: string; list_price: number }

// ── 출판사 ──
export function listPublishers(db: DB) {
  return all<Publisher>(db, 'SELECT id, code, name, phone, fax, biz_no FROM publishers ORDER BY code')
}

export function savePublisher(db: DB, input: PublisherInput, id?: number) {
  const name = requireText(input.name, '출판사명')
  const phone = input.phone.trim()
  const fax = input.fax.trim()
  const bizNo = input.biz_no?.trim() || null
  if (id) {
    // 출판사코드는 도서코드에 쓰이므로 수정하지 않는다
    run(db, 'UPDATE publishers SET name = ?, phone = ?, fax = ?, biz_no = ? WHERE id = ?', name, phone, fax, bizNo, id)
    return id
  }
  const code = requireText(input.code, '출판사코드')
  return run(db, 'INSERT INTO publishers (code, name, phone, fax, biz_no) VALUES (?, ?, ?, ?, ?)', code, name, phone, fax, bizNo)
}

export function deletePublisher(db: DB, id: number) {
  if (get(db, 'SELECT 1 FROM books WHERE publisher_id = ? LIMIT 1', id)) throw new AppError('소속 도서가 있어 삭제할 수 없습니다.')
  run(db, 'DELETE FROM publishers WHERE id = ?', id)
}

// ── 서점 ──
export function listBookstores(db: DB) {
  return all<Bookstore>(db, 'SELECT id, code, name, region FROM bookstores ORDER BY code')
}

export function saveBookstore(db: DB, input: BookstoreInput, id?: number) {
  const code = requireText(input.code, '서점코드')
  const name = requireText(input.name, '서점명')
  const region = requireText(input.region, '지역')
  if (id) {
    run(db, 'UPDATE bookstores SET code = ?, name = ?, region = ? WHERE id = ?', code, name, region, id)
    return id
  }
  return run(db, 'INSERT INTO bookstores (code, name, region) VALUES (?, ?, ?)', code, name, region)
}

export function deleteBookstore(db: DB, id: number) {
  const used = get(db, 'SELECT 1 FROM shipments WHERE bookstore_id = ? UNION ALL SELECT 1 FROM returns WHERE bookstore_id = ? LIMIT 1', id, id)
  if (used) throw new AppError('출고·반품 이력이 있어 삭제할 수 없습니다.')
  run(db, 'DELETE FROM bookstores WHERE id = ?', id)
}

// ── 도서 ──
const BOOK_SELECT = `SELECT b.id, b.publisher_id, p.code AS publisher_code, p.name AS publisher_name, b.code, b.name, b.list_price
  FROM books b JOIN publishers p ON p.id = b.publisher_id`

export function listBooks(db: DB, publisherId?: number) {
  return publisherId
    ? all<Book>(db, `${BOOK_SELECT} WHERE b.publisher_id = ? ORDER BY b.code`, publisherId)
    : all<Book>(db, `${BOOK_SELECT} ORDER BY b.code`)
}

export function getBook(db: DB, id: number) {
  const book = get<Book>(db, `${BOOK_SELECT} WHERE b.id = ?`, id)
  if (!book) throw new AppError('도서를 찾을 수 없습니다.')
  return book
}

function requirePrice(v: number) {
  if (!Number.isInteger(v) || v < 0) throw new AppError('정가는 0 이상 정수로 입력하세요.')
  return v
}

export function createBook(db: DB, input: BookInput) {
  const publisherId = requireId(input.publisher_id, '출판사')
  const name = requireText(input.name, '도서명')
  const price = requirePrice(input.list_price)
  return tx(db, () => {
    const pub = get<{ code: string; book_seq: number }>(db, 'SELECT code, book_seq FROM publishers WHERE id = ?', publisherId)
    if (!pub) throw new AppError('출판사를 찾을 수 없습니다.')
    const seq = pub.book_seq + 1
    run(db, 'UPDATE publishers SET book_seq = ? WHERE id = ?', seq, publisherId)
    return run(
      db,
      'INSERT INTO books (publisher_id, code, seq, name, list_price) VALUES (?, ?, ?, ?, ?)',
      publisherId,
      formatBookCode(pub.code, seq),
      seq,
      name,
      price,
    )
  })
}

export function updateBook(db: DB, id: number, input: { name: string; list_price: number }) {
  run(db, 'UPDATE books SET name = ?, list_price = ? WHERE id = ?', requireText(input.name, '도서명'), requirePrice(input.list_price), id)
}

export function deleteBook(db: DB, id: number) {
  const used = get(
    db,
    `SELECT 1 FROM receipts WHERE book_id = ? UNION ALL SELECT 1 FROM shipment_items WHERE book_id = ?
     UNION ALL SELECT 1 FROM returns WHERE book_id = ? LIMIT 1`,
    id,
    id,
    id,
  )
  if (used) throw new AppError('입고·출고·반품 이력이 있어 삭제할 수 없습니다.')
  run(db, 'DELETE FROM books WHERE id = ?', id)
}
