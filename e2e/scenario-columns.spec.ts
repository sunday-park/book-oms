import { expect, test, type Dialog, type Locator, type Page } from '@playwright/test'
import { addBook, addPublisher, col, gotoReady, pick, receive, trackErrors, withPosts } from './scenario-helpers'

/**
 * 목록 표 열 순서 바꾸기 (머리칸 ⠿ 손잡이 끌기·키보드) — 순서는 DB(ui_prefs)에 저장되어 새로고침 후에도 유지.
 * 끝에서 [열 순서 초기화]로 되돌려 뒤따르는 시나리오에 영향을 주지 않는다.
 */

const PUB = '열순서출판'
const BOOK = '열순서책'

test.describe.configure({ mode: 'serial' })

let errors: ReturnType<typeof trackErrors>
const accept = (d: Dialog) => d.accept()
test.beforeEach(({ page }) => {
  errors = trackErrors(page)
  page.on('dialog', accept)
})
test.afterEach(() => errors.assertClean())

const headers = (page: Page) => page.locator('main thead th').allInnerTexts().then((t) => t.map((s) => s.trim()))
const handle = (page: Page, header: string) => page.getByRole('button', { name: `'${header}' 열 이동` })

/** 손잡이를 마우스로 눌러 target 머리칸 왼쪽 끝까지 끌어 놓는다 */
async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 - 10, a.y + a.height / 2, { steps: 3 })
  await page.mouse.move(b.x + 8, b.y + b.height / 2, { steps: 20 })
  await page.mouse.up()
}

/** 두 칸의 가로 위치·너비가 같은지 (합계 칸이 제 열 아래 있는지) */
async function expectAligned(a: Locator, b: Locator) {
  const x = (await a.boundingBox())!
  const y = (await b.boundingBox())!
  expect(Math.abs(x.x - y.x)).toBeLessThan(1)
  expect(Math.abs(x.width - y.width)).toBeLessThan(1)
}

test('C0 준비: 출판사·도서·입고', async ({ page }) => {
  await addPublisher(page, 'C01', PUB)
  await addBook(page, PUB, BOOK)
  await receive(page, PUB, BOOK, 7)
})

test('C1 마우스로 끌어 옮기면 머리칸·칸·합계가 함께 옮겨지고, 새로고침해도 유지된다', async ({ page }) => {
  await gotoReady(page, '/receipts')
  const row = page.getByRole('row', { name: new RegExp(BOOK) })
  await expect(row).toBeVisible()
  expect(await headers(page)).toEqual(['입고일자', '출판사', '도서코드', '도서명', '입고부수'])

  // 입고부수를 맨 앞(입고일자 자리)으로 — 놓으면 저장(서버 동작 POST 1건)
  await withPosts(page, 1, () => drag(page, handle(page, '입고부수'), page.locator('main thead th[data-col="date"]')))
  expect(await headers(page)).toEqual(['입고부수', '입고일자', '출판사', '도서코드', '도서명'])
  await expect(row.getByRole('cell').first()).toHaveText('7')
  await expect(col(row, 'qty')).toHaveText('7')

  // 합계: 총 입고부수 제목은 글자 열 쪽, 합계 숫자는 입고부수 열 바로 아래
  const footer = page.getByRole('row').filter({ hasText: '총 입고부수' })
  const totalCell = footer.locator('[data-col="qty"]')
  await expect(totalCell).toHaveText(/\d/)
  await expectAligned(totalCell, page.locator('main thead th[data-col="qty"]'))
  await expect(footer.getByRole('cell').first()).toHaveAttribute('data-col', 'qty')

  await page.reload()
  await expect(row).toBeVisible()
  expect(await headers(page)).toEqual(['입고부수', '입고일자', '출판사', '도서코드', '도서명'])
  await expectAligned(footer.locator('[data-col="qty"]'), page.locator('main thead th[data-col="qty"]'))
})

test('C2 키보드로 옮긴다 (손잡이에서 Space → ArrowRight → Space), 스크린리더 안내는 한국어', async ({ page }) => {
  await gotoReady(page, '/receipts')
  await expect(page.getByRole('row', { name: new RegExp(BOOK) })).toBeVisible()
  const live = page.locator('[id^="DndLiveRegion"]')

  await handle(page, '입고일자').focus()
  await page.keyboard.press('Space')
  await expect(live).toContainText("'입고일자' 열을 들었습니다")
  await page.waitForTimeout(200) // 키보드 센서가 방향키 리스너를 붙이기까지 (들기 직후 setTimeout)
  await page.keyboard.press('ArrowRight')
  await expect(live).toContainText('번째 자리로 옮겨졌습니다')
  await withPosts(page, 1, () => page.keyboard.press('Space'))
  await expect(live).toContainText('자리에 놓았습니다')
  expect(await headers(page)).toEqual(['입고부수', '출판사', '입고일자', '도서코드', '도서명'])
  await expect(handle(page, '입고일자')).toBeFocused()

  await page.reload()
  await expect(page.getByRole('row', { name: new RegExp(BOOK) })).toBeVisible()
  expect(await headers(page)).toEqual(['입고부수', '출판사', '입고일자', '도서코드', '도서명'])
})

test('C3 묶음 표(도서 관리): 묶음 머리행 아래 열 머리행에서 옮기고, 순번은 고정', async ({ page }) => {
  await gotoReady(page, '/books')
  await pick(page, page, '출판사', PUB)
  await expect(page.getByRole('row', { name: new RegExp(BOOK) })).toBeVisible()
  const head = page.locator('main tbody tr').filter({ has: page.locator('th') }).first().locator('th')
  await expect(head).toHaveText(['순번', '도서코드', '도서명', '정가'])
  // 순번은 고정 — 손잡이가 없다
  await expect(handle(page, '순번')).toHaveCount(0)

  await handle(page, '정가').focus()
  const live = page.locator('[id^="DndLiveRegion"]')
  await page.keyboard.press('Space')
  await expect(live).toContainText("'정가' 열을 들었습니다")
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowLeft')
  await expect(live).toContainText('2번째 자리로 옮겨졌습니다')
  await withPosts(page, 1, () => page.keyboard.press('Space'))
  await expect(head).toHaveText(['순번', '도서코드', '정가', '도서명'])
  const row = page.getByRole('row', { name: new RegExp(BOOK) })
  await expect(row.getByRole('cell').nth(2)).toHaveText('10,000원')
})

test('C4 설정 [열 순서 초기화] → 모든 표가 기본 순서로', async ({ page }) => {
  let confirmText = ''
  page.on('dialog', (d) => void (confirmText = d.message()))
  await gotoReady(page, '/settings')
  await expect(page.getByText('백업·복원에도 함께 포함됩니다')).toBeVisible()
  await withPosts(page, 1, () => page.getByRole('button', { name: '열 순서 초기화' }).click())
  expect(confirmText).toBe('모든 목록 표의 열 순서를 처음 상태로 되돌릴까요?')
  await expect(page.getByText('열 순서를 초기화했습니다.')).toBeVisible()

  // 같은 앱 안에서 이동해도, 새로고침해도 기본 순서
  await page.locator('aside').getByRole('link', { name: '입고 관리' }).click()
  await expect(page.getByRole('row', { name: new RegExp(BOOK) })).toBeVisible()
  expect(await headers(page)).toEqual(['입고일자', '출판사', '도서코드', '도서명', '입고부수'])
  await page.reload()
  await expect(page.getByRole('row', { name: new RegExp(BOOK) })).toBeVisible()
  expect(await headers(page)).toEqual(['입고일자', '출판사', '도서코드', '도서명', '입고부수'])
  const footer = page.getByRole('row').filter({ hasText: '총 입고부수' })
  await expect(footer.getByRole('cell').first()).toHaveText('총 입고부수')
  await expectAligned(footer.locator('[data-col="qty"]'), page.locator('main thead th[data-col="qty"]'))

  await gotoReady(page, '/books')
  await pick(page, page, '출판사', PUB)
  await expect(page.locator('main tbody tr').filter({ has: page.locator('th') }).first().locator('th')).toHaveText(['순번', '도서코드', '도서명', '정가'])
})
