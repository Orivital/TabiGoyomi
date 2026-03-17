import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, syncRealtimeAuth } from '../lib/supabase'
import { debugLog, captureError } from '../lib/debugLog'

export type AuthState = {
  user: User | null
  isAllowed: boolean | null
  isLoading: boolean
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function checkAllowed(email: string): Promise<boolean> {
    // #region agent log
    debugLog('useAuth', 'checkAllowed called', { email })
    // #endregion
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    // #region agent log
    debugLog('useAuth', 'checkAllowed result', {
      hasError: !!error,
      errorMsg: error?.message,
      hasData: !!data,
    })
    // #endregion
    if (error) return false
    return !!data
  }

  useEffect(() => {
    // #region agent log
    debugLog('useAuth', 'useEffect started', {})
    // #endregion
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // #region agent log
      debugLog('useAuth', 'getSession resolved', {
        hasSession: !!session,
        hasEmail: !!session?.user?.email,
      })
      // #endregion
      await syncRealtimeAuth(session?.access_token)
      setUser(session?.user ?? null)
      if (session?.user?.email) {
        checkAllowed(session.user.email).then((v)=>{
          setIsAllowed(v)
          setIsLoading(false)
        }).catch((e)=>{
          // #region agent log
          captureError('useAuth:checkAllowed', e)
          // #endregion
          setIsLoading(false)
        })
      } else {
        setIsAllowed(null)
        setIsLoading(false)
      }
    }).catch((e)=>{
      // #region agent log
      captureError('useAuth:getSession', e)
      // #endregion
      setUser(null)
      setIsAllowed(null)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        void syncRealtimeAuth(session?.access_token).catch((error) => {
          captureError('useAuth:syncRealtimeAuth', error)
        })
        // #region agent log
        debugLog('useAuth', 'onAuthStateChange', {
          event,
          hasSession: !!session,
          hasEmail: !!session?.user?.email,
        })
        // #endregion
        setUser(session?.user ?? null)
        if (session?.user?.email) {
          checkAllowed(session.user.email).then((v)=>{setIsAllowed(v);}).catch((e)=>{
            // #region agent log
            captureError('useAuth:checkAllowed:onAuth', e)
            // #endregion
          })
        } else {
          setIsAllowed(false)
        }
      } catch (e) {
        captureError('useAuth:onAuthStateChange', e)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/',
        queryParams: {
          hl: 'ja', // Google の認証画面を日本語で表示
        },
      },
    })
  }

  const signOut = () => {
    return supabase.auth.signOut()
  }

  return {
    user,
    isAllowed,
    isLoading,
    signInWithGoogle,
    signOut,
  }
}
