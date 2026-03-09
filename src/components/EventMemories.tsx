import { useState, useEffect, useRef } from 'react'
import { fetchTripMemories, uploadEventMemory, deleteEventMemory } from '../lib/trips'
import type { EventMemory } from '../types/database'

type Props = {
  tripId: string
}

export function EventMemories({ tripId }: Props) {
  const [memories, setMemories] = useState<EventMemory[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchTripMemories(tripId).then(setMemories).catch(() => {})
  }, [tripId])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setError(null)
    try {
      const newMemories: EventMemory[] = []
      for (const file of Array.from(files)) {
        const memory = await uploadEventMemory(tripId, file)
        newMemories.push(memory)
      }
      setMemories((prev) => [...prev, ...newMemories])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (memoryId: string) => {
    try {
      await deleteEventMemory(memoryId)
      setMemories((prev) => prev.filter((m) => m.id !== memoryId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  return (
    <div className="event-memories-section">
      <span className="event-memories-label">思い出</span>
      {error && <p className="error">{error}</p>}
      <div className="event-memories-grid">
        {memories.map((memory) => (
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
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="event-memory-add-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
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
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}
