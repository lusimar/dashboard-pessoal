import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminClient, requireUser, sendJson } from '../_lib/push'

type Body = {
  subscription?: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
  userAgent?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  try {
    const user = await requireUser(req)
    const body = (req.body || {}) as Body
    const endpoint = body.subscription?.endpoint
    const p256dh = body.subscription?.keys?.p256dh
    const auth = body.subscription?.keys?.auth

    if (!endpoint || !p256dh || !auth) {
      return sendJson(res, 400, { error: 'Invalid subscription payload' })
    }

    const supabase = adminClient()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: body.userAgent || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' },
    )

    if (error) return sendJson(res, 500, { error: error.message })
    return sendJson(res, 200, { ok: true })
  } catch (err) {
    const status = typeof err === 'object' && err && 'statusCode' in err ? Number((err as { statusCode: number }).statusCode) : 500
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return sendJson(res, status, { error: message })
  }
}
