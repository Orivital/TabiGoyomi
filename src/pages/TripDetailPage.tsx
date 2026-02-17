import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { formatDateWithWeekday, formatTimeWithoutSeconds } from '../lib/dateFormat'
import { useTripDetail } from '../hooks/useTripDetail'

type LocationState = {
  dayDate: string
  isGenerated: boolean
}

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { trip, tripDays, isLoading, error } = useTripDetail(id ?? null)

  // 期間内の日付を生成し、trip_daysとマージする処理をuseMemoで最適化
  const daysInRange = useMemo(() => {
    if (!trip) return []

    const startDate = new Date(trip.start_date)
    const endDate = new Date(trip.end_date)
    const dateRange: string[] = []
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateRange.push(d.toISOString().slice(0, 10))
    }

    return dateRange.map((dateStr) => {
      const day = tripDays.find((d) => d.day_date === dateStr)
      return day
        ? { ...day, isGenerated: false }
        : {
            id: `generated-${dateStr}`,
            trip_id: trip.id,
            day_date: dateStr,
            memo: null,
            created_at: '',
            updated_at: '',
            events: [],
            isGenerated: true,
          }
    })
  }, [trip, tripDays])

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
          {formatDateWithWeekday(trip.start_date)} 〜 {formatDateWithWeekday(trip.end_date)}
        </p>

        <div className="trip-days">
          {daysInRange.map((day, index) => (
            <section key={day.id} className="trip-day">
              <h3 className="day-date">
                {index + 1}日目 ({formatDateWithWeekday(day.day_date)})
              </h3>
              {day.memo && <p className="day-memo">{day.memo}</p>}
              <ul className="event-list">
                {day.events.map((event) => (
                  <li key={event.id} className="event-card">
                    <Link
                      to={`/trips/${trip.id}/events/${event.id}/edit`}
                      className="event-card-link"
                    >
                      <div className="event-time">
                        {event.start_time && event.end_time
                          ? `${formatTimeWithoutSeconds(event.start_time)} - ${formatTimeWithoutSeconds(event.end_time)}`
                          : formatTimeWithoutSeconds(event.start_time)}
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
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to={`/trips/${trip.id}/days/${day.id}/events/new`}
                className="btn-add-event"
                state={{ dayDate: day.day_date, isGenerated: day.isGenerated } as LocationState}
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
