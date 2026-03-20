import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ConcurrentModificationError } from '../lib/errors'
import { EditableTripCard } from './EditableTripCard'
import type { TripDayWithEvents } from '../lib/trips'
import type { Trip } from '../types/database'

const tripsMocks = vi.hoisted(() => ({
  updateTrip: vi.fn(),
  deleteOutOfRangeTripDays: vi.fn().mockResolvedValue(undefined),
  fetchTripDaysWithEventsOutsideRange: vi.fn().mockResolvedValue([]),
  deleteTrip: vi.fn(),
  uploadTripThumbnail: vi.fn(),
  deleteTripThumbnail: vi.fn(),
  moveTripDayEventsToDate: vi.fn().mockResolvedValue(undefined),
  deleteTripDay: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/trips', () => tripsMocks)

const baseTrip: Trip = {
  id: 'trip-1',
  title: '北海道',
  start_date: '2026-03-01',
  end_date: '2026-03-05',
  thumbnail_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function renderCard(trip = baseTrip, onUpdated = vi.fn()) {
  return render(
    <MemoryRouter>
      <EditableTripCard trip={trip} totalCost={null} onUpdated={onUpdated} />
    </MemoryRouter>
  )
}

describe('EditableTripCard 保存と楽観ロック', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tripsMocks.fetchTripDaysWithEventsOutsideRange.mockResolvedValue([])
    tripsMocks.updateTrip.mockResolvedValue({
      ...baseTrip,
      title: '北海道',
      updated_at: '2026-01-02T00:00:00.000Z',
    })
  })

  it('updateTrip が ConcurrentModificationError のとき 範囲外日削除は呼ばれない', async () => {
    const user = userEvent.setup()
    tripsMocks.updateTrip.mockRejectedValueOnce(new ConcurrentModificationError())

    renderCard()

    await user.click(screen.getByRole('button', { name: '編集' }))
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(tripsMocks.updateTrip).toHaveBeenCalled()
    })
    expect(tripsMocks.deleteOutOfRangeTripDays).not.toHaveBeenCalled()
  })

  it('範囲外解決の確定で updateTrip が競合したとき 日削除系は呼ばれない', async () => {
    const user = userEvent.setup()
    const affectedDay: TripDayWithEvents = {
      id: 'day-early',
      trip_id: 'trip-1',
      day_date: '2026-03-01',
      memo: null,
      created_at: '',
      updated_at: '',
      trip_events: [
        {
          id: 'ev-1',
          trip_day_id: 'day-early',
          title: '朝食',
          location: null,
          start_time: null,
          end_time: null,
          description: null,
          sort_order: 0,
          is_reserved: false,
          is_settled: false,
          is_reservation_not_needed: false,
          cost: null,
          phone: null,
          address: null,
          opening_hours: null,
          website_url: null,
          google_maps_url: null,
          receipt_image_url: null,
          travel_mode: null,
          travel_duration_minutes: null,
          created_at: '',
          updated_at: '',
        },
      ],
    }
    tripsMocks.fetchTripDaysWithEventsOutsideRange.mockResolvedValue([affectedDay])
    tripsMocks.updateTrip.mockRejectedValueOnce(new ConcurrentModificationError())

    renderCard()

    await user.click(screen.getByRole('button', { name: '編集' }))
    await user.click(screen.getByRole('button', { name: '保存' }))
    await user.click(await screen.findByRole('button', { name: '確定' }))

    await waitFor(() => {
      expect(tripsMocks.updateTrip).toHaveBeenCalled()
    })
    expect(tripsMocks.deleteTripDay).not.toHaveBeenCalled()
    expect(tripsMocks.moveTripDayEventsToDate).not.toHaveBeenCalled()
    expect(tripsMocks.deleteOutOfRangeTripDays).not.toHaveBeenCalled()
  })
})
