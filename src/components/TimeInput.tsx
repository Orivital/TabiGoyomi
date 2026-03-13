type Props = {
  value: string
  onChange: (value: string) => void
  label: string
}

export function TimeInput({ value, onChange, label }: Props) {
  return (
    <div className="time-input-wrapper">
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
