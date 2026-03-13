type Props = {
  value: string
  onChange: (value: string) => void
}

export function TimeInput({ value, onChange }: Props) {
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
