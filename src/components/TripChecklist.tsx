import { useState, useRef, useEffect } from 'react'
import { useChecklist } from '../hooks/useChecklist'

type Props = {
  tripId: string
}

export function TripChecklist({ tripId }: Props) {
  const { items, isLoading, checkedCount, totalCount, addItem, toggleItem, removeItem } =
    useChecklist(tripId)
  const [isOpen, setIsOpen] = useState<boolean | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const addingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen === null && !isLoading) {
      setIsOpen(totalCount > 0 && checkedCount < totalCount)
    }
  }, [isLoading, totalCount, checkedCount])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // モバイルでキーボード表示時にパネルをキーボードの上に配置する
  useEffect(() => {
    if (!isOpen) return
    const vv = window.visualViewport
    if (!vv) return

    let rafId = 0
    const updatePosition = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const panel = panelRef.current
        if (!panel) return
        const keyboardHeight = window.innerHeight - vv.height
        panel.style.bottom = `${keyboardHeight}px`
      })
    }

    updatePosition()
    vv.addEventListener('resize', updatePosition)
    vv.addEventListener('scroll', updatePosition)
    return () => {
      cancelAnimationFrame(rafId)
      vv.removeEventListener('resize', updatePosition)
      vv.removeEventListener('scroll', updatePosition)
    }
  }, [isOpen])

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title || addingRef.current) return
    addingRef.current = true
    setNewTitle('')
    try {
      await addItem(title)
    } finally {
      addingRef.current = false
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  if (isLoading) return null

  return (
    <div className="checklist-widget">
      <button
        className="checklist-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={!!isOpen}
      >
        <span className="checklist-icon">✅</span>
        <span className="checklist-badge">
          {checkedCount}/{totalCount}
        </span>
        {isOpen && <span className="checklist-toggle-icon">&times;</span>}
      </button>

      {isOpen && (
        <>
          <div className="checklist-backdrop" onClick={() => setIsOpen(false)} />
          <div ref={panelRef} className="checklist-panel">
            <div className="checklist-header">
              <span className="checklist-title">チェックリスト</span>
            </div>
            <ul className="checklist-items">
              {items.map((item) => (
                <li key={item.id} className="checklist-item">
                  <label className="checklist-item-label">
                    <input
                      type="checkbox"
                      checked={item.is_checked}
                      onChange={() => toggleItem(item.id, item.is_checked)}
                    />
                    <span className={item.is_checked ? 'checklist-item-text--checked' : ''}>
                      {item.title}
                    </span>
                  </label>
                  <button
                    className="checklist-item-delete"
                    onClick={() => removeItem(item.id)}
                    aria-label="削除"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
            <div className="checklist-add">
              <input
                ref={inputRef}
                type="text"
                className="checklist-add-input"
                placeholder="追加..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="checklist-add-btn"
                onClick={handleAdd}
                disabled={!newTitle.trim()}
              >
                +
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
