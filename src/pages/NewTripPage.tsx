import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createTrip } from '../lib/trips'

export function NewTripPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || !endDate) return
    if (new Date(startDate) > new Date(endDate)) {
      setError('終了日は開始日以降にしてください')
      return
    }
    try {
      setIsSubmitting(true)
      setError(null)
      const trip = await createTrip({ title: title.trim(), start_date: startDate, end_date: endDate })
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
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label>
            終了日
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
