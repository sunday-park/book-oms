import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'

// db.ts(마이그레이션 전 안전 백업)와 설정 화면이 함께 쓴다 — db.ts 와 순환 import 가 생기지 않도록 따로 둔다

export const backupDir = (dbPath: string) => path.join(path.dirname(dbPath), 'backups')

const pad = (n: number) => String(n).padStart(2, '0')
export function backupFileName(d: Date, suffix = '') {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `book-oms-${date}-${time}${suffix}.db`
}

/** 연결을 연 채로 VACUUM INTO 로 일관된 사본을 만든다. 만든 파일 이름을 돌려준다. */
export function createBackup(db: DatabaseSync, dbPath: string, now = new Date(), suffix = '') {
  const dir = backupDir(dbPath)
  fs.mkdirSync(dir, { recursive: true })
  let name = backupFileName(now, suffix)
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = backupFileName(now, `-${n}${suffix}`)
  db.exec(`VACUUM INTO '${path.join(dir, name).replaceAll("'", "''")}'`)
  return name
}
