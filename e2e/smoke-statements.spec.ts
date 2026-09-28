import { expect, test } from '@playwright/test'

/**
 * 명세서 출력·재고 원장·출고증 화면 스모크 테스트.
 * DB 는 비어 있는 상태를 전제로 하며, 출판사·서점을 선택하지 않은(또는 출판사가 없는) 초기 상태만 확인한다.
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
      expect(consoleErrors).toEqual([])
    },
  }
}

// 화면(브라우저)과 테스트 러너가 같은 로컬 타임존이라는 전제 하에 today() 와 동일한 방식으로 계산한다.
const today = () => new Date().toLocaleDateString('sv-SE')

test('명세서 출력 스모크: 초기 상태 + 초기화/조회 + 인쇄 미리보기', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/statements/print')
  await expect(page.getByRole('heading', { name: '명세서 출력' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await expect(page.getByLabel('날짜')).toHaveValue(today())
  await expect(page.getByLabel('날짜')).toBeEnabled()

  await expect(page.getByText('출판사와 서점을 선택하세요.')).toBeVisible()
  await expect(page.getByRole('button', { name: '출력' })).toBeDisabled()

  await page.getByRole('button', { name: '초기화' }).click()
  await page.getByRole('button', { name: '조회' }).click()

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('aside')).not.toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).not.toBeVisible()
  await expect(page.getByRole('navigation', { name: '현재 위치' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: '도움말' })).not.toBeVisible()

  errors.assertClean()
})

test('재고 원장 스모크: 초기 상태(출판사 없음) + 초기화/조회', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/statements/ledger')
  await expect(page.getByRole('heading', { name: '재고 원장' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await expect(page.getByText('출판사를 선택하세요.')).toBeVisible()
  await expect(page.getByRole('button', { name: '출력' })).toBeDisabled()

  await page.getByRole('button', { name: '초기화' }).click()
  await page.getByRole('button', { name: '조회' }).click()

  errors.assertClean()
})

test('출고증 스모크: 초기 상태(출판사 없음) + 초기화/조회', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/statements/dispatch')
  await expect(page.getByRole('heading', { name: '출고증' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await expect(page.getByLabel('날짜')).toHaveValue(today())

  const pubSelect = page.getByLabel('출판사')
  await expect(pubSelect).toBeVisible()
  await pubSelect.click()
  await expect(page.getByRole('option', { name: '전체' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await expect(page.getByText('출판사를 선택하세요.')).toBeVisible()
  await expect(page.getByRole('button', { name: '출력' })).toBeDisabled()

  await page.getByRole('button', { name: '초기화' }).click()
  await page.getByRole('button', { name: '조회' }).click()

  errors.assertClean()
})
