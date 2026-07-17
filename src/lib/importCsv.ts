// Logic thuan (khong React) cho wizard nhap CSV Google Contacts — tach rieng
// de test duoc doc lap voi UI. Xem src/pages/ImportCsv.tsx cho phan giao dien.

// import mac dinh (khong phai { parse }) — papaparse la goi CommonJS, Node
// ESM thuan (vd scripts/*.test.ts chay bang node:test) chi nhan dien duoc
// export mac dinh, khong suy ra duoc named export 'parse' nhu bundler/esbuild.
import Papa from 'papaparse'
import { vnNormalize } from './normalize.ts'
import type { GroupType } from './types'

// ---------------------------------------------------------------------
// Kieu du lieu
// ---------------------------------------------------------------------

// Mot dong tho tu file CSV Google Contacts / LinkedIn (header: true => key la
// ten cot).
export type RawRow = Record<string, string>

export type CsvFormat = 'google' | 'linkedin' | 'unknown'

export interface ParseResult {
  rows: RawRow[]
  format: CsvFormat
}

// Ban ghi da chuan hoa, san sang de insert vao bang public.persons (khong
// gom cac cot do DB tu sinh: id, created_by, created_at, updated_at, search_text).
export interface MappedPerson {
  full_name: string
  nickname: string
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
  // --- Cac truong gia pha, chi dung boi wizard nhap Excel gia pha (xem
  // src/lib/importFamily.ts) — optional vi CSV/LinkedIn import (mapRow /
  // mapLinkedInRow) khong dung toi, de khong pha vo cac ham do.
  in_family_tree?: boolean
  gender?: 'nam' | 'nu' | null
  birth_year?: number | null
  death_date?: string | null
  death_year?: number | null
  death_lunar_day?: number | null
  death_lunar_month?: number | null
  hometown?: string | null
  burial_place?: string | null
  biography?: string | null
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
  // in_family_tree: chi wizard gia pha dung (danh dau nguoi da co san trong
  // danh ba la thanh vien dong ho khi file Excel khop trung ho).
  patch: Partial<Pick<MappedPerson, 'phone' | 'email' | 'birthday' | 'in_family_tree'>>
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
  // Id cua tung ban ghi da insert, CUNG THU TU voi plan.inserts (null o vi tri
  // that bai) — wizard gia pha (importFamily.ts) dung mang nay de anh xa
  // rowIndex -> personId roi tao quan he. ImportCsv.tsx (danh ba thuong)
  // khong dung toi truong nay.
  insertedIds: (string | null)[]
}

// ---------------------------------------------------------------------
// 1) Doc file CSV
// ---------------------------------------------------------------------

// Nhan dien dinh dang CSV tu danh sach header. LinkedIn: co First Name +
// Last Name + (Company hoac Position) nhung KHONG co Phone 1 - Value (cot
// dac trung cua Google Contacts) — kiem tra linkedin truoc vi dieu kien chat
// hon.
export function detectCsvFormat(headers: string[]): CsvFormat {
  const has = (h: string) => headers.includes(h)

  if (
    has('First Name') &&
    has('Last Name') &&
    (has('Company') || has('Position')) &&
    !has('Phone 1 - Value')
  ) {
    return 'linkedin'
  }

  if (has('First Name') && (has('Phone 1 - Value') || has('E-mail 1 - Value'))) {
    return 'google'
  }

  return 'unknown'
}

// File "LinkedIn Connections.csv" co vai dong ghi chu dau file ("Notes:",
// dong trong, cau giai thich...) TRUOC dong header thuc su — PapaParse voi
// header:true se hong cot neu doc nguyen van. Cat bo moi dong truoc dong bat
// dau bang "First Name".
function stripPreambleLines(text: string): string {
  const lines = text.split(/\r\n|\n|\r/)
  const headerIdx = lines.findIndex((l) => l.trim().startsWith('First Name'))
  if (headerIdx <= 0) return text
  return lines.slice(headerIdx).join('\n')
}

export function parseContactsCsv(file: File): Promise<ParseResult> {
  return file.text().then(
    (text) =>
      new Promise<ParseResult>((resolve, reject) => {
        const cleaned = stripPreambleLines(text)
        Papa.parse<RawRow>(cleaned, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const fields = results.meta.fields ?? []
            const format = detectCsvFormat(fields)
            resolve({ rows: results.data, format })
          },
          error: (err: Error) => reject(err),
        })
      }),
  )
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
    // "Ten danh ba" (nickname) khi nhap CSV lay cung gia tri voi full_name —
    // nguoi dung co the sua rieng tung o sau khi nhap.
    nickname: fullName,
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

// Anh xa 1 dong CSV xuat tu LinkedIn (Connections.csv) -> MappedPerson.
// Ten Viet tren LinkedIn thuong da viet dung thu tu ho-ten trong First Name /
// Last Name (vd "Nguyen Trung" + "Nguyen") — cu ghep First + Last, khong dao.
export function mapLinkedInRow(row: RawRow): { person: MappedPerson | null; error: string | null } {
  const firstName = (row['First Name'] || '').trim()
  const lastName = (row['Last Name'] || '').trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

  if (!fullName) {
    return { person: null, error: 'import.no_identity' }
  }

  const email = (row['Email Address'] || '').trim().toLowerCase()
  const company = (row['Company'] || '').trim() || null
  const jobTitle = (row['Position'] || '').trim() || null
  const url = (row['URL'] || '').trim()

  const social_links: Record<string, string> = {}
  if (url) social_links.linkedin = url

  const person: MappedPerson = {
    full_name: fullName,
    nickname: fullName,
    phone: null,
    email: email || null,
    birthday: null,
    company,
    job_title: jobTitle,
    notes: null,
    is_favorite: false,
    tags: ['linkedin'],
    group_type: 'khac',
    contact_frequency_days: null,
    hobbies: [],
    preferences: {},
    social_links,
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
// looseNameMatch=true (dung cho LinkedIn — khong co phone/birthday): khi ca
// hai phia CUNG THIEU birthday, chap nhan trung ten (vn_unaccent) — tranh so
// nham voi ban ghi Google da co day du thong tin (van yeu cau birthday khop).
function findMatch<T extends IdentityFields>(
  person: IdentityFields,
  candidates: T[],
  looseNameMatch = false,
): T | null {
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
  } else if (looseNameMatch) {
    const nameKey = vnNormalize(person.full_name)
    const found = candidates.find((c) => !c.birthday && vnNormalize(c.full_name) === nameKey)
    if (found) return found
  }
  return null
}

// Dung o ca dedupePlan (noi bo) lan o UI (preview tung dong) — mot nguon logic
// so khop duy nhat.
export function findMatchingExisting(
  person: MappedPerson,
  existing: ExistingPerson[],
  looseNameMatch = false,
): ExistingPerson | null {
  return findMatch(person, existing, looseNameMatch)
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
function mergeWithinFile(mapped: MappedPerson[], looseNameMatch = false): MappedPerson[] {
  const merged: MappedPerson[] = []
  for (const person of mapped) {
    const match = findMatch(person, merged, looseNameMatch)
    if (!match) {
      merged.push(person)
      continue
    }
    const idx = merged.indexOf(match)
    merged[idx] = fillEmpty(match, person)
  }
  return merged
}

// looseNameMatch: true cho dinh dang LinkedIn (khong co phone/birthday trong
// file nguon) — xem ghi chu o findMatch.
export function dedupePlan(
  mapped: MappedPerson[],
  existing: ExistingPerson[],
  looseNameMatch = false,
): DedupePlan {
  const merged = mergeWithinFile(mapped, looseNameMatch)

  const inserts: MappedPerson[] = []
  const updates: DedupeUpdate[] = []

  for (const person of merged) {
    const match = findMatch(person, existing, looseNameMatch)
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
  // Import dong (khong o dau file): './supabase' doc import.meta.env, chi co
  // gia tri duoi Vite — import tinh o dau file se lam moi module import
  // importCsv.ts (vd script test node:test cua wizard gia pha) crash ngay
  // luc load, du khong goi runImport(). Cac ham thuan (parseContactsCsv,
  // mapRow, dedupePlan, findMatchingExisting...) khong dung supabase nen
  // khong bi anh huong.
  const { supabase } = await import('./supabase.ts')

  const total = plan.inserts.length + plan.updates.length
  let done = 0
  let inserted = 0
  let updated = 0
  const failed: { name: string; reason: string }[] = []
  // Cung do dai voi plan.inserts, gan dan theo vi tri — null o cho insert that bai.
  const insertedIds: (string | null)[] = new Array(plan.inserts.length).fill(null)

  for (let i = 0; i < plan.inserts.length; i += CHUNK_SIZE) {
    const chunk = plan.inserts.slice(i, i + CHUNK_SIZE)
    const { data, error } = await supabase.from('persons').insert(chunk).select('id')

    if (!error && data) {
      inserted += chunk.length
      data.forEach((row, j) => {
        insertedIds[i + j] = (row as { id: string }).id
      })
    } else {
      // Chunk loi: thu lai tung dong de biet chinh xac dong nao that bai VA
      // lay id cua tung dong thanh cong.
      for (let j = 0; j < chunk.length; j++) {
        const person = chunk[j]
        const { data: rowData, error: rowError } = await supabase
          .from('persons')
          .insert([person])
          .select('id')
          .single()
        if (rowError || !rowData) {
          failed.push({ name: person.full_name, reason: rowError?.message ?? 'unknown error' })
        } else {
          inserted += 1
          insertedIds[i + j] = (rowData as { id: string }).id
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

  return { inserted, updated, failed, insertedIds }
}
