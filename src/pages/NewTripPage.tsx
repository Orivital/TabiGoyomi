import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createTrip } from '../lib/trips'
import { DatePickerField } from '../components/DatePickerField'
import { useDateRangeAdjustment } from '../hooks/useDateRangeAdjustment'

export function NewTripPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const {
    startDate,
    endDate,
    handleStartDateChange,
    handleEndDateChange,
    getAdjustedEndDate,
  } = useDateRangeAdjustment({ onDateChange: () => setError(null) })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || !endDate) return
    const adjustedEndDate = getAdjustedEndDate()
    try {
      setIsSubmitting(true)
      setError(null)
      const trip = await createTrip({ title: title.trim(), start_date: startDate, end_date: adjustedEndDate })
      navigate(`/trips/${trip.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <Link to="/" className="back-link">← 一覧</Link>
        <h1>新規旅程</h1>
      </header>

      <main className="main">
        <form onSubmit={handleSubmit} className="trip-form">
          {error && <p className="error">{error}</p>}
          <label>
            タイトル
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 北海道旅行"
              required
            />
          </label>
          <label>
            開始日
            <DatePickerField
              value={startDate}
              onChange={handleStartDateChange}
              placeholder="YYYY/MM/DD"
              required
            />
          </label>
          <label>
            終了日
            <DatePickerField
              value={endDate}
              onChange={handleEndDateChange}
              minDate={startDate || undefined}
              placeholder="YYYY/MM/DD"
              required
            />
          </label>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? '作成中...' : '作成'}
          </button>
        </form>
      </main>
    </div>
  )
}
