import { expect, test, type Dialog, type Locator, type Page } from '@playwright/test'

function trackErrors(page: Page) {
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

async function pick(page: Page, scope: Page | Locator, label: string, text: string) {
  await scope.getByRole('combobox', { name: label }).click()
  // 방금 연 팝오버만 대상으로 한다: 이전에 선택을 마친 팝오버는 닫힘 애니메이션 동안 잠시 DOM 에 남아
  // 같은 placeholder('검색...')를 가진 입력이 동시에 여러 개 존재할 수 있다.
  const popover = page.locator('[data-slot="popover-content"][data-state="open"]')
  await popover.getByPlaceholder('검색...').fill(text)
  await popover.getByRole('option', { name: new RegExp(text) }).first().click()
}

test('출판사 → 서점 → 도서 → 입고 → 출고 → 반품 → 현황 → 명세서', async ({ page }) => {
  const errors = trackErrors(page)
  const acceptDialog = (d: Dialog) => d.accept()
  page.on('dialog', acceptDialog)
  const dlg = page.getByRole('dialog')

  await page.goto('/publishers')
  await page.getByRole('button', { name: '+ 출판사 등록' }).click()
  await dlg.getByLabel('출판사코드').fill('P01')
  await dlg.getByLabel('출판사명').fill('한빛출판')
  await dlg.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('cell', { name: '한빛출판' })).toBeVisible()

  await page.goto('/bookstores')
  await page.getByRole('button', { name: '+ 서점 등록' }).click()
  await dlg.getByLabel('서점코드').fill('S01')
  await dlg.getByLabel('서점명').fill('교보문고 광화문')
  await dlg.getByRole('combobox', { name: '지역' }).click()
  await page.getByRole('option', { name: '서울특별시' }).click()
  await dlg.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('cell', { name: '교보문고 광화문' })).toBeVisible()

  // 마지막 unsaved-edit 가드 검증에서 '다른 서점으로 변경'을 시도하기 위한 두 번째 서점
  await page.getByRole('button', { name: '+ 서점 등록' }).click()
  await dlg.getByLabel('서점코드').fill('S02')
  await dlg.getByLabel('서점명').fill('알라딘 강남점')
  await dlg.getByRole('combobox', { name: '지역' }).click()
  await page.getByRole('option', { name: '경기도' }).click()
  await dlg.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('cell', { name: '알라딘 강남점' })).toBeVisible()

  await page.goto('/books')
  await expect(page.getByRole('combobox', { name: '출판사' })).toHaveText(/한빛출판/)
  await page.getByRole('button', { name: '+ 도서 등록' }).click()
  await dlg.getByLabel('도서명').fill('리액트 입문')
  await dlg.getByLabel('정가').fill('20000')
  await dlg.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('cell', { name: 'P01-0001' })).toBeVisible()

  await page.goto('/receipts')
  await page.getByRole('button', { name: '+ 입고 등록' }).click()
  await pick(page, dlg, '출판사', '한빛')
  await pick(page, dlg, '도서', '리액트')
  await dlg.getByLabel('입고부수').fill('100')
  await dlg.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('row', { name: /총 입고부수/ })).toContainText('100')

  await page.goto('/statements/entry')
  await pick(page, page, '출판사', '한빛')
  await pick(page, page, '서점', '교보')
  await pick(page, page, '1행 도서', '리액트')
  await page.getByLabel('1행 출고율').fill('60')
  await page.getByLabel('1행 부수').fill('30')
  await expect(page.getByRole('cell', { name: '12,000' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '360,000' }).first()).toBeVisible()
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('저장했습니다.')).toBeVisible()

  await page.goto('/returns')
  await page.getByRole('button', { name: '+ 반품 등록' }).click()
  await pick(page, dlg, '출판사', '한빛')
  await pick(page, dlg, '서점', '교보')
  await pick(page, dlg, '도서', '리액트')
  await dlg.getByLabel('부수').fill('5')
  await dlg.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('row', { name: /총 반품부수/ })).toContainText('5')

  await page.goto('/status/stock')
  await expect(page.getByRole('row', { name: /리액트 입문/ })).toContainText('75')

  await page.goto('/status/shipments')
  await expect(page.getByRole('row', { name: /총 출고부수/ })).toContainText('30')

  await page.goto('/statements/print')
  await pick(page, page, '출판사', '한빛')
  await pick(page, page, '서점', '교보')
  await expect(page.getByRole('cell', { name: '리액트 입문' })).toBeVisible()
  await page.evaluate(() => {
    window.print = () => {}
  })
  await page.getByRole('button', { name: '출력' }).click()
  await expect(page.getByText('새로 추가된 도서 없음')).toBeVisible()

  await page.goto('/statements/dispatch')
  await expect(page.getByText('교보문고 광화문')).toBeVisible()
  await expect(page.getByRole('row', { name: /리액트 입문/ })).toContainText('30')

  // 저장 + 인쇄된 명세서를 다시 조회했을 때 그대로 불러와지는지, 인쇄된 행은 잠겨 있는지,
  // 그리고 저장하지 않은 변경 내용이 있을 때 조회 조건을 바꾸면 가드(confirm)가 막아주는지 확인한다.
  await page.goto('/statements/entry')
  await pick(page, page, '출판사', '한빛')
  await pick(page, page, '서점', '교보')
  await expect(page.getByLabel('1행 부수')).toHaveValue('30')
  await expect(page.getByText('인쇄됨')).toBeVisible()
  await expect(page.getByLabel('1행 부수')).toBeDisabled()

  await page.getByRole('button', { name: '+ 행 추가' }).click()
  await pick(page, page, '2행 도서', '리액트')
  await page.getByLabel('2행 부수').fill('5')

  page.off('dialog', acceptDialog)
  page.once('dialog', (d) => d.dismiss())
  await pick(page, page, '서점', '알라딘')
  page.on('dialog', acceptDialog)

  await expect(page.getByRole('combobox', { name: '서점' })).toHaveText(/교보/)
  await expect(page.getByLabel('2행 부수')).toHaveValue('5')
  await expect(page.getByLabel('1행 부수')).toBeDisabled()

  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('저장했습니다.')).toBeVisible()

  // 재출력 시 추가분만 표시(spec §7): 이미 인쇄된 1행은 빠지고 새로 추가한 행만 나온다
  await page.goto('/statements/print')
  await pick(page, page, '출판사', '한빛')
  await pick(page, page, '서점', '교보')
  const printRows = page.locator('tbody tr')
  await expect(printRows).toHaveCount(1)
  await expect(printRows.first()).toContainText('리액트 입문')
  await expect(printRows.first()).toContainText('5')

  errors.assertClean()
})
