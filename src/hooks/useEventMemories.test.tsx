import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEventMemories } from './useEventMemories'
import type { EventMemory } from '../types/database'

const {
  fetchTripMemoriesMock,
  removeChannelMock,
  channelMock,
  onMock,
  subscribeMock,
} = vi.hoisted(() => ({
  fetchTripMemoriesMock: vi.fn(),
  removeChannelMock: vi.fn(),
  channelMock: vi.fn(),
  onMock: vi.fn(),
  subscribeMock: vi.fn(),
}))

vi.mock('../lib/trips', () => ({
  fetchTripMemories: fetchTripMemoriesMock,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: channelMock,
    removeChannel: removeChannelMock,
  },
}))

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function createMemory(id: string, tripId: string): EventMemory {
  return {
    id,
    trip_id: tripId,
    file_url: `https://example.com/${id}.jpg`,
    file_type: 'image',
    sort_order: 0,
    created_at: '2026-03-18T00:00:00.000Z',
    updated_at: '2026-03-18T00:00:00.000Z',
  }
}

describe('useEventMemories', () => {
  beforeEach(() => {
    fetchTripMemoriesMock.mockReset()
    removeChannelMock.mockReset()
    subscribeMock.mockReset()
    onMock.mockReset()
    channelMock.mockReset()

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

  it('trip 切り替え時に古い memories を即座に隠す', async () => {
    fetchTripMemoriesMock
      .mockResolvedValueOnce([createMemory('memory-a', 'trip-a')])
      .mockImplementationOnce(() => new Promise(() => {}))

    const { result, rerender } = renderHook(
      ({ tripId }) => useEventMemories(tripId),
      { initialProps: { tripId: 'trip-a' as string | null } }
    )

    await waitFor(() => {
      expect(result.current.memories).toEqual([createMemory('memory-a', 'trip-a')])
    })

    rerender({ tripId: 'trip-b' })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.memories).toEqual([])
  })

  it('trip を素早く切り替えても古い fetch 結果で上書きしない', async () => {
    const tripA = createDeferred<EventMemory[]>()
    const tripB = createDeferred<EventMemory[]>()

    fetchTripMemoriesMock.mockImplementation((tripId: string) => {
      if (tripId === 'trip-a') return tripA.promise
      if (tripId === 'trip-b') return tripB.promise
      throw new Error(`Unexpected tripId: ${tripId}`)
    })

    const { result, rerender } = renderHook(
      ({ tripId }) => useEventMemories(tripId),
      { initialProps: { tripId: 'trip-a' as string | null } }
    )

    rerender({ tripId: 'trip-b' })

    await act(async () => {
      tripB.resolve([createMemory('memory-b', 'trip-b')])
      await tripB.promise
    })

    await waitFor(() => {
      expect(result.current.memories).toEqual([createMemory('memory-b', 'trip-b')])
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      tripA.resolve([createMemory('memory-a', 'trip-a')])
      await tripA.promise
    })

    expect(result.current.memories).toEqual([createMemory('memory-b', 'trip-b')])
    expect(result.current.isLoading).toBe(false)
  })

  it('DELETE は filter なしで購読する', async () => {
    vi.useFakeTimers()
    fetchTripMemoriesMock.mockResolvedValue([])

    renderHook(() => useEventMemories('trip-a'))

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
      table: 'event_memories',
      filter: 'trip_id=eq.trip-a',
    })
    expect(updateCall?.[1]).toMatchObject({
      event: 'UPDATE',
      schema: 'public',
      table: 'event_memories',
      filter: 'trip_id=eq.trip-a',
    })
    expect(deleteCall?.[1]).toEqual({
      event: 'DELETE',
      schema: 'public',
      table: 'event_memories',
    })
  })
})
