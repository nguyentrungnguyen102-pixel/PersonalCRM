// Test cho src/lib/importFamily.ts — chay bang node:test, khong phu thuoc
// ngoai. Chay: npm run test:unit (node --experimental-strip-types --test
// scripts/*.test.ts)

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  autoDetectMapping,
  parseFlexibleDate,
  parseGender,
  parseLunarDayMonth,
  resolveRelationships,
} from '../src/lib/importFamily.ts'
import type { ExistingFamilyPerson, FamilyMapped, FamilyPersonDraft } from '../src/lib/importFamily.ts'

// ---------------------------------------------------------------------
// autoDetectMapping
// ---------------------------------------------------------------------

test('autoDetectMapping — nhan dien bo header gia pha thuong gap', () => {
  const headers = ['Họ và tên', 'Năm sinh', 'Bố', 'Mẹ', 'Vợ/Chồng', 'Đời', 'Ngày giỗ', 'Giới tính']
  const mapping = autoDetectMapping(headers)
  const fieldOf = (h: string) => mapping.find((m) => m.header === h)?.field

  assert.equal(fieldOf('Họ và tên'), 'full_name')
  assert.equal(fieldOf('Năm sinh'), 'birthday')
  assert.equal(fieldOf('Bố'), 'father_name')
  assert.equal(fieldOf('Mẹ'), 'mother_name')
  assert.equal(fieldOf('Vợ/Chồng'), 'spouse_name')
  assert.equal(fieldOf('Đời'), 'generation')
  assert.equal(fieldOf('Ngày giỗ'), 'death_lunar')
  assert.equal(fieldOf('Giới tính'), 'gender')
})

test('autoDetectMapping — chu hoa van nhan dien duoc (khong phan biet hoa/thuong)', () => {
  const mapping = autoDetectMapping(['HỌ VÀ TÊN', 'NĂM SINH'])
  assert.equal(mapping[0].field, 'full_name')
  assert.equal(mapping[1].field, 'birthday')
})

test('autoDetectMapping — header khong khop truong nao thi ve skip', () => {
  const mapping = autoDetectMapping(['Random Column ABC'])
  assert.equal(mapping[0].field, 'skip')
})

test('autoDetectMapping — "Giới tính" phai khop gender, KHONG duoc khop death_lunar (bay "gio")', () => {
  // "gioi tinh" (sau vnNormalize) chua substring "gio" cua death_lunar — neu
  // khop chinh xac (pass 1) khong chay TRUOC khop chua (pass 2), se bi gan
  // nham vao death_lunar. Dat 2 cot canh nhau de dam bao ca 2 truong deu
  // duoc "claim" dung.
  const mapping = autoDetectMapping(['Giới tính', 'Ngày giỗ'])
  assert.equal(mapping[0].field, 'gender')
  assert.equal(mapping[1].field, 'death_lunar')
})

test('autoDetectMapping — 2 cot cung khop 1 truong: chi cot dau duoc nhan, cot sau ve skip', () => {
  const mapping = autoDetectMapping(['Họ tên', 'Tên'])
  assert.equal(mapping[0].field, 'full_name')
  assert.equal(mapping[1].field, 'skip')
})

// ---------------------------------------------------------------------
// parseFlexibleDate
// ---------------------------------------------------------------------

test('parseFlexibleDate — dd/mm/yyyy (ngay truoc) ra ISO + nam', () => {
  const r = parseFlexibleDate('12/07/1932')
  assert.deepEqual(r, { date: '1932-07-12', year: 1932 })
})

test('parseFlexibleDate — chi nam "1932" -> chi co year, date null', () => {
  const r = parseFlexibleDate('1932')
  assert.deepEqual(r, { date: null, year: 1932 })
})

test('parseFlexibleDate — "khoảng 1932" -> strip ky tu khong phai so, con 4 chu so -> year', () => {
  const r = parseFlexibleDate('khoảng 1932')
  assert.deepEqual(r, { date: null, year: 1932 })
})

test('parseFlexibleDate — ngay khong hop le (31/2) -> null', () => {
  assert.equal(parseFlexibleDate('31/2/2000'), null)
})

test('parseFlexibleDate — chuoi rong -> null', () => {
  assert.equal(parseFlexibleDate(''), null)
})

test('parseFlexibleDate — ISO yyyy-mm-dd', () => {
  const r = parseFlexibleDate('2000-05-06')
  assert.deepEqual(r, { date: '2000-05-06', year: 2000 })
})

// ---------------------------------------------------------------------
// parseLunarDayMonth
// ---------------------------------------------------------------------

test('parseLunarDayMonth — cac dang viet ngay/thang am lich pho bien', () => {
  assert.deepEqual(parseLunarDayMonth('12/7'), { day: 12, month: 7 })
  assert.deepEqual(parseLunarDayMonth('12-7'), { day: 12, month: 7 })
  assert.deepEqual(parseLunarDayMonth('ngày 12 tháng 7'), { day: 12, month: 7 })
  assert.deepEqual(parseLunarDayMonth('mùng 3 tháng 3'), { day: 3, month: 3 })
  assert.deepEqual(parseLunarDayMonth('12/7 ÂL'), { day: 12, month: 7 })
})

test('parseLunarDayMonth — thang khong hop le (31/13) -> null', () => {
  assert.equal(parseLunarDayMonth('31/13'), null)
})

// ---------------------------------------------------------------------
// parseGender
// ---------------------------------------------------------------------

test('parseGender — cac dang nam/nu thuong gap', () => {
  assert.equal(parseGender('Nam'), 'nam')
  assert.equal(parseGender('trai'), 'nam')
  assert.equal(parseGender('Male'), 'nam')
  assert.equal(parseGender('M'), 'nam')
  assert.equal(parseGender('Nữ'), 'nu')
  assert.equal(parseGender('gái'), 'nu')
  assert.equal(parseGender('female'), 'nu')
  assert.equal(parseGender('f'), 'nu')
  assert.equal(parseGender('không rõ'), null)
})

// ---------------------------------------------------------------------
// resolveRelationships
// ---------------------------------------------------------------------

function makePerson(fullName: string, nickname: string | null = null): FamilyPersonDraft {
  return {
    full_name: fullName,
    nickname: nickname ?? fullName,
    phone: null,
    email: null,
    birthday: null,
    company: null,
    job_title: null,
    notes: null,
    is_favorite: false,
    tags: [],
    group_type: 'gia_dinh',
    contact_frequency_days: null,
    hobbies: [],
    preferences: {},
    social_links: {},
    in_family_tree: true,
    gender: null,
    birth_year: null,
    death_date: null,
    death_year: null,
    death_lunar_day: null,
    death_lunar_month: null,
    hometown: null,
    burial_place: null,
    biography: null,
  }
}

function makeMapped(
  rowIndex: number,
  fullName: string,
  opts: { father?: string; mother?: string; spouse?: string; nickname?: string } = {},
): FamilyMapped {
  return {
    person: makePerson(fullName, opts.nickname ?? null),
    rowIndex,
    fatherName: opts.father ?? null,
    motherName: opts.mother ?? null,
    spouseName: opts.spouse ?? null,
  }
}

test('resolveRelationships — khop bo trong file (bo_me_con, parentIsTarget=true, target la bo)', () => {
  const mapped = [makeMapped(0, 'Nguyễn Văn A', { father: 'Nguyễn Văn Ông' }), makeMapped(1, 'Nguyễn Văn Ông')]
  const rel = resolveRelationships(mapped, [])
  const item = rel.find((r) => r.fromRow === 0 && r.kind === 'bo_me_con')

  assert.ok(item)
  assert.equal(item?.status, 'ok')
  assert.equal(item?.targetRow, 1)
  assert.equal(item?.targetExistingId, null)
  assert.equal(item?.parentIsTarget, true)
})

test('resolveRelationships — vo chong A<->B chi tao 1 quan he (dedupe theo cap)', () => {
  const mapped = [makeMapped(0, 'A', { spouse: 'B' }), makeMapped(1, 'B', { spouse: 'A' })]
  const rel = resolveRelationships(mapped, [])
  const spouseItems = rel.filter((r) => r.kind === 'vo_chong')

  assert.equal(spouseItems.length, 1)
  assert.equal(spouseItems[0].status, 'ok')
})

test('resolveRelationships — trung ten trong file -> ambiguous', () => {
  const mapped = [
    makeMapped(0, 'Con', { father: 'Trùng Tên' }),
    makeMapped(1, 'Trùng Tên'),
    makeMapped(2, 'Trùng Tên'),
  ]
  const rel = resolveRelationships(mapped, [])
  const item = rel.find((r) => r.fromRow === 0)

  assert.equal(item?.status, 'ambiguous')
})

test('resolveRelationships — khong tim thay ten -> not_found', () => {
  const mapped = [makeMapped(0, 'Con', { father: 'Không Tồn Tại' })]
  const rel = resolveRelationships(mapped, [])
  const item = rel.find((r) => r.fromRow === 0)

  assert.equal(item?.status, 'not_found')
})

test('resolveRelationships — khop nguoi da co san trong dong ho -> targetExistingId', () => {
  const mapped = [makeMapped(0, 'Con', { father: 'Ông Ngoại' })]
  const existing: ExistingFamilyPerson[] = [{ id: 'existing-1', full_name: 'Ông Ngoại', nickname: null }]
  const rel = resolveRelationships(mapped, existing)
  const item = rel.find((r) => r.fromRow === 0)

  assert.equal(item?.status, 'ok')
  assert.equal(item?.targetExistingId, 'existing-1')
  assert.equal(item?.targetRow, null)
})

test('resolveRelationships — tu tham chieu (ten trung voi chinh minh) -> not_found', () => {
  const mapped = [makeMapped(0, 'A', { father: 'A' })]
  const rel = resolveRelationships(mapped, [])
  const item = rel.find((r) => r.fromRow === 0)

  assert.equal(item?.status, 'not_found')
})

test('buildFamilyDedupePlan — nguoi khop trung voi danh ba co san duoc danh dau in_family_tree', async () => {
  const { buildFamilyDedupePlan, mapFamilyRow } = await import('../src/lib/importFamily.ts')
  const mapping = [{ header: 'Họ tên', field: 'full_name' as const }]
  const row = mapFamilyRow({ 'Họ tên': 'Nguyễn Văn A' }, mapping, 0)
  assert.ok('ok' in row)
  const existing = [
    { id: 'id-1', phone: null, email: null, full_name: 'Nguyễn Văn A', birthday: null },
  ]
  const plan = buildFamilyDedupePlan([row.ok], existing)
  assert.equal(plan.inserts.length, 0)
  assert.equal(plan.updates.length, 1)
  assert.equal(plan.updates[0].id, 'id-1')
  assert.equal(plan.updates[0].patch.in_family_tree, true)
  assert.deepEqual(plan.updateRowIndexes, [0])
})
