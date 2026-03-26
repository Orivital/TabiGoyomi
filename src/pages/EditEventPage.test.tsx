import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EditEventPage } from './EditEventPage'

// ---- モック ----
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

vi.mock('../lib/trips', () => ({
  fetchTripEvent: vi.fn(),
  updateTripEvent: vi.fn(),
  deleteTripEvent: vi.fn(),
  uploadReceiptImage: vi.fn(),
  deleteReceiptImage: vi.fn(),
}))

vi.mock('../lib/reminderPreferences', () => ({
  fetchEventReminderPrefs: vi.fn(),
  upsertEventReminderPrefs: vi.fn(),
}))

vi.mock('../components/PlaceAutocompleteInput', () => ({
  PlaceAutocompleteInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} data-testid="place-input" />
  ),
}))

vi.mock('../components/TimeInput', () => ({
  TimeInput: ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <input
      type="text"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

// ---- ヘルパー ----
import { supabase } from '../lib/supabase'
import { fetchTripEvent, updateTripEvent } from '../lib/trips'
import { fetchEventReminderPrefs, upsertEventReminderPrefs } from '../lib/reminderPreferences'

const mockSupabase = supabase as unknown as { auth: { getUser: ReturnType<typeof vi.fn> } }
const mockFetchTripEvent = fetchTripEvent as ReturnType<typeof vi.fn>
const mockUpdateTripEvent = updateTripEvent as ReturnType<typeof vi.fn>
const mockFetchEventReminderPrefs = fetchEventReminderPrefs as ReturnType<typeof vi.fn>
const mockUpsertEventReminderPrefs = upsertEventReminderPrefs as ReturnType<typeof vi.fn>

function renderPage(tripId = 'trip-1', eventId = 'event-1') {
  return render(
    <MemoryRouter initialEntries={[`/trips/${tripId}/events/${eventId}/edit`]}>
      <Routes>
        <Route path="/trips/:tripId/events/:eventId/edit" element={<EditEventPage />} />
        <Route path="/trips/:tripId" element={<div>旅程詳細</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const baseEvent = {
  id: 'event-1',
  trip_id: 'trip-1',
  title: 'テストイベント',
  location: null,
  start_time: '10:00',
  end_time: '11:00',
  description: null,
  cost: null,
  is_reserved: false,
  is_settled: false,
  is_reservation_not_needed: false,
  phone: null,
  address: null,
  opening_hours: null,
  website_url: null,
  google_maps_url: null,
  receipt_image_url: null,
  updated_at: '2026-03-27T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchTripEvent.mockResolvedValue(baseEvent)
  mockUpdateTripEvent.mockResolvedValue({ ...baseEvent, updated_at: '2026-03-27T00:01:00Z' })
  mockUpsertEventReminderPrefs.mockResolvedValue(undefined)
})

describe('EditEventPage - remind_end_at_enabled の保持', () => {
  it('既存の remind_end_at_enabled: true を保存時に上書きしない', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFetchEventReminderPrefs.mockResolvedValue({
      user_id: 'user-1',
      trip_event_id: 'event-1',
      remind_start_enabled: true,
      remind_end_enabled: true,
      remind_end_at_enabled: true,
      remind_start_minutes_before: 5,
      remind_end_minutes_before: 5,
    })

    renderPage()

    // データ読み込み完了を待つ
    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
    })

    // フォーム送信
    await userEvent.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(mockUpsertEventReminderPrefs).toHaveBeenCalledTimes(1)
    })

    const calledWith = mockUpsertEventReminderPrefs.mock.calls[0][1] as Record<string, unknown>
    expect(calledWith.remind_end_at_enabled).toBe(true)
  })

  it('既存の remind_end_at_enabled: false は false のまま保持する', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFetchEventReminderPrefs.mockResolvedValue({
      user_id: 'user-1',
      trip_event_id: 'event-1',
      remind_start_enabled: true,
      remind_end_enabled: true,
      remind_end_at_enabled: false,
      remind_start_minutes_before: 5,
      remind_end_minutes_before: 5,
    })

    renderPage()

    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(mockUpsertEventReminderPrefs).toHaveBeenCalledTimes(1)
    })

    const calledWith = mockUpsertEventReminderPrefs.mock.calls[0][1] as Record<string, unknown>
    expect(calledWith.remind_end_at_enabled).toBe(false)
  })

  it('リマインダー設定が未登録の場合は remind_end_at_enabled: false で保存する', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFetchEventReminderPrefs.mockResolvedValue(null)

    renderPage()

    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(mockUpsertEventReminderPrefs).toHaveBeenCalledTimes(1)
    })

    const calledWith = mockUpsertEventReminderPrefs.mock.calls[0][1] as Record<string, unknown>
    expect(calledWith.remind_end_at_enabled).toBe(false)
  })
})
