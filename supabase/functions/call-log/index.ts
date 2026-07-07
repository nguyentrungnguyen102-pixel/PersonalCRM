// call-log — webhook nhan tu app Android (vd MacroDroid) khi ket thuc cuoc
// goi, tu dong ghi interaction 'goi_dien' cho nguoi tuong ung theo so dien
// thoai, hoac dua vao Hop thu cho neu khong khop.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { phoneVariants, vnDateStr } from '../_shared/normalize.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CALL_WEBHOOK_SECRET = Deno.env.get('CALL_WEBHOOK_SECRET')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface CallLogBody {
  secret: string
  phone: string
  duration_sec?: number
  direction?: 'in' | 'out'
  ts?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  try {
    const body: CallLogBody = await req.json()

    if (!CALL_WEBHOOK_SECRET || body.secret !== CALL_WEBHOOK_SECRET) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    if (!body.phone) {
      return jsonResponse({ error: 'thieu phone' }, 400)
    }

    const tsDate = body.ts ? new Date(body.ts) : new Date()
    if (Number.isNaN(tsDate.getTime())) {
      return jsonResponse({ error: 'ts khong hop le' }, 400)
    }

    const variants = phoneVariants(body.phone)
    if (variants.length === 0) {
      // So khong hop le -> khong tim duoc ai, dua thang vao inbox
      await supabase.from('inbox_items').insert({
        source: 'cuoc_goi',
        raw_text: `Cuộc gọi ${body.phone}`,
        payload: body,
      })
      return jsonResponse({ ok: true, matched: false })
    }

    const { data: matches, error: matchErr } = await supabase
      .from('persons')
      .select('id, full_name, nickname, phone')
      .in('phone', variants)
      .limit(1)

    if (matchErr) {
      console.error('query persons loi', matchErr.message)
      return jsonResponse({ error: 'loi truy van persons' }, 500)
    }

    const person = matches?.[0]

    if (!person) {
      const { error: inboxErr } = await supabase.from('inbox_items').insert({
        source: 'cuoc_goi',
        raw_text: `Cuộc gọi ${body.phone}`,
        payload: body,
      })
      if (inboxErr) console.error('insert inbox_items loi', inboxErr.message)
      return jsonResponse({ ok: true, matched: false })
    }

    // Chong trung: da co interaction goi_dien trong +-2 phut quanh ts
    const fromTs = new Date(tsDate.getTime() - 2 * 60 * 1000).toISOString()
    const toTs = new Date(tsDate.getTime() + 2 * 60 * 1000).toISOString()
    const { data: dup, error: dupErr } = await supabase
      .from('interactions')
      .select('id')
      .eq('person_id', person.id)
      .eq('type', 'goi_dien')
      .gte('created_at', fromTs)
      .lte('created_at', toTs)
      .limit(1)

    if (dupErr) {
      console.error('query trung lap loi', dupErr.message)
      return jsonResponse({ error: 'loi kiem tra trung lap' }, 500)
    }
    if (dup && dup.length > 0) {
      return jsonResponse({ skipped: true })
    }

    const directionLabel = body.direction === 'in' ? 'đến' : 'đi'
    const durationLabel = body.duration_sec
      ? `, ${Math.round(body.duration_sec / 60)} phút`
      : ''
    const note = `Cuộc gọi ${directionLabel}${durationLabel} (tự động)`

    const { error: insErr } = await supabase.from('interactions').insert({
      person_id: person.id,
      type: 'goi_dien',
      date: vnDateStr(tsDate),
      note,
    })

    if (insErr) {
      console.error('insert interactions loi', insErr.message)
      return jsonResponse({ error: 'loi ghi interaction' }, 500)
    }

    return jsonResponse({ ok: true, person })
  } catch (err) {
    console.error('call-log loi xu ly', err)
    const message = err instanceof Error ? err.message : 'unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
