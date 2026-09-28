import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://localhost:3100', locale: 'ko-KR' },
  webServer: {
    command: 'node e2e/reset-db.mjs && npx next dev -p 3100',
    // '/' 는 '/books' 로 redirect 되는데 그 라우트가 아직 없어(Task 5-9 에서 생성) 404 가 나서
    // 'http://localhost:3100' 로는 준비 완료 판정을 받지 못해 블록되므로, 항상 200 을 내려주는
    // 정적 파일(app 라우터 기본 favicon)로 서버 기동 확인을 대신한다.
    url: 'http://localhost:3100/favicon.ico',
    env: { BOOK_OMS_DB: 'data/e2e.db' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
