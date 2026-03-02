import { useMemo, useLayoutEffect, useEffect, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { formatDateWithWeekday, formatDateWithWeekdayWithoutYear, formatTimeWithoutSeconds, compareTimeStrings } from '../lib/dateFormat'
import { useTripDetail } from '../hooks/useTripDetail'
import { useCarousel } from '../hooks/useCarousel'
import { DayIndicator } from '../components/DayIndicator'

type LocationState = {
  dayDate: string
  isGenerated: boolean
}

type TripDetailLocationState = {
  focusDayDate?: string
}

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { trip, tripDays, isLoading, error } = useTripDetail(id ?? null)
  const locationState = location.state as TripDetailLocationState | null
  const shouldRestoreFocus = Boolean(locationState?.focusDayDate)
  const [isRestoringFocus, setIsRestoringFocus] = useState(shouldRestoreFocus)

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
      const events = day?.events || []
      // イベントをstart_timeでソート（start_timeがnullの場合は最後に配置）
      const sortedEvents = [...events].sort((a, b) => {
        if (!a.start_time && !b.start_time) {
          return a.sort_order - b.sort_order
        }
        if (!a.start_time) return 1
        if (!b.start_time) return -1
        return compareTimeStrings(a.start_time, b.start_time)
      })
      
      return day
        ? { ...day, events: sortedEvents, isGenerated: false }
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

  const initialFocusIndex = useMemo(() => {
    const focusDayDate = locationState?.focusDayDate
    if (!focusDayDate || daysInRange.length === 0) return 0
    const index = daysInRange.findIndex((day) => day.day_date === focusDayDate)
    return index >= 0 ? index : 0
  }, [daysInRange, locationState?.focusDayDate])

  const { containerRef, activeIndex, scrollTo, handleScroll } = useCarousel(
    daysInRange.length,
    initialFocusIndex,
    !isLoading
  )
  const displayActiveIndex = isRestoringFocus ? initialFocusIndex : activeIndex

  useLayoutEffect(() => {
    if (isLoading || !isRestoringFocus) return

    if (initialFocusIndex === 0) {
      setIsRestoringFocus(false)
      return
    }

    scrollTo(initialFocusIndex, 'auto')
  }, [initialFocusIndex, isLoading, isRestoringFocus, scrollTo])

  useEffect(() => {
    if (isLoading || !isRestoringFocus) return
    if (activeIndex !== initialFocusIndex) return

    const rafId = window.requestAnimationFrame(() => {
      setIsRestoringFocus(false)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [activeIndex, initialFocusIndex, isLoading, isRestoringFocus])

  const dayTabs = daysInRange.map((day, i) => ({
    dayDate: day.day_date,
    label: `${i + 1}日目`,
  }))

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

        {!isRestoringFocus && (
          <DayIndicator
            days={dayTabs}
            activeIndex={displayActiveIndex}
            onSelect={scrollTo}
            instantScroll={false}
          />
        )}

        <div
          className="trip-days-carousel"
          ref={containerRef}
          onScroll={handleScroll}
          style={isRestoringFocus ? { visibility: 'hidden' } : undefined}
        >
          {daysInRange.map((day, index) => (
            <section key={day.id} className="trip-day-slide" data-carousel-index={index}>
              <h3 className="day-date">
                <span>{index + 1}日目</span>
                <span>{formatDateWithWeekdayWithoutYear(day.day_date)}</span>
              </h3>
              {day.memo && <p className="day-memo">{day.memo}</p>}
              <ul className="event-list">
                {day.events.map((event) => (
                  <li key={event.id} className="event-card">
                    <Link
                      to={`/trips/${trip.id}/events/${event.id}/edit`}
                      className="event-card-link"
                      state={{ focusDayDate: day.day_date } as TripDetailLocationState}
                    >
                      <div className="event-time">
                        {event.start_time && event.end_time
                          ? `${formatTimeWithoutSeconds(event.start_time)} - ${formatTimeWithoutSeconds(event.end_time)}`
                          : formatTimeWithoutSeconds(event.start_time)}
                      </div>
                      <div className="event-content">
                        <div className="event-title-row">
                          <strong>{event.title}</strong>
                          {event.cost != null && (
                            <span className="event-cost">¥{event.cost.toLocaleString()}</span>
                          )}
                        </div>
                        {(event.is_reserved || event.is_settled || event.is_reservation_not_needed) && (
                          <div className="event-status-badges">
                            {event.is_reserved && (
                              <span className="event-badge event-badge-reserved">予約済み</span>
                            )}
                            {event.is_settled && (
                              <span className="event-badge event-badge-settled">精算済み</span>
                            )}
                            {event.is_reservation_not_needed && (
                              <span className="event-badge event-badge-not-needed">予約不要</span>
                            )}
                          </div>
                        )}
                        {event.location && (
                          <span className="event-location">📍 {event.location}</span>
                        )}
                        {event.description && (
                          <p className="event-description">{event.description}</p>
                        )}
                      </div>
                    </Link>
                    {(event.phone || event.google_maps_url || event.website_url) && (
                      <div className="event-place-links">
                        {event.phone && (
                          <a href={`tel:${event.phone}`} className="event-place-link">📞 電話</a>
                        )}
                        {event.google_maps_url && (
                          <a href={event.google_maps_url} target="_blank" rel="noopener noreferrer" className="event-place-link">🗺️ 地図</a>
                        )}
                        {event.website_url && (
                          <a href={event.website_url} target="_blank" rel="noopener noreferrer" className="event-place-link">🌐 Web</a>
                        )}
                      </div>
                    )}
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
