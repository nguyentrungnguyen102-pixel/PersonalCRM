// Quan he giua 2 nguoi (bang `relationships`) — kieu HubSpot associations:
// 1 dong luu 2 chieu nhan (direction_label_a_to_b / direction_label_b_to_a),
// UI tu chon dung chieu de hien thi tuy theo dang xem ho so ai.
//
// QUY UOC HIEN THI CHIEU (quan trong, doc ky truoc khi sua):
// Voi 1 dong quan he (A = person_a, B = person_b), dang xem ho so P, nguoi
// con lai trong dong la K (K = A hoac K = B, vi A<>B luon dung 1 trong 2).
//   - Neu K = A (tuc P = B): nhan hien thi = direction_label_a_to_b, vi cot
//     nay luu nghia "A la [nhan] doi voi B" → doc thanh "K la [nhan] cua P".
//     VD: direction_label_a_to_b = "bo/me cua" → hien "K — bo/me cua" nghia
//     la "K la bo/me cua P".
//   - Neu K = B (tuc P = A): nhan hien thi = direction_label_b_to_a, cung ly
//     do doi xung ("B la [nhan] doi voi A" → "K la [nhan] cua P").
// Noi cach khac: nhan hien thi luon la nhan gan VOI PHIA CUA K trong cap
// (a_to_b neu K dung vi tri A, b_to_a neu K dung vi tri B).
import { displayName } from './displayName'
import { supabase } from './supabase'
import type { GroupType } from './types'

export interface RelationType {
  value: string
  label: string
  family: boolean
  direction: 'same' | 'down'
  label_a_to_b: string
  label_b_to_a: string
}

export interface RelationshipRow {
  id: string
  person_a: string
  person_b: string
  relation_type: string
  direction_label_a_to_b: string
  direction_label_b_to_a: string
  note: string | null
  created_by: string | null
  created_at: string
}

export interface RelationView {
  id: string
  otherId: string
  otherName: string
  otherAvatarUrl: string | null
  otherGroupType: GroupType | null
  label: string
  note: string | null
  createdBy: string | null
  relationType: string
}

// Cache don gian o module-level — relation_types la du lieu tinh, hiem khi
// doi trong 1 phien lam viec; useSettings() khong load san key nay nen tu
// fetch + cache tai day de tranh goi lai nhieu lan khi mo modal.
let relationTypesCache: RelationType[] | null = null
let relationTypesPromise: Promise<RelationType[]> | null = null

async function loadRelationTypes(): Promise<RelationType[]> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'relation_types')
    .maybeSingle()

  const types = !error && data ? ((data.value as RelationType[]) ?? []) : []
  relationTypesCache = types
  return types
}

export async function fetchRelationTypes(): Promise<RelationType[]> {
  if (relationTypesCache) return relationTypesCache
  if (relationTypesPromise) return relationTypesPromise

  relationTypesPromise = loadRelationTypes()
  return relationTypesPromise
}

interface OtherPersonRow {
  id: string
  nickname: string | null
  full_name: string
  avatar_url: string | null
  group_type: GroupType
}

export async function fetchRelationships(
  personId: string,
  canEdit: boolean,
): Promise<RelationView[]> {
  const { data: rows, error } = await supabase
    .from('relationships')
    .select('*')
    .or(`person_a.eq.${personId},person_b.eq.${personId}`)

  if (error || !rows || rows.length === 0) return []

  const relationships = rows as RelationshipRow[]

  const otherIds = Array.from(
    new Set(relationships.map((r) => (r.person_a === personId ? r.person_b : r.person_a))),
  )

  if (otherIds.length === 0) return []

  const personsTable = canEdit ? 'persons' : 'persons_safe'
  const { data: peopleData, error: peopleError } = await supabase
    .from(personsTable)
    .select('id, nickname, full_name, avatar_url, group_type')
    .in('id', otherIds)

  const peopleMap = new Map<string, OtherPersonRow>()
  if (!peopleError && peopleData) {
    for (const p of peopleData as OtherPersonRow[]) {
      peopleMap.set(p.id, p)
    }
  }

  return relationships.map((r) => {
    const otherId = r.person_a === personId ? r.person_b : r.person_a
    const other = peopleMap.get(otherId)
    // Xem quy uoc chieu o dau file: K = other, P = personId.
    const label = r.person_a === personId ? r.direction_label_b_to_a : r.direction_label_a_to_b

    return {
      id: r.id,
      otherId,
      otherName: other ? displayName(other) : '',
      otherAvatarUrl: other?.avatar_url ?? null,
      otherGroupType: other?.group_type ?? null,
      label,
      note: r.note,
      createdBy: r.created_by,
      relationType: r.relation_type,
    }
  })
}

export interface CreateRelationshipInput {
  personA: string
  personB: string
  type: string
  labelAB: string
  labelBA: string
  note: string | null
}

export async function createRelationship(input: CreateRelationshipInput) {
  return supabase.from('relationships').insert({
    person_a: input.personA,
    person_b: input.personB,
    relation_type: input.type,
    direction_label_a_to_b: input.labelAB,
    direction_label_b_to_a: input.labelBA,
    note: input.note,
  })
}

export async function deleteRelationship(id: string) {
  return supabase.from('relationships').delete().eq('id', id)
}

// Lay du lieu 2-hop quanh 1 nguoi de tim goi y bo/me-con: cac dong
// bo_me_con/anh_chi_em cham truc tiep personId, roi mo rong sang cac dong
// cham toi "hang xom" 1-hop cua no (vi goi y can nhin thay ca quan he
// anh-chi-em cua nguoi con truc tiep, thu khong lien quan truc tiep P).
// Gioi han pham vi de tranh keo ca bang relationships ve client.
export async function fetchFamilySuggestionData(personId: string): Promise<RelationshipRow[]> {
  const { data: direct } = await supabase
    .from('relationships')
    .select('*')
    .in('relation_type', ['bo_me_con', 'anh_chi_em'])
    .or(`person_a.eq.${personId},person_b.eq.${personId}`)

  const directRows = (direct as RelationshipRow[]) ?? []

  const neighborIds = new Set<string>()
  for (const r of directRows) {
    neighborIds.add(r.person_a)
    neighborIds.add(r.person_b)
  }
  neighborIds.delete(personId)

  if (neighborIds.size === 0) return directRows

  const orClause = Array.from(neighborIds)
    .map((id) => `person_a.eq.${id},person_b.eq.${id}`)
    .join(',')

  const { data: extended } = await supabase
    .from('relationships')
    .select('*')
    .in('relation_type', ['bo_me_con', 'anh_chi_em'])
    .or(orClause)

  const merged = new Map<string, RelationshipRow>()
  for (const r of [...directRows, ...((extended as RelationshipRow[]) ?? [])]) {
    merged.set(r.id, r)
  }
  return Array.from(merged.values())
}

export interface ParentChildSuggestion {
  parent: string
  child: string
}

// Suy luan don gian: neu A la bo/me cua B (bo_me_con), va B la anh/chi/em
// cua C (anh_chi_em, chieu nao cung duoc vi 'same'), thi rat co the A cung
// la bo/me cua C — goi y neu chua co dong bo_me_con (A,C) nao.
// Chi tra toi da 3 goi y de tranh spam UI.
export function suggestParentChild(relationships: RelationshipRow[]): ParentChildSuggestion[] {
  const parentOf = new Map<string, Set<string>>() // child -> set cha me
  const siblingsOf = new Map<string, Set<string>>() // person -> set anh chi em

  for (const r of relationships) {
    if (r.relation_type === 'bo_me_con') {
      if (!parentOf.has(r.person_b)) parentOf.set(r.person_b, new Set())
      parentOf.get(r.person_b)!.add(r.person_a)
    } else if (r.relation_type === 'anh_chi_em') {
      if (!siblingsOf.has(r.person_a)) siblingsOf.set(r.person_a, new Set())
      if (!siblingsOf.has(r.person_b)) siblingsOf.set(r.person_b, new Set())
      siblingsOf.get(r.person_a)!.add(r.person_b)
      siblingsOf.get(r.person_b)!.add(r.person_a)
    }
  }

  const existingParentChild = new Set(
    relationships
      .filter((r) => r.relation_type === 'bo_me_con')
      .map((r) => `${r.person_a}:${r.person_b}`),
  )

  const suggestions: ParentChildSuggestion[] = []
  const seen = new Set<string>()

  for (const [child, parents] of parentOf) {
    const siblings = siblingsOf.get(child)
    if (!siblings) continue
    for (const parent of parents) {
      for (const sibling of siblings) {
        const key = `${parent}:${sibling}`
        if (existingParentChild.has(key) || seen.has(key)) continue
        seen.add(key)
        suggestions.push({ parent, child: sibling })
        if (suggestions.length >= 3) return suggestions
      }
    }
  }

  return suggestions
}
