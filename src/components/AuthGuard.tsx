import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { debugLog, captureError } from '../lib/debugLog'
import { detectInAppBrowser } from '../lib/detectInAppBrowser'
import { BrandLogo } from './BrandLogo'

type AuthGuardProps = {
  children: React.ReactNode
}

const inAppBrowserName = detectInAppBrowser()

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isAllowed, isLoading, signInWithGoogle, signOut } = useAuth()
  const [authError, setAuthError] = React.useState<string | null>(() => {
    try {
      const msg = sessionStorage.getItem('tabigoyomi_oauth_error')
      if (msg) {
        sessionStorage.removeItem('tabigoyomi_oauth_error')
        return msg
      }
    } catch {
      // ignore
    }
    return null
  })

  async function handleGoogleSignIn() {
    setAuthError(null)
    // #region agent log
    debugLog('AuthGuard', 'signInWithGoogle clicked', {})
    // #endregion

    try {
      const result = await signInWithGoogle()
      // #region agent log
      debugLog('AuthGuard', 'signInWithGoogle resolved', {
        hasError: !!result?.error,
        error: result?.error?.message,
      })
      // #endregion

      if (result?.error) {
        setAuthError(result.error.message ?? 'ログインに失敗しました')
      }
    } catch (error) {
      // #region agent log
      captureError('AuthGuard:signInWithGoogle', error)
      // #endregion
      setAuthError(error instanceof Error ? error.message : 'ログインに失敗しました')
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>読み込み中...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <BrandLogo variant="hero" />
        {inAppBrowserName && (
          <div className="in-app-browser-banner">
            <p>
              {inAppBrowserName}のブラウザでは
              Google ログインが利用できません。
            </p>
            <p>
              右上メニューから「ブラウザで開く」を選択してください。
            </p>
          </div>
        )}
        {authError && (
          <p style={{ marginBottom: '1rem', color: '#dc2626', fontSize: '0.9rem' }}>
            {authError}
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={!!inAppBrowserName}
          onClick={handleGoogleSignIn}
        >
          Googleでログイン
        </button>
      </div>
    )
  }

  if (!isAllowed) {
    return (
      <div className="auth-screen">
        <h1>アクセスできません</h1>
        <p style={{ marginBottom: '1.5rem' }}>
          このアプリは招待されたユーザーのみ利用できます。
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            borderRadius: '8px',
            border: '1px solid #ccc',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          ログアウト
        </button>
      </div>
    )
  }

  return <>{children}</>
}
