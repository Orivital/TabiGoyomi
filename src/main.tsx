import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// 開発環境では body に dev-mode クラスを付与して背景色を変える
if (import.meta.env.DEV) {
  document.body.classList.add('dev-mode')

  // ウォーターマーク: 「開発」文字を斜めに敷き詰めるオーバーレイ
  const watermark = document.createElement('div')
  watermark.className = 'dev-watermark'
  // 「開発」テキストを生成して画面を埋め尽くす
  const text = '開発 '.repeat(200)
  const lines = Array.from({ length: 40 }, () => text).join('\n')
  watermark.textContent = lines
  document.body.appendChild(watermark)
}

import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { debugLog, captureError } from './lib/debugLog'

// #region agent log
debugLog('main.tsx', 'app bootstrap', {
  hash: window.location.hash?.slice(0, 80),
  href: window.location.href,
})
window.addEventListener('error', (e) => {
  captureError('window.error', e.error ?? e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  captureError('unhandledrejection', e.reason)
})
// #endregion

// OAuth コールバックのエラーを事前に検出（Supabase パース前にハッシュをクリアしてクラッシュを防ぐ）
const hash = window.location.hash
if (hash) {
  try {
    const params = new URLSearchParams(hash.slice(1))
    const err = params.get('error')
    const desc = params.get('error_description')
    if (err || desc) {
      debugLog('main.tsx', 'OAuth callback error in hash', { err, desc })
      sessionStorage.setItem(
        'tabigoyomi_oauth_error',
        desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : err ?? '認証に失敗しました'
      )
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  } catch {
    // ignore
  }
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
