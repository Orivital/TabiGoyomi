import { useRef, useEffect } from 'react'

type Props = {
  days: { dayDate: string; label: string }[]
  activeIndex: number
  onSelect: (index: number) => void
}

export function DayIndicator({ days, activeIndex, onSelect }: Props) {
  const tabsRef = useRef<HTMLDivElement>(null)

  // アクティブタブが見えるように自動スクロール
  useEffect(() => {
    const container = tabsRef.current
    if (!container) return

    const activeTab = container.children[activeIndex] as HTMLElement | undefined
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeIndex])

  return (
    <nav className="day-indicator" aria-label="日程ナビゲーション">
      <div className="day-indicator-tabs" ref={tabsRef}>
        {days.map((day, index) => (
          <button
            key={day.dayDate}
            className={`day-indicator-tab${index === activeIndex ? ' day-indicator-tab--active' : ''}`}
            onClick={() => onSelect(index)}
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            {day.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
