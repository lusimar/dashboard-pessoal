import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  adminClient,
  assertCronAuth,
  sendJson,
  sendPushToSubscription,
  type PushSubRow,
} from '../_lib/push'

type TaskRow = {
  id: string
  user_id: string
  title: string
  due_date: string
  category: string
  status: string
}

type Kind = 'day_before' | 'hour_before'

const WINDOW_MS = 5 * 60 * 1000

function windowBounds(offsetMs: number, now: number) {
  const start = new Date(now + offsetMs)
  const end = new Date(now + offsetMs + WINDOW_MS)
  return { start: start.toISOString(), end: end.toISOString() }
}

async function findDueTasks(kind: Kind, now: number): Promise<TaskRow[]> {
  const offset = kind === 'day_before' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
  const { start, end } = windowBounds(offset, now)
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, title, due_date, category, status')
    .neq('status', 'Completed')
    .not('due_date', 'is', null)
    .gte('due_date', start)
    .lt('due_date', end)

  if (error) throw error
  return (data as TaskRow[]) ?? []
}

function payloadFor(task: TaskRow, kind: Kind) {
  const isReminder = task.category === 'Lembrete'
  const typeLabel = isReminder ? 'Lembrete' : 'Tarefa'
  const when = kind === 'day_before' ? 'em 24 horas' : 'em 1 hora'
  const url = isReminder ? '/reminders' : '/tasks'

  return {
    title: `${typeLabel} ${when}`,
    body: task.title,
    url,
    tag: `${kind}-${task.id}`,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  try {
    assertCronAuth(req)
    const now = Date.now()
    const supabase = adminClient()

    const kinds: Kind[] = ['day_before', 'hour_before']
    let sent = 0
    let skipped = 0
    let failed = 0
    const goneEndpoints: string[] = []

    for (const kind of kinds) {
      const tasks = await findDueTasks(kind, now)

      for (const task of tasks) {
        const { data: existing } = await supabase
          .from('notification_dispatches')
          .select('id')
          .eq('task_id', task.id)
          .eq('kind', kind)
          .maybeSingle()

        if (existing) {
          skipped += 1
          continue
        }

        const { data: subs, error: subErr } = await supabase
          .from('push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth')
          .eq('user_id', task.user_id)

        if (subErr) throw subErr
        const rows = (subs as PushSubRow[]) ?? []
        if (rows.length === 0) {
          skipped += 1
          continue
        }

        const payload = payloadFor(task, kind)
        let delivered = false

        for (const row of rows) {
          const result = await sendPushToSubscription(row, payload)
          if (result.ok) {
            delivered = true
            sent += 1
            continue
          }
          failed += 1
          if (result.statusCode === 404 || result.statusCode === 410) {
            goneEndpoints.push(row.endpoint)
          }
        }

        if (delivered) {
          await supabase.from('notification_dispatches').insert({
            user_id: task.user_id,
            task_id: task.id,
            kind,
          })
        }
      }
    }

    if (goneEndpoints.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', [...new Set(goneEndpoints)])
    }

    return sendJson(res, 200, {
      ok: true,
      sent,
      skipped,
      failed,
      cleaned: goneEndpoints.length,
      at: new Date(now).toISOString(),
    })
  } catch (err) {
    const status =
      typeof err === 'object' && err && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : 500
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return sendJson(res, status, { error: message })
  }
}
