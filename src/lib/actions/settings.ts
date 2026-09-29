'use server'

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { closeDb, dbPath, getDb } from '@/lib/db'
import * as repo from '@/lib/repo/settings'
import { wrap } from '@/lib/result'

export async function getDbInfo() {
  return wrap(() => repo.getDbInfo(getDb(), dbPath()))
}
export async function listBackups() {
  return wrap(() => repo.listBackups(dbPath()))
}
export async function backupNow() {
  return wrap(() => repo.createBackup(getDb(), dbPath()))
}
export async function restoreBackup(name: string) {
  return wrap(() => repo.restoreBackup(getDb(), dbPath(), name, { close: closeDb, reopen: getDb }))
}

/** 파일 탐색기로 연다. 경로는 인자로만 넘긴다 (셸 문자열 조립 없음). */
function reveal(target: string, select: boolean) {
  const child =
    process.platform === 'win32'
      ? // explorer 는 /select,"경로" 형태만 알아들어 따옴표를 그대로 넘긴다 (Windows 경로에는 " 가 들어갈 수 없다)
        spawn('explorer.exe', [select ? `/select,"${target}"` : `"${target}"`], { windowsVerbatimArguments: true, detached: true, stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [select ? path.dirname(target) : target], { detached: true, stdio: 'ignore' })
  child.on('error', (e) => console.error(e))
  child.unref()
}

export async function openDbFolder() {
  return wrap(() => reveal(dbPath(), true))
}
export async function openBackupFolder() {
  return wrap(() => {
    const dir = repo.backupDir(dbPath())
    fs.mkdirSync(dir, { recursive: true })
    reveal(dir, false)
  })
}
