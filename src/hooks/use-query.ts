'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Result } from '@/lib/result'

export const none = <T,>(data: T): Promise<Result<T>> => Promise.resolve({ ok: true, data })

/** deps 가 바뀌면 150ms 뒤 자동 조회(입력 즉시 필터링), reload() 는 [조회] 버튼용 즉시 조회 */
export function useQuery<T>(fetcher: () => Promise<Result<T>>, deps: unknown[], initial: T) {
  const [data, setData] = useState<T>(initial)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(async () => {
    const r = await fetcherRef.current()
    if (r.ok) setData(r.data)
    else toast.error(r.error)
  }, [])

  useEffect(() => {
    const t = setTimeout(reload, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, reload }
}
