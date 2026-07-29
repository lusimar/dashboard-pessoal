/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()
self.skipWaiting()

type PushPayload = {
  title?: string
  body?: string
  url?: string
  tag?: string
  icon?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {
    title: 'Control Desk',
    body: 'Você tem um aviso pendente.',
    url: '/',
  }

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() }
    }
  } catch {
    const text = event.data?.text()
    if (text) payload.body = text
  }

  const title = payload.title || 'Control Desk'
  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: payload.tag || 'control-desk',
    renotify: true,
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data?.url as string | undefined) || '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await (client as WindowClient).navigate(targetUrl)
          }
          return
        }
      }
      await self.clients.openWindow(targetUrl)
    })(),
  )
})
