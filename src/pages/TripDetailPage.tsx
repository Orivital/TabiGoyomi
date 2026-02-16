import { useParams, Link } from 'react-router-dom'
import { useTripDetail } from '../hooks/useTripDetail'

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { trip, tripDays, isLoading, error } = useTripDetail(id ?? null)

  if (isLoading) {
    return (
      <div className="page">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="page">
        <p className="error">
          {error?.message ?? '旅程が見つかりません'}
        </p>
        <Link to="/">一覧に戻る</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <Link to="/" className="back-link">← 一覧</Link>
        <h1>{trip.title}</h1>
      </header>

      <main className="main">
        <p className="trip-dates">
          {trip.start_date.replace(/-/g, '/')} 〜 {trip.end_date.replace(/-/g, '/')}
        </p>

        <div className="trip-days">
          {tripDays.map((day) => (
            <section key={day.id} className="trip-day">
              <h3 className="day-date">
                {day.day_date.replace(/-/g, '/')}
              </h3>
              {day.memo && <p className="day-memo">{day.memo}</p>}
              <ul className="event-list">
                {day.events.map((event) => (
                  <li key={event.id} className="event-card">
                    <div className="event-time">
                      {event.start_time && event.end_time
                        ? `${event.start_time} - ${event.end_time}`
                        : event.start_time ?? '-'}
                    </div>
                    <div className="event-content">
                      <strong>{event.title}</strong>
                      {event.location && (
                        <span className="event-location">📍 {event.location}</span>
                      )}
                      {event.description && (
                        <p className="event-description">{event.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                to={`/trips/${trip.id}/days/${day.id}/events/new`}
                className="btn-add-event"
              >
                + 予定を追加
              </Link>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
