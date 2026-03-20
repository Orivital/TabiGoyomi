import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  updateTrip,
  deleteTrip,
  uploadTripThumbnail,
  deleteTripThumbnail,
  fetchTripDaysWithEventsOutsideRange,
  moveTripDayEventsToDate,
  deleteOutOfRangeTripDays,
  deleteTripDay,
} from '../lib/trips'
import { ConcurrentModificationError } from '../lib/errors'
import type { TripDayWithEvents } from '../lib/trips'
import { formatDateWithWeekdayWithoutYear } from '../lib/dateFormat'
import { DatePickerField } from './DatePickerField'
import { useDateRangeAdjustment } from '../hooks/useDateRangeAdjustment'
import type { Trip } from '../types/database'

type Props = {
  trip: Trip
  totalCost: number | null
  onUpdated: () => void
}

type DayAction = { type: 'delete' } | { type: 'move'; targetDate: string }

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

export function EditableTripCard({ trip, totalCost, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [shouldDeleteThumbnail, setShouldDeleteThumbnail] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const expectedTripUpdatedAtRef = useRef(trip.updated_at)

  // 範囲外イベント解決UI用の状態
  const [outOfRangeDays, setOutOfRangeDays] = useState<TripDayWithEvents[]>([])
  const [dayActions, setDayActions] = useState<Record<string, DayAction>>({})
  const [isResolving, setIsResolving] = useState(false)
  const [pendingSave, setPendingSave] = useState<{ title: string; startDate: string; endDate: string } | null>(null)

  useEffect(() => {
    return () => {
      if (thumbnailPreview && thumbnailPreview.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnailPreview)
      }
    }
  }, [thumbnailPreview])
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

  const handleEditClick = () => {
    expectedTripUpdatedAtRef.current = trip.updated_at
    setIsEditing(true)
    setTitle(trip.title)
    setStartDate(trip.start_date)
    setEndDate(trip.end_date)
    setThumbnailFile(null)
    setThumbnailPreview(trip.thumbnail_url)
    setShouldDeleteThumbnail(false)
    setError(null)
    setIsResolving(false)
    setOutOfRangeDays([])
    setDayActions({})
    setPendingSave(null)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setThumbnailFile(null)
    setThumbnailPreview(null)
    setShouldDeleteThumbnail(false)
    setError(null)
    setIsResolving(false)
    setOutOfRangeDays([])
    setDayActions({})
    setPendingSave(null)
  }

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true)
  }

  const handleDeleteConfirm = async () => {
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

  const handleDeleteCancel = () => {
    setIsConfirmingDelete(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnailFile(file)
    setShouldDeleteThumbnail(false)
    if (thumbnailPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnailPreview)
    }
    setThumbnailPreview(URL.createObjectURL(file))
  }

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null)
    if (thumbnailPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnailPreview)
    }
    setThumbnailPreview(null)
    setShouldDeleteThumbnail(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || !endDate) return
    try {
      setIsSubmitting(true)
      setError(null)
      const adjustedEndDate = getAdjustedEndDate()

      // 範囲外にイベントを持つ日があるかチェック
      const affected = await fetchTripDaysWithEventsOutsideRange(
        trip.id,
        startDate,
        adjustedEndDate
      )

      if (affected.length > 0) {
        // 解決UIを表示
        setOutOfRangeDays(affected)
        const newDateRange = generateDateRange(startDate, adjustedEndDate)
        const defaultActions: Record<string, DayAction> = {}
        for (const day of affected) {
          defaultActions[day.id] = { type: 'move', targetDate: newDateRange[0] ?? startDate }
        }
        setDayActions(defaultActions)
        setPendingSave({ title: title.trim(), startDate, endDate: adjustedEndDate })
        setIsResolving(true)
      } else {
        // 影響なし → 楽観ロックで旅程を先に更新し、成功後に範囲外の空日のみ削除（競合時に日だけ消える事故を防ぐ）
        let token = expectedTripUpdatedAtRef.current
        const updatedTrip = await updateTrip(
          trip.id,
          {
            title: title.trim(),
            start_date: startDate,
            end_date: adjustedEndDate,
          },
          { expectedUpdatedAt: token }
        )
        token = updatedTrip.updated_at
        await deleteOutOfRangeTripDays(trip.id, startDate, adjustedEndDate)
        if (thumbnailFile) {
          const thumb = await uploadTripThumbnail(trip.id, thumbnailFile, { expectedUpdatedAt: token })
          token = thumb.updatedAt
        } else if (shouldDeleteThumbnail) {
          const thumb = await deleteTripThumbnail(trip.id, { expectedUpdatedAt: token })
          token = thumb.updatedAt
        }
        expectedTripUpdatedAtRef.current = token
        onUpdated()
        setIsEditing(false)
      }
    } catch (err) {
      if (err instanceof ConcurrentModificationError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : '更新に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResolveBack = () => {
    setIsResolving(false)
    setOutOfRangeDays([])
    setDayActions({})
    setPendingSave(null)
  }

  const handleResolveConfirm = async () => {
    if (!pendingSave) return
    try {
      setIsSubmitting(true)
      setError(null)

      // 先に楽観ロックで旅程を更新（競合時に日・イベントだけ先に壊れるのを防ぐ）
      let token = expectedTripUpdatedAtRef.current
      const updatedTrip = await updateTrip(
        trip.id,
        {
          title: pendingSave.title,
          start_date: pendingSave.startDate,
          end_date: pendingSave.endDate,
        },
        { expectedUpdatedAt: token }
      )
      token = updatedTrip.updated_at

      // 各日のアクションを実行
      for (const day of outOfRangeDays) {
        const action = dayActions[day.id]
        if (!action || action.type === 'delete') {
          await deleteTripDay(day.id)
        } else if (action.type === 'move') {
          await moveTripDayEventsToDate(day.id, trip.id, action.targetDate)
          await deleteTripDay(day.id)
        }
      }

      // 残った空の範囲外日を削除
      await deleteOutOfRangeTripDays(trip.id, pendingSave.startDate, pendingSave.endDate)
      if (thumbnailFile) {
        const thumb = await uploadTripThumbnail(trip.id, thumbnailFile, { expectedUpdatedAt: token })
        token = thumb.updatedAt
      } else if (shouldDeleteThumbnail) {
        const thumb = await deleteTripThumbnail(trip.id, { expectedUpdatedAt: token })
        token = thumb.updatedAt
      }
      expectedTripUpdatedAtRef.current = token

      onUpdated()
      setIsEditing(false)
      setIsResolving(false)
      setOutOfRangeDays([])
      setDayActions({})
      setPendingSave(null)
    } catch (err) {
      if (err instanceof ConcurrentModificationError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : '更新に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDayActionChange = (dayId: string, value: string) => {
    if (value === 'delete') {
      setDayActions((prev) => ({ ...prev, [dayId]: { type: 'delete' } }))
    } else {
      setDayActions((prev) => ({ ...prev, [dayId]: { type: 'move', targetDate: value } }))
    }
  }

  // 解決UI
  if (isResolving && pendingSave) {
    const newDateRange = generateDateRange(pendingSave.startDate, pendingSave.endDate)
    return (
      <div className="trip-card trip-card--editing">
        <div className="out-of-range-notice">
          {error && <p className="error">{error}</p>}
          <p className="out-of-range-notice-text">
            日付変更により以下の日のイベントが範囲外になります。各日のイベントをどうするか選択してください。
          </p>
          {outOfRangeDays.map((day) => {
            const action = dayActions[day.id]
            const selectValue = action?.type === 'delete' ? 'delete' : action?.type === 'move' ? action.targetDate : ''
            return (
              <div key={day.id} className="out-of-range-day">
                <div className="out-of-range-day-header">
                  {formatDateWithWeekdayWithoutYear(day.day_date)}
                </div>
                <ul className="out-of-range-event-list">
                  {day.trip_events.map((ev) => (
                    <li key={ev.id}>{ev.title}</li>
                  ))}
                </ul>
                <select
                  className="out-of-range-action-select"
                  value={selectValue}
                  onChange={(e) => handleDayActionChange(day.id, e.target.value)}
                >
                  <option value="delete">削除する</option>
                  {newDateRange.map((date) => (
                    <option key={date} value={date}>
                      {formatDateWithWeekdayWithoutYear(date)} に移動
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
          <div className="trip-card-edit-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleResolveBack}
              disabled={isSubmitting}
            >
              戻る
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleResolveConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? '保存中...' : '確定'}
            </button>
          </div>
        </div>
      </div>
    )
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
          <div className="trip-card-thumbnail-edit-section">
            <span className="trip-card-thumbnail-label">サムネイル</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              hidden
            />
            {thumbnailPreview ? (
              <div className="trip-card-thumbnail-preview-wrapper">
                <img
                  src={thumbnailPreview}
                  alt="サムネイルプレビュー"
                  className="trip-card-thumbnail-preview"
                />
                <button
                  type="button"
                  className="trip-card-thumbnail-remove-btn"
                  onClick={handleRemoveThumbnail}
                >
                  画像を削除
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="trip-card-thumbnail-upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="trip-card-thumbnail-placeholder">
                  タップして画像を選択
                </span>
              </button>
            )}
          </div>
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
      <Link to={`/trips/${trip.id}`} className={`trip-card${trip.thumbnail_url ? ' trip-card--has-thumbnail' : ''}`}>
        {trip.thumbnail_url && (
          <img
            src={trip.thumbnail_url}
            alt={trip.title}
            className="trip-card-thumbnail"
          />
        )}
        <p className="trip-dates">
          {formatDateWithWeekdayWithoutYear(trip.start_date)} 〜 {formatDateWithWeekdayWithoutYear(trip.end_date)}
        </p>
        {totalCost != null && totalCost > 0 && (
          <p className="trip-card-total-cost">💰 {totalCost.toLocaleString()}円</p>
        )}
        <div className="trip-card-title-row">
          <h3>{trip.title}</h3>
        </div>
      </Link>
      <div className="trip-card-footer">
        <div className="trip-card-actions">
          <button
            type="button"
            className="trip-card-edit-btn"
            onClick={handleEditClick}
            title="編集"
            aria-label="編集"
          >
            編集
          </button>
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
        </div>
        <Link
          to={`/trips/${trip.id}/memories`}
          className="trip-card-memories-btn"
          title="思い出"
          aria-label="思い出"
        >
          📷
        </Link>
      </div>
    </div>
  )
}
