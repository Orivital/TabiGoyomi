import { useState, useEffect, useRef } from 'react'
import { uploadEventMemory, deleteEventMemory } from '../lib/trips'
import { getErrorMessage } from '../lib/errorMessage'
import type { EventMemory } from '../types/database'
import { useEventMemories } from '../hooks/useEventMemories'

type Props = {
  tripId: string
}

export function EventMemories({ tripId }: Props) {
  const { memories, setMemories, isLoading } = useEventMemories(tripId)
  const [uploadingTripId, setUploadingTripId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeTripIdRef = useRef(tripId)

  useEffect(() => {
    activeTripIdRef.current = tripId
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [tripId])

  const isUploading = uploadingTripId === tripId
  const isAddDisabled = isLoading || isUploading
  const visibleMemories = isLoading ? [] : memories
  const visibleError = isLoading ? null : error

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAddDisabled) {
      e.target.value = ''
      return
    }

    const files = e.target.files
    if (!files || files.length === 0) return

    const currentTripId = tripId
    setUploadingTripId(currentTripId)
    setError(null)
    const newMemories: EventMemory[] = []
    const errors: string[] = []
    for (const file of Array.from(files)) {
      try {
        const memory = await uploadEventMemory(currentTripId, file)
        newMemories.push(memory)
      } catch (err) {
        errors.push(`${file.name}: ${getErrorMessage(err, 'アップロードに失敗しました')}`)
      }
    }
    if (activeTripIdRef.current === currentTripId && newMemories.length > 0) {
      setMemories((prev) => [...prev, ...newMemories])
    }
    if (activeTripIdRef.current === currentTripId && errors.length > 0) {
      setError(errors.join('\n'))
    }
    setUploadingTripId((activeTripId) => (activeTripId === currentTripId ? null : activeTripId))
    e.target.value = ''
  }

  const handleDelete = async (memoryId: string) => {
    try {
      await deleteEventMemory(memoryId)
      setMemories((prev) => prev.filter((m) => m.id !== memoryId))
    } catch (err) {
      setError(getErrorMessage(err, '削除に失敗しました'))
    }
  }

  return (
    <div className="event-memories-section">
      <span className="event-memories-label">思い出</span>
      {visibleError && <p className="error">{visibleError}</p>}
      {isLoading && <p className="event-memories-loading">読み込み中...</p>}
      <div className="event-memories-grid">
        {visibleMemories.map((memory) => (
          <div key={memory.id} className="event-memory-item">
            {memory.file_type === 'video' ? (
              <video src={memory.file_url} controls playsInline />
            ) : (
              <img src={memory.file_url} alt="思い出" />
            )}
            <button
              type="button"
              className="event-memory-remove-btn"
              onClick={() => handleDelete(memory.id)}
              aria-label={`思い出 ${memory.id} を削除`}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="event-memory-add-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAddDisabled}
          aria-label="思い出を追加"
        >
          {isUploading ? '...' : '+'}
        </button>
      </div>
      {isUploading && <div className="event-memory-uploading">アップロード中...</div>}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4"
        disabled={isAddDisabled}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}
