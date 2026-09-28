export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/** 사용자에게 그대로 보여줄 오류 */
export class AppError extends Error {}

export async function wrap<T>(fn: () => T): Promise<Result<T>> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message }
    if (e instanceof Error && e.message.includes('UNIQUE')) return { ok: false, error: '이미 등록된 코드입니다.' }
    console.error(e)
    return { ok: false, error: '처리 중 오류가 발생했습니다.' }
  }
}
