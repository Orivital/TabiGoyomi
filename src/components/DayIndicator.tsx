import { useRef, useLayoutEffect } from 'react'

type Props = {
  days: { dayDate: string; label: string }[]
  activeIndex: number
  onSelect: (index: number) => void
  instantScroll?: boolean
}

export function DayIndicator({ days, activeIndex, onSelect, instantScroll = false }: Props) {
  const tabsRef = useRef<HTMLDivElement>(null)
  const hasAppliedInitialScrollRef = useRef(false)
  const lastScrolledIndexRef = useRef<number | null>(null)

  // アクティブタブが見えるように自動スクロール
  useLayoutEffect(() => {
    const container = tabsRef.current
    if (!container) return

    // 復帰フラグだけが切り替わった場合は再スクロールしない
    if (!instantScroll && hasAppliedInitialScrollRef.current && lastScrolledIndexRef.current === activeIndex) {
      return
    }

    const activeTab = container.children[activeIndex] as HTMLElement | undefined
    if (activeTab) {
      activeTab.scrollIntoView({
        behavior: instantScroll || !hasAppliedInitialScrollRef.current ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center',
      })
      hasAppliedInitialScrollRef.current = true
      lastScrolledIndexRef.current = activeIndex
    }
  }, [activeIndex, instantScroll])

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
