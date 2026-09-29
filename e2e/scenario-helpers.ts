import { expect, type Locator, type Page, type Response } from '@playwright/test'

/** 시나리오 테스트 공용 도우미 — 선택자는 flow.spec.ts 와 같은 방식을 쓴다 */

export function trackErrors(page: Page) {
  const pageErrors: Error[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  return {
    assertClean() {
      expect(pageErrors).toEqual([])
      expect(consoleErrors).toEqual([])
    },
  }
}

export const today = () => new Date().toLocaleDateString('sv-SE')
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function pick(page: Page, scope: Page | Locator, label: string, text: string) {
  await scope.getByRole('combobox', { name: label }).click()
  // 방금 연 팝오버만 대상으로 한다 (닫히는 중인 이전 팝오버가 잠시 DOM 에 남을 수 있다)
  const popover = page.locator('[data-slot="popover-content"][data-state="open"]')
  await popover.getByPlaceholder('검색...').fill(text)
  await popover.getByRole('option', { name: new RegExp(escape(text)) }).first().click()
}

/** 서버 동작(POST) 응답 n 개를 기다린다 — 화면이 불러온 결과로 입력을 덮어쓰기 전에 다음 조작을 하지 않도록 */
export async function withPosts(page: Page, n: number, action: () => Promise<void>) {
  let count = 0
  let resolve!: () => void
  const done = new Promise<void>((r) => (resolve = r))
  const onResponse = (r: Response) => {
    if (r.request().method() === 'POST' && ++count >= n) resolve()
  }
  page.on('response', onResponse)
  try {
    await action()
    await done
  } finally {
    page.off('response', onResponse)
  }
}

/**
 * 화면을 열고 첫 조회(서버 동작 POST) 응답까지 기다린다 = 하이드레이션이 끝났다는 신호.
 * 그 전에 날짜 칸을 채우면 React 상태에 반영되지 않고 오늘 날짜로 되돌아갈 수 있다.
 */
export async function gotoReady(page: Page, url: string) {
  await withPosts(page, 1, async () => {
    await page.goto(url)
  })
}

// 폼 다이얼로그 (콤보박스 팝오버도 role=dialog 라 data-slot 으로 구분)
export const dialog = (page: Page) => page.locator('[data-slot="dialog-content"]')

export async function addPublisher(page: Page, code: string, name: string) {
  await page.goto('/publishers')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await dialog(page).getByLabel('출판사코드').fill(code)
  await dialog(page).getByLabel('출판사명').fill(name)
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(page.getByRole('cell', { name: code.trim(), exact: true })).toBeVisible()
}

export async function addStore(page: Page, code: string, name: string, region = '서울특별시') {
  await page.goto('/bookstores')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await dialog(page).getByLabel('서점코드').fill(code)
  await dialog(page).getByLabel('서점명').fill(name)
  await dialog(page).getByRole('combobox', { name: '지역' }).click()
  await page.getByRole('option', { name: region }).click()
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(page.getByRole('cell', { name: code, exact: true })).toBeVisible()
}

/** 도서를 등록하고 부여된 도서코드를 돌려준다 */
export async function addBook(page: Page, pubName: string, name: string, price = 10000) {
  await page.goto('/books')
  await pick(page, page, '출판사', pubName)
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await expect(dialog(page).getByRole('combobox', { name: '출판사' })).toHaveText(new RegExp(escape(pubName)))
  await dialog(page).getByLabel('도서명').fill(name)
  await dialog(page).getByLabel('정가').fill(String(price))
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect(dialog(page)).toBeHidden()
  const row = page.getByRole('row', { name: new RegExp(escape(name)) })
  await expect(row).toBeVisible()
  return (await row.getByRole('cell').nth(1).innerText()).trim()
}

export async function receive(page: Page, pubName: string, bookName: string, qty: number, date?: string) {
  await page.goto('/receipts')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  if (date) await dialog(page).getByLabel('입고일자').fill(date)
  await pick(page, dialog(page), '출판사', pubName)
  await pick(page, dialog(page), '도서', bookName)
  await dialog(page).getByLabel('입고부수').fill(String(qty))
  await dialog(page).getByRole('button', { name: '저장' }).click()
  await expect(dialog(page)).toBeHidden()
}

/** 반품 등록 다이얼로그를 채우고 [저장] — 성공 여부는 호출한 쪽에서 확인 */
export async function submitReturn(page: Page, pubName: string, storeName: string, bookName: string, qty: number, date?: string) {
  await page.goto('/returns')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  if (date) await dialog(page).getByLabel('반품일자').fill(date)
  await pick(page, dialog(page), '출판사', pubName)
  await pick(page, dialog(page), '서점', storeName)
  await pick(page, dialog(page), '도서', bookName)
  await dialog(page).getByLabel('부수').fill(String(qty))
  await dialog(page).getByRole('button', { name: '저장' }).click()
}

/** 출고 입력을 열고 서점 → 출판사 순으로 선택한 뒤, 불러오기(출고·재고·도서 목록 3건)가 끝날 때까지 기다린다 */
export async function openEntry(page: Page, pubName: string, storeName: string, date?: string) {
  await gotoReady(page, '/statements/entry')
  await expect(page.getByText('출판사와 서점을 선택하세요.')).toBeVisible()
  if (date) await page.getByLabel('날짜').fill(date)
  await expect(page.getByLabel('날짜')).toHaveValue(date ?? today())
  await pick(page, page, '서점', storeName)
  await withPosts(page, 3, () => pick(page, page, '출판사', pubName))
  await expect(page.getByRole('button', { name: '저장' })).toBeVisible()
}

export const entryRow = (page: Page, n: number) => page.locator('main tbody tr').nth(n - 1)

export async function fillRow(page: Page, n: number, bookName: string, qty: number) {
  await pick(page, page, `${n}행 도서`, bookName)
  await page.getByLabel(`${n}행 부수`).fill(String(qty))
}

export async function addRow(page: Page, n: number, bookName: string, qty: number) {
  await page.getByRole('button', { name: '+ 행 추가' }).click()
  await fillRow(page, n, bookName, qty)
}

/** 출고 [저장] — 성공이면 저장 후 다시 불러오기(2건)까지 기다린다 */
export async function saveEntry(page: Page) {
  await withPosts(page, 3, () => page.getByRole('button', { name: '저장' }).click())
  await expect(page.getByText('저장했습니다.').last()).toBeVisible()
}

/** 출고 [저장]이 거절되고 안내가 보이는지 */
export async function saveEntryRejected(page: Page, message: string) {
  await withPosts(page, 1, () => page.getByRole('button', { name: '저장' }).click())
  await expect(page.locator('main').getByText(message, { exact: true })).toBeVisible()
}

/** 재고 현황에서 도서 한 줄의 [입고, 출고, 반품, 현재고] 칸 */
export async function stockRow(page: Page, pubName: string, bookName: string) {
  await page.goto('/status/stock')
  await pick(page, page, '출판사', pubName)
  const row = page.getByRole('row', { name: new RegExp(escape(bookName)) })
  await expect(row).toBeVisible()
  return row
}

export const num = (s: string) => Number((s.match(/-?[\d,]+/)?.[0] ?? '0').replaceAll(',', ''))
