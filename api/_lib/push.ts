import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import webpush from 'web-push'

export type PushSubRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export function getEnv(name: string, fallbacks: string[] = []): string {
  const candidates = [process.env[name], ...fallbacks.map((key) => process.env[key])]
  const value = candidates.find((v) => Boolean(v))
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

export function adminClient(): SupabaseClient {
  return createClient(
    getEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@controldesk.app',
    getEnv('VAPID_PUBLIC_KEY', ['VITE_VAPID_PUBLIC_KEY']),
    getEnv('VAPID_PRIVATE_KEY'),
  )
}

export async function requireUser(req: VercelRequest): Promise<User> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  }
  const token = header.slice(7)
  const supabase = createClient(
    getEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']),
    getEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_PUBLISHABLE_KEY']),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  )
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  }
  return data.user
}

export function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body)
}

export async function sendPushToSubscription(
  row: PushSubRow,
  payload: { title: string; body: string; url: string; tag: string },
) {
  configureWebPush()
  const subscription = {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60 * 60,
      urgency: 'normal',
    })
    return { ok: true as const }
  } catch (err: unknown) {
    const statusCode =
      typeof err === 'object' && err && 'statusCode' in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 0
    return { ok: false as const, statusCode, err }
  }
}

export function assertCronAuth(req: VercelRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return
  const auth = req.headers.authorization
  if (auth !== `Bearer ${secret}`) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  }
}
