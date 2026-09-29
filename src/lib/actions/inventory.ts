'use server'

import { getDb } from '@/lib/db'
import * as inv from '@/lib/repo/inventory'
import * as rep from '@/lib/repo/reports'
import { wrap } from '@/lib/result'

export async function listReceipts(f: inv.ReceiptFilter) {
  return wrap(() => inv.listReceipts(getDb(), f))
}
export async function createReceipt(input: Parameters<typeof inv.createReceipt>[1]) {
  return wrap(() => inv.createReceipt(getDb(), input))
}
export async function deleteReceipt(id: number) {
  return wrap(() => inv.deleteReceipt(getDb(), id))
}

export async function listReturns(f: inv.ReturnFilter) {
  return wrap(() => inv.listReturns(getDb(), f))
}
export async function createReturn(input: Parameters<typeof inv.createReturn>[1]) {
  return wrap(() => inv.createReturn(getDb(), input))
}
export async function deleteReturn(id: number) {
  return wrap(() => inv.deleteReturn(getDb(), id))
}

export async function getShipment(date: string, publisherId: number, bookstoreId: number) {
  return wrap(() => inv.getShipment(getDb(), date, publisherId, bookstoreId))
}
/** version: 화면이 불러온 명세 버전 (null = 명세가 없었음) — 그새 다른 곳에서 바뀌었으면 거절 */
export async function saveShipment(input: inv.ShipmentInput & { version: number | null }) {
  return wrap(() => inv.saveShipment(getDb(), { ...input, version: input.version ?? null }))
}
export async function deleteShipment(id: number, version: number) {
  return wrap(() => inv.deleteShipment(getDb(), id, version))
}
export async function listAvailable(date: string, publisherId: number, bookstoreId: number) {
  return wrap(() => inv.listAvailable(getDb(), date, publisherId, bookstoreId))
}
export async function listUnprinted(date: string, publisherId: number, bookstoreId: number) {
  return wrap(() => inv.listUnprinted(getDb(), date, publisherId, bookstoreId))
}
export async function markPrinted(ids: number[]) {
  return wrap(() => inv.markPrinted(getDb(), ids, new Date().toISOString()))
}

export async function listStock(publisherId: number) {
  return wrap(() => rep.listStock(getDb(), publisherId))
}
export async function listShipmentStatus(f: rep.ShipmentStatusFilter) {
  return wrap(() => rep.listShipmentStatus(getDb(), f))
}
export async function listDispatch(date: string, publisherId: number) {
  return wrap(() => rep.listDispatch(getDb(), date, publisherId))
}
