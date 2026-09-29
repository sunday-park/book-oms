// 실사용 실행: 빌드 후 정식 모드로 켠다 (개발 서버보다 페이지 이동이 훨씬 빠름)
// 개발 서버(.next)와 캐시 폴더를 분리해 동시에 있어도 서로 덮어쓰지 않는다.
import { spawnSync } from 'node:child_process'

const env = { ...process.env, NEXT_DIST_DIR: '.next-app' }
const run = (args) => {
  const r = spawnSync('npx', ['next', ...args], { stdio: 'inherit', env, shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run(['build', '--turbopack'])
run(['start', '-H', '127.0.0.1', '-p', process.env.PORT ?? '3000'])
