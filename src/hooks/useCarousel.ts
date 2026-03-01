import { useRef, useState, useEffect, useCallback } from 'react'

export function useCarousel(totalSlides: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // React onScroll で使用するハンドラ（addEventListener 不要で確実に接続）
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const slideWidth = container.offsetWidth
    if (slideWidth === 0) return
    const index = Math.round(container.scrollLeft / slideWidth)
    setActiveIndex(Math.max(0, Math.min(index, totalSlides - 1)))
  }, [totalSlides])

  // プログラム的にスクロール（containerRef は ref なので deps 不要）
  const scrollTo = useCallback((index: number) => {
    const container = containerRef.current
    if (!container) return

    // 楽観的更新：クリック直後にタブを即座にハイライト
    setActiveIndex(index)
    // コンテナを直接スクロール（各スライドは100%幅なのでoffsetWidthで計算）
    container.scrollTo({ left: container.offsetWidth * index, behavior: 'smooth' })
  }, [])

  // キーボード左右矢印でナビゲーション
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && activeIndex > 0) {
        scrollTo(activeIndex - 1)
      } else if (e.key === 'ArrowRight' && activeIndex < totalSlides - 1) {
        scrollTo(activeIndex + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, totalSlides, scrollTo])

  return { containerRef, activeIndex, scrollTo, handleScroll }
}
