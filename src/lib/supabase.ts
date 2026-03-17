import { createClient } from '@supabase/supabase-js'

function resolveSupabaseUrl() {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  if (!rawUrl || typeof window === 'undefined') return rawUrl

  try {
    const url = new URL(rawUrl)
    const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
    const pageHost = window.location.hostname

    if (!isLoopback || !pageHost) return rawUrl

    url.hostname = pageHost
    return url.toString().replace(/\/$/, '')
  } catch {
    return rawUrl
  }
}

const supabaseUrl = resolveSupabaseUrl()
const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ''

if (import.meta.env.DEV && (!supabaseUrl || !supabasePublicKey)) {
  console.warn(
    '[TabiGoyomi] VITE_SUPABASE_URL と VITE_SUPABASE_PUBLISHABLE_KEY を .env に設定してください'
  )
}

export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
  },
})

export async function syncRealtimeAuth(accessToken?: string | null) {
  await supabase.realtime.setAuth(accessToken ?? supabasePublicKey)
}
