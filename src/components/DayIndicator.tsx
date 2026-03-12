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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect(index)
  }

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
      const targetLeft = activeTab.offsetLeft - (container.clientWidth - activeTab.offsetWidth) / 2
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)
      const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, targetLeft))

      container.scrollTo({
        left: nextScrollLeft,
        behavior: instantScroll || !hasAppliedInitialScrollRef.current ? 'auto' : 'smooth',
      })
      hasAppliedInitialScrollRef.current = true
      lastScrolledIndexRef.current = activeIndex
    }
  }, [activeIndex, instantScroll])

  return (
    <nav className="day-indicator" aria-label="日程ナビゲーション">
      <div className="day-indicator-tabs" ref={tabsRef}>
        {days.map((day, index) => (
          <div
            key={day.dayDate}
            role="button"
            tabIndex={0}
            className={`day-indicator-tab${index === activeIndex ? ' day-indicator-tab--active' : ''}`}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            <span className="day-indicator-tab-label">{day.label}</span>
          </div>
        ))}
      </div>
    </nav>
  )
}
