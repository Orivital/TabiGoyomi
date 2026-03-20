import { BrandLogo } from './BrandLogo'

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <BrandLogo variant="hero" />
      <div className="loading-dots" role="status" aria-label="読み込み中">
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </div>
    </div>
  )
}
