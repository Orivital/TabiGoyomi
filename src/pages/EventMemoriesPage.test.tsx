import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventMemoriesPage } from './EventMemoriesPage'
import type { EventMemory } from '../types/database'

const { paramsState, uploadEventMemoryMock, setMemoriesMock } = vi.hoisted(() => ({
  paramsState: { tripId: 'trip-a' },
  uploadEventMemoryMock: vi.fn(),
  setMemoriesMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useParams: () => ({ tripId: paramsState.tripId }),
  }
})

vi.mock('../lib/trips', () => ({
  uploadEventMemory: uploadEventMemoryMock,
  deleteEventMemory: vi.fn(),
}))

vi.mock('../hooks/useEventMemories', () => ({
  useEventMemories: () => ({
    memories: [],
    setMemories: setMemoriesMock,
    isLoading: false,
  }),
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

describe('EventMemoriesPage', () => {
  beforeEach(() => {
    paramsState.tripId = 'trip-a'
    uploadEventMemoryMock.mockReset()
    setMemoriesMock.mockReset()
  })

  it('trip 切り替え中でも新しい trip の upload UI を塞がない', async () => {
    const upload = createDeferred<EventMemory>()
    uploadEventMemoryMock.mockReturnValue(upload.promise)

    const { container, rerender } = render(
      <MemoryRouter>
        <EventMemoriesPage />
      </MemoryRouter>
    )
    const input = container.querySelector('input[type="file"]')
    const file = new File(['image'], 'memory-a.jpg', { type: 'image/jpeg' })

    if (!input) {
      throw new Error('file input not found')
    }

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロード中...')).toBeInTheDocument()
    })

    paramsState.tripId = 'trip-b'
    rerender(
      <MemoryRouter>
        <EventMemoriesPage />
      </MemoryRouter>
    )

    expect(screen.queryByText('アップロード中...')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /写真をアップロード/ })).not.toBeDisabled()

    await act(async () => {
      upload.resolve(createMemory('memory-a', 'trip-a'))
      await upload.promise
    })

    expect(setMemoriesMock).not.toHaveBeenCalled()
  })
})
