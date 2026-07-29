import { computed, ref } from 'vue'
import { useAuth } from './useAuth'

export type PushPermissionState = NotificationPermission | 'unsupported'

const permission = ref<PushPermissionState>(
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
)
const subscribed = ref(false)
const loading = ref(false)
const error = ref('')

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.ready
}

async function refreshSubscriptionState() {
  const reg = await getRegistration()
  if (!reg) {
    subscribed.value = false
    return
  }
  const existing = await reg.pushManager.getSubscription()
  subscribed.value = Boolean(existing)
}

export function usePushNotifications() {
  const { session } = useAuth()
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

  const canEnable = computed(
    () =>
      permission.value !== 'unsupported' &&
      Boolean(vapidPublicKey) &&
      'serviceWorker' in navigator &&
      'PushManager' in window,
  )

  const isEnabled = computed(() => permission.value === 'granted' && subscribed.value)

  async function enableNotifications() {
    error.value = ''
    if (!canEnable.value) {
      error.value = 'Notificações push não são suportadas neste dispositivo/navegador.'
      return false
    }
    if (!vapidPublicKey) {
      error.value = 'VITE_VAPID_PUBLIC_KEY não configurada.'
      return false
    }
    if (!session.value?.access_token) {
      error.value = 'Faça login para ativar as notificações.'
      return false
    }

    loading.value = true
    try {
      const result = await Notification.requestPermission()
      permission.value = result
      if (result !== 'granted') {
        error.value = 'Permissão de notificação negada.'
        return false
      }

      const { registerSW } = await import('virtual:pwa-register')
      registerSW({ immediate: true })

      const reg = await navigator.serviceWorker.ready
      let subscription = await reg.pushManager.getSubscription()
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.value.access_token}`,
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Falha ao salvar assinatura (${res.status})`)
      }

      subscribed.value = true
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erro ao ativar notificações.'
      return false
    } finally {
      loading.value = false
    }
  }

  async function disableNotifications() {
    error.value = ''
    loading.value = true
    try {
      const reg = await getRegistration()
      const subscription = await reg?.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        if (session.value?.access_token) {
          await fetch('/api/notifications/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.value.access_token}`,
            },
            body: JSON.stringify({ endpoint }),
          })
        }
      }
      subscribed.value = false
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erro ao desativar notificações.'
      return false
    } finally {
      loading.value = false
    }
  }

  void refreshSubscriptionState()

  return {
    permission,
    subscribed,
    loading,
    error,
    canEnable,
    isEnabled,
    enableNotifications,
    disableNotifications,
    refreshSubscriptionState,
  }
}
