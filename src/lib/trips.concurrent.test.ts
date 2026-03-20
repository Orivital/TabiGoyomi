import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isConcurrentUpdatePostgrestError } from './errors'

const singleMock = vi.fn()
const selectMock = vi.fn()
const eqMock = vi.fn()
const updateMock = vi.fn()

const { storageRemoveMock, storageUploadMock } = vi.hoisted(() => ({
  storageRemoveMock: vi.fn(() => Promise.resolve({ data: [], error: null })),
  storageUploadMock: vi.fn(() => Promise.resolve({ data: null, error: null })),
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: updateMock,
    })),
    storage: {
      from: vi.fn(() => ({
        upload: storageUploadMock,
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: 'https://example.com/bucket/t1/thumbnail.jpg' },
        })),
        remove: storageRemoveMock,
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

describe('メディア削除・楽観的ロックの順序', () => {
  beforeEach(async () => {
    vi.resetModules()
    singleMock.mockReset()
    eqMock.mockReset()
    updateMock.mockReset()
    selectMock.mockReset()
    storageRemoveMock.mockReset()
    storageUploadMock.mockReset()
    storageUploadMock.mockResolvedValue({ data: null, error: null })
    storageRemoveMock.mockResolvedValue({ data: [], error: null })
    updateMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ eq: eqMock, select: selectMock })
    selectMock.mockReturnValue({ single: singleMock })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deleteTripThumbnail: 衝突時はストレージを削除しない', async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    const { deleteTripThumbnail } = await import('./trips')
    await expect(
      deleteTripThumbnail('t1', { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })
    ).rejects.toMatchObject({ name: 'ConcurrentModificationError' })

    expect(storageRemoveMock).not.toHaveBeenCalled()
  })

  it('deleteTripThumbnail: DB 成功後にストレージ削除する', async () => {
    singleMock.mockResolvedValue({
      data: { id: 't1', updated_at: '2026-01-02T00:00:00.000Z' },
      error: null,
    })

    const { deleteTripThumbnail } = await import('./trips')
    await deleteTripThumbnail('t1', { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })

    expect(storageRemoveMock).toHaveBeenCalledWith([
      't1/thumbnail.jpg',
      't1/thumbnail.png',
      't1/thumbnail.webp',
    ])
  })

  it('deleteReceiptImage: 衝突時はストレージを削除しない', async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    const { deleteReceiptImage } = await import('./trips')
    await expect(
      deleteReceiptImage('e1', { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })
    ).rejects.toMatchObject({ name: 'ConcurrentModificationError' })

    expect(storageRemoveMock).not.toHaveBeenCalled()
  })

  it('uploadTripThumbnail: DB 衝突時はアップロードしたファイルだけロールバック削除する', async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    const { uploadTripThumbnail } = await import('./trips')
    await expect(
      uploadTripThumbnail('t1', file, { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })
    ).rejects.toMatchObject({ name: 'ConcurrentModificationError' })

    expect(storageRemoveMock).toHaveBeenCalledTimes(1)
    expect(storageRemoveMock).toHaveBeenCalledWith(['t1/thumbnail.jpg'])
  })

  it('uploadTripThumbnail: DB 成功後に他拡張子のサムネだけ削除する', async () => {
    singleMock.mockResolvedValue({
      data: { id: 't1', updated_at: '2026-01-02T00:00:00.000Z' },
      error: null,
    })

    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    const { uploadTripThumbnail } = await import('./trips')
    await uploadTripThumbnail('t1', file, { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })

    expect(storageRemoveMock).toHaveBeenCalledTimes(1)
    expect(storageRemoveMock).toHaveBeenCalledWith(['t1/thumbnail.png', 't1/thumbnail.webp'])
  })

  it('uploadReceiptImage: DB 衝突時はアップロードしたファイルだけロールバック削除する', async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' })
    const { uploadReceiptImage } = await import('./trips')
    await expect(
      uploadReceiptImage('e1', file, { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })
    ).rejects.toMatchObject({ name: 'ConcurrentModificationError' })

    expect(storageRemoveMock).toHaveBeenCalledTimes(1)
    expect(storageRemoveMock).toHaveBeenCalledWith(['e1/receipt.jpg'])
  })

  it('uploadReceiptImage: DB 成功後に他拡張子のレシート画像だけ削除する', async () => {
    singleMock.mockResolvedValue({
      data: { id: 'e1', updated_at: '2026-01-02T00:00:00.000Z' },
      error: null,
    })

    const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' })
    const { uploadReceiptImage } = await import('./trips')
    await uploadReceiptImage('e1', file, { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })

    expect(storageRemoveMock).toHaveBeenCalledTimes(1)
    expect(storageRemoveMock).toHaveBeenCalledWith(['e1/receipt.png', 'e1/receipt.webp'])
  })
})
