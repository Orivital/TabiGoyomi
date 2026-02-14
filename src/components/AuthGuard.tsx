import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { debugLog, captureError } from '../lib/debugLog'

type AuthGuardProps = {
  children: React.ReactNode
}

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

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>読み込み中...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h1>旅暦</h1>
        {authError && (
          <p style={{ marginBottom: '1rem', color: '#dc2626', fontSize: '0.9rem' }}>
            {authError}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setAuthError(null)
            // #region agent log
            debugLog('AuthGuard', 'signInWithGoogle clicked', {})
            // #endregion
            signInWithGoogle()?.then((r)=>{
              // #region agent log
              debugLog('AuthGuard', 'signInWithGoogle resolved', {
                hasError: !!r?.error,
                error: r?.error?.message,
              })
              // #endregion
              if (r?.error) {
                setAuthError(r.error.message ?? 'ログインに失敗しました')
              }
            }).catch((e)=>{
              // #region agent log
              captureError('AuthGuard:signInWithGoogle', e)
              // #endregion
              setAuthError(e instanceof Error ? e.message : 'ログインに失敗しました')
            });
          }}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            borderRadius: '8px',
            border: 'none',
            background: '#2563eb',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Googleでログイン
        </button>
      </div>
    )
  }

  if (!isAllowed) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
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
