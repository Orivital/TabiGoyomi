import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TripDetailPage } from './TripDetailPage'

const mockCarouselState = vi.hoisted(() => ({
  activeIndex: 2,
}))

vi.mock('../hooks/useTripDetail', () => ({
  useTripDetail: () => ({
    trip: {
      id: 'trip-1',
      title: 'テスト旅程',
      start_date: '2026-03-01',
      end_date: '2026-03-05',
    },
    tripDays: [
      {
        id: 'day-1',
        trip_id: 'trip-1',
        day_date: '2026-03-01',
        memo: null,
        created_at: '',
        updated_at: '',
        events: [],
      },
      {
        id: 'day-2',
        trip_id: 'trip-1',
        day_date: '2026-03-02',
        memo: null,
        created_at: '',
        updated_at: '',
        events: [],
      },
      {
        id: 'day-3',
        trip_id: 'trip-1',
        day_date: '2026-03-03',
        memo: null,
        created_at: '',
        updated_at: '',
        events: [],
      },
      {
        id: 'day-4',
        trip_id: 'trip-1',
        day_date: '2026-03-04',
        memo: null,
        created_at: '',
        updated_at: '',
        events: [],
      },
      {
        id: 'day-5',
        trip_id: 'trip-1',
        day_date: '2026-03-05',
        memo: null,
        created_at: '',
        updated_at: '',
        events: [],
      },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useCarousel', () => ({
  useCarousel: () => ({
    containerRef: { current: null },
    activeIndex: mockCarouselState.activeIndex,
    scrollTo: vi.fn(),
    handleScroll: vi.fn(),
  }),
}))

vi.mock('../hooks/useTravelTimes', () => ({
  useTravelTimes: () => [],
}))

vi.mock('../components/TripChecklist', () => ({
  TripChecklist: () => null,
}))

vi.mock('../components/DayIndicator', () => ({
  DayIndicator: () => null,
}))

vi.mock('../components/TravelTimeIndicator', () => ({
  TravelTimeIndicator: () => null,
}))

function LocationStateProbe() {
  const location = useLocation()
  return <pre data-testid="location-state">{JSON.stringify(location.state)}</pre>
}

function TestRouter() {
  return (
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/trips/trip-1',
          state: { focusDayDate: '2026-03-03' },
        },
      ]}
    >
      <Routes>
        <Route
          path="/trips/:id"
          element={
            <>
              <TripDetailPage />
              <LocationStateProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

function renderPage() {
  return render(<TestRouter />)
}

describe('TripDetailPage', () => {
  it('現在表示中の日付を履歴 state に同期する', async () => {
    mockCarouselState.activeIndex = 2
    const view = renderPage()

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)))
    })

    expect(screen.getByTestId('location-state')).toHaveTextContent('2026-03-03')

    mockCarouselState.activeIndex = 4
    view.rerender(<TestRouter />)

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('2026-03-05')
    })
  })
})
