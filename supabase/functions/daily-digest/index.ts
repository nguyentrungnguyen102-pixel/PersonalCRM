// daily-digest — tong hop sinh nhat sap toi, moi quan he sap nguoi, viec qua
// han/den han hom nay; gui qua Telegram (moi bot_accounts da duyet) va email
// (Resend, tuy chon). Du kien goi dinh ky qua Supabase Cron (pg_cron + HTTP).
//
// Bao ve: verify_jwt mac dinh cua Supabase da yeu cau JWT hop le trong header
// Authorization — giu nguyen mac dinh (khong tat trong config.toml). O day chi
// kiem tra phong thu la header co ton tai, khong tu decode JWT (platform lam roi).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { displayName, vnDateStr, vnNow } from '../_shared/normalize.ts'
import { formatLunar, nextLunarAnniversary } from '../_shared/lunar.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const DIGEST_EMAIL = Deno.env.get('DIGEST_EMAIL')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface PersonRow {
  id: string
  full_name: string
  nickname: string | null
}

// ---------------------------------------------------------------------
// Helpers ngay thang (gio VN, tinh thu cong offset +7)
// ---------------------------------------------------------------------
function todayYmd(): { y: number; m: number; d: number } {
  const now = vnNow()
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() }
}

function diffDaysFromToday(y: number, m: number, d: number): number {
  const { y: ty, m: tm, d: td } = todayYmd()
  const todayUtc = Date.UTC(ty, tm - 1, td)
  const otherUtc = Date.UTC(y, m - 1, d)
  return Math.round((otherUtc - todayUtc) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------
// 1) Sinh nhat trong 7 ngay toi (xu ly qua nam)
// ---------------------------------------------------------------------
async function computeBirthdays(): Promise<{ person: PersonRow; daysLeft: number }[]> {
  const { data, error } = await supabase
    .from('persons')
    .select('id, full_name, nickname, birthday')
    .not('birthday', 'is', null)

  if (error) {
    console.error('query birthdays loi', error.message)
    return []
  }

  const { y: ty } = todayYmd()
  const result: { person: PersonRow; daysLeft: number }[] = []

  for (const row of data as (PersonRow & { birthday: string })[]) {
    const [, bm, bd] = row.birthday.split('-').map(Number)
    let daysLeft = diffDaysFromToday(ty, bm, bd)
    if (daysLeft < 0) daysLeft = diffDaysFromToday(ty + 1, bm, bd)
    if (daysLeft >= 0 && daysLeft <= 7) {
      result.push({ person: row, daysLeft })
    }
  }

  result.sort((a, b) => a.daysLeft - b.daysLeft)
  return result
}

// ---------------------------------------------------------------------
// 2) Sap nguoi — top 10 khan nhat (daysLeft nho nhat, co the am = qua han)
// ---------------------------------------------------------------------
async function computeCooling(warningDays: number): Promise<{ person: PersonRow; daysLeft: number }[]> {
  const [{ data: persons, error: pErr }, { data: contacted, error: cErr }] = await Promise.all([
    supabase
      .from('persons')
      .select('id, full_name, nickname, contact_frequency_days')
      .not('contact_frequency_days', 'is', null),
    supabase.from('person_last_contacted').select('person_id, last_contacted'),
  ])

  if (pErr || cErr) {
    console.error('query cooling loi', pErr?.message, cErr?.message)
    return []
  }

  const lastMap = new Map<string, string>()
  for (const row of (contacted ?? []) as { person_id: string; last_contacted: string | null }[]) {
    if (row.last_contacted) lastMap.set(row.person_id, row.last_contacted)
  }

  const { y: ty, m: tm, d: td } = todayYmd()
  const todayUtc = Date.UTC(ty, tm - 1, td)
  const result: { person: PersonRow; daysLeft: number }[] = []

  for (const row of persons as (PersonRow & { contact_frequency_days: number })[]) {
    const freq = row.contact_frequency_days
    const last = lastMap.get(row.id)
    let daysLeft: number
    if (!last) {
      daysLeft = -freq
    } else {
      const [ly, lm, ld] = last.split('-').map(Number)
      const lastUtc = Date.UTC(ly, lm - 1, ld)
      const daysSince = Math.round((todayUtc - lastUtc) / (1000 * 60 * 60 * 24))
      daysLeft = freq - daysSince
    }
    if (daysLeft < warningDays) {
      result.push({ person: row, daysLeft })
    }
  }

  result.sort((a, b) => a.daysLeft - b.daysLeft)
  return result.slice(0, 10)
}

// ---------------------------------------------------------------------
// 3) Viec den han hoac qua han (done=false, due_date <= hom nay)
// ---------------------------------------------------------------------
interface TaskRow {
  id: string
  title: string
  due_date: string
  persons: PersonRow | null
}

async function computeTasks(): Promise<TaskRow[]> {
  const today = vnDateStr()
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, persons(id, full_name, nickname)')
    .eq('done', false)
    .not('due_date', 'is', null)
    .lte('due_date', today)
    .order('due_date', { ascending: true })

  if (error) {
    console.error('query tasks loi', error.message)
    return []
  }
  return (data ?? []) as unknown as TaskRow[]
}

// ---------------------------------------------------------------------
// 4) Gio sap toi trong 7 ngay (am lich, xem supabase/functions/_shared/lunar.ts)
// ---------------------------------------------------------------------
interface GioItem {
  person: PersonRow
  daysLeft: number
  lunarDay: number
  lunarMonth: number
  solarDay: number
  solarMonth: number
}

// Boc toan bo trong try/catch — DB chua chay migration gia pha (thieu cot
// death_lunar_day/death_lunar_month) se loi ngay o buoc select, khong duoc
// de loi do lam vo ca digest (birthdays/cooling/tasks van phai gui binh
// thuong).
async function computeUpcomingGio(): Promise<GioItem[]> {
  try {
    const { data, error } = await supabase
      .from('persons')
      .select('id, full_name, nickname, death_lunar_day, death_lunar_month')
      .not('death_lunar_day', 'is', null)

    if (error) {
      console.error('query gio loi', error.message)
      return []
    }

    const { y, m, d } = todayYmd()
    // Dung Date constructor "local" (khong phai getUTC*) vi
    // nextLunarAnniversary (ban sao cua src/lib/lunar.ts) doc gio bang
    // getter local — tu xay + tu doc cung 1 cach nen luon nhat quan bat ke
    // timezone thuc su cua may chay Edge Function.
    const from = new Date(y, m - 1, d)

    const result: GioItem[] = []
    for (const row of data as (PersonRow & {
      death_lunar_day: number
      death_lunar_month: number | null
    })[]) {
      if (row.death_lunar_month == null) continue // du lieu thieu thang — bo qua, khong tinh duoc
      const next = nextLunarAnniversary(row.death_lunar_day, row.death_lunar_month, from)
      const daysLeft = diffDaysFromToday(next.getFullYear(), next.getMonth() + 1, next.getDate())
      if (daysLeft <= 7) {
        result.push({
          person: row,
          daysLeft,
          lunarDay: row.death_lunar_day,
          lunarMonth: row.death_lunar_month,
          solarDay: next.getDate(),
          solarMonth: next.getMonth() + 1,
        })
      }
    }

    result.sort((a, b) => a.daysLeft - b.daysLeft)
    return result
  } catch (err) {
    console.error('computeUpcomingGio loi', err)
    return []
  }
}

// ---------------------------------------------------------------------
// Soan noi dung tin nhan (HTML don gian, Telegram parse_mode: HTML)
// ---------------------------------------------------------------------
function composeMessage(
  birthdays: { person: PersonRow; daysLeft: number }[],
  cooling: { person: PersonRow; daysLeft: number }[],
  tasks: TaskRow[],
  gio: GioItem[],
): string {
  const lines: string[] = ['<b>Điểm tin hôm nay</b>']

  if (birthdays.length) {
    lines.push('')
    lines.push('🎂 <b>Sinh nhật sắp tới</b>')
    for (const b of birthdays) {
      const when = b.daysLeft === 0 ? 'hôm nay' : `còn ${b.daysLeft} ngày`
      lines.push(`• ${displayName(b.person)} — ${when}`)
    }
  }

  if (cooling.length) {
    lines.push('')
    lines.push('🌡️ <b>Sắp nguội — cần giữ liên lạc</b>')
    for (const c of cooling) {
      const label = c.daysLeft < 0 ? `quá hạn ${-c.daysLeft} ngày` : `còn ${c.daysLeft} ngày`
      lines.push(`• ${displayName(c.person)} — ${label}`)
    }
  }

  if (tasks.length) {
    lines.push('')
    lines.push('☑️ <b>Việc đến hạn / quá hạn</b>')
    for (const t of tasks) {
      const who = t.persons ? ` (${displayName(t.persons)})` : ''
      lines.push(`• ${t.title}${who} — hạn ${t.due_date}`)
    }
  }

  if (gio.length) {
    lines.push('')
    lines.push('🕯 <b>Giỗ sắp tới</b>')
    for (const g of gio) {
      const when = g.daysLeft === 0 ? 'HÔM NAY' : `còn ${g.daysLeft} ngày`
      const solar = `${String(g.solarDay).padStart(2, '0')}/${String(g.solarMonth).padStart(2, '0')}`
      lines.push(`• ${displayName(g.person)} — ${formatLunar(g.lunarDay, g.lunarMonth)} ÂL (${solar}) — ${when}`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------
// Gui Telegram cho tat ca bot_accounts da duyet
// ---------------------------------------------------------------------
async function sendTelegramToApproved(text: string): Promise<number> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('thieu TELEGRAM_BOT_TOKEN, bo qua gui telegram')
    return 0
  }
  const { data, error } = await supabase.from('bot_accounts').select('chat_id').eq('approved', true)
  if (error) {
    console.error('query bot_accounts loi', error.message)
    return 0
  }

  let sent = 0
  for (const row of (data ?? []) as { chat_id: number }[]) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: row.chat_id, text, parse_mode: 'HTML' }),
      })
      if (res.ok) sent++
      else console.error('gui telegram digest that bai', row.chat_id, res.status, await res.text())
    } catch (err) {
      console.error('gui telegram digest loi mang', row.chat_id, err)
    }
  }
  return sent
}

// ---------------------------------------------------------------------
// Gui email qua Resend (tuy chon — chi chay neu co du RESEND_API_KEY + DIGEST_EMAIL)
// ---------------------------------------------------------------------
async function sendEmailIfConfigured(text: string): Promise<boolean> {
  if (!RESEND_API_KEY || !DIGEST_EMAIL) return false

  try {
    const html = text.replace(/\n/g, '<br/>')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'PersonalCRM <onboarding@resend.dev>',
        to: DIGEST_EMAIL,
        subject: `Điểm tin PersonalCRM — ${vnDateStr()}`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('gui email resend that bai', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('gui email resend loi mang', err)
    return false
  }
}

// ---------------------------------------------------------------------
// Handler chinh
// ---------------------------------------------------------------------
Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing authorization header' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }

    const { data: warningRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'warning_days')
      .maybeSingle()
    const warningDays = typeof warningRow?.value === 'number' ? warningRow.value : 7

    const [birthdays, cooling, tasks, gio] = await Promise.all([
      computeBirthdays(),
      computeCooling(warningDays),
      computeTasks(),
      computeUpcomingGio(),
    ])

    if (birthdays.length === 0 && cooling.length === 0 && tasks.length === 0 && gio.length === 0) {
      return new Response(JSON.stringify({ sent: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const text = composeMessage(birthdays, cooling, tasks, gio)
    const [telegramCount, emailSent] = await Promise.all([
      sendTelegramToApproved(text),
      sendEmailIfConfigured(text),
    ])

    return new Response(
      JSON.stringify({ sent: true, telegram_count: telegramCount, email_sent: emailSent }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  } catch (err) {
    console.error('daily-digest loi xu ly', err)
    const message = err instanceof Error ? err.message : 'unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
