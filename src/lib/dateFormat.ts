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
