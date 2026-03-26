import type { SupabaseClient } from '@supabase/supabase-js'

/** VAPID 公開鍵（URL セーフ Base64）を PushManager 用のバイナリに変換する */
export function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export type PushSubscriptionRow = {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export function pushSubscriptionToRow(
  sub: PushSubscription,
  userId: string,
): PushSubscriptionRow {
  const json = sub.toJSON()
  const keys = json.keys
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Invalid push subscription')
  }
  return {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }
}

export async function subscribeWithVapid(
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    await existing.unsubscribe()
  }
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
}

export async function savePushSubscription(
  supabase: SupabaseClient,
  sub: PushSubscription,
  userId: string,
): Promise<void> {
  const row = pushSubscriptionToRow(sub, userId)
  const { error } = await supabase.from('push_subscriptions').upsert(
    { ...row, updated_at: new Date().toISOString() },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function removePushSubscriptionForEndpoint(
  supabase: SupabaseClient,
  endpoint: string,
): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}
