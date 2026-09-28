import { expect, test } from '@playwright/test'

/**
 * 출판사·서점·도서 관리 화면 스모크 테스트.
 * DB 는 비어 있는 상태를 전제로 하며(Task 10 플로우 테스트가 '한빛출판'을 첫 출판사로 가정),
 * 여기서는 등록 다이얼로그를 열고 빈 값으로 [저장] 을 눌러 검증 오류만 확인한 뒤 [취소] 로 닫는다.
 * 실제 저장은 하지 않는다.
 */

function trackErrors(page: import('@playwright/test').Page) {
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

test('출판사 관리 스모크: 목록 노출 + 빈 값 저장 검증', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/publishers')
  await expect(page.getByRole('heading', { name: '출판사 관리' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await page.getByRole('button', { name: '+ 출판사 등록' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '저장' }).click()
  const pubError = dialog.locator('.text-destructive')
  await expect(pubError).toBeVisible()
  await expect(pubError).toContainText('출판사명')

  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(dialog).toBeHidden()

  errors.assertClean()
})

test('서점 관리 스모크: 목록 노출 + 빈 값 저장 검증', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/bookstores')
  await expect(page.getByRole('heading', { name: '서점 관리' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await page.getByRole('button', { name: '+ 서점 등록' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '저장' }).click()
  const storeError = dialog.locator('.text-destructive')
  await expect(storeError).toBeVisible()
  await expect(storeError).toContainText('서점코드')

  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(dialog).toBeHidden()

  errors.assertClean()
})

test('도서 관리 스모크: 목록 노출 + 빈 값 저장 검증', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/books')
  await expect(page.getByRole('heading', { name: '도서 관리' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await page.getByRole('button', { name: '+ 도서 등록' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '저장' }).click()
  const errorText = dialog.locator('.text-destructive')
  await expect(errorText).toBeVisible()
  await expect(errorText).toContainText(/출판사|도서명/)

  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(dialog).toBeHidden()

  errors.assertClean()
})
