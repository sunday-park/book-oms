import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', locale: 'ko-KR' },
  webServer: {
    command: 'node e2e/reset-db.mjs && npx next dev -p 3100 -H 127.0.0.1',
    url: 'http://127.0.0.1:3100/books',
    env: { BOOK_OMS_DB: 'data/e2e.db', NEXT_DIST_DIR: '.next-e2e' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'smoke', testMatch: /smoke-.*\.spec\.ts/ },
    { name: 'flow', testMatch: /flow\.spec\.ts/, dependencies: ['smoke'] },
    { name: 'scenario', testMatch: /scenario(-absurd)?\.spec\.ts/, dependencies: ['flow'] },
  ],
})
