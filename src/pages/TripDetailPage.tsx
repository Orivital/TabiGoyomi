import { useMemo, useLayoutEffect, useEffect, useState, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { formatDateWithWeekday, formatDateWithWeekdayWithoutYear, formatTimeWithoutSeconds, compareTimeStrings } from '../lib/dateFormat'
import { useTripDetail } from '../hooks/useTripDetail'
import { useCarousel } from '../hooks/useCarousel'
import { useTravelTimes } from '../hooks/useTravelTimes'
import { DayIndicator } from '../components/DayIndicator'
import { TripChecklist } from '../components/TripChecklist'
import { TravelTimeIndicator } from '../components/TravelTimeIndicator'
import type { TripDetailLocationState } from '../types/navigation'

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { trip, tripDays, isLoading, error } = useTripDetail(id ?? null)
  const locationState = location.state as TripDetailLocationState | null
  const shouldRestoreFocus = Boolean(locationState?.focusDayDate)
  const [isRestoringFocus, setIsRestoringFocus] = useState(shouldRestoreFocus)
  const hasScrolledToEventRef = useRef(false)

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

    if (initialFocusIndex === 0) return

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

  useEffect(() => {
    if (isLoading || isRestoringFocus) return

    const currentDayDate = daysInRange[activeIndex]?.day_date
    if (!currentDayDate) return

    if (
      locationState?.focusDayDate === currentDayDate &&
      !locationState?.focusEventId
    ) {
      return
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { focusDayDate: currentDayDate } as TripDetailLocationState,
    })
  }, [
    activeIndex,
    daysInRange,
    isLoading,
    isRestoringFocus,
    location.pathname,
    location.search,
    locationState?.focusDayDate,
    locationState?.focusEventId,
    navigate,
  ])

  // イベントカードの縦スクロール位置を復元
  useLayoutEffect(() => {
    if (isRestoringFocus || isLoading) return
    if (hasScrolledToEventRef.current) return
    const focusEventId = locationState?.focusEventId
    if (!focusEventId) return
    hasScrolledToEventRef.current = true

    const carousel = containerRef.current
    if (!carousel) return
    const eventEl = carousel.querySelector(
      `[data-event-id="${CSS.escape(focusEventId)}"]`
    ) as HTMLElement | null
    if (!eventEl) return

    const slideEl = eventEl.closest('.trip-day-slide') as HTMLElement | null
    if (!slideEl) return
    const slideRect = slideEl.getBoundingClientRect()
    const eventRect = eventEl.getBoundingClientRect()
    slideEl.scrollTop = eventRect.top - slideRect.top - slideRect.height / 2 + eventRect.height / 2
  }, [isRestoringFocus, isLoading, locationState?.focusEventId, containerRef])

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
      <TripChecklist tripId={trip.id} />
      <header className="header header--trip-detail">
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
            <DaySlide
              key={day.id}
              day={day}
              index={index}
              tripId={trip.id}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

type DaySlideDay = {
  id: string
  trip_id: string
  day_date: string
  memo: string | null
  events: import('../types/database').TripEvent[]
  isGenerated: boolean
}

type DaySlideProps = {
  day: DaySlideDay
  index: number
  tripId: string
}

function DaySlide({ day, index, tripId }: DaySlideProps) {
  const travelTimes = useTravelTimes(day.events, day.day_date)

  return (
    <section className="trip-day-slide" data-carousel-index={index}>
      <h3 className="day-date">
        <span>{index + 1}日目</span>
        <span>{formatDateWithWeekdayWithoutYear(day.day_date)}</span>
      </h3>
      {day.memo && <p className="day-memo">{day.memo}</p>}
      <ul className="event-list">
        {day.events.map((event, eventIndex) => {
          const travelTimePair = travelTimes.find(
            (tt) => tt.toEventId === event.id
          )
          return (
            <li key={event.id}>
              {eventIndex > 0 && (
                <div className="event-connector">
                  <div className="event-connector-track" />
                  {travelTimePair && (
                    <TravelTimeIndicator
                      travelTime={travelTimePair.travelTime}
                      isLoading={travelTimePair.isLoading}
                      mode={travelTimePair.mode}
                      onModeChange={travelTimePair.setMode}
                    />
                  )}
                </div>
              )}
              <div className="event-card" data-event-id={event.id}>
                <Link
                  to={`/trips/${tripId}/events/${event.id}/edit`}
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
              </div>
            </li>
          )
        })}
      </ul>
      <Link
        to={`/trips/${tripId}/days/${day.id}/events/new`}
        className="btn-add-event"
        state={{ dayDate: day.day_date }}
      >
        + 予定を追加
      </Link>
    </section>
  )
}
