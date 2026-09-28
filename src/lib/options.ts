import type { Book, Bookstore, Publisher } from '@/lib/repo/master'

export type Option = { value: number; label: string; hint?: string }

export const pubOptions = (ps: Publisher[]): Option[] => ps.map((p) => ({ value: p.id, label: p.name, hint: p.code }))
export const storeOptions = (ss: Bookstore[]): Option[] => ss.map((s) => ({ value: s.id, label: s.name, hint: s.region }))
export const bookOptions = (bs: Book[]): Option[] => bs.map((b) => ({ value: b.id, label: b.name, hint: b.code }))
