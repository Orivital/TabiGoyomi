import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isConcurrentUpdatePostgrestError } from './errors'

const singleMock = vi.fn()
const selectMock = vi.fn()
const eqMock = vi.fn()
const updateMock = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: updateMock,
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ publicUrl: 'https://example.com/x' })),
        remove: vi.fn(),
      })),
    },
  },
}))

updateMock.mockReturnValue({ eq: eqMock })
eqMock.mockReturnValue({ eq: eqMock, select: selectMock })
selectMock.mockReturnValue({ single: singleMock })

describe('isConcurrentUpdatePostgrestError', () => {
  it('PGRST116 を同時更新衝突とみなす', () => {
    expect(isConcurrentUpdatePostgrestError({ code: 'PGRST116', message: 'x' })).toBe(true)
  })

  it('それ以外は false', () => {
    expect(isConcurrentUpdatePostgrestError({ code: '23505', message: 'x' })).toBe(false)
    expect(isConcurrentUpdatePostgrestError(null)).toBe(false)
  })
})

describe('楽観的ロック付き updateTripEvent', () => {
  beforeEach(async () => {
    vi.resetModules()
    singleMock.mockReset()
    eqMock.mockReset()
    updateMock.mockReset()
    selectMock.mockReset()
    updateMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ eq: eqMock, select: selectMock })
    selectMock.mockReturnValue({ single: singleMock })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('id と updated_at の両方で eq する', async () => {
    singleMock.mockResolvedValue({
      data: { id: 'e1', updated_at: '2026-01-02T00:00:00.000Z' },
      error: null,
    })

    const { updateTripEvent } = await import('./trips')
    await updateTripEvent(
      'e1',
      { title: 't' },
      { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }
    )

    expect(eqMock).toHaveBeenCalledWith('id', 'e1')
    expect(eqMock).toHaveBeenCalledWith('updated_at', '2026-01-01T00:00:00.000Z')
  })

  it('PGRST116 のとき ConcurrentModificationError', async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    const { updateTripEvent } = await import('./trips')
    await expect(
      updateTripEvent('e1', { title: 't' }, { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })
    ).rejects.toMatchObject({ name: 'ConcurrentModificationError' })
  })
})
