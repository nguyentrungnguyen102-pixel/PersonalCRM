// Su kien cuoc doi (bang life_events) — dong doi cho tung nguoi, dung o
// PersonProfile.tsx (gop voi interactions) va PersonPanel.tsx (gia pha, khong
// co interactions). insert KHONG set created_by tuong minh — cot nay co
// default auth.uid() o DB (giong pattern InteractionFormModal.tsx).

import type { ReactNode } from 'react'
import type { TimelineItem } from '../components/Timeline'
import { formatLunar } from './lunar'
import { supabase } from './supabase'

export interface LifeEvent {
  id: string
  person_id: string
  event_date: string | null
  event_year: number | null
  title: string
  note: string | null
  kind: string | null
  created_by: string | null
  created_at: string
}

export const LIFE_EVENT_KINDS = ['sinh', 'mat', 'hoc_hanh', 'su_nghiep', 'hon_nhan', 'khac'] as const
export type LifeEventKind = (typeof LIFE_EVENT_KINDS)[number]

export async function fetchLifeEvents(personId: string): Promise<LifeEvent[]> {
  const { data, error } = await supabase
    .from('life_events')
    .select('*')
    .eq('person_id', personId)

  if (error || !data) return []
  return data as LifeEvent[]
}

export interface LifeEventInput {
  person_id: string
  title: string
  kind: string | null
  note: string | null
  event_date: string | null
  event_year: number | null
}

export async function createLifeEvent(input: LifeEventInput) {
  return supabase.from('life_events').insert(input)
}

export async function updateLifeEvent(id: string, patch: Partial<LifeEventInput>) {
  return supabase.from('life_events').update(patch).eq('id', id)
}

export async function deleteLifeEvent(id: string) {
  return supabase.from('life_events').delete().eq('id', id)
}

// Sap xep dong doi moi -> cu: uu tien ngay day du, roi toi nam (bia ve
// 01/01 chi de sap xep, KHONG hien thi ra ngoai), cuoi cung la created_at
// (su kien khong ro thoi gian van co vi tri on dinh, xep theo luc tao).
export function lifeEventSortKey(e: Pick<LifeEvent, 'event_date' | 'event_year' | 'created_at'>): string {
  if (e.event_date) return e.event_date
  if (e.event_year != null) return `${e.event_year}-01-01`
  return e.created_at
}

function formatDateDMY(value: string | null): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, yyyy, mm, dd] = match
  return `${dd}/${mm}/${yyyy}`
}

export function lifeEventToTimelineItem(
  event: LifeEvent,
  t: (path: string) => string,
  actions?: ReactNode,
): TimelineItem {
  const dateLabel =
    formatDateDMY(event.event_date) ?? (event.event_year != null ? String(event.event_year) : '')
  return {
    id: event.id,
    chipLabel: event.kind ? t(`life_event.kind_${event.kind}`) : undefined,
    dateLabel,
    title: event.title,
    note: event.note ?? undefined,
    actions,
  }
}

// Nguoi (tu PersonSafe/PersonWithMeta) can cac truong nay de suy ra 2 su kien
// "ao" (khong luu bang life_events): sinh va mat — chi lay tu du lieu SAN CO
// tren ho so (birthday/birth_year, death_date/death_year, death_lunar_*).
export interface ComputedEventPerson {
  birthday: string | null
  birth_year: number | null
  death_date: string | null
  death_year: number | null
  death_lunar_day: number | null
  death_lunar_month: number | null
}

// Sinh tu person.birthday (uu tien) hoac birth_year; mat tu death_date (uu
// tien) hoac death_year, kem dong gio am lich trong note neu co cap
// death_lunar_day/month. Chi tra ve entry cho du lieu THUC SU co — khong bia
// gia tri rong.
export function buildComputedEvents(
  person: ComputedEventPerson,
  t: (path: string) => string,
): TimelineItem[] {
  const items: TimelineItem[] = []

  const birthLabel = formatDateDMY(person.birthday) ?? (person.birth_year != null ? String(person.birth_year) : null)
  if (birthLabel) {
    items.push({
      id: 'computed-birth',
      icon: '👶',
      chipLabel: t('life_event.kind_sinh'),
      dateLabel: birthLabel,
      title: t('life_event.kind_sinh'),
    })
  }

  const deathLabel = formatDateDMY(person.death_date) ?? (person.death_year != null ? String(person.death_year) : null)
  if (deathLabel) {
    const hasLunarPair = person.death_lunar_day != null && person.death_lunar_month != null
    const note = hasLunarPair
      ? `${formatLunar(person.death_lunar_day as number, person.death_lunar_month as number)} ${t('person.lunar_suffix')}`
      : undefined
    items.push({
      id: 'computed-death',
      icon: '🕯',
      chipLabel: t('life_event.kind_mat'),
      dateLabel: deathLabel,
      title: t('life_event.kind_mat'),
      note,
    })
  }

  return items
}

// Sort key tuong ung cho 2 entry "ao" cua buildComputedEvents — dung de gop
// chung vao 1 danh sach sap xep voi life_events/interactions (xem
// PersonProfile.tsx va PersonPanel.tsx). Tra ve object rong neu khong co
// entry nao (giu it nhat 1 trong hai truong hop birthday/birth_year hoac
// death_date/death_year).
export function computedEventSortKeys(person: ComputedEventPerson): Record<string, string> {
  const keys: Record<string, string> = {}

  if (person.birthday) keys['computed-birth'] = person.birthday
  else if (person.birth_year != null) keys['computed-birth'] = `${person.birth_year}-01-01`

  if (person.death_date) keys['computed-death'] = person.death_date
  else if (person.death_year != null) keys['computed-death'] = `${person.death_year}-01-01`

  return keys
}
