import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { debugLog, captureError } from './lib/debugLog'
import { installVitePreloadRecovery } from './lib/vitePreloadRecovery'

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
installVitePreloadRecovery({
  target: window,
  onError: (error) => {
    captureError('vite:preloadError', error)
  },
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
