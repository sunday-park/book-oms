import { expect, test } from '@playwright/test'

/**
 * 출고 입력 화면 스모크 테스트.
 * DB 는 비어 있는 상태를 전제로 하며, 출판사·서점을 선택하지 않은 초기 상태만 확인한다.
 * 저장 등 전체 흐름(Task 10 플로우 테스트가 다룸)을 포함해 데이터는 저장하지 않는다.
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

test('출고 입력 스모크: 초기 상태 + 초기화/조회', async ({ page }) => {
  const errors = trackErrors(page)

  await page.goto('/statements/entry')
  await expect(page.getByRole('heading', { name: '출고 입력' })).toBeVisible()
  await expect(page.getByRole('button', { name: '초기화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()

  await expect(page.getByLabel('날짜')).toHaveValue(today())

  await expect(page.getByText('출판사와 서점을 선택하세요.')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '저장' })).toHaveCount(0)

  await page.getByRole('button', { name: '초기화' }).click()
  await page.getByRole('button', { name: '조회' }).click()

  errors.assertClean()
})
