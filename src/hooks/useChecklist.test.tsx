import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChecklist } from './useChecklist'

const {
  fetchChecklistItemsMock,
  createChecklistItemMock,
  updateChecklistItemMock,
  deleteChecklistItemMock,
  removeChannelMock,
  channelMock,
  onMock,
  subscribeMock,
} = vi.hoisted(() => ({
  fetchChecklistItemsMock: vi.fn(),
  createChecklistItemMock: vi.fn(),
  updateChecklistItemMock: vi.fn(),
  deleteChecklistItemMock: vi.fn(),
  removeChannelMock: vi.fn(),
  channelMock: vi.fn(),
  onMock: vi.fn(),
  subscribeMock: vi.fn(),
}))

vi.mock('../lib/trips', () => ({
  fetchChecklistItems: fetchChecklistItemsMock,
  createChecklistItem: createChecklistItemMock,
  updateChecklistItem: updateChecklistItemMock,
  deleteChecklistItem: deleteChecklistItemMock,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: channelMock,
    removeChannel: removeChannelMock,
  },
}))

describe('useChecklist', () => {
  beforeEach(() => {
    fetchChecklistItemsMock.mockReset()
    createChecklistItemMock.mockReset()
    updateChecklistItemMock.mockReset()
    deleteChecklistItemMock.mockReset()
    removeChannelMock.mockReset()
    subscribeMock.mockReset()
    onMock.mockReset()
    channelMock.mockReset()

    fetchChecklistItemsMock.mockResolvedValue([])
    onMock.mockReturnThis()
    subscribeMock.mockReturnThis()
    channelMock.mockReturnValue({
      on: onMock,
      subscribe: subscribeMock,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('DELETE は filter なしで購読する', async () => {
    vi.useFakeTimers()

    renderHook(() => useChecklist('trip-a'))

    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
    })

    const insertCall = onMock.mock.calls.find(([, config]) => config.event === 'INSERT')
    const updateCall = onMock.mock.calls.find(([, config]) => config.event === 'UPDATE')
    const deleteCall = onMock.mock.calls.find(([, config]) => config.event === 'DELETE')

    expect(insertCall?.[1]).toMatchObject({
      event: 'INSERT',
      schema: 'public',
      table: 'trip_checklist_items',
      filter: 'trip_id=eq.trip-a',
    })
    expect(updateCall?.[1]).toMatchObject({
      event: 'UPDATE',
      schema: 'public',
      table: 'trip_checklist_items',
      filter: 'trip_id=eq.trip-a',
    })
    expect(deleteCall?.[1]).toEqual({
      event: 'DELETE',
      schema: 'public',
      table: 'trip_checklist_items',
    })
  })
})
