/**
 * YYYY-MM-DD 形式の日付文字列を YYYY/MM/DD (曜日) 形式に変換
 * @param ymd YYYY-MM-DD 形式の日付文字列
 * @returns YYYY/MM/DD (曜日) 形式の文字列、または空文字列
 */
export function formatDateWithWeekday(ymd: string): string {
  if (!ymd) return ''
  
  const date = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(date.getTime())) return ymd.replace(/-/g, '/')
  
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  
  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdayNames[date.getDay()]
  
  return `${y}/${m}/${d} (${weekday})`
}

/**
 * HH:mm:ss 形式の時間文字列から秒を削除して HH:mm 形式に変換
 * @param time HH:mm:ss または HH:mm 形式の時間文字列
 * @returns HH:mm 形式の文字列
 * @throws {Error} 不正な形式の時間文字列が渡された場合
 */
export function formatTimeWithoutSeconds(time: string | null): string {
  if (!time) return '-'
  
  // HH:mm:ss 形式の場合、秒を削除
  if (time.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return time.slice(0, 5) // 最初の5文字（HH:mm）を取得
  }
  
  // 既に HH:mm 形式の場合はそのまま返す
  if (time.match(/^\d{2}:\d{2}$/)) {
    return time
  }
  
  // 不正な形式の場合はエラーを投げる
  throw new Error(`不正な時間形式です: "${time}". HH:mm:ss または HH:mm 形式を期待しています。`)
}
