// Test cho src/lib/familyLayout.ts (computeFamilySides + gender ordering) —
// chay bang node:test, khong phu thuoc ngoai.
// Chay: npm run test:unit (node --experimental-strip-types --test scripts/*.test.ts)

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeFamilySides, layoutFamilyTree } from '../src/lib/familyLayout.ts'

interface Rel {
  person_a: string
  person_b: string
  relation_type: string
}

function rel(a: string, type: string, b: string): Rel {
  return { person_a: a, person_b: b, relation_type: type }
}

// Gia dinh mau: chong (C) + vo (V) la cap goc; con chung K1 (co vo la D —
// con dau), chau chung Ch (con cua K1); bo me chong (BC/MC), bo me vo (BV/MV),
// em trai chong (EC), chi gai vo (CV).
const IDS = ['C', 'V', 'K1', 'D', 'Ch', 'BC', 'MC', 'BV', 'MV', 'EC', 'CV']
const BASE_RELS: Rel[] = [
  rel('C', 'vo_chong', 'V'),
  rel('C', 'bo_me_con', 'K1'),
  rel('V', 'bo_me_con', 'K1'),
  rel('K1', 'vo_chong', 'D'),
  rel('K1', 'bo_me_con', 'Ch'),
  rel('BC', 'bo_me_con', 'C'),
  rel('MC', 'bo_me_con', 'C'),
  rel('BV', 'bo_me_con', 'V'),
  rel('MV', 'bo_me_con', 'V'),
  rel('C', 'anh_chi_em', 'EC'),
  rel('V', 'anh_chi_em', 'CV'),
]

test('computeFamilySides — phan phia dung cho gia dinh 3 doi du 2 ben', () => {
  const sides = computeFamilySides(BASE_RELS, new Set(IDS), 'C', 'V')

  assert.equal(sides.get('C'), 'a')
  assert.equal(sides.get('V'), 'b')
  // Con chau chung + dau/re
  assert.equal(sides.get('K1'), 'chung')
  assert.equal(sides.get('D'), 'chung')
  assert.equal(sides.get('Ch'), 'chung')
  // Phia chong
  assert.equal(sides.get('BC'), 'a')
  assert.equal(sides.get('MC'), 'a')
  assert.equal(sides.get('EC'), 'a')
  // Phia vo
  assert.equal(sides.get('BV'), 'b')
  assert.equal(sides.get('MV'), 'b')
  assert.equal(sides.get('CV'), 'b')
})

test('computeFamilySides — canh ong_ba_chau noi tat khong keo ho hang phia vo sang phia chong', () => {
  // Them canh noi tat: ong ba ngoai (BV/MV) <-> chau chung (Ch). Truoc khi
  // sua loi, BFS phia A (chay truoc) lan qua K1/Ch roi gan nham BV/MV = 'a'.
  const rels = [...BASE_RELS, rel('BV', 'ong_ba_chau', 'Ch'), rel('MV', 'ong_ba_chau', 'Ch')]
  const sides = computeFamilySides(rels, new Set(IDS), 'C', 'V')

  assert.equal(sides.get('BV'), 'b')
  assert.equal(sides.get('MV'), 'b')
  assert.equal(sides.get('Ch'), 'chung')
})

test('computeFamilySides — khong co rootB: chi co phia a + con chau chung', () => {
  const sides = computeFamilySides(BASE_RELS, new Set(IDS), 'C', null)
  assert.equal(sides.get('C'), 'a')
  assert.equal(sides.get('K1'), 'chung')
  assert.equal(sides.get('Ch'), 'chung')
  assert.equal(sides.get('BC'), 'a')
  // Khong bi chan boi rootB nen phia vo van toi duoc qua canh vo_chong C-V.
  assert.equal(sides.get('V'), 'a')
})

test('layoutFamilyTree — genderOf dat nam ben trai trong cap vo chong', () => {
  // Dat id sao cho sort id mac dinh se cho V (id 'A-vo') dung truoc C ('Z-chong')
  // — genderOf phai dao lai duoc.
  const ids = new Set(['Z-chong', 'A-vo', 'K'])
  const rels: Rel[] = [
    rel('Z-chong', 'vo_chong', 'A-vo'),
    rel('Z-chong', 'bo_me_con', 'K'),
  ]
  const gender = (id: string): 'nam' | 'nu' | null =>
    id === 'Z-chong' ? 'nam' : id === 'A-vo' ? 'nu' : null

  const withGender = layoutFamilyTree(rels, ids, 'Z-chong', { genderOf: gender })
  const xChong = withGender.nodes.find((n) => n.id === 'Z-chong')!.x
  const xVo = withGender.nodes.find((n) => n.id === 'A-vo')!.x
  assert.ok(xChong < xVo, 'nam phai o ben trai (x nho hon)')

  // Khong truyen opts: giu sort id cu (A-vo truoc) — tuong thich nguoc Diagram.
  const withoutOpts = layoutFamilyTree(rels, ids, 'Z-chong')
  const xChong2 = withoutOpts.nodes.find((n) => n.id === 'Z-chong')!.x
  const xVo2 = withoutOpts.nodes.find((n) => n.id === 'A-vo')!.x
  assert.ok(xVo2 < xChong2, 'khong co genderOf thi sort theo id nhu cu')
})
