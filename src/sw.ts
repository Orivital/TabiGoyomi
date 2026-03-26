/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ url }) =>
    /\.supabase\.co$/i.test(url.hostname) && !url.pathname.includes('/auth/v1/'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  }),
)

self.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data?.json() as typeof data
  } catch {
    const t = event.data?.text()
    data = t ? { body: t } : {}
  }
  const title = data.title ?? '旅暦'
  const body = data.body ?? ''
  const url = data.url ?? '/'

  const options: NotificationOptions & { vibrate?: number[] } = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url },
    vibrate: [200, 100, 200],
    tag: `${url}::${title}`,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  const targetUrl = raw.startsWith('http')
    ? raw
    : new URL(raw.startsWith('/') ? raw : `/${raw}`, self.location.origin).href

  event.waitUntil(self.clients.openWindow(targetUrl))
})
