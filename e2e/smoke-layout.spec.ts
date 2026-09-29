import { expect, test } from '@playwright/test'

const GROUP_TITLES = ['관리', '현황', '명세서']
const MENU_LABELS = [
  '도서 관리', '서점 관리', '출판사 관리', '입고 관리', '반품 관리',
  '출고 현황', '재고 현황',
  '출고 입력', '명세서 출력', '재고 원장', '출고증',
]

test('레이아웃(사이드바) 스모크: 콘솔/페이지 에러 없이 메뉴가 모두 보인다', async ({ page }) => {
  const pageErrors: Error[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (err) => pageErrors.push(err))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  const requestUrls: string[] = []
  page.on('request', (req) => requestUrls.push(req.url()))

  // '/' 는 '/books' 로 redirect 된다.
  await page.goto('/')

  const sidebar = page.locator('aside')
  for (const title of GROUP_TITLES) {
    await expect(sidebar.getByText(title, { exact: true })).toBeVisible()
  }
  for (const label of MENU_LABELS) {
    await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible()
  }

  // 접기: 아이콘만 남고 메뉴 링크는 이름(aria-label)으로 계속 찾을 수 있다
  await sidebar.getByRole('button', { name: '메뉴 접기' }).click()
  await expect(sidebar.getByText('도서 재고관리')).toBeHidden()
  await expect(sidebar.getByText('관리', { exact: true })).toBeHidden()
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(100)
  for (const label of MENU_LABELS) {
    await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible()
  }
  // 새로고침해도 접힌 상태 유지
  await page.reload()
  await expect(sidebar.getByRole('button', { name: '메뉴 펼치기' })).toBeVisible()
  await sidebar.getByRole('button', { name: '메뉴 펼치기' }).click()
  await expect(sidebar.getByText('도서 재고관리')).toBeVisible()

  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])

  // 오프라인 제약 확인: 외부 호스트로 나가는 요청이 없어야 한다 (예: Google Fonts 등)
  for (const url of requestUrls) {
    expect(url.startsWith('http://127.0.0.1:3100')).toBe(true)
  }
})
