import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTravelTimes } from './useTravelTimes'
import type { TripEvent } from '../types/database'

const {
  getTravelTimeMock,
  getCachedTravelTimeMock,
  updateTripEventMock,
} = vi.hoisted(() => ({
  getTravelTimeMock: vi.fn(),
  getCachedTravelTimeMock: vi.fn(),
  updateTripEventMock: vi.fn(),
}))

vi.mock('../lib/googleMaps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/googleMaps')>()
  return {
    ...actual,
    getTravelTime: getTravelTimeMock,
    getCachedTravelTime: getCachedTravelTimeMock,
    isGoogleMapsAvailable: () => true,
    isValidTravelMode: (value: string | null | undefined) =>
      value === 'walking' || value === 'transit' || value === 'driving',
  }
})

vi.mock('../lib/trips', () => ({
  updateTripEvent: updateTripEventMock,
}))

vi.mock('../lib/realtimeSkipList', () => ({
  markSelfUpdate: vi.fn(),
  clearSelfUpdate: vi.fn(),
}))

function createEvent(overrides: Partial<TripEvent>): TripEvent {
  return {
    id: overrides.id ?? 'event',
    trip_day_id: 'day-1',
    title: 'event',
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
    ...overrides,
  }
}

describe('useTravelTimes', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 2, 15, 9, 0, 0, 0).getTime())
    getTravelTimeMock.mockClear()
    getCachedTravelTimeMock.mockClear()
    updateTripEventMock.mockClear()
    getTravelTimeMock.mockResolvedValue({
      walking: null,
      transit: 18,
      driving: null,
    })
    getCachedTravelTimeMock.mockReturnValue(undefined)
    updateTripEventMock.mockResolvedValue({
      id: 'from',
      updated_at: '2026-03-20T10:00:01.000Z',
    } as TripEvent)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('transit は DB の保存値があっても日程時刻付きで再取得する', async () => {
    const events = [
      createEvent({
        id: 'from',
        location: 'レストラン ツモロ',
        address: '東京都千代田区丸の内1-1-1',
        end_time: '09:30',
        travel_mode: 'transit',
        travel_duration_minutes: 12,
      }),
      createEvent({
        id: 'to',
        location: 'パイの店 マーテル',
        address: '東京都台東区上野公園7-20',
        start_time: '10:00',
      }),
    ]

    renderHook(() => useTravelTimes(events, '2026-03-20'))

    await waitFor(() => {
      expect(getTravelTimeMock).toHaveBeenCalledTimes(1)
    })

    expect(getTravelTimeMock.mock.calls[0]?.[0]).toBe('レストラン ツモロ, 東京都千代田区丸の内1-1-1')
    expect(getTravelTimeMock.mock.calls[0]?.[1]).toBe('パイの店 マーテル, 東京都台東区上野公園7-20')
    const request = getTravelTimeMock.mock.calls[0]?.[2]
    expect(request).toMatchObject({ mode: 'transit' })
    expect(request.departureTime).toBeInstanceOf(Date)
    expect(updateTripEventMock).not.toHaveBeenCalled()
  })

  it('住所は郵便番号と全角を正規化して検索文字列に使う', async () => {
    const events = [
      createEvent({
        id: 'from',
        location: 'レストラン ツモロ',
        address: '〒709-0625 岡山県岡山市東区上道北方３４５',
        travel_mode: 'transit',
      }),
      createEvent({
        id: 'to',
        location: 'パイの店 マーテル',
        address: '〒700-0984 岡山県岡山市北区桑田町１３−１９',
        start_time: '13:00',
      }),
    ]

    renderHook(() => useTravelTimes(events, '2025-12-28'))

    await waitFor(() => {
      expect(getTravelTimeMock.mock.calls.length).toBeGreaterThan(0)
    })

    expect(getTravelTimeMock.mock.calls[0]?.[0]).toBe('レストラン ツモロ, 岡山県岡山市東区上道北方345')
    expect(getTravelTimeMock.mock.calls[0]?.[1]).toBe('パイの店 マーテル, 岡山県岡山市北区桑田町13-19')
    const request = getTravelTimeMock.mock.calls[0]?.[2]
    expect(request.arrivalTime).toBeInstanceOf(Date)
    expect(request.departureTime).toBeUndefined()
  })

  it('移動時間の DB 保存時は楽観的ロック用の expectedUpdatedAt を渡す', async () => {
    const events = [
      createEvent({
        id: 'from',
        location: 'A',
        address: '東京都千代田区1-1-1',
        travel_duration_minutes: null,
        updated_at: '2026-03-20T10:00:00.000Z',
      }),
      createEvent({
        id: 'to',
        location: 'B',
        address: '東京都港区2-2-2',
      }),
    ]

    getTravelTimeMock.mockResolvedValue({
      walking: 15,
      transit: null,
      driving: null,
    })

    renderHook(() => useTravelTimes(events, '2026-03-20'))

    await waitFor(() => {
      expect(updateTripEventMock).toHaveBeenCalledWith(
        'from',
        { travel_duration_minutes: 15 },
        { expectedUpdatedAt: '2026-03-20T10:00:00.000Z' }
      )
    })
  })
})
