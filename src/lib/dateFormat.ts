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
 * YYYY-MM-DD 形式の日付文字列を M/DD (曜日) 形式に変換（年を省略）
 * @param ymd YYYY-MM-DD 形式の日付文字列
 * @returns M/DD (曜日) 形式の文字列、または空文字列
 */
export function formatDateWithWeekdayWithoutYear(ymd: string): string {
  if (!ymd) return ''
  
  const date = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(date.getTime())) {
    // フォールバック: 年を除いた部分を返す
    const parts = ymd.split('-')
    if (parts.length === 3) {
      const m = parts[1] ?? ''
      const d = parts[2] ?? ''
      if (m && d) {
        return `${parseInt(m, 10)}/${parseInt(d, 10)}`
      }
    }
    return ymd.replace(/-/g, '/')
  }
  
  const m = date.getMonth() + 1
  const d = date.getDate()
  
  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdayNames[date.getDay()]
  
  return `${m}/${d} (${weekday})`
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

/**
 * 時刻文字列を分単位の数値に変換して比較用の値を取得
 * @param time HH:mm:ss または HH:mm 形式の時間文字列
 * @returns 分単位の数値（例: "10:30" -> 630）
 * @throws {Error} 不正な形式の時間文字列が渡された場合
 */
function timeToMinutes(time: string): number {
  // HH:mm:ss または HH:mm 形式のバリデーション
  if (!time.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
    throw new Error(`不正な時間形式です: "${time}". HH:mm:ss または HH:mm 形式を期待しています。`)
  }
  
  const parts = time.split(':')
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`不正な時間形式です: "${time}". HH:mm:ss または HH:mm 形式を期待しています。`)
  }
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  
  // 数値の妥当性チェック
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours >= 24 || minutes < 0 || minutes >= 60) {
    throw new Error(`不正な時間値です: "${time}". 時間は0-23、分は0-59の範囲である必要があります。`)
  }
  
  return hours * 60 + minutes
}

/**
 * 時刻文字列を比較する（ソート用）
 * @param a 時刻文字列1
 * @param b 時刻文字列2
 * @returns 比較結果（a < b なら負の値、a > b なら正の値、a === b なら0）
 */
export function compareTimeStrings(a: string, b: string): number {
  return timeToMinutes(a) - timeToMinutes(b)
}
