import { expect, test, type Dialog, type Page } from '@playwright/test'
import {
  addBook, addPublisher, addRow, addStore, dialog, entryRow, fillRow, openEntry, pick, receive, saveEntry, saveEntryRejected,
  stockRow, submitReturn, today, trackErrors, withPosts,
} from './scenario-helpers'

/**
 * "말도 안 되는 경우" 시나리오 (flow 다음, 같은 서버·DB).
 * 다른 시나리오와 겹치지 않게 출판사 Z01~, 서점 Y01~, 도서명 Z… 를 쓴다.
 * 결과 표기: ✅ 이미 막힘 / 🔧 이번에 막음 / ⚠️ 허용됨(결정 필요 — 현재 동작을 기록만 한다)
 */

const Z = 'Z출판'
test.describe.configure({ mode: 'serial' })

let errors: ReturnType<typeof trackErrors>
let alerts: string[]
const accept = (d: Dialog) => d.accept()
test.beforeEach(({ page }) => {
  errors = trackErrors(page)
  alerts = []
  page.on('dialog', (d) => {
    if (d.type() === 'alert') alerts.push(d.message())
  })
  page.on('dialog', accept)
})
test.afterEach(() => {
  errors.assertClean()
  expect(alerts).toEqual([]) // 입력한 문자열이 스크립트로 실행되면 alert 가 뜬다
})

const formError = (page: Page) => dialog(page).locator('.text-destructive')

test('Z0 준비', async ({ page }) => {
  test.setTimeout(180_000)
  await addPublisher(page, 'Z01', Z)
  for (const [code, name] of [['Y01', 'Y서점일'], ['Y02', 'Y서점이'], ['Y03', 'Y서점삼'], ['Y04', 'Y서점사'], ['Y06', 'Y서점백']]) await addStore(page, code, name)
  for (const name of ['Z책A', 'Z책B', 'Z미래책', 'Z반품책']) await addBook(page, Z, name, 15000)
  await receive(page, Z, 'Z책A', 100)
  await receive(page, Z, 'Z책B', 1000)
  await receive(page, Z, 'Z반품책', 20)
})

const BAD_QTY = ['-5', '0', '1.5', '1000000000000', '', 'e', '--']
async function typeQty(page: Page, label: string, v: string) {
  const input = page.getByLabel(label)
  await input.fill('')
  // 'e', '--' 는 숫자 칸에 fill 할 수 없어 키보드로 친다 (브라우저는 값을 빈칸으로 넘긴다)
  if (/^[\d.-]+$/.test(v) && v !== '--') await input.fill(v)
  else if (v) await input.pressSequentially(v)
}

test('A1 부수: 음수·0·소수·엄청 큰 수·빈칸·e·-- — 입고·반품·출고 모두 거절', async ({ page }) => {
  await page.goto('/receipts')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await pick(page, dialog(page), '출판사', Z)
  await pick(page, dialog(page), '도서', 'Z책A')
  for (const v of BAD_QTY) {
    await typeQty(page, '입고부수', v)
    await dialog(page).getByRole('button', { name: '저장' }).click()
    await expect(formError(page)).toHaveText('입고부수는 1 이상 999,999 이하 정수로 입력하세요.')
  }
  await dialog(page).getByRole('button', { name: '취소' }).click()

  await page.goto('/returns')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await pick(page, dialog(page), '출판사', Z)
  await pick(page, dialog(page), '서점', 'Y서점일')
  await pick(page, dialog(page), '도서', 'Z책A')
  for (const v of BAD_QTY) {
    await typeQty(page, '부수', v)
    await dialog(page).getByRole('button', { name: '저장' }).click()
    await expect(formError(page)).toHaveText('부수는 1 이상 999,999 이하 정수로 입력하세요.')
  }
  await dialog(page).getByRole('button', { name: '취소' }).click()

  await openEntry(page, Z, 'Y서점일')
  await pick(page, page, '1행 도서', 'Z책A')
  for (const v of BAD_QTY) {
    await typeQty(page, '1행 부수', v)
    await saveEntryRejected(page, '1행: 부수는 1 이상 999,999 이하 정수로 입력하세요.')
  }

  const row = await stockRow(page, Z, 'Z책A')
  await expect(row.getByRole('cell').nth(2)).toHaveText('100')
  await expect(row.getByRole('cell').nth(3)).toHaveText('0')
  await expect(row.getByRole('cell').nth(4)).toHaveText('0')
})

test('A2 정가(음수·소수·큰 수) 거절, 출고율 0·음수·100 초과 거절, 62.5 허용', async ({ page }) => {
  await page.goto('/books')
  await pick(page, page, '출판사', Z)
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await dialog(page).getByLabel('도서명').fill('Z정가책')
  for (const v of ['-1', '1.5', '1000000000000']) {
    await dialog(page).getByLabel('정가').fill(v)
    await dialog(page).getByRole('button', { name: '저장' }).click()
    await expect(formError(page)).toHaveText('정가는 0 이상 9,999,999 이하 정수로 입력하세요.')
  }
  await dialog(page).getByRole('button', { name: '취소' }).click()
  await expect(page.getByRole('row', { name: /Z정가책/ })).toHaveCount(0)

  await openEntry(page, Z, 'Y서점일')
  await fillRow(page, 1, 'Z책A', 2)
  for (const v of ['0', '-5', '101']) {
    await page.getByLabel('1행 출고율').fill(v)
    await saveEntryRejected(page, '1행: 출고율은 0 초과 100 이하로 입력하세요.')
  }
  await page.getByLabel('1행 출고율').fill('62.5')
  await expect(entryRow(page, 1).getByRole('cell', { name: '9,375원' })).toBeVisible() // 15,000 × 62.5% = 9,375
  await saveEntry(page)
  await expect(page.getByLabel('1행 출고율')).toHaveValue('62.5')
})

test('A3 날짜: 빈 날짜 거절, 1900·2999 년은 ⚠️ 허용', async ({ page }) => {
  await page.goto('/receipts')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await dialog(page).getByLabel('입고일자').fill('')
  await pick(page, dialog(page), '출판사', Z)
  await pick(page, dialog(page), '도서', 'Z미래책')
  await dialog(page).getByLabel('입고부수').fill('1')
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect(formError(page)).toHaveText('입고일자를 선택하세요.')
  await dialog(page).getByRole('button', { name: '취소' }).click()

  // 먼 과거·미래 날짜는 확인(수락)을 거쳐 저장된다 — 확인 창은 B9 에서 따로 본다
  await receive(page, Z, 'Z미래책', 1, '1900-01-01')
  await receive(page, Z, 'Z미래책', 1, '2999-12-31')
  const row = await stockRow(page, Z, 'Z미래책')
  await expect(row.getByRole('cell').nth(2)).toHaveText('2')
})

test('A4 이름: 공백만 거절, 앞뒤 공백 trim, 101자 거절, <script>·이모지는 글자 그대로(화면·인쇄물)', async ({ page }) => {
  await page.goto('/publishers')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await dialog(page).getByLabel('출판사코드').fill('Z02')
  await dialog(page).getByLabel('출판사명').fill('   ')
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect(formError(page)).toHaveText('출판사명을 입력하세요.')
  await dialog(page).getByLabel('출판사명').fill('가'.repeat(500))
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect(formError(page)).toHaveText('출판사명은 100자 이하로 입력하세요.')
  await dialog(page).getByRole('button', { name: '취소' }).click()

  await addPublisher(page, '  Z02  ', '  Z공백출판  ')
  await expect(page.getByRole('cell', { name: 'Z공백출판', exact: true })).toBeVisible()

  const XSS = '<script>alert(1)</script><img src=x onerror=alert(2)>'
  await addPublisher(page, 'Z03', XSS)
  await expect(page.getByRole('cell', { name: XSS, exact: true })).toBeVisible()
  await addStore(page, 'Y05', '📚 이모지서점 🚚')
  await expect(page.getByRole('cell', { name: '📚 이모지서점 🚚', exact: true })).toBeVisible()

  // 인쇄물(거래명세서)에도 글자 그대로 찍히는지
  await addBook(page, XSS, 'Z스크립트책')
  await receive(page, XSS, 'Z스크립트책', 5)
  await openEntry(page, XSS, '📚 이모지서점')
  await fillRow(page, 1, 'Z스크립트책', 1)
  await saveEntry(page)
  await page.goto('/statements/print')
  await pick(page, page, '출판사', XSS)
  await pick(page, page, '서점', '📚 이모지서점')
  await expect(page.getByText('공급자', { exact: true }).locator('..')).toContainText(XSS)
  await expect(page.getByText('공급받는자', { exact: true }).locator('..')).toContainText('📚 이모지서점 🚚')
  await expect(page.locator('main img')).toHaveCount(0)
})

test('A5 코드 중복: 같은 코드·대소문자만 다른 코드 모두 거절', async ({ page }) => {
  for (const code of ['Z01', 'z01']) {
    await page.goto('/publishers')
    await page.getByRole('button', { name: '등록', exact: true }).click()
    await dialog(page).getByLabel('출판사코드').fill(code)
    await dialog(page).getByLabel('출판사명').fill('중복출판')
    await dialog(page).getByRole('button', { name: '저장' }).click()
    await expect(formError(page)).toHaveText('이미 등록된 코드입니다.')
  }
  for (const code of ['Y01', 'y01']) {
    await page.goto('/bookstores')
    await page.getByRole('button', { name: '등록', exact: true }).click()
    await dialog(page).getByLabel('서점코드').fill(code)
    await dialog(page).getByLabel('서점명').fill('중복서점')
    await dialog(page).getByRole('combobox', { name: '지역' }).click()
    await page.getByRole('option', { name: '서울특별시' }).click()
    await dialog(page).getByRole('button', { name: '저장' }).click()
    await expect(formError(page)).toHaveText('이미 등록된 코드입니다.')
  }
})

test('B1 반품: 출고한 적 없는 서점 반품·출고보다 많은 반품 거절', async ({ page }) => {
  await submitReturn(page, Z, 'Y서점이', 'Z반품책', 1)
  await expect(formError(page)).toHaveText(`'Z반품책'은 'Y서점이'에 ${today()}까지 반품 가능한 부수가 0부입니다.`)

  await openEntry(page, Z, 'Y서점이')
  await fillRow(page, 1, 'Z반품책', 5)
  await saveEntry(page)
  await submitReturn(page, Z, 'Y서점이', 'Z반품책', 10)
  await expect(formError(page)).toHaveText(`'Z반품책'은 'Y서점이'에 ${today()}까지 반품 가능한 부수가 5부입니다.`)
  await dialog(page).getByLabel('부수').fill('5')
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect(dialog(page)).toBeHidden()

  const row = await stockRow(page, Z, 'Z반품책')
  await expect(row.getByRole('cell').nth(5)).toHaveText('20') // 입고 20 − 출고 5 + 반품 5
})

test('B2 🔧 날짜 역전: 내년 입고로 오늘 출고 막힘, 출고일 이전 날짜 반품 막힘', async ({ page }) => {
  const nextYear = `${Number(today().slice(0, 4)) + 1}${today().slice(4)}`.replace(/-02-29$/, '-02-28')
  await receive(page, Z, 'Z미래책', 10, nextYear)
  await openEntry(page, Z, 'Y서점삼')
  await fillRow(page, 1, 'Z미래책', 12) // 전체 재고는 12(1900년 1 + 2999년 1 + 내년 10)지만 오늘 기준으로는 1부
  await expect(entryRow(page, 1).getByText(/출고 가능/)).toHaveText('출고 가능 1부')
  await saveEntryRejected(page, `1행: 'Z미래책' ${today()} 기준 출고 가능 1부, 입력 12부`)
  await page.getByLabel('1행 부수').fill('1')
  await saveEntry(page)

  await submitReturn(page, Z, 'Y서점삼', 'Z미래책', 1, '2020-01-01') // 이상 날짜 확인은 수락
  await expect(formError(page)).toHaveText("'Z미래책'은 'Y서점삼'에 2020-01-01까지 반품 가능한 부수가 0부입니다.")
  await dialog(page).getByRole('button', { name: '취소' }).click()
  const row = await stockRow(page, Z, 'Z미래책')
  await expect(row.getByRole('cell').nth(5)).toHaveText('11')
})

test('B3 같은 도서 여러 행: 합계로 막고, 줄이면 저장', async ({ page }) => {
  await openEntry(page, Z, 'Y서점사')
  await fillRow(page, 1, 'Z책A', 60)
  await addRow(page, 2, 'Z책A', 50)
  for (const n of [1, 2]) {
    await expect(entryRow(page, n).getByText(/출고 가능/)).toHaveText('출고 가능 98부')
    await expect(entryRow(page, n).getByText(/출고 가능/)).toHaveClass(/text-neg/)
  }
  await saveEntryRejected(page, `1행: 'Z책A' ${today()} 기준 출고 가능 98부, 입력 110부`)
  await page.getByLabel('2행 부수').fill('38')
  await expect(entryRow(page, 2).getByText(/출고 가능/)).not.toHaveClass(/text-neg/)
  await saveEntry(page)
})

test('B4 🔧 두 탭 동시 편집: 오래된 탭의 저장은 막히고, 다른 탭이 추가한 행은 남는다', async ({ page, context }) => {
  const other = await context.newPage()
  const otherErrors = trackErrors(other)
  other.on('dialog', accept)
  await openEntry(page, Z, 'Y서점사')
  await openEntry(other, Z, 'Y서점사')
  await expect(other.locator('main tbody tr')).toHaveCount(2)

  await addRow(page, 3, 'Z책B', 5) // 탭 A: 행 추가 후 저장
  await saveEntry(page)
  await expect(page.locator('main tbody tr')).toHaveCount(3)

  await saveEntryRejected(other, '다른 곳에서 이 출고 명세가 먼저 수정되었습니다. [취소]를 눌러 새로 불러온 뒤 다시 입력하세요.') // 탭 B: 2행짜리 오래된 화면
  await withPosts(other, 2, () => other.getByRole('button', { name: '취소' }).click())
  await expect(other.locator('main tbody tr')).toHaveCount(3) // [취소]로 새로 불러오면 탭 A 의 행이 보인다

  await openEntry(page, Z, 'Y서점사') // 다시 열어도 그대로
  await expect(page.locator('main tbody tr')).toHaveCount(3)
  await expect(page.getByLabel('3행 부수')).toHaveValue('5')
  const row = await stockRow(page, Z, 'Z책B')
  await expect(row.getByRole('cell').nth(3)).toHaveText('5')
  otherErrors.assertClean()
  await other.close()
})

test('B5 인쇄된 명세: 출고 삭제·인쇄된 행 수정은 막힘', async ({ page }) => {
  await page.goto('/statements/print')
  await pick(page, page, '출판사', Z)
  await pick(page, page, '서점', 'Y서점사')
  await expect(page.locator('main tbody tr')).toHaveCount(3)
  await page.evaluate(() => {
    window.print = () => {}
  })
  await page.getByRole('button', { name: '출력' }).click()
  await expect(page.getByText('새로 추가된 도서 없음')).toBeVisible()

  await openEntry(page, Z, 'Y서점사')
  await expect(page.getByLabel('1행 부수')).toBeDisabled()
  await expect(page.getByLabel('2행 부수')).toBeDisabled()
  await expect(page.getByRole('button', { name: '1행 삭제' })).toBeDisabled()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('이미 인쇄된 명세가 있어 삭제할 수 없습니다.')).toBeVisible()
  await expect(page.locator('main tbody tr')).toHaveCount(3)
})

test('B7 출고 100행 한 번에 저장', async ({ page }) => {
  test.setTimeout(300_000)
  await openEntry(page, Z, 'Y서점백')
  await fillRow(page, 1, 'Z책B', 1)
  for (let n = 2; n <= 100; n++) await addRow(page, n, 'Z책B', 1)
  await expect(page.getByRole('row', { name: /합계/ })).toContainText('총 100부')
  await expect(entryRow(page, 100).getByText(/출고 가능/)).toHaveText('출고 가능 995부') // B4 에서 5부 출고

  const t = Date.now()
  await saveEntry(page)
  const ms = Date.now() - t
  console.log(`B7 100행 저장+다시 불러오기: ${ms}ms`)
  expect(ms).toBeLessThan(5000)

  await openEntry(page, Z, 'Y서점백')
  await expect(page.locator('main tbody tr')).toHaveCount(100)
  await expect(page.getByLabel('100행 부수')).toHaveValue('1')
  // 가로 넘침으로 화면이 깨지지 않는지 (문서 폭이 창 폭을 넘지 않음)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('B8 이력이 있는 출판사·서점·도서 삭제는 막힘', async ({ page }) => {
  await page.goto('/publishers')
  await page.getByRole('cell', { name: Z, exact: true }).click()
  await page.getByRole('button', { name: '수정' }).click()
  await dialog(page).getByRole('button', { name: '삭제' }).click()
  await expect(formError(page)).toHaveText('소속 도서가 있어 삭제할 수 없습니다.')
  await dialog(page).getByRole('button', { name: '취소' }).click()

  await page.goto('/bookstores')
  await page.getByRole('cell', { name: 'Y서점이', exact: true }).click()
  await page.getByRole('button', { name: '수정' }).click()
  await dialog(page).getByRole('button', { name: '삭제' }).click()
  await expect(formError(page)).toHaveText('출고·반품 이력이 있어 삭제할 수 없습니다.')
  await dialog(page).getByRole('button', { name: '취소' }).click()

  await page.goto('/books')
  await pick(page, page, '출판사', Z)
  await page.getByRole('row', { name: /Z책A/ }).click()
  await page.getByRole('button', { name: '수정' }).click()
  await dialog(page).getByRole('button', { name: '삭제' }).click()
  await expect(formError(page)).toHaveText('입고·출고·반품 이력이 있어 삭제할 수 없습니다.')
  await dialog(page).getByRole('button', { name: '취소' }).click()
  await expect(page.getByRole('row', { name: /Z책A/ })).toBeVisible()
})

test('B9 🔧 오늘과 1년 넘게 차이 나는 날짜는 확인을 받는다 (취소 → 저장 안 함, 확인 → 저장)', async ({ page }) => {
  const confirms: string[] = []
  page.off('dialog', accept)
  page.on('dialog', (d) => {
    if (d.type() !== 'confirm') return
    confirms.push(d.message())
    void (confirms.length === 1 ? d.dismiss() : d.accept())
  })
  await page.goto('/receipts')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await dialog(page).getByLabel('입고일자').fill('2020-01-01')
  await pick(page, dialog(page), '출판사', Z)
  await pick(page, dialog(page), '도서', 'Z반품책')
  await dialog(page).getByLabel('입고부수').fill('7')
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect.poll(() => confirms.length).toBe(1)
  expect(confirms[0]).toBe('입력한 날짜(2020-01-01)가 오늘과 1년 이상 차이 납니다. 이 날짜가 맞나요?')
  await expect(dialog(page)).toBeVisible() // 취소 → 창이 그대로, 저장 안 됨
  let row = await stockRow(page, Z, 'Z반품책')
  await expect(row.getByRole('cell').nth(2)).toHaveText('20')

  await receive(page, Z, 'Z반품책', 7, '2020-01-01') // 두 번째 확인은 수락 → 저장
  expect(confirms).toHaveLength(2)
  row = await stockRow(page, Z, 'Z반품책')
  await expect(row.getByRole('cell').nth(2)).toHaveText('27')
})

test('B10 🔧 기간 필터: 시작일이 종료일보다 늦어지는 값은 적용하지 않고 알린다 (입고·반품)', async ({ page }) => {
  for (const url of ['/receipts', '/returns']) {
    await page.goto(url)
    const from = page.getByLabel('시작일')
    const to = page.getByLabel('종료일')
    await expect(from).toHaveAttribute('max', today())
    await expect(to).toHaveAttribute('min', today())

    await from.fill('2099-01-01')
    await expect(page.getByText('시작일은 종료일보다 늦을 수 없습니다.').last()).toBeVisible()
    await expect(from).toHaveValue(today())

    await to.fill('2000-01-01')
    await expect(page.getByText('시작일은 종료일보다 늦을 수 없습니다.')).not.toHaveCount(0)
    await expect(to).toHaveValue(today())

    await from.fill('2000-01-01') // 뒤집히지 않는 값은 그대로 적용
    await expect(from).toHaveValue('2000-01-01')
    await expect(to).toHaveAttribute('min', '2000-01-01')
  }
})
