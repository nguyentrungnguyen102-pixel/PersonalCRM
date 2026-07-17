// Logic thuan (khong React) cho wizard nhap gia pha tu Excel/CSV bat ky —
// tach rieng de test duoc doc lap voi UI. Xem src/pages/ImportGiaPha.tsx cho
// phan giao dien. Cau truc phong theo src/lib/importCsv.ts: phan thuan
// (khong goi supabase) truoc, phan chay DB o cuoi file.

// Extension .ts o 2 import gia tri duoi day la CO Y (allowImportingTsExtensions
// da bat trong tsconfig.app.json) — de scripts/importFamily.test.ts (chay
// truc tiep bang node --experimental-strip-types, khong qua Vite) resolve
// duoc module, vi Node ESM khong tu suy ra duoi file nhu bundler.
import { findMatchingExisting, normalizePhone, runImport } from './importCsv.ts'
import type { DedupePlan, DedupeUpdate, ExistingPerson, MappedPerson, RunImportResult } from './importCsv.ts'
import { vnNormalize } from './normalize.ts'
// fetchRelationTypes (./relations) va supabase (./supabase) CO Y import
// dong (khong o dau file) trong runFamilyImport() ben duoi — ca 2 module do
// deu dung import.meta.env (qua supabase.ts), chi hop le duoi Vite. Import
// tinh o day se lam moi lan `import` module importFamily.ts (vd script
// scripts/importFamily.test.ts chay bang node:test) crash ngay luc load, du
// cac test chi goi toi cac ham thuan ben tren.

// ---------------------------------------------------------------------
// 1) Kieu du lieu
// ---------------------------------------------------------------------

export type FamilyField =
  | 'full_name'
  | 'nickname'
  | 'gender'
  | 'birthday'
  | 'death_date'
  | 'death_lunar'
  | 'father_name'
  | 'mother_name'
  | 'spouse_name'
  | 'generation'
  | 'branch'
  | 'hometown'
  | 'burial_place'
  | 'biography'
  | 'phone'
  | 'email'
  | 'note'
  | 'skip'

export interface ColumnMapping {
  header: string
  field: FamilyField
}

// Cac truong "that su" co the ghep cot toi (khong tinh 'skip') — dung lam
// khoa cho FIELD_VARIANTS va vong lap tu dong nhan dien.
type MappableField = Exclude<FamilyField, 'skip'>

// Payload san sang insert vao persons — chinh la MappedPerson (dung chung may
// dedupe/runImport voi wizard CSV danh ba) nhung BAT BUOC phai co day du cac
// truong gia pha (o MappedPerson chung la optional vi CSV thuong khong dung).
export type FamilyPersonDraft = MappedPerson &
  Required<
    Pick<
      MappedPerson,
      | 'in_family_tree'
      | 'gender'
      | 'birth_year'
      | 'death_date'
      | 'death_year'
      | 'death_lunar_day'
      | 'death_lunar_month'
      | 'hometown'
      | 'burial_place'
      | 'biography'
    >
  >

export interface FamilyMapped {
  person: FamilyPersonDraft
  rowIndex: number
  fatherName: string | null
  motherName: string | null
  spouseName: string | null
}

// ---------------------------------------------------------------------
// 2) Tu dong nhan dien cot (autoDetectMapping)
// ---------------------------------------------------------------------

// Cac bien the ten cot (da vnNormalize, chu thuong) cho tung truong — dung ca
// cho khop CHINH XAC (pass 1) lan khop CHUA (pass 2, xem autoDetectMapping).
const FIELD_VARIANTS: Record<MappableField, string[]> = {
  full_name: ['ho ten', 'ho va ten', 'ten day du', 'ten', 'name', 'ho_ten'],
  nickname: ['ten thuong goi', 'ten goi', 'biet danh', 'ten danh ba'],
  gender: ['gioi tinh', 'gioi', 'nam nu'],
  birthday: ['ngay sinh', 'nam sinh', 'sinh nam', 'sinh', 'sn', 'birthday', 'ngay thang nam sinh'],
  death_date: ['ngay mat', 'nam mat', 'mat nam', 'mat', 'qua doi', 'tu tran', 'hy sinh', 'ngay chet'],
  death_lunar: ['ngay gio', 'gio ky', 'ngay ky', 'gio', 'ky nhat'],
  father_name: ['bo', 'cha', 'ten bo', 'ten cha', 'than phu', 'phu than', 'con ong'],
  mother_name: ['me', 'ten me', 'than mau', 'mau than', 'con ba'],
  spouse_name: ['vo chong', 'vo/chong', 'vo', 'chong', 'phoi ngau', 'hon phoi', 'ban doi'],
  generation: ['doi thu', 'the he', 'doi'],
  branch: ['chi', 'nhanh', 'phai', 'chi ho'],
  hometown: ['que quan', 'nguyen quan', 'que'],
  burial_place: ['mo phan', 'noi an tang', 'an tang', 'nghia trang', 'mo'],
  biography: ['tieu su', 'than the', 'cuoc doi'],
  phone: ['dien thoai', 'so dien thoai', 'sdt', 'so dt', 'phone'],
  email: ['email', 'thu dien tu'],
  note: ['ghi chu', 'chu thich', 'note'],
}

const FIELD_KEYS = Object.keys(FIELD_VARIANTS) as MappableField[]

// vnNormalize + gom khoang trang thua — header thuc te co the co nhieu
// khoang trang lien tiep hoac dau/cuoi.
function normalizeHeader(h: string): string {
  return vnNormalize(h).replace(/\s+/g, ' ').trim()
}

// Nhan dien tu dong FamilyField cho tung cot dua vao ten header, khong can
// theo mau co dinh. 2 buoc:
//  - Pass 1 (khop CHINH XAC): header == 1 bien the nao do -> gan truong do
//    ngay, khong xet substring. Lam truoc de tranh vd 'Giới tính' (chua chu
//    'gio') bi pass 2 vo tinh khop nham vao death_lunar (bien the 'gio').
//  - Pass 2 (khop CHUA/substring): voi header con lai, duyet danh sach phang
//    (bien the, truong) sap xep do dai bien the GIAM DAN — bien the dai/cu
//    the hon duoc uu tien, hit dau tien thang.
// Moi truong chi duoc nhan toi da 1 cot — cot thu 2 tro di anh xa cung
// truong se roi ve 'skip'.
export function autoDetectMapping(headers: string[]): ColumnMapping[] {
  const normed = headers.map(normalizeHeader)
  const result: ColumnMapping[] = headers.map((header) => ({ header, field: 'skip' as FamilyField }))
  const claimed = new Set<MappableField>()

  // Pass 1: khop chinh xac.
  const exactIndex = new Map<string, MappableField>()
  for (const field of FIELD_KEYS) {
    for (const variant of FIELD_VARIANTS[field]) {
      if (!exactIndex.has(variant)) exactIndex.set(variant, field)
    }
  }
  headers.forEach((_, i) => {
    const field = exactIndex.get(normed[i])
    if (field && !claimed.has(field)) {
      result[i].field = field
      claimed.add(field)
    }
  })

  // Pass 2: khop chua (substring), uu tien bien the dai hon.
  const flat: { variant: string; field: MappableField }[] = []
  for (const field of FIELD_KEYS) {
    for (const variant of FIELD_VARIANTS[field]) flat.push({ variant, field })
  }
  flat.sort((a, b) => b.variant.length - a.variant.length)

  headers.forEach((_, i) => {
    if (result[i].field !== 'skip') return
    for (const { variant, field } of flat) {
      if (claimed.has(field)) continue
      if (normed[i].includes(variant)) {
        result[i].field = field
        claimed.add(field)
        break
      }
    }
  })

  return result
}

// ---------------------------------------------------------------------
// 3) Phan tich ngay thang / gioi tinh linh hoat
// ---------------------------------------------------------------------

const ISO_DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
const DAY_FIRST_RE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function toIso(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0')
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function validateYmd(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 2200) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > daysInMonth(year, month)) return false
  return true
}

export interface FlexibleDate {
  date: string | null
  year: number | null
}

// Nhan mot Date object (vd XLSX doc voi cellDates:true) hoac chuoi kieu
// dd/mm/yyyy, d-m-yyyy, d.m.yyyy (NGAY TRUOC), yyyy-mm-dd, hoac chi nam ("1932",
// "~1932", "khoảng 1932"). Tra ve null neu rong/khong doc duoc.
export function parseFlexibleDate(raw: string | Date): FlexibleDate | null {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    const year = raw.getFullYear()
    const month = raw.getMonth() + 1
    const day = raw.getDate()
    if (!validateYmd(year, month, day)) return null
    return { date: toIso(year, month, day), year }
  }

  const trimmed = raw.trim()
  if (!trimmed) return null

  const isoMatch = ISO_DATE_RE.exec(trimmed)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    if (!validateYmd(year, month, day)) return null
    return { date: toIso(year, month, day), year }
  }

  const dayFirstMatch = DAY_FIRST_RE.exec(trimmed)
  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1])
    const month = Number(dayFirstMatch[2])
    const year = Number(dayFirstMatch[3])
    if (!validateYmd(year, month, day)) return null
    return { date: toIso(year, month, day), year }
  }

  // Chi con nam, kieu "1932", "~1932", "khoảng 1932" — bo het ky tu khong
  // phai chu so, neu con lai DUNG 4 chu so thi coi la nam.
  const digitsOnly = trimmed.replace(/\D/g, '')
  if (digitsOnly.length === 4) {
    const year = Number(digitsOnly)
    if (year >= 1000 && year <= 2200) return { date: null, year }
  }

  return null
}

const LUNAR_STOPWORDS_RE = /\b(am lich|ngay|thang|mung|mong|al)\b/g
const LUNAR_DAY_MONTH_RE = /(\d{1,2})\D+(\d{1,2})/

export interface LunarDayMonth {
  day: number
  month: number
}

// Nhan cac dang "12/7", "12-7", "ngày 12 tháng 7", "mùng 3 tháng 3", "12/7 ÂL"
// -> {day, month}. Validate day 1-30, month 1-12 (am lich toi da 30 ngay).
export function parseLunarDayMonth(raw: string): LunarDayMonth | null {
  const normalized = vnNormalize(raw).replace(LUNAR_STOPWORDS_RE, ' ')
  const match = LUNAR_DAY_MONTH_RE.exec(normalized)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  if (day < 1 || day > 30) return null
  if (month < 1 || month > 12) return null
  return { day, month }
}

export function parseGender(raw: string): 'nam' | 'nu' | null {
  const n = vnNormalize(raw).trim()
  if (n === 'nam' || n === 'trai' || n === 'male' || n === 'm') return 'nam'
  if (n === 'nu' || n === 'gai' || n === 'female' || n === 'f') return 'nu'
  return null
}

// ---------------------------------------------------------------------
// 4) Anh xa 1 dong -> FamilyPersonDraft
// ---------------------------------------------------------------------

// Ly do loi dong (key nhan) khi thieu ten day du — dung lai key co san
// 'import.no_identity' cua wizard CSV (chua co key rieng cho gia pha o
// import_family.*, xem ghi chu trong bao cao).
const ERROR_NO_NAME = 'import.no_identity'

export function mapFamilyRow(
  row: Record<string, string>,
  mapping: ColumnMapping[],
  rowIndex: number,
): { ok: FamilyMapped } | { error: string } {
  const valueFor = (field: FamilyField): string => {
    const col = mapping.find((m) => m.field === field)
    if (!col) return ''
    const raw = row[col.header]
    return raw == null ? '' : String(raw).trim()
  }

  const fullName = valueFor('full_name')
  if (!fullName) {
    return { error: ERROR_NO_NAME }
  }

  const nicknameRaw = valueFor('nickname')
  const gender = parseGender(valueFor('gender'))

  const birthdayParsed = parseFlexibleDate(valueFor('birthday'))
  const deathParsed = parseFlexibleDate(valueFor('death_date'))
  const lunar = parseLunarDayMonth(valueFor('death_lunar'))

  const generationRaw = valueFor('generation')
  const generationNum = Number.parseInt(generationRaw, 10)
  const branchRaw = valueFor('branch')

  const tags: string[] = []
  if (!Number.isNaN(generationNum)) tags.push(`Đời ${generationNum}`)
  if (branchRaw) tags.push(`Chi ${branchRaw}`)

  const phone = normalizePhone(valueFor('phone'))
  const email = valueFor('email').toLowerCase()
  const notes = valueFor('note')

  const person: FamilyPersonDraft = {
    full_name: fullName,
    nickname: nicknameRaw || fullName,
    phone: phone || null,
    email: email || null,
    birthday: birthdayParsed?.date ?? null,
    company: null,
    job_title: null,
    notes: notes || null,
    is_favorite: false,
    tags,
    group_type: 'gia_dinh',
    contact_frequency_days: null,
    hobbies: [],
    preferences: {},
    social_links: {},
    in_family_tree: true,
    gender,
    // birth_year/death_year chi dung khi KHONG co ngay day du (xem comment
    // cot trong migration 20260801100000_v21_life_events.sql).
    birth_year: birthdayParsed && !birthdayParsed.date ? birthdayParsed.year : null,
    death_date: deathParsed?.date ?? null,
    death_year: deathParsed && !deathParsed.date ? deathParsed.year : null,
    death_lunar_day: lunar?.day ?? null,
    death_lunar_month: lunar?.month ?? null,
    hometown: valueFor('hometown') || null,
    burial_place: valueFor('burial_place') || null,
    biography: valueFor('biography') || null,
  }

  return {
    ok: {
      person,
      rowIndex,
      fatherName: valueFor('father_name') || null,
      motherName: valueFor('mother_name') || null,
      spouseName: valueFor('spouse_name') || null,
    },
  }
}

// ---------------------------------------------------------------------
// 5) Suy luan quan he (bo/me-con, vo/chong) tu ten trong file
// ---------------------------------------------------------------------

export type RelKind = 'bo_me_con' | 'vo_chong'
export type RelStatus = 'ok' | 'ambiguous' | 'not_found'

export interface RelPlanItem {
  fromRow: number
  kind: RelKind
  targetRow: number | null
  targetExistingId: string | null
  status: RelStatus
  targetName: string
  // true = nguoi duoc tham chieu (targetRow/targetExistingId) LA bo/me;
  // false = nguoi duoc tham chieu LA vo/chong (khong phan cap).
  parentIsTarget: boolean
}

export interface ExistingFamilyPerson {
  id: string
  full_name: string
  nickname: string | null
}

// Suy ra danh sach quan he can tao tu cot "Tên bố"/"Tên mẹ"/"Tên vợ/chồng"
// bang cach so ten (vnNormalize) trong CHINH file dang nhap truoc, roi moi
// so voi nguoi da co san trong dong ho (existingFamily). Dung 1 ten khop -> ok;
// khop 0 hoac >1 (trong file + da co, tinh gop) -> not_found/ambiguous.
export function resolveRelationships(
  mapped: FamilyMapped[],
  existingFamily: ExistingFamilyPerson[],
): RelPlanItem[] {
  const inFileIndex = new Map<string, number[]>()
  const addToFileIndex = (name: string | null, rowIndex: number) => {
    if (!name) return
    const key = vnNormalize(name.trim())
    if (!key) return
    const arr = inFileIndex.get(key) ?? []
    arr.push(rowIndex)
    inFileIndex.set(key, arr)
  }
  for (const m of mapped) {
    addToFileIndex(m.person.full_name, m.rowIndex)
    addToFileIndex(m.person.nickname, m.rowIndex)
  }

  const existingIndex = new Map<string, string[]>()
  const addToExistingIndex = (name: string | null, id: string) => {
    if (!name) return
    const key = vnNormalize(name.trim())
    if (!key) return
    const arr = existingIndex.get(key) ?? []
    if (!arr.includes(id)) arr.push(id)
    existingIndex.set(key, arr)
  }
  for (const p of existingFamily) {
    addToExistingIndex(p.full_name, p.id)
    addToExistingIndex(p.nickname, p.id)
  }

  function resolveOne(
    fromRow: number,
    targetName: string,
    kind: RelKind,
    parentIsTarget: boolean,
  ): RelPlanItem | null {
    const trimmed = targetName.trim()
    if (!trimmed) return null
    const key = vnNormalize(trimmed)

    // Tu tham chieu (vd 1 dong ghi ten chinh minh vao cot bo) khong tinh la
    // 1 hit trong file.
    const inFileHits = Array.from(new Set((inFileIndex.get(key) ?? []).filter((r) => r !== fromRow)))
    const existingHits = existingIndex.get(key) ?? []

    let status: RelStatus
    let targetRow: number | null = null
    let targetExistingId: string | null = null

    if (inFileHits.length === 1 && existingHits.length === 0) {
      status = 'ok'
      targetRow = inFileHits[0]
    } else if (inFileHits.length === 0 && existingHits.length === 1) {
      status = 'ok'
      targetExistingId = existingHits[0]
    } else if (inFileHits.length + existingHits.length === 0) {
      status = 'not_found'
    } else {
      status = 'ambiguous'
    }

    return { fromRow, kind, targetRow, targetExistingId, status, targetName: trimmed, parentIsTarget }
  }

  const items: RelPlanItem[] = []
  for (const m of mapped) {
    if (m.fatherName) {
      const item = resolveOne(m.rowIndex, m.fatherName, 'bo_me_con', true)
      if (item) items.push(item)
    }
    if (m.motherName) {
      const item = resolveOne(m.rowIndex, m.motherName, 'bo_me_con', true)
      if (item) items.push(item)
    }
    if (m.spouseName) {
      const item = resolveOne(m.rowIndex, m.spouseName, 'vo_chong', false)
      if (item) items.push(item)
    }
  }

  // vo_chong co the sinh 2 lan (dong A ghi vo/chong la B, dong B ghi vo/chong
  // la A) — gop lai chi giu 1, dua theo cap dinh danh da sap xep.
  const seenPairs = new Set<string>()
  const deduped: RelPlanItem[] = []
  for (const item of items) {
    if (item.kind === 'vo_chong' && item.status === 'ok') {
      const a = `row:${item.fromRow}`
      const b = item.targetRow != null ? `row:${item.targetRow}` : `id:${item.targetExistingId}`
      const pairKey = [a, b].sort().join('|')
      if (seenPairs.has(pairKey)) continue
      seenPairs.add(pairKey)
    }
    deduped.push(item)
  }

  return deduped
}

// ---------------------------------------------------------------------
// 6) Chay import that su len Supabase (persons + relationships)
// ---------------------------------------------------------------------

export interface FamilyDedupePlan {
  inserts: MappedPerson[]
  // Cung do dai/thu tu voi inserts — rowIndex nguon cua tung phan tu.
  insertRowIndexes: number[]
  updates: DedupeUpdate[]
  updateRowIndexes: number[]
}

// KHONG dung dedupePlan()/mergeWithinFile cua importCsv.ts o day: gop cac
// dong "giong nhau" trong file se lam mat lien ket rowIndex -> ban ghi, vo
// vong resolveRelationships() phia tren khong con tro dung nua. Voi gia pha,
// 2 dong trung ten trong file gan nhu chac chan la 2 NGUOI KHAC NHAU (ong/chau
// trung ten...) nen KHONG gop — chi doi chieu voi du lieu DA CO trong DB.
export function buildFamilyDedupePlan(
  mapped: FamilyMapped[],
  existing: ExistingPerson[],
): FamilyDedupePlan {
  const inserts: MappedPerson[] = []
  const insertRowIndexes: number[] = []
  const updates: DedupeUpdate[] = []
  const updateRowIndexes: number[] = []

  for (const m of mapped) {
    const match = findMatchingExisting(m.person, existing, true)
    if (!match) {
      inserts.push(m.person)
      insertRowIndexes.push(m.rowIndex)
      continue
    }

    const patch: DedupeUpdate['patch'] = {}
    if (!match.phone && m.person.phone) patch.phone = m.person.phone
    if (!match.email && m.person.email) patch.email = m.person.email
    if (!match.birthday && m.person.birthday) patch.birthday = m.person.birthday
    // Nguoi da co san trong danh ba nhung xuat hien trong file gia pha thi
    // PHAI duoc danh dau thuoc dong ho — neu khong ho se duoc noi quan he ma
    // van khong hien tren cay (/gia-pha chi hien in_family_tree = true).
    patch.in_family_tree = true
    updates.push({ id: match.id, patch })
    updateRowIndexes.push(m.rowIndex)
  }

  return { inserts, insertRowIndexes, updates, updateRowIndexes }
}

export interface RunFamilyImportResult {
  inserted: number
  updated: number
  failed: { name: string; reason: string }[]
  relCreated: number
  relDuplicate: number
  relSkipped: RelPlanItem[]
}

const REL_CHUNK_SIZE = 50

// Nhan FamilyDedupePlan (rowIndex con nguyen) + RelPlanItem[] (tu
// resolveRelationships), chay insert/update persons roi tao cac quan he o
// trang thai 'ok'. Cac quan he 'ambiguous'/'not_found' (va nhung quan he
// khong quy ve duoc personId that su, vd nguoi lien quan insert that bai) roi
// vao relSkipped de nguoi dung tu noi tay sau.
export async function runFamilyImport(
  plan: FamilyDedupePlan,
  relPlan: RelPlanItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<RunFamilyImportResult> {
  const { supabase } = await import('./supabase.ts')
  const { fetchRelationTypes } = await import('./relations.ts')

  const baseDedupePlan: DedupePlan = { inserts: plan.inserts, updates: plan.updates, errors: [] }
  const base: RunImportResult = await runImport(baseDedupePlan, onProgress)

  const rowIndexToPersonId = new Map<number, string>()
  plan.insertRowIndexes.forEach((rowIndex, i) => {
    const id = base.insertedIds[i]
    if (id) rowIndexToPersonId.set(rowIndex, id)
  })
  plan.updateRowIndexes.forEach((rowIndex, i) => {
    rowIndexToPersonId.set(rowIndex, plan.updates[i].id)
  })

  const relTypes = await fetchRelationTypes()
  const boMeCon = relTypes.find((r) => r.value === 'bo_me_con')
  const voChong = relTypes.find((r) => r.value === 'vo_chong')
  const boMeConLabels = {
    aToB: boMeCon?.label_a_to_b || 'bố/mẹ của',
    bToA: boMeCon?.label_b_to_a || 'con của',
  }
  const voChongLabels = {
    aToB: voChong?.label_a_to_b || 'vợ/chồng của',
    bToA: voChong?.label_b_to_a || 'vợ/chồng của',
  }

  interface RelInsertRow {
    person_a: string
    person_b: string
    relation_type: RelKind
    direction_label_a_to_b: string
    direction_label_b_to_a: string
    note: null
  }

  const toInsert: RelInsertRow[] = []
  const relSkipped: RelPlanItem[] = []

  for (const item of relPlan) {
    if (item.status !== 'ok') {
      relSkipped.push(item)
      continue
    }

    const fromId = rowIndexToPersonId.get(item.fromRow)
    const targetId =
      item.targetExistingId ?? (item.targetRow != null ? rowIndexToPersonId.get(item.targetRow) : undefined)

    if (!fromId || !targetId) {
      // Nguoi lien quan khong ra duoc personId that su (vd insert that bai).
      relSkipped.push(item)
      continue
    }

    if (item.kind === 'bo_me_con') {
      const parentId = item.parentIsTarget ? targetId : fromId
      const childId = item.parentIsTarget ? fromId : targetId
      toInsert.push({
        person_a: parentId,
        person_b: childId,
        relation_type: 'bo_me_con',
        direction_label_a_to_b: boMeConLabels.aToB,
        direction_label_b_to_a: boMeConLabels.bToA,
        note: null,
      })
    } else {
      toInsert.push({
        person_a: fromId,
        person_b: targetId,
        relation_type: 'vo_chong',
        direction_label_a_to_b: voChongLabels.aToB,
        direction_label_b_to_a: voChongLabels.bToA,
        note: null,
      })
    }
  }

  let relCreated = 0
  let relDuplicate = 0

  for (let i = 0; i < toInsert.length; i += REL_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + REL_CHUNK_SIZE)
    const { error } = await supabase.from('relationships').insert(chunk)

    if (!error) {
      relCreated += chunk.length
      continue
    }

    // Chunk loi (thuong la trung quan he) — thu lai tung dong, nuot loi
    // 23505 (unique_violation) tinh la trung, cac loi khac cung tinh trung de
    // khong chan tien trinh (nguoi dung co the tu them tay sau qua ho so).
    for (const rel of chunk) {
      const { error: rowError } = await supabase.from('relationships').insert([rel])
      if (!rowError) {
        relCreated += 1
      } else {
        relDuplicate += 1
      }
    }
  }

  return {
    inserted: base.inserted,
    updated: base.updated,
    failed: base.failed,
    relCreated,
    relDuplicate,
    relSkipped,
  }
}
