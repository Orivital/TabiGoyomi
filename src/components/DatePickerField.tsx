import { useRef, useCallback, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ja } from 'date-fns/locale'
import { registerLocale } from 'react-datepicker'

registerLocale('ja', ja)

const POSITION_UPDATE_DELAY_MS = 10
const MONITOR_INTERVAL_MS = 50
const POSITION_DRIFT_THRESHOLD_PX = 1
const POPPER_OFFSET_PX = 8

/** react-datepicker が内部で使用するポッパーのクラス名。ライブラリのバージョンアップで変更される可能性あり。 */
const POPPER_SELECTOR = '.react-datepicker-popper'

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
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fixedPositionRef = useRef<{ top: number; left: number } | null>(null)
  const monitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const updatePopperPosition = useCallback(() => {
    if (!inputRef.current) return

    const inputRect = inputRef.current.getBoundingClientRect()
    const top = inputRect.bottom + POPPER_OFFSET_PX
    const left = inputRect.left

    const popper = document.querySelector(POPPER_SELECTOR) as HTMLElement
    if (popper) {
      fixedPositionRef.current = { top, left }
      popper.style.position = 'fixed'
      popper.style.top = `${top}px`
      popper.style.left = `${left}px`
      popper.style.transform = 'none'
      popper.style.margin = '0'
      popper.style.zIndex = '9999'
    }
  }, [])

  const handleCalendarOpen = useCallback(() => {
    setTimeout(() => {
      updatePopperPosition()
    }, POSITION_UPDATE_DELAY_MS)

    const checkAndFixPosition = () => {
      const popper = document.querySelector(POPPER_SELECTOR) as HTMLElement
      if (popper && inputRef.current) {
        const currentTop = parseFloat(popper.style.top) || popper.getBoundingClientRect().top
        const inputRect = inputRef.current.getBoundingClientRect()
        const expectedTop = inputRect.bottom + POPPER_OFFSET_PX
        if (Math.abs(currentTop - expectedTop) > POSITION_DRIFT_THRESHOLD_PX) {
          updatePopperPosition()
        }
      }
    }

    monitorIntervalRef.current = setInterval(() => {
      const popper = document.querySelector(POPPER_SELECTOR) as HTMLElement
      if (popper) {
        checkAndFixPosition()
      }
    }, MONITOR_INTERVAL_MS)
  }, [updatePopperPosition])

  const handleCalendarClose = useCallback(() => {
    fixedPositionRef.current = null
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current)
      monitorIntervalRef.current = null
    }
  }, [])

  const handleMonthChange = useCallback(() => {
    if (fixedPositionRef.current) {
      setTimeout(() => {
        updatePopperPosition()
      }, POSITION_UPDATE_DELAY_MS)
    }
  }, [updatePopperPosition])

  useEffect(() => {
    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current)
        monitorIntervalRef.current = null
      }
    }
  }, [])

  return (
    <DatePicker
      ref={(ref) => {
        if (ref?.input) {
          inputRef.current = ref.input as HTMLInputElement
        }
      }}
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
      popperPlacement="bottom-start"
      onCalendarOpen={handleCalendarOpen}
      onCalendarClose={handleCalendarClose}
      onMonthChange={handleMonthChange}
    />
  )
}
