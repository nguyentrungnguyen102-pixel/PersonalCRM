// sheet-sync — nhan du lieu tu Google Apps Script (Google Sheet dong vai tro
// "kho nhap lieu ngoai") de dong bo them/cap nhat persons va interactions.
// Idempotent-ish: Apps Script chi gui dong chua co dau "da xu ly" nen khong
// can chong trung tuyet doi, nhung van co check trung co ban cho interactions.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { normalizePhone, parseDdMmYyyy, vnNormalize } from '../_shared/normalize.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNC_TOKEN = Deno.env.get('SYNC_TOKEN')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const VALID_GROUPS = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']
const VALID_INTERACTION_TYPES = [
  'gap_mat',
  'goi_dien',
  'nhan_tin',
  'du_lich',
  'an_uong',
  'cong_viec',
  'khac',
]

// ---------------------------------------------------------------------
// Kieu du lieu vao/ra
// ---------------------------------------------------------------------
interface PersonRowIn {
  row: number
  full_name: string
  nickname?: string
  group_type?: string
  phone?: string
  email?: string
  birthday?: string // dd/mm/yyyy hoac yyyy-mm-dd
  company?: string
  job_title?: string
  tags?: string
  hobbies?: string
  facebook?: string
  zalo?: string
  linkedin?: string
  notes?: string
}

interface InteractionRowIn {
  row: number
  person_phone_or_email: string
  date: string // dd/mm/yyyy
  type: string
  title?: string
  note?: string
  location?: string
}

interface RowResult {
  row: number
  status: 'inserted' | 'updated' | 'error'
  message?: string
}

interface SyncBody {
  token: string
  persons?: PersonRowIn[]
  interactions?: InteractionRowIn[]
}

// Cache noi bo mot ban ghi persons (du cot can cho dedupe + fill-empty)
interface PersonCache {
  id: string
  phone: string | null
  email: string | null
  full_name: string
  nickname: string | null
  birthday: string | null
  company: string | null
  job_title: string | null
  tags: string[]
  hobbies: string[]
  social_links: Record<string, string>
  notes: string | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function isEmptyStr(v: string | null | undefined): boolean {
  return v == null || v.trim() === ''
}

function splitCsv(v?: string): string[] {
  if (!v) return []
  return v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

// yyyy-mm-dd hoac dd/mm/yyyy -> yyyy-mm-dd
function parseFlexibleBirthday(v?: string): string | null {
  if (!v) return null
  const t = v.trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return parseDdMmYyyy(t)
}

// ---------------------------------------------------------------------
// Dedupe: phone -> email -> full_name+birthday (giong src/lib/importCsv.ts)
// ---------------------------------------------------------------------
function findMatch(
  target: { phone: string | null; email: string | null; full_name: string; birthday: string | null },
  candidates: PersonCache[],
): PersonCache | null {
  if (target.phone) {
    const found = candidates.find((c) => c.phone && normalizePhone(c.phone) === target.phone)
    if (found) return found
  }
  if (target.email) {
    const found = candidates.find((c) => c.email && c.email.trim().toLowerCase() === target.email)
    if (found) return found
  }
  if (target.birthday) {
    const key = vnNormalize(target.full_name)
    const found = candidates.find(
      (c) => c.birthday && c.birthday === target.birthday && vnNormalize(c.full_name) === key,
    )
    if (found) return found
  }
  return null
}

// Chi dien cot dang trong o ban ghi da co, khong bao gio ghi de du lieu san co
function buildEmptyOnlyPatch(
  existing: PersonCache,
  incoming: {
    phone: string | null
    email: string | null
    birthday: string | null
    company: string | null
    job_title: string | null
    notes: string | null
    nickname: string | null
    tags: string[]
    hobbies: string[]
    social_links: Record<string, string>
  },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if (isEmptyStr(existing.phone) && incoming.phone) patch.phone = incoming.phone
  if (isEmptyStr(existing.email) && incoming.email) patch.email = incoming.email
  if (isEmptyStr(existing.birthday) && incoming.birthday) patch.birthday = incoming.birthday
  if (isEmptyStr(existing.company) && incoming.company) patch.company = incoming.company
  if (isEmptyStr(existing.job_title) && incoming.job_title) patch.job_title = incoming.job_title
  if (isEmptyStr(existing.notes) && incoming.notes) patch.notes = incoming.notes
  if (isEmptyStr(existing.nickname) && incoming.nickname) patch.nickname = incoming.nickname
  if ((existing.tags?.length ?? 0) === 0 && incoming.tags.length) patch.tags = incoming.tags
  if ((existing.hobbies?.length ?? 0) === 0 && incoming.hobbies.length) patch.hobbies = incoming.hobbies

  const socialPatch: Record<string, string> = {}
  for (const k of ['facebook', 'zalo', 'linkedin']) {
    const existingVal = existing.social_links?.[k]
    const incomingVal = incoming.social_links[k]
    if (isEmptyStr(existingVal) && incomingVal) socialPatch[k] = incomingVal
  }
  if (Object.keys(socialPatch).length > 0) {
    patch.social_links = { ...(existing.social_links ?? {}), ...socialPatch }
  }

  return patch
}

// ---------------------------------------------------------------------
// Xu ly mang persons[]
// ---------------------------------------------------------------------
async function processPersons(rows: PersonRowIn[]): Promise<{ results: RowResult[]; cache: PersonCache[] }> {
  const results: RowResult[] = []

  const { data: existingRaw, error: loadErr } = await supabase
    .from('persons')
    .select('id, phone, email, full_name, nickname, birthday, company, job_title, tags, hobbies, social_links, notes')

  if (loadErr) {
    console.error('load persons hien co loi', loadErr.message)
    // Khong load duoc du lieu doi chieu -> bao loi cho tat ca dong persons
    for (const r of rows) {
      results.push({ row: r.row, status: 'error', message: 'khong doc duoc du lieu hien co de doi chieu' })
    }
    return { results, cache: [] }
  }

  const cache: PersonCache[] = (existingRaw ?? []).map((p) => ({
    id: p.id,
    phone: p.phone,
    email: p.email,
    full_name: p.full_name,
    nickname: p.nickname,
    birthday: p.birthday,
    company: p.company,
    job_title: p.job_title,
    tags: p.tags ?? [],
    hobbies: p.hobbies ?? [],
    social_links: (p.social_links ?? {}) as Record<string, string>,
    notes: p.notes,
  }))

  for (const row of rows) {
    try {
      const fullName = (row.full_name || '').trim()
      if (!fullName) {
        results.push({ row: row.row, status: 'error', message: 'thieu full_name' })
        continue
      }

      let groupType = 'khac'
      if (row.group_type != null && row.group_type !== '') {
        if (!VALID_GROUPS.includes(row.group_type)) {
          results.push({ row: row.row, status: 'error', message: `group_type khong hop le: ${row.group_type}` })
          continue
        }
        groupType = row.group_type
      }

      const phone = row.phone ? normalizePhone(row.phone) || null : null
      const email = row.email ? row.email.trim().toLowerCase() || null : null
      const birthday = parseFlexibleBirthday(row.birthday)
      const company = row.company?.trim() || null
      const jobTitle = row.job_title?.trim() || null
      const notes = row.notes?.trim() || null
      const nickname = row.nickname?.trim() || null
      const tags = splitCsv(row.tags)
      const hobbies = splitCsv(row.hobbies)
      const socialLinks: Record<string, string> = {}
      if (row.facebook?.trim()) socialLinks.facebook = row.facebook.trim()
      if (row.zalo?.trim()) socialLinks.zalo = row.zalo.trim()
      if (row.linkedin?.trim()) socialLinks.linkedin = row.linkedin.trim()

      const match = findMatch({ phone, email, full_name: fullName, birthday }, cache)

      if (match) {
        const patch = buildEmptyOnlyPatch(match, {
          phone,
          email,
          birthday,
          company,
          job_title: jobTitle,
          notes,
          nickname,
          tags,
          hobbies,
          social_links: socialLinks,
        })

        if (Object.keys(patch).length > 0) {
          const { error: updErr } = await supabase.from('persons').update(patch).eq('id', match.id)
          if (updErr) {
            results.push({ row: row.row, status: 'error', message: updErr.message })
            continue
          }
          // Cap nhat cache tai cho de cac dong sau (va interactions) thay du lieu moi
          Object.assign(match, patch)
        }

        results.push({ row: row.row, status: 'updated' })
        continue
      }

      const insertPayload = {
        full_name: fullName,
        nickname: nickname || fullName,
        group_type: groupType,
        phone,
        email,
        birthday,
        company,
        job_title: jobTitle,
        tags,
        hobbies,
        social_links: socialLinks,
        notes,
      }

      const { data: inserted, error: insErr } = await supabase
        .from('persons')
        .insert(insertPayload)
        .select('id')
        .single()

      if (insErr || !inserted) {
        results.push({ row: row.row, status: 'error', message: insErr?.message ?? 'insert that bai' })
        continue
      }

      cache.push({
        id: inserted.id,
        phone,
        email,
        full_name: fullName,
        nickname: nickname || fullName,
        birthday,
        company,
        job_title: jobTitle,
        tags,
        hobbies,
        social_links: socialLinks,
        notes,
      })

      results.push({ row: row.row, status: 'inserted' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'loi khong xac dinh'
      results.push({ row: row.row, status: 'error', message })
    }
  }

  return { results, cache }
}

// ---------------------------------------------------------------------
// Xu ly mang interactions[]
// ---------------------------------------------------------------------
async function processInteractions(rows: InteractionRowIn[], cache: PersonCache[]): Promise<RowResult[]> {
  const results: RowResult[] = []

  const phoneMap = new Map<string, PersonCache>()
  const emailMap = new Map<string, PersonCache>()
  for (const p of cache) {
    if (p.phone) phoneMap.set(normalizePhone(p.phone), p)
    if (p.email) emailMap.set(p.email.trim().toLowerCase(), p)
  }

  for (const row of rows) {
    try {
      const key = (row.person_phone_or_email || '').trim()
      if (!key) {
        results.push({ row: row.row, status: 'error', message: 'thieu person_phone_or_email' })
        continue
      }

      let person: PersonCache | undefined
      if (key.includes('@')) {
        person = emailMap.get(key.toLowerCase())
      } else {
        person = phoneMap.get(normalizePhone(key))
      }

      if (!person) {
        results.push({ row: row.row, status: 'error', message: 'không tìm thấy người này, nhập person trước' })
        continue
      }

      if (!VALID_INTERACTION_TYPES.includes(row.type)) {
        results.push({ row: row.row, status: 'error', message: `type khong hop le: ${row.type}` })
        continue
      }

      const isoDate = parseDdMmYyyy(row.date || '')
      if (!isoDate) {
        results.push({ row: row.row, status: 'error', message: `date khong hop le: ${row.date}` })
        continue
      }

      const title = row.title?.trim() || null
      const note = row.note?.trim() || null
      const location = row.location?.trim() || null

      // Trung: cung person + date + type + title -> coi nhu da xu ly, khong insert lai
      let dupQuery = supabase
        .from('interactions')
        .select('id')
        .eq('person_id', person.id)
        .eq('date', isoDate)
        .eq('type', row.type)
      dupQuery = title === null ? dupQuery.is('title', null) : dupQuery.eq('title', title)

      const { data: dup, error: dupErr } = await dupQuery.limit(1)
      if (dupErr) {
        results.push({ row: row.row, status: 'error', message: dupErr.message })
        continue
      }
      if (dup && dup.length > 0) {
        results.push({ row: row.row, status: 'updated' })
        continue
      }

      const { error: insErr } = await supabase.from('interactions').insert({
        person_id: person.id,
        date: isoDate,
        type: row.type,
        title,
        note,
        location,
      })

      if (insErr) {
        results.push({ row: row.row, status: 'error', message: insErr.message })
        continue
      }

      results.push({ row: row.row, status: 'inserted' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'loi khong xac dinh'
      results.push({ row: row.row, status: 'error', message })
    }
  }

  return results
}

// ---------------------------------------------------------------------
// Handler chinh
// ---------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  try {
    const body: SyncBody = await req.json()

    if (!SYNC_TOKEN || body.token !== SYNC_TOKEN) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    const personRows = body.persons ?? []
    const interactionRows = body.interactions ?? []

    const { results: personResults, cache } = personRows.length
      ? await processPersons(personRows)
      : { results: [] as RowResult[], cache: [] as PersonCache[] }

    // Neu co interactions nhung khong co persons trong request, van can load cache
    let interactionCache = cache
    if (interactionRows.length > 0 && personRows.length === 0) {
      const { data: existingRaw, error: loadErr } = await supabase
        .from('persons')
        .select('id, phone, email, full_name, nickname, birthday, company, job_title, tags, hobbies, social_links, notes')
      if (loadErr) {
        console.error('load persons cho interactions loi', loadErr.message)
      } else {
        interactionCache = (existingRaw ?? []).map((p) => ({
          id: p.id,
          phone: p.phone,
          email: p.email,
          full_name: p.full_name,
          nickname: p.nickname,
          birthday: p.birthday,
          company: p.company,
          job_title: p.job_title,
          tags: p.tags ?? [],
          hobbies: p.hobbies ?? [],
          social_links: (p.social_links ?? {}) as Record<string, string>,
          notes: p.notes,
        }))
      }
    }

    const interactionResults = interactionRows.length
      ? await processInteractions(interactionRows, interactionCache)
      : []

    return jsonResponse({
      persons: personResults,
      interactions: interactionResults,
    })
  } catch (err) {
    console.error('sheet-sync loi xu ly', err)
    const message = err instanceof Error ? err.message : 'unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
