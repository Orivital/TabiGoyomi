import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchTripMemories, uploadEventMemory, deleteEventMemory } from '../lib/trips'
import type { EventMemory } from '../types/database'

export function EventMemoriesPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const [memories, setMemories] = useState<EventMemory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!tripId) return
    let stale = false
    setMemories([])
    setError(null)
    setIsLoading(true)
    fetchTripMemories(tripId)
      .then((data) => {
        if (!stale) setMemories(data)
      })
      .catch((err) => {
        if (!stale) setError(err instanceof Error ? err.message : '読み込みに失敗しました')
      })
      .finally(() => {
        if (!stale) setIsLoading(false)
      })
    return () => { stale = true }
  }, [tripId])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !tripId) return

    setIsUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const memory = await uploadEventMemory(tripId, file)
        setMemories((prev) => [...prev, memory])
      }
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
      setMemories((prev) => prev.filter((memory) => memory.id !== memoryId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  return (
    <div className="page">
      <header className="header">
        <Link to="/" className="back-link">← 戻る</Link>
        <h1>思い出</h1>
      </header>

      <main className="main">
        {isLoading && <p>読み込み中...</p>}
        {error && <p className="error">{error}</p>}
        {!isLoading && memories.length === 0 && (
          <p className="empty-message">まだ思い出がありません</p>
        )}
        {!isLoading && memories.length > 0 && (
          <div className="memories-upload-toolbar">
            <button
              type="button"
              className="memories-upload-inline-btn"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              {isUploading ? 'アップロード中...' : '写真を追加'}
            </button>
          </div>
        )}
        {!isLoading && memories.length === 0 && tripId && (
          <div className="memories-empty-state">
            <button
              type="button"
              className="memories-upload-card"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              <span className="memories-upload-card-icon">
                {isUploading ? '...' : '＋'}
              </span>
              <span className="memories-upload-card-label">写真をアップロード</span>
            </button>
            {isUploading && (
              <div className="event-memory-uploading">アップロード中...</div>
            )}
          </div>
        )}
        {memories.length > 0 && (
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
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </main>
    </div>
  )
}
