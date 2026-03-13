import { useRef } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  label: string
}

export function TimeInput({ value, onChange, label }: Props) {
  const lastInputSeen = useRef(false)

  return (
    <div className="time-input-wrapper">
      <input
        type="time"
        value={value}
        onInput={(e) => {
          lastInputSeen.current = true
          onChange((e.target as HTMLInputElement).value)
        }}
        onChange={(e) => {
          if (!lastInputSeen.current) return
          lastInputSeen.current = false
          onChange(e.target.value)
        }}
      />
      {value && (
        <button
          type="button"
          className="time-clear-btn"
          aria-label={`${label}をクリア`}
          onClick={(e) => {
            e.preventDefault()
            onChange('')
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
