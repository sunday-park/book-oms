'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Result } from '@/lib/result'

export const none = <T,>(data: T): Promise<Result<T>> => Promise.resolve({ ok: true, data })

// 마지막으로 받은 조회 결과 (화면을 다시 열면 이걸 먼저 보여주고 뒤에서 새로 조회)
const cache = new Map<string, unknown>()
/** 저장해 둔 조회 결과를 모두 버린다 (DB 복원 뒤) */
export const clearQueryCache = () => cache.clear()

/**
 * 첫 조회는 즉시, 이후 deps 가 바뀌면 150ms 뒤 자동 조회(입력 즉시 필터링), reload() 는 [조회] 버튼용 즉시 조회.
 * key 를 주면 결과를 key+deps 별로 기억해, 같은 조회를 다시 열 때 지난 결과를 바로 보여준다 (deps 가 조회를 완전히 결정해야 함).
 */
export function useQuery<T>(fetcher: () => Promise<Result<T>>, deps: unknown[], initial: T, key?: string) {
  const cacheKey = key && `${key}:${JSON.stringify(deps)}`
  const [data, setData] = useState<T>(() => (cacheKey && cache.has(cacheKey) ? (cache.get(cacheKey) as T) : initial))
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const cacheKeyRef = useRef(cacheKey)
  cacheKeyRef.current = cacheKey
  const loadedRef = useRef(false)

  const reload = useCallback(async () => {
    const k = cacheKeyRef.current
    const r = await fetcherRef.current()
    if (r.ok) {
      if (k) cache.set(k, r.data)
      if (k === cacheKeyRef.current) setData(r.data) // 늦게 온 이전 조회 결과로 덮어쓰지 않게
    } else toast.error(r.error)
  }, [])

  useEffect(() => {
    if (cacheKey && cache.has(cacheKey)) setData(cache.get(cacheKey) as T)
    // 첫 조회가 나가기 전에 deps 가 바뀌면(예: 첫 출판사 자동 선택) 기다리지 않고 바로 조회
    const t = setTimeout(() => {
      loadedRef.current = true
      reload()
    }, loadedRef.current ? 150 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, reload }
}
