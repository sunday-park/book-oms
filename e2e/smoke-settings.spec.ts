import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

// e2e DB(data/e2e.db) 의 백업은 data/backups 에 생긴다 — 실제 DB 백업과 같은 폴더라 테스트가 만든 파일은 지운다
const BACKUP_DIR = path.resolve('data/backups')
const created: string[] = []
test.afterAll(() => {
  for (const name of created) fs.rmSync(path.join(BACKUP_DIR, name), { force: true })
  try {
    fs.rmdirSync(BACKUP_DIR) // 비어 있을 때만 지워진다
  } catch {}
})

test('설정 스모크: 사이드바 아래 링크로 열고, DB 경로 확인 후 [지금 백업]', async ({ page }) => {
  const pageErrors: Error[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('/books')
  await expect(page.getByRole('button', { name: '조회' })).toBeVisible()
  const link = page.locator('aside').getByRole('link', { name: '설정', exact: true })
  await link.click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(link).toHaveAttribute('aria-current', 'page')
  const where = page.getByRole('navigation', { name: '현재 위치' })
  await expect(where).toContainText('시스템')
  await expect(where).toContainText('설정')

  await expect(page.getByTestId('db-path')).toHaveText(/data[\\/]e2e\.db$/)

  await page.getByRole('button', { name: '지금 백업' }).click()
  const toast = page.getByText(/백업했습니다: book-oms-\d{8}-\d{6}(-\d+)?\.db/)
  await expect(toast).toBeVisible()
  const name = (await toast.textContent())!.replace('백업했습니다: ', '').trim()
  created.push(name)
  await expect(page.getByRole('row').filter({ hasText: name }).getByRole('button', { name: '복원' })).toBeVisible()
  expect(fs.existsSync(path.join(BACKUP_DIR, name))).toBe(true)

  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})
