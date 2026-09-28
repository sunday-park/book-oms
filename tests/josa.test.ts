import { describe, expect, it } from 'vitest'
import { josa } from '@/lib/josa'

describe('josa', () => {
  it('받침 유무에 따라 알맞은 조사를 고른다', () => {
    expect(josa('출판사', '을', '를')).toBe('를') // 받침 없음
    expect(josa('도서명', '을', '를')).toBe('을') // 받침 있음(ㅁ)
    expect(josa('서점', '을', '를')).toBe('을') // 받침 있음(ㅁ)
    expect(josa('부수', '은', '는')).toBe('는') // 받침 없음
  })
  it('한글 음절이 아니면 받침 없는 쪽을 쓴다', () => {
    expect(josa('ABC', '을', '를')).toBe('를')
  })
})
