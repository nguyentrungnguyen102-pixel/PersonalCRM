// Thuat toan layout "cay gia pha" — logic thuan, khong phu thuoc React/DOM.
// Dau vao la cac dong quan he (relationships) + 1 "root" (nguoi goc); dau ra
// la toa do (x,y) tinh san cho tung nguoi + danh sach canh de ve.
//
// QUY UOC (doc ky truoc khi sua):
// - Chi 4 loai quan he duoc coi la "gia dinh" cho cay: vo_chong, bo_me_con,
//   anh_chi_em, ong_ba_chau (giong flag `family` cua relation_types, nhung
//   ta chi can 4 gia tri nay vi day la cay HUYET THONG/HON NHAN, khong ve
//   dong_nghiep/doi_tac du chung cung co the family=true trong tuong lai).
// - The (gen = generation): so nho hon o TREN. Quy uoc CHIEU dua vao
//   relation_type + thu tu person_a/person_b trong tung dong (KHONG dua vao
//   direction_label_a_to_b/b_to_a — 2 cot do chi la van ban hien thi, nguoi
//   dung co the sua tay ma khong doi cau truc bang):
//     - bo_me_con: person_a la bo/me ("be tren"), person_b la con → con
//       thap hon bo/me dung 1 the.
//     - ong_ba_chau: person_a la ong/ba, person_b la chau → chau thap hon
//       ong/ba dung 2 the.
//     - vo_chong, anh_chi_em: 2 nguoi CUNG the (delta = 0).
// - The duoc gan bang BFS tu root (an toan voi do thi co chu trinh nho vi
//   BFS chi gan the cho nguoi CHUA tung gap, khong sua lai neu co mau thuan
//   du lieu — de bai khong yeu cau xu ly mau thuan, chi can khong chong node).
//
// LAYOUT TOA DO X: xem moi nguoi la 1 "don vi" (unit) — 2 vo chong ghep
// thanh 1 unit de luon dung canh nhau, nguoi doc than la unit rieng. Dat vi
// tri kieu cay (thuat toan Reingold–Tilford don gian hoa): don vi la "la"
// (khong co con nao) thi chiem 1 (hoac 2, neu la cap) o ngang lien tiep tinh
// theo con tro (cursor) toan cuc tang dan; don vi co con thi dat o giua
// (trung diem min/max) cua cac con no — dam bao khong chong lan vi cac
// nhanh con luon chiem 1 khoang cursor rieng, roi con o tren chi "noi" vao
// giua khoang do chu khong xin them cho.

import type { RelationshipRow } from './relations'

export const FAMILY_RELATION_TYPES = new Set(['vo_chong', 'bo_me_con', 'anh_chi_em', 'ong_ba_chau'])

// Delta so the khi di TU person_a SANG person_b theo dung chieu luu trong
// bang (mac dinh 0 = cung the, ap dung cho vo_chong/anh_chi_em).
const GEN_DELTA_A_TO_B: Record<string, number> = {
  bo_me_con: 1,
  ong_ba_chau: 2,
}

export const NODE_W = 150
export const CARD_H = 76
export const GAP = 40
export const ROW_H = 150
const SLOT = NODE_W + GAP

export interface FamilyLayoutNode {
  id: string
  x: number
  y: number
  gen: number
}

export interface FamilyLayoutEdge {
  type: 'couple' | 'parent' | 'other'
  from: string
  to: string
  // Chi co y nghia voi type 'parent': true = nguoi `from` co vo/chong cung
  // xuat hien trong cay (con `to` la con chung) → renderer nen ve duong noi
  // xuat phat tu TRUNG DIEM cua cap vo chong thay vi tu rieng nguoi `from`.
  midFrom?: boolean
}

export interface FamilyLayoutResult {
  nodes: FamilyLayoutNode[]
  edges: FamilyLayoutEdge[]
}

type FamilyRelRow = Pick<RelationshipRow, 'person_a' | 'person_b' | 'relation_type'>

interface AdjEdge {
  other: string
  deltaToOther: number
}

export interface LayoutFamilyTreeOptions {
  // Khi co: dung de sap xep 2 nguoi trong 1 cap vo chong — 'nam' luon ben
  // trai (member[0]), khong ro/khuyet gioi tinh thi lui ve sap theo id (nhu
  // khi khong truyen opts). Khong anh huong callers khong truyen opts (Diagram).
  genderOf?: (id: string) => 'nam' | 'nu' | null
}

/**
 * Tinh layout cay gia pha cho thanh phan lien thong (trong cac quan he gia
 * dinh) chua `rootId`. Tra ve { nodes: [], edges: [] } neu root khong co
 * quan he gia dinh nao ket noi toi (empty state `diagram.empty_family`).
 */
export function layoutFamilyTree(
  relationships: FamilyRelRow[],
  personIds: Set<string>,
  rootId: string,
  opts?: LayoutFamilyTreeOptions,
): FamilyLayoutResult {
  if (!personIds.has(rootId)) return { nodes: [], edges: [] }

  const familyRels = relationships.filter(
    (r) =>
      FAMILY_RELATION_TYPES.has(r.relation_type) &&
      personIds.has(r.person_a) &&
      personIds.has(r.person_b),
  )
  if (familyRels.length === 0) return { nodes: [], edges: [] }

  // --- 1. Ke va gan the bang BFS tu root ---------------------------------
  const adj = new Map<string, AdjEdge[]>()
  function pushAdj(from: string, to: string, delta: number) {
    if (!adj.has(from)) adj.set(from, [])
    adj.get(from)!.push({ other: to, deltaToOther: delta })
  }
  for (const r of familyRels) {
    const delta = GEN_DELTA_A_TO_B[r.relation_type] ?? 0
    pushAdj(r.person_a, r.person_b, delta)
    pushAdj(r.person_b, r.person_a, -delta)
  }

  const gen = new Map<string, number>()
  gen.set(rootId, 0)
  const queue: string[] = [rootId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    const curGen = gen.get(cur)!
    for (const e of adj.get(cur) ?? []) {
      if (gen.has(e.other)) continue
      gen.set(e.other, curGen + e.deltaToOther)
      queue.push(e.other)
    }
  }

  if (gen.size <= 1) return { nodes: [], edges: [] } // root le loi, khong co ai ket noi

  // --- 2. Cap vo chong (chi lay 1 cap dau tien cho moi nguoi) ------------
  const partnerOf = new Map<string, string>()
  for (const r of familyRels) {
    if (r.relation_type !== 'vo_chong') continue
    if (!gen.has(r.person_a) || !gen.has(r.person_b)) continue
    if (!partnerOf.has(r.person_a)) partnerOf.set(r.person_a, r.person_b)
    if (!partnerOf.has(r.person_b)) partnerOf.set(r.person_b, r.person_a)
  }

  function unitKeyOf(id: string): string {
    const partner = partnerOf.get(id)
    if (!partner || !gen.has(partner)) return id
    return id < partner ? id : partner
  }

  const unitMembers = new Map<string, string[]>()
  for (const id of gen.keys()) {
    const key = unitKeyOf(id)
    const members = unitMembers.get(key)
    if (!members) unitMembers.set(key, [id])
    else if (!members.includes(id)) members.push(id)
  }
  // Sap xep on dinh de xac dinh nguoi nao ben trai/phai trong cap: neu co
  // opts.genderOf thi 'nam' luon dung truoc (ben trai), khong ro/khuyet gioi
  // tinh thi lui ve sap theo id — dung het opts.genderOf khong duoc truyen
  // (Diagram) thi ket qua giong het `.sort()` mac dinh cu.
  const genderOf = opts?.genderOf
  for (const members of unitMembers.values()) {
    members.sort((a, b) => {
      if (genderOf) {
        const ga = genderOf(a)
        const gb = genderOf(b)
        if (ga === 'nam' && gb !== 'nam') return -1
        if (gb === 'nam' && ga !== 'nam') return 1
      }
      return a < b ? -1 : a > b ? 1 : 0
    })
  }

  // --- 3. Quan he "be tren -> con" quy ve unit (bo_me_con/ong_ba_chau) ---
  const childUnitsOf = new Map<string, string[]>()
  const parentUnitsOfChild = new Map<string, string[]>()
  for (const r of familyRels) {
    if (r.relation_type !== 'bo_me_con' && r.relation_type !== 'ong_ba_chau') continue
    if (!gen.has(r.person_a) || !gen.has(r.person_b)) continue
    const pUnit = unitKeyOf(r.person_a)
    const cUnit = unitKeyOf(r.person_b)
    if (pUnit === cUnit) continue
    const kids = childUnitsOf.get(pUnit)
    if (!kids) childUnitsOf.set(pUnit, [cUnit])
    else if (!kids.includes(cUnit)) kids.push(cUnit)
    const parents = parentUnitsOfChild.get(cUnit)
    if (!parents) parentUnitsOfChild.set(cUnit, [pUnit])
    else if (!parents.includes(pUnit)) parents.push(pUnit)
  }

  // --- 4. Dat toa do X kieu cay (DFS hau thu, cursor toan cuc) -----------
  const personX = new Map<string, number>()
  const visited = new Set<string>()
  let cursor = 0

  function place(unitKey: string) {
    if (visited.has(unitKey)) return
    visited.add(unitKey)
    const members = unitMembers.get(unitKey) ?? [unitKey]
    const kids = (childUnitsOf.get(unitKey) ?? []).filter((k) => !visited.has(k))

    if (kids.length === 0) {
      const startSlot = cursor
      cursor += members.length
      members.forEach((id, i) => personX.set(id, (startSlot + i) * SLOT))
      return
    }

    for (const k of kids) place(k)
    const childXs = kids
      .flatMap((k) => unitMembers.get(k) ?? [k])
      .map((id) => personX.get(id))
      .filter((v): v is number => v !== undefined)
    const mid = childXs.length > 0 ? (Math.min(...childXs) + Math.max(...childXs)) / 2 : cursor * SLOT

    if (members.length === 2) {
      personX.set(members[0], mid - SLOT / 2)
      personX.set(members[1], mid + SLOT / 2)
    } else {
      personX.set(members[0], mid)
    }
  }

  const allUnitKeys = Array.from(unitMembers.keys())
  // "Goc rung": don vi khong co unit cha nao (in-degree 0) — thuong la nhanh
  // to tien xa nhat trong thanh phan lien thong cua root. Thu tu duyet giu
  // theo thu tu phat hien BFS (Map insertion order) — du dung, khong can toi uu.
  const rootUnits = allUnitKeys.filter((k) => !(parentUnitsOfChild.get(k)?.length))
  for (const key of rootUnits) place(key)
  // Phong ho: don vi con lai chua duoc dat (vi du vong lap du lieu hiem gap).
  for (const key of allUnitKeys) if (!visited.has(key)) place(key)

  // --- 5. Chuan hoa toa do (bat dau tu 0) va xuat ket qua ----------------
  const gens = Array.from(gen.values())
  const minGen = Math.min(...gens)
  const xs = Array.from(personX.values())
  const minX = xs.length > 0 ? Math.min(...xs) : 0
  const PAD_X = NODE_W / 2
  const PAD_Y = NODE_W / 2

  const nodes: FamilyLayoutNode[] = Array.from(gen.keys()).map((id) => ({
    id,
    x: (personX.get(id) ?? 0) - minX + PAD_X,
    y: (gen.get(id)! - minGen) * ROW_H + PAD_Y,
    gen: gen.get(id)! - minGen,
  }))

  const edges: FamilyLayoutEdge[] = []
  for (const r of familyRels) {
    if (!gen.has(r.person_a) || !gen.has(r.person_b)) continue
    if (r.relation_type === 'vo_chong') {
      edges.push({ type: 'couple', from: r.person_a, to: r.person_b })
    } else if (r.relation_type === 'bo_me_con' || r.relation_type === 'ong_ba_chau') {
      const partner = partnerOf.get(r.person_a)
      const midFrom = !!partner && gen.has(partner)
      edges.push({ type: 'parent', from: r.person_a, to: r.person_b, midFrom })
    } else if (r.relation_type === 'anh_chi_em') {
      edges.push({ type: 'other', from: r.person_a, to: r.person_b })
    }
  }

  return { nodes, edges }
}

// --- computeFamilySides: gan nguoi vao "phia" (chong/vo/con chung) --------
//
// Dung cho trang /gia-pha de to mau vien the hien nguoi nay thuoc phia nao
// (xem GiaPha.tsx). Thuat toan (dung QUY UOC trong opts o dau file cho
// person_a/person_b cua tung loai quan he):
//   1. Gieo mam: rootA -> 'a'; rootB -> 'b' (neu co).
//   2. BFS XUOI (chi bo_me_con/ong_ba_chau, person_a -> person_b) bat dau tu
//      {rootA, rootB} — moi nguoi con toi duoc gan 'chung'; khi 1 nguoi duoc
//      gan 'chung', vo/chong cua ho (vo_chong) cung thanh 'chung' va BFS
//      tiep tuc xuoi tu ho (dau re con dau/re cung la con chau chung).
//   3. BFS tu rootA tren TOAN BO quan he gia dinh (khong phan biet chieu),
//      bo qua rootB va bo qua nguoi da co nhan (khong ghi de) -> gan 'a'.
//      Lam tuong tu tu rootB (bo qua rootA) -> gan 'b'.
//   4. Nguoi khong duoc cham toi o ca 3 buoc tren thi khong co trong ket qua
//      (absent khoi Map).
export type FamilySide = 'a' | 'b' | 'chung'

export function computeFamilySides(
  relationships: FamilyRelRow[],
  personIds: Set<string>,
  rootA: string,
  rootB: string | null,
): Map<string, FamilySide> {
  const result = new Map<string, FamilySide>()
  if (!personIds.has(rootA)) return result

  const familyRels = relationships.filter(
    (r) =>
      FAMILY_RELATION_TYPES.has(r.relation_type) &&
      personIds.has(r.person_a) &&
      personIds.has(r.person_b),
  )

  const validRootB = rootB && personIds.has(rootB) ? rootB : null

  result.set(rootA, 'a')
  if (validRootB) result.set(validRootB, 'b')

  // --- 1. BFS xuoi tu {rootA, rootB} -> 'chung' --------------------------
  const downAdj = new Map<string, string[]>() // cha/ong ba -> con/chau
  const spouseAdj = new Map<string, string[]>() // vo_chong, 2 chieu
  for (const r of familyRels) {
    if (r.relation_type === 'bo_me_con' || r.relation_type === 'ong_ba_chau') {
      if (!downAdj.has(r.person_a)) downAdj.set(r.person_a, [])
      downAdj.get(r.person_a)!.push(r.person_b)
    } else if (r.relation_type === 'vo_chong') {
      if (!spouseAdj.has(r.person_a)) spouseAdj.set(r.person_a, [])
      spouseAdj.get(r.person_a)!.push(r.person_b)
      if (!spouseAdj.has(r.person_b)) spouseAdj.set(r.person_b, [])
      spouseAdj.get(r.person_b)!.push(r.person_a)
    }
  }

  const seeds = validRootB ? [rootA, validRootB] : [rootA]
  const visitedDown = new Set<string>(seeds)
  const downQueue: string[] = [...seeds]

  while (downQueue.length > 0) {
    const cur = downQueue.shift()!
    for (const child of downAdj.get(cur) ?? []) {
      if (visitedDown.has(child)) continue
      visitedDown.add(child)
      result.set(child, 'chung')
      downQueue.push(child)
    }
    // Vo/chong cua nguoi 'chung' cung la 'chung' (dau re/con dau) — root
    // ban than khong phai 'chung' nen khong lan qua vo/chong cua root o day.
    if (result.get(cur) === 'chung') {
      for (const spouse of spouseAdj.get(cur) ?? []) {
        if (visitedDown.has(spouse)) continue
        visitedDown.add(spouse)
        result.set(spouse, 'chung')
        downQueue.push(spouse)
      }
    }
  }

  // --- 2. BFS khong phan biet chieu tu rootA (bo qua rootB) -> 'a' ------
  //        va tu rootB (bo qua rootA) -> 'b'. Khong ghi de nhan da co.
  const undirectedAdj = new Map<string, string[]>()
  for (const r of familyRels) {
    if (!undirectedAdj.has(r.person_a)) undirectedAdj.set(r.person_a, [])
    undirectedAdj.get(r.person_a)!.push(r.person_b)
    if (!undirectedAdj.has(r.person_b)) undirectedAdj.set(r.person_b, [])
    undirectedAdj.get(r.person_b)!.push(r.person_a)
  }

  function bfsSide(start: string, side: FamilySide, skip: string | null) {
    const visited = new Set<string>([start])
    const queue: string[] = [start]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const other of undirectedAdj.get(cur) ?? []) {
        if (other === skip) continue
        if (visited.has(other)) continue
        visited.add(other)
        // KHONG lan xuyen qua nguoi da la 'chung': neu co canh noi tat (vd
        // ong_ba_chau tu ong ba ngoai toi chau chung), BFS phia A chay truoc
        // se vong qua con chau chung roi gan nham ho hang phia B thanh 'a'.
        // Ho hang moi phia van duoc gan du tu chinh root phia do (buoc BFS
        // rieng ben duoi); ai chi toi duoc qua nhanh con chau chung (vd thong
        // gia — bo me cua con dau/re) thi de trung lap (absent = mau trung tinh).
        if (result.get(other) === 'chung') continue
        if (!result.has(other)) result.set(other, side)
        queue.push(other)
      }
    }
  }

  bfsSide(rootA, 'a', validRootB)
  if (validRootB) bfsSide(validRootB, 'b', rootA)

  return result
}
