import { expect, test } from '@playwright/test'

/**
 * 출고 현황·재고 현황 화면 스모크 테스트.
 * DB 는 비어 있는 상태를 전제로 하며, 조회 결과가 없는 화면을 확인한다.
 * 데이터를 저장하지 않는다.
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
      const realErrors = consoleErrors.filter((e) => !/404/.test(e))
      expect(realErrors).toEqual([])
    },
  }
}

// 화면(브라우저)과 테스트 러너가 같은 로컬 타임존이라는 전제 하에 today() 와 동일한 방식으로 계산한다.
const today = () => new Date().toLocaleDateString('sv-SE')

test('출고 현황 스모크: 목록 노출 + 초기화/조회', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/status/shipments')
  await expect(page.getByRole('heading', { name: '출고 현황' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await expect(page.getByLabel('날짜')).toHaveValue(today())

  await expect(page.getByText('총 출고부수')).toBeVisible()
  const footerRow = page.getByRole('row').filter({ hasText: '총 출고부수' })
  await expect(footerRow).toContainText('0')

  await page.getByRole('button', { name: '초기화' }).click()
  await page.getByRole('button', { name: '조회' }).click()

  errors.assertClean()
})

test('재고 현황 스모크: 목록 노출 + 초기화/조회', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/status/stock')
  await expect(page.getByRole('heading', { name: '재고 현황' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await expect(page.getByText('조회된 데이터가 없습니다.')).toBeVisible()
  const headerRow = page.getByRole('row').first()
  await expect(headerRow).toContainText('도서코드')
  await expect(headerRow).toContainText('도서명')
  await expect(headerRow).toContainText('입고')
  await expect(headerRow).toContainText('출고')
  await expect(headerRow).toContainText('반품')
  await expect(headerRow).toContainText('현재고')

  await page.getByRole('button', { name: '초기화' }).click()
  await page.getByRole('button', { name: '조회' }).click()

  errors.assertClean()
})
