// Logic thuan (khong React) cho wizard nhap CSV Google Contacts — tach rieng
// de test duoc doc lap voi UI. Xem src/pages/ImportCsv.tsx cho phan giao dien.

import { parse } from 'papaparse'
import { supabase } from './supabase'
import { vnNormalize } from './normalize'
import type { GroupType } from './types'

// ---------------------------------------------------------------------
// Kieu du lieu
// ---------------------------------------------------------------------

// Mot dong tho tu file CSV Google Contacts (header: true => key la ten cot).
export type RawRow = Record<string, string>

export interface ParseResult {
  rows: RawRow[]
  isGoogleFormat: boolean
}

// Ban ghi da chuan hoa, san sang de insert vao bang public.persons (khong
// gom cac cot do DB tu sinh: id, created_by, created_at, updated_at, search_text).
export interface MappedPerson {
  full_name: string
  phone: string | null
  email: string | null
  birthday: string | null
  company: string | null
  job_title: string | null
  notes: string | null
  is_favorite: boolean
  tags: string[]
  group_type: GroupType
  contact_frequency_days: number | null
  hobbies: string[]
  preferences: Record<string, string>
  social_links: Record<string, string>
}

// Tap con cac cot cua persons dung de doi chieu trung lap.
export interface ExistingPerson {
  id: string
  phone: string | null
  email: string | null
  full_name: string
  birthday: string | null
}

export interface DedupeUpdate {
  id: string
  patch: Partial<Pick<MappedPerson, 'phone' | 'email' | 'birthday'>>
}

export interface DedupePlan {
  inserts: MappedPerson[]
  updates: DedupeUpdate[]
  errors: { row: number; reason: string }[]
}

export interface RunImportResult {
  inserted: number
  updated: number
  failed: { name: string; reason: string }[]
}

// ---------------------------------------------------------------------
// 1) Doc file CSV
// ---------------------------------------------------------------------

export function parseGoogleCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? []
        const isGoogleFormat =
          fields.includes('First Name') &&
          (fields.includes('Phone 1 - Value') || fields.includes('E-mail 1 - Value'))
        resolve({ rows: results.data, isGoogleFormat })
      },
      error: (err: Error) => reject(err),
    })
  })
}

// ---------------------------------------------------------------------
// 2) Chuan hoa so dien thoai
// ---------------------------------------------------------------------

// Bo moi ky tu khong phai so, giu lai dau '+' neu no dung dau tien.
// Rieng dau +84 (ma vung VN) doi thanh 0 dau (+84912345678 -> 0912345678).
export function normalizePhone(s: string | null | undefined): string {
  if (!s) return ''
  const trimmed = s.trim()
  if (!trimmed) return ''

  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/[^0-9]/g, '')
  if (!digits) return ''

  let result = (hasLeadingPlus ? '+' : '') + digits
  if (result.startsWith('+84')) {
    result = '0' + result.slice(3)
  }
  return result
}

// ---------------------------------------------------------------------
// 3) Anh xa mot dong CSV -> MappedPerson
// ---------------------------------------------------------------------

const BIRTHDAY_RE = /^\d{4}-\d{2}-\d{2}$/

function parseLabels(raw: string): { isFavorite: boolean; tags: string[] } {
  const trimmed = raw.trim()
  if (!trimmed) return { isFavorite: false, tags: [] }

  const labels = trimmed
    .split(' ::: ')
    .map((l) => l.trim())
    .filter(Boolean)

  const isFavorite = labels.some((l) => l === '* starred')
  const tags = labels
    .filter((l) => l !== '* myContacts' && l !== '* starred')
    .map((l) => (l.startsWith('* ') ? l.slice(2) : l))

  return { isFavorite, tags }
}

export function mapRow(row: RawRow): { person: MappedPerson | null; error: string | null } {
  const firstName = (row['First Name'] || '').trim()
  const middleName = (row['Middle Name'] || '').trim()
  const lastName = (row['Last Name'] || '').trim()
  let fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()

  const phone = normalizePhone(row['Phone 1 - Value'])
  const email = (row['E-mail 1 - Value'] || '').trim().toLowerCase()

  if (!fullName && !phone) {
    return { person: null, error: 'import.no_identity' }
  }
  if (!fullName) {
    fullName = phone
  }

  const company = (row['Organization Name'] || '').trim() || null
  const jobTitle = (row['Organization Title'] || '').trim() || null
  const notes = (row['Notes'] || '').trim() || null

  const rawBirthday = (row['Birthday'] || '').trim()
  const birthday = BIRTHDAY_RE.test(rawBirthday) ? rawBirthday : null

  const { isFavorite, tags } = parseLabels(row['Labels'] || '')

  const person: MappedPerson = {
    full_name: fullName,
    phone: phone || null,
    email: email || null,
    birthday,
    company,
    job_title: jobTitle,
    notes,
    is_favorite: isFavorite,
    tags,
    group_type: 'khac',
    contact_frequency_days: null,
    hobbies: [],
    preferences: {},
    social_links: {},
  }

  return { person, error: null }
}

// ---------------------------------------------------------------------
// 4) Doi chieu trung lap (trong file + voi du lieu da co)
// ---------------------------------------------------------------------

interface IdentityFields {
  phone: string | null
  email: string | null
  full_name: string
  birthday: string | null
}

// Tim ban ghi trung theo thu tu uu tien: phone -> email -> full_name+birthday
// (ca hai phai co birthday). Chuan hoa lai phone o ca hai phia truoc khi so.
function findMatch<T extends IdentityFields>(person: IdentityFields, candidates: T[]): T | null {
  if (person.phone) {
    const found = candidates.find((c) => c.phone && normalizePhone(c.phone) === person.phone)
    if (found) return found
  }
  if (person.email) {
    const found = candidates.find(
      (c) => c.email && c.email.trim().toLowerCase() === person.email,
    )
    if (found) return found
  }
  if (person.birthday) {
    const nameKey = vnNormalize(person.full_name)
    const found = candidates.find(
      (c) => c.birthday && c.birthday === person.birthday && vnNormalize(c.full_name) === nameKey,
    )
    if (found) return found
  }
  return null
}

// Dung o ca dedupePlan (noi bo) lan o UI (preview tung dong) — mot nguon logic
// so khop duy nhat.
export function findMatchingExisting(
  person: MappedPerson,
  existing: ExistingPerson[],
): ExistingPerson | null {
  return findMatch(person, existing)
}

// Dien vao cac o rong cua target bang du lieu cua source (dong sau merge vao
// dong truoc). Khong bao gio ghi de du lieu da co san.
function fillEmpty(target: MappedPerson, source: MappedPerson): MappedPerson {
  return {
    ...target,
    phone: target.phone || source.phone,
    email: target.email || source.email,
    birthday: target.birthday || source.birthday,
    company: target.company || source.company,
    job_title: target.job_title || source.job_title,
    notes: target.notes || source.notes,
    tags: target.tags.length ? target.tags : source.tags,
    is_favorite: target.is_favorite || source.is_favorite,
  }
}

// Gop cac dong trung lap NGAY TRONG file CSV thanh 1 ban ghi duy nhat.
function mergeWithinFile(mapped: MappedPerson[]): MappedPerson[] {
  const merged: MappedPerson[] = []
  for (const person of mapped) {
    const match = findMatch(person, merged)
    if (!match) {
      merged.push(person)
      continue
    }
    const idx = merged.indexOf(match)
    merged[idx] = fillEmpty(match, person)
  }
  return merged
}

export function dedupePlan(mapped: MappedPerson[], existing: ExistingPerson[]): DedupePlan {
  const merged = mergeWithinFile(mapped)

  const inserts: MappedPerson[] = []
  const updates: DedupeUpdate[] = []

  for (const person of merged) {
    const match = findMatch(person, existing)
    if (!match) {
      inserts.push(person)
      continue
    }

    // Chi dien cac cot dang null/rong o ban ghi da co — khong ghi de du lieu.
    const patch: DedupeUpdate['patch'] = {}
    if (!match.phone && person.phone) patch.phone = person.phone
    if (!match.email && person.email) patch.email = person.email
    if (!match.birthday && person.birthday) patch.birthday = person.birthday

    // Patch rong van tinh la 1 dong "trung" (updated=skip), khong tao insert moi.
    updates.push({ id: match.id, patch })
  }

  return { inserts, updates, errors: [] }
}

// ---------------------------------------------------------------------
// 5) Chay import that su len Supabase
// ---------------------------------------------------------------------

const CHUNK_SIZE = 50

export async function runImport(
  plan: DedupePlan,
  onProgress?: (done: number, total: number) => void,
): Promise<RunImportResult> {
  const total = plan.inserts.length + plan.updates.length
  let done = 0
  let inserted = 0
  let updated = 0
  const failed: { name: string; reason: string }[] = []

  for (let i = 0; i < plan.inserts.length; i += CHUNK_SIZE) {
    const chunk = plan.inserts.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from('persons').insert(chunk)

    if (!error) {
      inserted += chunk.length
    } else {
      // Chunk loi: thu lai tung dong de biet chinh xac dong nao that bai.
      for (const person of chunk) {
        const { error: rowError } = await supabase.from('persons').insert([person])
        if (rowError) {
          failed.push({ name: person.full_name, reason: rowError.message })
        } else {
          inserted += 1
        }
      }
    }

    done += chunk.length
    onProgress?.(done, total)
  }

  for (const update of plan.updates) {
    if (Object.keys(update.patch).length === 0) {
      // Trung nhung khong co gi de dien them — bo qua ghi DB, van tinh la updated.
      updated += 1
      done += 1
      onProgress?.(done, total)
      continue
    }

    const { error } = await supabase.from('persons').update(update.patch).eq('id', update.id)
    if (error) {
      failed.push({ name: update.id, reason: error.message })
    } else {
      updated += 1
    }

    done += 1
    onProgress?.(done, total)
  }

  return { inserted, updated, failed }
}
