import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fetchTripEvent, updateTripEvent, deleteTripEvent } from '../lib/trips'

export function EditEventPage() {
  const { tripId, eventId } = useParams<{ tripId: string; eventId: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [isReserved, setIsReserved] = useState(false)
  const [isSettled, setIsSettled] = useState(false)
  const [isReservationNotNeeded, setIsReservationNotNeeded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!eventId) {
        setIsLoading(false)
        return
      }
      try {
        const event = await fetchTripEvent(eventId)
        setTitle(event.title)
        setLocationInput(event.location ?? '')
        setStartTime(event.start_time ?? '')
        setEndTime(event.end_time ?? '')
        setDescription(event.description ?? '')
        setIsReserved(event.is_reserved ?? false)
        setIsSettled(event.is_settled ?? false)
        setIsReservationNotNeeded(event.is_reservation_not_needed ?? false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '予定の読み込みに失敗しました')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [eventId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !title.trim()) return
    try {
      setIsSubmitting(true)
      setError(null)
      await updateTripEvent(eventId, {
        title: title.trim(),
        location: locationInput.trim() || undefined,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        description: description.trim() || undefined,
        is_reserved: isReserved,
        is_settled: isSettled,
        is_reservation_not_needed: isReservationNotNeeded,
      })
      navigate(`/trips/${tripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!eventId || !tripId) return
    if (!window.confirm('この予定を削除しますか？')) return
    try {
      setIsSubmitting(true)
      setError(null)
      await deleteTripEvent(eventId)
      navigate(`/trips/${tripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error && !title) {
    return (
      <div className="page">
        <header className="header">
          <Link to={`/trips/${tripId}`} className="back-link">← 戻る</Link>
          <h1>予定を編集</h1>
        </header>
        <main className="main">
          <p className="error">{error}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <Link to={`/trips/${tripId}`} className="back-link">← 戻る</Link>
        <h1>予定を編集</h1>
      </header>

      <main className="main">
        <form onSubmit={handleSubmit} className="event-form">
          {error && <p className="error">{error}</p>}
          <label>
            タイトル *
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 旭山動物園"
              required
            />
          </label>
          <label>
            場所
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="例: 旭川市"
            />
          </label>
          <div className="form-row">
            <label>
              開始時刻
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label>
              終了時刻
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
          <label>
            メモ
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細やメモ"
              rows={3}
            />
          </label>
          <div className="form-section">
            <label>
              予約
              <select
                value={
                  isReserved
                    ? 'reserved'
                    : isReservationNotNeeded
                    ? 'not_needed'
                    : ''
                }
                onChange={(e) => {
                  const value = e.target.value
                  setIsReserved(value === 'reserved')
                  setIsReservationNotNeeded(value === 'not_needed')
                }}
              >
                <option value="">選択なし</option>
                <option value="reserved">予約済み</option>
                <option value="not_needed">予約不要</option>
              </select>
            </label>
          </div>
          <div className="form-section">
            <label>
              精算
              <select
                value={isSettled ? 'settled' : ''}
                onChange={(e) => setIsSettled(e.target.value === 'settled')}
              >
                <option value="">選択なし</option>
                <option value="settled">精算済み</option>
              </select>
            </label>
          </div>
          <div className="event-form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? '更新中...' : '更新'}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              削除
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
