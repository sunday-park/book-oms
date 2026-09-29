import { TABLE_ID_RE } from '@/lib/columns'
import { type DB, all, get, run } from '@/lib/db'
import { AppError } from '@/lib/result'

// 화면 설정 (ui_prefs) — 목록 표의 열 순서를 'columns:<표 id>' 키에 JSON 배열로 둔다

const PREFIX = 'columns:'

function parseIds(value: string): string[] | null {
  try {
    const v: unknown = JSON.parse(value)
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null
  } catch {
    return null
  }
}

/** 모든 표의 저장된 열 순서 { 표 id: [열 id…] } */
export function getColumnOrders(db: DB): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const r of all<{ key: string; value: string }>(db, "SELECT key, value FROM ui_prefs WHERE key LIKE 'columns:%'")) {
    const ids = parseIds(r.value)
    if (ids) out[r.key.slice(PREFIX.length)] = ids
  }
  return out
}

export function getColumnOrder(db: DB, tableId: string): string[] | null {
  const r = get<{ value: string }>(db, 'SELECT value FROM ui_prefs WHERE key = ?', PREFIX + tableId)
  return r ? parseIds(r.value) : null
}

export function saveColumnOrder(db: DB, tableId: string, ids: string[]) {
  if (typeof tableId !== 'string' || !TABLE_ID_RE.test(tableId)) throw new AppError('올바른 표 이름이 아닙니다.')
  if (!Array.isArray(ids) || ids.length > 50 || !ids.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 40) || new Set(ids).size !== ids.length)
    throw new AppError('올바른 열 순서가 아닙니다.')
  run(db, 'INSERT INTO ui_prefs (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', PREFIX + tableId, JSON.stringify(ids))
}

/** 모든 표를 기본 열 순서로 되돌린다 */
export function resetColumnOrders(db: DB) {
  run(db, "DELETE FROM ui_prefs WHERE key LIKE 'columns:%'")
}
