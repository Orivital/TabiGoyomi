import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updateTrip } from '../lib/trips'
import type { Trip } from '../types/database'

type Props = {
  trip: Trip
  onUpdated: () => void
}

export function EditableTripCard({ trip, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)
  const [startDate, setStartDate] = useState(trip.start_date)
  const [endDate, setEndDate] = useState(trip.end_date)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsEditing(true)
    setTitle(trip.title)
    setStartDate(trip.start_date)
    setEndDate(trip.end_date)
    setError(null)
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsEditing(false)
    setError(null)
  }

  const validateDates = (start?: string, end?: string) => {
    const s = start ?? startDate
    const e = end ?? endDate
    if (s && e && new Date(s) > new Date(e)) {
      setError('終了日は開始日以降にしてください')
      return false
    }
    setError(null)
    return true
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!title.trim() || !startDate || !endDate) return
    if (!validateDates()) return
    try {
      setIsSubmitting(true)
      setError(null)
      await updateTrip(trip.id, {
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
      })
      onUpdated()
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditing) {
    return (
      <div className="trip-card trip-card--editing">
        <form onSubmit={handleSave} className="trip-card-edit-form">
          {error && <p className="error">{error}</p>}
          <label htmlFor={`trip-title-${trip.id}`}>
            タイトル
            <input
              id={`trip-title-${trip.id}`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 北海道旅行"
              required
              autoFocus
            />
          </label>
          <label htmlFor={`trip-start-${trip.id}`}>
            開始日
            <input
              id={`trip-start-${trip.id}`}
              type="date"
              value={startDate}
              onChange={(e) => {
                const newStart = e.target.value
                setStartDate(newStart)
                validateDates(newStart, endDate)
              }}
              required
            />
          </label>
          <label htmlFor={`trip-end-${trip.id}`}>
            終了日
            <input
              id={`trip-end-${trip.id}`}
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                const newEnd = e.target.value
                setEndDate(newEnd)
                validateDates(startDate, newEnd)
              }}
              required
            />
          </label>
          <div className="trip-card-edit-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !!error}
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="trip-card-wrapper">
      <Link to={`/trips/${trip.id}`} className="trip-card">
        <h3>{trip.title}</h3>
        <p className="trip-dates">
          {trip.start_date} 〜 {trip.end_date}
        </p>
      </Link>
      <button
        type="button"
        className="trip-card-edit-btn"
        onClick={handleEditClick}
        title="編集"
        aria-label="編集"
      >
        編集
      </button>
    </div>
  )
}
