import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updateTrip, deleteTrip } from '../lib/trips'
import { formatDateWithWeekdayWithoutYear } from '../lib/dateFormat'
import { DatePickerField } from './DatePickerField'
import { useDateRangeAdjustment } from '../hooks/useDateRangeAdjustment'
import type { Trip } from '../types/database'

type Props = {
  trip: Trip
  onUpdated: () => void
}

export function EditableTripCard({ trip, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    handleStartDateChange,
    handleEndDateChange,
    getAdjustedEndDate,
  } = useDateRangeAdjustment({
    initialStart: trip.start_date,
    initialEnd: trip.end_date,
    onDateChange: () => setError(null),
  })

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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsConfirmingDelete(true)
  }

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      setIsSubmitting(true)
      setError(null)
      await deleteTrip(trip.id)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsSubmitting(false)
      setIsConfirmingDelete(false)
    }
  }

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsConfirmingDelete(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!title.trim() || !startDate || !endDate) return
    try {
      setIsSubmitting(true)
      setError(null)
      const adjustedEndDate = getAdjustedEndDate()
      await updateTrip(trip.id, {
        title: title.trim(),
        start_date: startDate,
        end_date: adjustedEndDate,
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
            <DatePickerField
              id={`trip-start-${trip.id}`}
              value={startDate}
              onChange={handleStartDateChange}
              placeholder="YYYY/MM/DD"
              required
            />
          </label>
          <label htmlFor={`trip-end-${trip.id}`}>
            終了日
            <DatePickerField
              id={`trip-end-${trip.id}`}
              value={endDate}
              onChange={handleEndDateChange}
              minDate={startDate || undefined}
              placeholder="YYYY/MM/DD"
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
              disabled={isSubmitting}
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
      {error && <p className="error trip-card-error">{error}</p>}
      <Link to={`/trips/${trip.id}`} className="trip-card">
        <p className="trip-dates">
          {formatDateWithWeekdayWithoutYear(trip.start_date)} 〜 {formatDateWithWeekdayWithoutYear(trip.end_date)}
        </p>
        <div className="trip-card-title-row">
          <h3>{trip.title}</h3>
          <div className="trip-card-actions">
            {isConfirmingDelete ? (
              <>
                <span className="trip-card-delete-confirm-label">削除しますか？</span>
                <button
                  type="button"
                  className="trip-card-delete-confirm-btn"
                  onClick={handleDeleteConfirm}
                  disabled={isSubmitting}
                  title="削除を実行"
                  aria-label="削除を実行"
                >
                  {isSubmitting ? '削除中...' : 'はい'}
                </button>
                <button
                  type="button"
                  className="trip-card-delete-cancel-btn"
                  onClick={handleDeleteCancel}
                  disabled={isSubmitting}
                  title="キャンセル"
                  aria-label="キャンセル"
                >
                  いいえ
                </button>
              </>
            ) : (
              <button
                type="button"
                className="trip-card-delete-btn"
                onClick={handleDeleteClick}
                title="削除"
                aria-label="削除"
                disabled={isSubmitting}
              >
                削除
              </button>
            )}
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
        </div>
      </Link>
    </div>
  )
}
