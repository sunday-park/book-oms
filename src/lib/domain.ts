export const SHIP_KINDS = ['위탁', '탁송'] as const
export type ShipKind = (typeof SHIP_KINDS)[number]
export const DEFAULT_RATE = 65

export function formatBookCode(publisherCode: string, seq: number) {
  return `${publisherCode}-${String(seq).padStart(4, '0')}`
}

export function calcUnitPrice(listPrice: number, rate: number) {
  return Math.round((listPrice * rate) / 100)
}

export function calcAmount(unitPrice: number, qty: number) {
  return unitPrice * qty
}

export function calcStock(received: number, shipped: number, returned: number) {
  return received - shipped + returned
}
