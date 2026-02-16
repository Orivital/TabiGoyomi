import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ja } from 'date-fns/locale'
import { registerLocale } from 'react-datepicker'

registerLocale('ja', ja)

type Props = {
  id?: string
  value: string
  onChange: (ymd: string) => void
  minDate?: string
  placeholder?: string
  required?: boolean
}

/** YYYY-MM-DD を Date に変換（タイムゾーンずれ防止） */
function toDate(ymd: string): Date | null {
  if (!ymd) return null
  const d = new Date(ymd + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

/** Date を YYYY-MM-DD に変換 */
function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DatePickerField({
  id,
  value,
  onChange,
  minDate,
  placeholder = 'YYYY/MM/DD',
  required,
}: Props) {
  const selected = toDate(value)
  const minRaw = minDate ? toDate(minDate) : null
  const min = minRaw === null ? undefined : minRaw

  return (
    <DatePicker
      id={id}
      selected={selected === null ? undefined : selected}
      onChange={(d: Date | null) => {
        if (d) onChange(toYMD(d))
        else onChange('')
      }}
      dateFormat="yyyy/MM/dd"
      dateFormatCalendar="yyyy年 LLLL"
      locale="ja"
      minDate={min}
      placeholderText={placeholder}
      required={required}
      className="date-picker-input"
    />
  )
}
