import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { createTripEvent } from '../lib/trips'

export function NewEventPage() {
  const { tripId, dayId } = useParams<{ tripId: string; dayId: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tripId || !dayId || !title.trim()) return
    try {
      setIsSubmitting(true)
      setError(null)
      await createTripEvent({
        trip_day_id: dayId,
        title: title.trim(),
        location: location.trim() || undefined,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        description: description.trim() || undefined,
      })
      navigate(`/trips/${tripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <Link to={`/trips/${tripId}`} className="back-link">← 戻る</Link>
        <h1>予定を追加</h1>
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
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? '追加中...' : '追加'}
          </button>
        </form>
      </main>
    </div>
  )
}
