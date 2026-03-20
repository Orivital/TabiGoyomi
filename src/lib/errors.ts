/** 楽観的ロック: 他クライアント等により updated_at が変わり UPDATE が 0 件だったとき */
export class ConcurrentModificationError extends Error {
  constructor(
    message = '他の操作によりデータが更新されました。画面を再読み込みしてからやり直してください。'
  ) {
    super(message)
    this.name = 'ConcurrentModificationError'
  }
}

export function isConcurrentUpdatePostgrestError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'PGRST116'
  )
}
