import { expect, test } from '@playwright/test'

/**
 * 입고·반품 관리 화면 스모크 테스트.
 * DB 는 비어 있는 상태를 전제로 하며(Task 10 플로우 테스트가 빈 DB 를 가정),
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

// 화면(브라우저)과 테스트 러너가 같은 로컬 타임존이라는 전제 하에 today() 와 동일한 방식으로 계산한다.
const today = () => new Date().toLocaleDateString('sv-SE')

test('입고 관리 스모크: 목록 노출 + 빈 값 저장 검증', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/receipts')
  await expect(page.getByRole('heading', { name: '입고 관리' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await expect(page.getByLabel('시작일')).toHaveValue(today())
  await expect(page.getByLabel('종료일')).toHaveValue(today())

  await expect(page.getByText('총 입고부수')).toBeVisible()
  const footerRow = page.getByRole('row').filter({ hasText: '총 입고부수' })
  await expect(footerRow).toContainText('0')

  await page.getByRole('button', { name: '+ 입고 등록' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '저장' }).click()
  const dialogError = dialog.locator('.text-destructive')
  await expect(dialogError).toBeVisible()
  await expect(dialogError).toContainText('도서')

  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(dialog).toBeHidden()

  errors.assertClean()
})

test('반품 관리 스모크: 목록 노출 + 빈 값 저장 검증', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/returns')
  await expect(page.getByRole('heading', { name: '반품 관리' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await expect(page.getByLabel('시작일')).toHaveValue(today())
  await expect(page.getByLabel('종료일')).toHaveValue(today())

  await expect(page.getByText('총 반품부수')).toBeVisible()
  const footerRow = page.getByRole('row').filter({ hasText: '총 반품부수' })
  await expect(footerRow).toContainText('0')

  await page.getByRole('button', { name: '+ 반품 등록' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '저장' }).click()
  const dialogError = dialog.locator('.text-destructive')
  await expect(dialogError).toBeVisible()
  await expect(dialogError).toContainText('출판사')

  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(dialog).toBeHidden()

  errors.assertClean()
})
