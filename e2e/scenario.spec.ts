import { expect, test, type Dialog } from '@playwright/test'
import {
  addBook, addPublisher, addRow, addStore, dialog, entryRow, fillRow, gotoReady, num, openEntry, pick, receive, saveEntry, saveEntryRejected,
  stockRow, submitReturn, trackErrors,
} from './scenario-helpers'

/**
 * 실제 사용 흐름 시나리오 (flow 다음에 같은 서버·DB 에서 실행).
 * flow 데이터와 겹치지 않게 출판사 Q01/Q02, 서점 T01~T06, 도서명 S1책… 을 쓰고, 화면마다 출판사를 직접 고른다.
 * 시나리오끼리 출고가 섞이지 않도록 시나리오마다 서점을 따로 쓴다 (출고는 날짜·출판사·서점 단위로 하나).
 */

const Q1 = '큐출판'
const Q2 = '큐북스'
const D5 = '2025-12-31' // S5 전용 날짜 — 출고증·출고 현황에 다른 시나리오 출고가 섞이지 않게

test.describe.configure({ mode: 'serial' })

let errors: ReturnType<typeof trackErrors>
const accept = (d: Dialog) => d.accept()
test.beforeEach(({ page }) => {
  errors = trackErrors(page)
  page.on('dialog', accept)
})
test.afterEach(() => errors.assertClean())

test('S0 준비: 출판사 2 · 서점 6 · 도서 7 등록', async ({ page }) => {
  test.setTimeout(180_000)
  await addPublisher(page, 'Q01', Q1)
  await addPublisher(page, 'Q02', Q2)
  for (const [code, name] of [['T01', 'S1서점'], ['T02', 'S2서점'], ['T03', 'S3서점'], ['T04', 'S4서점'], ['T05', 'S5서점갑'], ['T06', 'S5서점을']]) {
    await addStore(page, code, name)
  }
  for (const name of ['S1책', 'S2책', 'S3책', 'S3추가책', 'S4책', 'S5가']) await addBook(page, Q1, name)
  await addBook(page, Q2, 'S5나')
})

test('S1 입고 없이 출고 → 저장이 막히고, 새로고침 후에도 저장 안 됨', async ({ page }) => {
  await openEntry(page, Q1, 'S1서점')
  await fillRow(page, 1, 'S1책', 3)
  const hint = entryRow(page, 1).getByText(/출고 가능/)
  await expect(hint).toHaveText('출고 가능 0부')
  await expect(hint).toHaveClass(/text-neg/)

  await saveEntryRejected(page, "1행: 'S1책' 출고 가능 0부, 입력 3부")
  await expect(page.getByText('저장했습니다.')).toHaveCount(0)

  await page.reload()
  await openEntry(page, Q1, 'S1서점')
  await expect(page.getByRole('combobox', { name: '1행 도서' })).toHaveText(/도서 선택/)
  await expect(page.getByLabel('1행 부수')).toHaveValue('0')

  const row = await stockRow(page, Q1, 'S1책')
  await expect(row.getByRole('cell').nth(3)).toHaveText('0') // 출고
})

test('S2 입고 10 → 출고 10 → 1부 추가 막힘 → 반품 3 → 3부 추가 → 품절', async ({ page }) => {
  await receive(page, Q1, 'S2책', 10)

  await openEntry(page, Q1, 'S2서점')
  await fillRow(page, 1, 'S2책', 10)
  await expect(entryRow(page, 1).getByText(/출고 가능/)).toHaveText('출고 가능 10부')
  await expect(entryRow(page, 1).getByText(/출고 가능/)).not.toHaveClass(/text-neg/)
  await saveEntry(page)
  // 저장된 명세를 다시 불러와도 자기 부수를 이중으로 빼지 않는다
  await expect(page.getByLabel('1행 부수')).toHaveValue('10')
  await expect(entryRow(page, 1).getByText(/출고 가능/)).toHaveText('출고 가능 10부')

  await addRow(page, 2, 'S2책', 1)
  await expect(entryRow(page, 2).getByText(/출고 가능/)).toHaveClass(/text-neg/)
  await saveEntryRejected(page, "1행: 'S2책' 출고 가능 10부, 입력 11부")

  await submitReturn(page, Q1, 'S2서점', 'S2책', 3)
  await expect(dialog(page)).toBeHidden()

  await openEntry(page, Q1, 'S2서점')
  await expect(page.locator('main tbody tr')).toHaveCount(1) // 막힌 1부 행은 저장되지 않았다
  await addRow(page, 2, 'S2책', 3)
  await expect(entryRow(page, 2).getByText(/출고 가능/)).toHaveText('출고 가능 13부')
  await saveEntry(page)

  const row = await stockRow(page, Q1, 'S2책')
  const cells = row.getByRole('cell')
  await expect(cells.nth(2)).toHaveText('10')
  await expect(cells.nth(3)).toHaveText('13')
  await expect(cells.nth(4)).toHaveText('3')
  await expect(cells.nth(5)).toHaveText('0품절')
})

test('S3 출고 → 명세서 출력 → 인쇄된 행 잠김 → 새 행 저장 → 재출력엔 새 행만', async ({ page }) => {
  await receive(page, Q1, 'S3책', 20)
  await receive(page, Q1, 'S3추가책', 20)
  await openEntry(page, Q1, 'S3서점')
  await fillRow(page, 1, 'S3책', 5)
  await saveEntry(page)

  await page.goto('/statements/print')
  await pick(page, page, '출판사', Q1)
  await pick(page, page, '서점', 'S3서점')
  await expect(page.locator('main tbody tr')).toHaveCount(1)
  await expect(page.getByRole('cell', { name: 'S3책' })).toBeVisible()
  await page.evaluate(() => {
    window.print = () => {}
  })
  await page.getByRole('button', { name: '출력' }).click()
  await expect(page.getByText('새로 추가된 도서 없음')).toBeVisible()

  await openEntry(page, Q1, 'S3서점')
  await expect(page.getByText('인쇄됨')).toBeVisible()
  await expect(page.getByLabel('1행 부수')).toBeDisabled()
  await expect(page.getByLabel('1행 출고율')).toBeDisabled()
  await expect(page.getByRole('combobox', { name: '1행 도서' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '1행 삭제' })).toBeDisabled()
  await addRow(page, 2, 'S3추가책', 4)
  await saveEntry(page)

  await page.goto('/statements/print')
  await pick(page, page, '출판사', Q1)
  await pick(page, page, '서점', 'S3서점')
  const rows = page.locator('main tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('S3추가책')
  await expect(rows.first().getByRole('cell').nth(6)).toHaveText('4')
})

test('S4 재고가 음수가 되는 입고 삭제는 막히고, 영향 없는 입고 삭제는 된다', async ({ page }) => {
  await receive(page, Q1, 'S4책', 10)
  await receive(page, Q1, 'S4책', 4)
  await receive(page, Q1, 'S4책', 3)
  await openEntry(page, Q1, 'S4서점')
  await fillRow(page, 1, 'S4책', 12) // 재고 17 → 5
  await saveEntry(page)

  const receiptRow = async (qty: string, n: number) => {
    await page.goto('/receipts')
    await pick(page, page, '출판사', Q1)
    await pick(page, page, '도서', 'S4책')
    await expect(page.locator('main tbody tr')).toHaveCount(n)
    return page.getByRole('row', { name: /S4책/ }).filter({ has: page.getByRole('cell', { name: qty, exact: true }) })
  }

  await (await receiptRow('10', 3)).click()
  await page.getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText("입고를 삭제하면 'S4책' 재고가 -5부가 되어 삭제할 수 없습니다.")).toBeVisible()
  await expect(page.locator('main tbody tr')).toHaveCount(3)

  // 재고 5 → 1: 음수가 아니므로 삭제된다
  await (await receiptRow('4', 3)).click()
  await page.getByRole('button', { name: '삭제' }).click()
  await expect(page.locator('main tbody tr')).toHaveCount(2)
  const row = await stockRow(page, Q1, 'S4책')
  await expect(row.getByRole('cell').nth(5)).toHaveText('1')
})

test('S5 두 출판사 × 두 서점 → 출고증·출고 현황·재고 원장 합계', async ({ page }) => {
  await receive(page, Q1, 'S5가', 50)
  await receive(page, Q2, 'S5나', 50)
  for (const [pub, store, book, qty] of [
    [Q1, 'S5서점갑', 'S5가', 7],
    [Q1, 'S5서점을', 'S5가', 5],
    [Q2, 'S5서점갑', 'S5나', 4],
    [Q2, 'S5서점을', 'S5나', 6],
  ] as const) {
    await openEntry(page, pub, store, D5)
    await fillRow(page, 1, book, qty)
    await saveEntry(page)
  }

  // 출고증: 선택 출판사의 서점별 소계·총계
  const dispatch = async (pub: string, expected: [string, string][], grand: string) => {
    await gotoReady(page, '/statements/dispatch')
    await page.getByLabel('날짜').fill(D5)
    await page.getByLabel('출판사').click()
    await page.getByRole('option', { name: pub }).click()
    for (const [store, sub] of expected) {
      const group = page.locator('.break-inside-avoid').filter({ hasText: store })
      await expect(group.getByRole('row', { name: /소계/ }).getByRole('cell').last()).toHaveText(sub)
    }
    await expect(page.locator('.break-inside-avoid')).toHaveCount(expected.length)
    await expect(page.getByText(`총 출고부수 ${grand}부`)).toBeVisible()
  }
  await dispatch(Q1, [['S5서점갑', '7'], ['S5서점을', '5']], '12')
  await dispatch(Q2, [['S5서점갑', '4'], ['S5서점을', '6']], '10')

  // 출고 현황: 날짜·서점 필터 합계
  await gotoReady(page, '/status/shipments')
  await page.getByLabel('날짜').fill(D5)
  const total = page.getByRole('row', { name: /총 출고부수/ }).getByRole('cell').last()
  await expect(total).toHaveText('22')
  await pick(page, page, '서점', 'S5서점갑')
  await expect(total).toHaveText('11')
  await pick(page, page, '출판사', Q2)
  await expect(total).toHaveText('4')
  await pick(page, page, '서점', 'S5서점을')
  await expect(total).toHaveText('6')

  // 재고 원장 합계 = 재고 현황 현재고 합
  for (const pub of [Q1, Q2]) {
    await page.goto('/status/stock')
    await pick(page, page, '출판사', pub)
    await expect(page.getByRole('row', { name: pub === Q1 ? /S5가/ : /S5나/ })).toBeVisible()
    const stockCells = await page.locator('main tbody tr td:last-child').allInnerTexts()
    const stockSum = stockCells.reduce((s, t) => s + num(t), 0)

    await page.goto('/statements/ledger')
    await pick(page, page, '출판사', pub)
    await expect(page.locator('main tbody tr')).toHaveCount(stockCells.length)
    await expect(page.getByRole('row', { name: /총 재고부수/ }).getByRole('cell').last()).toHaveText(stockSum.toLocaleString('ko-KR'))
    if (pub === Q2) expect(stockSum).toBe(40)
  }
})

test('S6 도서코드 미재사용 · 다른 출판사 도서 안 보임 · 미저장 이동 확인창', async ({ page }) => {
  const deletedCode = await addBook(page, Q2, 'S6삭제책')
  await page.getByRole('row', { name: /S6삭제책/ }).click()
  await page.getByRole('button', { name: '수정' }).click()
  await dialog(page).getByRole('button', { name: '삭제' }).click()
  await expect(page.getByRole('row', { name: /S6삭제책/ })).toHaveCount(0)
  const newCode = await addBook(page, Q2, 'S6재등록책')
  const seq = (c: string) => Number(c.split('-')[1])
  expect(seq(newCode)).toBe(seq(deletedCode) + 1)
  await expect(page.getByRole('cell', { name: deletedCode, exact: true })).toHaveCount(0)

  await openEntry(page, Q1, 'S1서점')
  await page.getByRole('combobox', { name: '1행 도서' }).click()
  const popover = page.locator('[data-slot="popover-content"][data-state="open"]')
  await expect(popover.getByRole('option', { name: /S1책/ })).toBeVisible()
  await popover.getByPlaceholder('검색...').fill('S5나')
  await expect(popover.getByText('결과 없음')).toBeVisible()
  await popover.getByPlaceholder('검색...').fill('S6재등록책')
  await expect(popover.getByText('결과 없음')).toBeVisible()
  await page.keyboard.press('Escape')

  await fillRow(page, 1, 'S1책', 1)
  const link = page.locator('aside').getByRole('link', { name: '재고 현황', exact: true })
  page.off('dialog', accept)
  let message = ''
  page.once('dialog', (d) => {
    message = d.message()
    void d.dismiss()
  })
  await link.click()
  await expect.poll(() => message).toContain('저장하지 않은 변경 내용이 있습니다')
  await expect(page).toHaveURL(/\/statements\/entry$/)
  await expect(page.getByLabel('1행 부수')).toHaveValue('1')

  page.on('dialog', accept)
  await link.click()
  await expect(page).toHaveURL(/\/status\/stock$/)
  await expect(page.locator('main h1')).toHaveText('재고 현황')
})
