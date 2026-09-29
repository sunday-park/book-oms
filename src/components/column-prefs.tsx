'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { resetColumnOrders, saveColumnOrder } from '@/lib/actions/prefs'

type Orders = Record<string, string[]>
type Ctx = {
  orders: Orders
  /** 화면에 먼저 반영하고 저장한다 (실패하면 되돌리고 토스트) */
  setOrder: (tableId: string, ids: string[]) => void
  /** 모든 표를 기본 순서로. 성공하면 true */
  resetAll: () => Promise<boolean>
}

const ColumnPrefsContext = createContext<Ctx>({ orders: {}, setOrder: () => {}, resetAll: async () => false })

/** 앱 시작 때(레이아웃 서버 렌더) 읽은 열 순서를 들고 있어, 표가 처음부터 저장된 순서로 그려진다 */
export function ColumnPrefsProvider({ initial, children }: { initial: Orders; children: ReactNode }) {
  const [orders, setOrders] = useState(initial)
  const ordersRef = useRef(orders)
  ordersRef.current = orders

  const setOrder = useCallback((tableId: string, ids: string[]) => {
    const prev = ordersRef.current[tableId]
    setOrders((o) => ({ ...o, [tableId]: ids }))
    void saveColumnOrder(tableId, ids).then((r) => {
      if (r.ok) return
      toast.error(`열 순서를 저장하지 못했습니다. ${r.error}`)
      setOrders((o) => {
        const next = { ...o }
        if (prev) next[tableId] = prev
        else delete next[tableId]
        return next
      })
    })
  }, [])

  const resetAll = useCallback(async () => {
    const r = await resetColumnOrders()
    if (!r.ok) {
      toast.error(r.error)
      return false
    }
    setOrders({})
    return true
  }, [])

  const value = useMemo(() => ({ orders, setOrder, resetAll }), [orders, setOrder, resetAll])
  return <ColumnPrefsContext.Provider value={value}>{children}</ColumnPrefsContext.Provider>
}

export const useColumnPrefs = () => useContext(ColumnPrefsContext)
