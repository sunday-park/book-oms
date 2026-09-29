'use server'

import { getDb } from '@/lib/db'
import * as repo from '@/lib/repo/prefs'
import { wrap } from '@/lib/result'

/** 모든 표의 저장된 열 순서 (앱 시작 때 한 번) */
export async function getColumnOrders() {
  return wrap(() => repo.getColumnOrders(getDb()))
}
export async function getColumnOrder(tableId: string) {
  return wrap(() => repo.getColumnOrder(getDb(), tableId))
}
export async function saveColumnOrder(tableId: string, ids: string[]) {
  return wrap(() => repo.saveColumnOrder(getDb(), tableId, ids))
}
export async function resetColumnOrders() {
  return wrap(() => repo.resetColumnOrders(getDb()))
}
