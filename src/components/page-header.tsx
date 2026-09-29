'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TOPBAR_ACTIONS_ID } from '@/components/top-bar'

/**
 * 화면 제목은 상단바가 보여주므로 본문에는 스크린리더용 h1 만 둔다.
 * 머리 버튼(children)은 상단바 오른쪽 자리로 옮겨 그린다.
 */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById(TOPBAR_ACTIONS_ID)), [])
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      {children && slot && createPortal(children, slot)}
    </>
  )
}
