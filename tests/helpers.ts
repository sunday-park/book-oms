import { openDb } from '@/lib/db'
import { createBook, saveBookstore, savePublisher } from '@/lib/repo/master'

export function seed() {
  const db = openDb(':memory:')
  const p1 = savePublisher(db, { code: 'P01', name: '한빛출판', phone: '02-111-1111', fax: '', biz_no: null })
  const p2 = savePublisher(db, { code: 'P02', name: '길벗', phone: '', fax: '', biz_no: null })
  const s1 = saveBookstore(db, { code: 'S01', name: '교보문고 광화문', region: '서울특별시' })
  const s2 = saveBookstore(db, { code: 'S02', name: '영풍문고 부산', region: '부산광역시' })
  const b1 = createBook(db, { publisher_id: p1, name: '리액트 입문', list_price: 20000 })
  const b2 = createBook(db, { publisher_id: p1, name: '타입스크립트', list_price: 15000 })
  const b3 = createBook(db, { publisher_id: p2, name: '파이썬 기초', list_price: 18000 })
  return { db, p1, p2, s1, s2, b1, b2, b3 }
}
