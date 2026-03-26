import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0'
import webPush from 'npm:web-push@3.6.7'

type CandidateRow = {
  user_id: string
  trip_event_id: string
  trip_id: string
  day_date: string
  kind: 'start' | 'end' | 'end_at'
  notification_title: string
  notification_body: string
  url_path: string
}

function isGoneError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode === 410
  }
  return false
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const authHeader = req.headers.get('Authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate || !vapidSubject) {
    return new Response(JSON.stringify({ error: 'Missing env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  webPush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: rows, error: rpcError } = await supabase.rpc('reminder_dispatch_candidates', {
    p_now: new Date().toISOString(),
  })

  if (rpcError) {
    console.error('[send-trip-reminders] rpc', rpcError)
    return new Response(JSON.stringify({ error: rpcError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const candidates = (rows ?? []) as CandidateRow[]
  let sent = 0
  let failed = 0

  if (candidates.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, candidates: 0, batchesMarkedSent: 0, failed: 0 }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const userIds = [...new Set(candidates.map((r) => r.user_id))]
  const { data: allSubs, error: subFetchErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', userIds)

  if (subFetchErr) {
    console.error('[send-trip-reminders] fetch subs', subFetchErr)
    return new Response(JSON.stringify({ error: subFetchErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  type SubRow = { id: string; endpoint: string; p256dh: string; auth: string; user_id: string }
  const subsByUser = new Map<string, SubRow[]>()
  for (const sub of (allSubs ?? []) as SubRow[]) {
    const list = subsByUser.get(sub.user_id) ?? []
    list.push(sub)
    subsByUser.set(sub.user_id, list)
  }

  for (const row of candidates) {
    const subs = subsByUser.get(row.user_id) ?? []

    if (!subs.length) {
      failed++
      continue
    }

    const payload = JSON.stringify({
      title: row.notification_title,
      body: row.notification_body,
      url: row.url_path,
    })

    let anyOk = false
    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 300 },
        )
        anyOk = true
      } catch (e) {
        console.error('[send-trip-reminders] push', sub.id, e)
        if (isGoneError(e)) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    if (anyOk) {
      const { error: insErr } = await supabase.from('reminder_notifications_sent').insert({
        user_id: row.user_id,
        trip_event_id: row.trip_event_id,
        kind: row.kind,
      })
      if (insErr) {
        console.error('[send-trip-reminders] insert sent', insErr)
      } else {
        sent++
      }
    } else {
      failed++
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      candidates: candidates.length,
      batchesMarkedSent: sent,
      failed,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
