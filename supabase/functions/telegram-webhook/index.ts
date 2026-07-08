// telegram-webhook — nhan update tu Telegram Bot API, ghi nhanh tuong tac/viec
// hoac dua vao Hop thu cho khi khong nhan dien duoc nguoi.
//
// Luon tra 200 cho Telegram (ke ca khi xu ly loi noi bo) de tranh Telegram
// retry lien tuc gay bao request. Chi tra 401 khi secret header sai.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { displayName, vnDateStr, vnNow, vnNormalize } from '../_shared/normalize.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const HELP_TEXT =
  'Cu phap:\n' +
  '- "Ten / noi dung" -> ghi tuong tac (nhan tin) cho nguoi do\n' +
  '- "!viec Ten / viec [dd/mm]" -> tao viec can lam, co the kem han\n' +
  'Vi du: !viec Chi Lan / goi dien chuc mung sinh nhat 15/8'

interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
}

interface TelegramMessage {
  message_id: number
  chat: { id: number }
  from?: TelegramUser
  text?: string
}

interface TelegramUpdate {
  message?: TelegramMessage
}

interface PersonMatch {
  id: string
  nickname: string | null
  full_name: string
  search_text: string | null
}

// ---------------------------------------------------------------------
// Helper: goi Telegram sendMessage
// ---------------------------------------------------------------------
async function reply(chatId: number, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('thieu TELEGRAM_BOT_TOKEN, khong gui duoc reply')
    return
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!res.ok) {
      console.error('telegram sendMessage that bai', res.status, await res.text())
    }
  } catch (err) {
    console.error('telegram sendMessage loi mang', err)
  }
}

// ---------------------------------------------------------------------
// Match nguoi theo ten (khong dau) — uu tien khop dai nhat / bat dau bang
// ---------------------------------------------------------------------
// Cham diem 1 TEN don le (nickname hoac full_name, da bo dau) so voi query.
// Quan trong: "a bach" startsWith("a ba") nhung KHONG phai khop ranh gioi tu
// — chi cong diem cao khi khop chinh xac hoac khop het mot tu.
function scoreName(name: string, q: string): number {
  if (!name) return 0
  if (name === q) return 1000
  if (name.startsWith(q + ' ')) return 600 // "a ba" khop "a ba chien" o ranh gioi tu
  if (name.includes(' ' + q + ' ') || name.endsWith(' ' + q)) return 400
  if (name.startsWith(q)) return 200 // khop giua tu ("a ba" ~ "a bach") — diem thap
  if (name.includes(q)) return 100
  return 0
}

async function matchPerson(nameQuery: string): Promise<PersonMatch | null> {
  const q = vnNormalize(nameQuery).trim()
  if (!q) return null

  const { data, error } = await supabase
    .from('persons')
    .select('id, nickname, full_name, search_text')
    .ilike('search_text', `%${q}%`)
    .limit(20)

  if (error) {
    console.error('matchPerson loi query', error.message)
    return null
  }
  if (!data || data.length === 0) return null

  let best: PersonMatch | null = null
  let bestScore = 0
  let bestLen = Infinity
  for (const p of data as PersonMatch[]) {
    const names = [vnNormalize(p.nickname ?? ''), vnNormalize(p.full_name ?? '')]
    const score = Math.max(scoreName(names[0], q), scoreName(names[1], q))
    const len = Math.min(...names.filter(Boolean).map((n) => n.length))
    // Hoa diem -> uu tien ten NGAN hon (khop "chat" hon voi query)
    if (score > bestScore || (score === bestScore && score > 0 && len < bestLen)) {
      bestScore = score
      bestLen = len
      best = p
    }
  }
  return best
}

// ---------------------------------------------------------------------
// Dua vao hop thu cho khi khong nhan dien duoc nguoi
// ---------------------------------------------------------------------
async function pushToInbox(text: string, chatId: number, from?: TelegramUser): Promise<void> {
  const { error } = await supabase.from('inbox_items').insert({
    source: 'telegram',
    raw_text: text,
    payload: { chat_id: chatId, from: from ?? null },
  })
  if (error) console.error('insert inbox_items loi', error.message)
}

const FALLBACK_TEXT = '📥 Chưa nhận ra ai — đã đưa vào Hộp thư chờ, anh gán trong app nhé'

// ---------------------------------------------------------------------
// Parse ngay dd/mm o cuoi cau -> yyyy-mm-dd (nam hien tai, qua roi thi +1)
// ---------------------------------------------------------------------
function extractTrailingDueDate(text: string): { title: string; dueDate: string | null } {
  const m = text.match(/^(.*?)\s*(\d{1,2})\/(\d{1,2})\s*$/)
  if (!m) return { title: text.trim(), dueDate: null }

  const dd = Number(m[2])
  const mm = Number(m[3])
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return { title: text.trim(), dueDate: null }

  const now = vnNow()
  let year = now.getUTCFullYear()
  const todayUtc = Date.UTC(year, now.getUTCMonth(), now.getUTCDate())
  let candidate = Date.UTC(year, mm - 1, dd)
  if (candidate < todayUtc) {
    year += 1
    candidate = Date.UTC(year, mm - 1, dd)
  }
  const dueDate = new Date(candidate).toISOString().slice(0, 10)
  return { title: m[1].trim(), dueDate }
}

// ---------------------------------------------------------------------
// Xu ly !viec <ten> / <viec> [dd/mm]
// ---------------------------------------------------------------------
async function handleTaskCommand(chatId: number, rest: string, from?: TelegramUser): Promise<void> {
  const slashIdx = rest.indexOf('/')
  if (slashIdx === -1) {
    await reply(chatId, 'Cú pháp: !viec Tên / việc [dd/mm]')
    return
  }

  const namePart = rest.slice(0, slashIdx).trim()
  const taskPart = rest.slice(slashIdx + 1).trim()
  if (!namePart || !taskPart) {
    await reply(chatId, 'Cú pháp: !viec Tên / việc [dd/mm]')
    return
  }

  const person = await matchPerson(namePart)
  if (!person) {
    await pushToInbox(`!viec ${rest}`, chatId, from)
    await reply(chatId, FALLBACK_TEXT)
    return
  }

  let { title, dueDate } = extractTrailingDueDate(taskPart)
  if (!title) {
    // Ca cau chi co ngay (vd "15/8") -> giu nguyen lam tieu de, khong tach han
    title = taskPart
    dueDate = null
  }
  const { error } = await supabase.from('tasks').insert({
    person_id: person.id,
    title,
    due_date: dueDate,
  })
  if (error) {
    console.error('insert tasks loi', error.message)
    await reply(chatId, 'Có lỗi khi tạo việc, thử lại sau nhé')
    return
  }

  const name = displayName(person)
  if (dueDate) {
    const [y, m, d] = dueDate.split('-')
    await reply(chatId, `☑️ Đã tạo việc cho ${name}: ${title} (hạn ${d}/${m})`)
  } else {
    await reply(chatId, `☑️ Đã tạo việc cho ${name}: ${title}`)
  }
}

// ---------------------------------------------------------------------
// Xu ly tin co "/" hoac ":" ngan cach -> ghi interaction nhan_tin
// ---------------------------------------------------------------------
async function handleSeparatedMessage(chatId: number, text: string, sepIdx: number, from?: TelegramUser): Promise<void> {
  const namePart = text.slice(0, sepIdx).trim()
  const notePart = text.slice(sepIdx + 1).trim()

  const person = namePart ? await matchPerson(namePart) : null
  if (!person) {
    await pushToInbox(text, chatId, from)
    await reply(chatId, FALLBACK_TEXT)
    return
  }

  const { error } = await supabase.from('interactions').insert({
    person_id: person.id,
    type: 'nhan_tin',
    note: notePart || null,
    date: vnDateStr(),
  })
  if (error) {
    console.error('insert interactions loi', error.message)
    await reply(chatId, 'Có lỗi khi ghi lại, thử lại sau nhé')
    return
  }

  await reply(chatId, `✅ Đã ghi cho ${displayName(person)}`)
}

// ---------------------------------------------------------------------
// Xu ly tin tu do (khong co "/" hoac ":") -> thu match theo n-gram 1..4 tu
// ---------------------------------------------------------------------
async function handleFreeTextMessage(chatId: number, text: string, from?: TelegramUser): Promise<void> {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const maxN = Math.min(4, words.length)

  // Thu tu dai nhat (4 tu) xuong ngan nhat (1 tu) — uu tien n-gram dai hon.
  for (let n = maxN; n >= 1; n--) {
    const query = words.slice(0, n).join(' ')
    const person = await matchPerson(query)
    if (person) {
      const notePart = words.slice(n).join(' ').trim() || text.trim()
      const { error } = await supabase.from('interactions').insert({
        person_id: person.id,
        type: 'nhan_tin',
        note: notePart,
        date: vnDateStr(),
      })
      if (error) {
        console.error('insert interactions (free text) loi', error.message)
        await reply(chatId, 'Có lỗi khi ghi lại, thử lại sau nhé')
        return
      }
      await reply(chatId, `✅ Đã ghi cho ${displayName(person)}`)
      return
    }
  }

  await pushToInbox(text, chatId, from)
  await reply(chatId, FALLBACK_TEXT)
}

// ---------------------------------------------------------------------
// Xu ly /start
// ---------------------------------------------------------------------
async function handleStart(chatId: number, from?: TelegramUser): Promise<void> {
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim() || null

  const { data: existing } = await supabase
    .from('bot_accounts')
    .select('approved')
    .eq('chat_id', chatId)
    .maybeSingle()

  if (existing?.approved) {
    await reply(chatId, `Chào ${fullName ?? 'bạn'}! Bot đã sẵn sàng.\n\n${HELP_TEXT}`)
    return
  }

  const { error } = await supabase
    .from('bot_accounts')
    .upsert(
      { chat_id: chatId, display_name: fullName, approved: false },
      { onConflict: 'chat_id', ignoreDuplicates: true },
    )
  if (error) console.error('upsert bot_accounts loi', error.message)

  await reply(
    chatId,
    'Đã ghi nhận yêu cầu kết nối. Chờ admin duyệt trong app (Cài đặt → Kết nối) rồi quay lại nhắn tin nhé.',
  )
}

// ---------------------------------------------------------------------
// Handler chinh
// ---------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  if (!TELEGRAM_WEBHOOK_SECRET || secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const update: TelegramUpdate = await req.json()
    const message = update.message
    if (!message || !message.text) {
      // Bo qua cac loai update khac (edited_message, callback_query...) va tin khong co text
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    const chatId = message.chat.id
    const text = message.text.trim()
    const from = message.from

    if (text === '/start' || text.startsWith('/start ')) {
      await handleStart(chatId, from)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (text === '/help' || text.startsWith('/help')) {
      await reply(chatId, HELP_TEXT)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // Tin thuong: kiem tra da duyet chua
    const { data: account } = await supabase
      .from('bot_accounts')
      .select('approved')
      .eq('chat_id', chatId)
      .maybeSingle()

    if (!account?.approved) {
      await reply(chatId, 'Tài khoản Telegram này chưa được duyệt. Nhắn /start rồi chờ admin duyệt trong app nhé.')
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (text.startsWith('!viec ')) {
      await handleTaskCommand(chatId, text.slice('!viec '.length), from)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    const slashIdx = text.indexOf('/')
    const colonIdx = text.indexOf(':')
    const candidates = [slashIdx, colonIdx].filter((i) => i > 0)
    if (candidates.length > 0) {
      const sepIdx = Math.min(...candidates)
      await handleSeparatedMessage(chatId, text, sepIdx, from)
    } else {
      await handleFreeTextMessage(chatId, text, from)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    // Van tra 200 cho Telegram de tranh retry bao, chi log loi de debug
    console.error('telegram-webhook loi xu ly', err)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
})
