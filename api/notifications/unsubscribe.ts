import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminClient, requireUser, sendJson } from '../_lib/push'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  try {
    const user = await requireUser(req)
    const endpoint = (req.body as { endpoint?: string } | undefined)?.endpoint
    if (!endpoint) return sendJson(res, 400, { error: 'Missing endpoint' })

    const supabase = adminClient()
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)

    if (error) return sendJson(res, 500, { error: error.message })
    return sendJson(res, 200, { ok: true })
  } catch (err) {
    const status = typeof err === 'object' && err && 'statusCode' in err ? Number((err as { statusCode: number }).statusCode) : 500
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return sendJson(res, status, { error: message })
  }
}
