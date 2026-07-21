// Panel Ancestry-style ben canh (desktop) / bottom-sheet (mobile) hien ho so
// rut gon 1 nguoi ngay tren trang /gia-pha — khong roi trang, bam vao 1
// nguoi khac trong danh sach quan he se CHUYEN panel sang nguoi do (qua
// onSelectPerson, GiaPha.tsx truyen setPanelPersonId) thay vi mo panel moi.
// Nut "Xem ho so day du" o cuoi moi dieu huong sang /nguoi/:id.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PersonWithMeta } from '../../hooks/usePersons'
import { useLabels } from '../../hooks/useSettings'
import { displayName as personDisplayName } from '../../lib/displayName'
import {
  buildComputedEvents,
  computedEventSortKeys,
  deleteLifeEvent,
  fetchLifeEvents,
  lifeEventSortKey,
  lifeEventToTimelineItem,
} from '../../lib/lifeEvents'
import type { LifeEvent } from '../../lib/lifeEvents'
import { formatLunar, nextLunarAnniversary } from '../../lib/lunar'
import { deleteRelationship } from '../../lib/relations'
import type { RelationshipRow } from '../../lib/relations'
import { Avatar } from '../Avatar'
import { AvatarUpload } from '../AvatarUpload'
import { ConfirmDialog } from '../ConfirmDialog'
import { LifeEventModal } from '../LifeEventModal'
import { Timeline } from '../Timeline'
import type { TimelineItem } from '../Timeline'
import { QuickAddRelative } from './QuickAddRelative'

interface PersonPanelProps {
  personId: string
  persons: Map<string, PersonWithMeta>
  relationships: RelationshipRow[]
  canEdit: boolean
  onClose: () => void
  onChanged: () => void
  onSelectPerson?: (id: string) => void
}

function yearOf(dateStr: string | null): number | null {
  if (!dateStr) return null
  const match = /^(\d{4})-/.exec(dateStr)
  return match ? Number(match[1]) : null
}

// "1932–2001" — uu tien ngay day du, fallback ve nam gan dung
// (birth_year/death_year) khi khong co ngay day du.
function lifespanLabel(p: PersonWithMeta): string | null {
  const birth = yearOf(p.birthday) ?? p.birth_year ?? null
  const death = yearOf(p.death_date) ?? p.death_year ?? null
  if (birth && death) return `${birth}–${death}`
  if (birth) return `${birth}`
  if (death) return `${death}`
  return null
}

function formatDateObj(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

interface RelationRowData {
  relId: string
  otherId: string
}

interface RelationRowProps {
  person: PersonWithMeta
  canEdit: boolean
  onSelect: () => void
  onRemove: () => void
}

function RelationRow({ person, canEdit, onSelect, onRemove }: RelationRowProps) {
  const { t } = useLabels()
  return (
    <div className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-bg/60">
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Avatar name={personDisplayName(person)} avatarUrl={person.avatar_url} size={24} />
        <span className="truncate text-xs text-ink">{personDisplayName(person)}</span>
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('actions.delete')}
          className="flex-shrink-0 rounded-md p-1 text-muted transition-colors hover:text-rose"
        >
          ✕
        </button>
      )}
    </div>
  )
}

interface RelationGroupProps {
  title: string
  rows: RelationRowData[]
  persons: Map<string, PersonWithMeta>
  canEdit: boolean
  onSelect: (id: string) => void
  onRemove: (relId: string) => void
}

function RelationGroup({ title, rows, persons, canEdit, onSelect, onRemove }: RelationGroupProps) {
  if (rows.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] font-medium tracking-[0.6px] text-muted uppercase">{title}</div>
      {rows.map((row) => {
        const other = persons.get(row.otherId)
        if (!other) return null
        return (
          <RelationRow
            key={row.relId}
            person={other}
            canEdit={canEdit}
            onSelect={() => onSelect(row.otherId)}
            onRemove={() => onRemove(row.relId)}
          />
        )
      })}
    </div>
  )
}

export function PersonPanel({
  personId,
  persons,
  relationships,
  canEdit,
  onClose,
  onChanged,
  onSelectPerson,
}: PersonPanelProps) {
  const { t } = useLabels()
  const navigate = useNavigate()

  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([])
  const [lifeEventsReloadKey, setLifeEventsReloadKey] = useState(0)
  const [showLifeEventModal, setShowLifeEventModal] = useState(false)
  const [editingLifeEvent, setEditingLifeEvent] = useState<LifeEvent | null>(null)
  const [deleteEventTarget, setDeleteEventTarget] = useState<LifeEvent | null>(null)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [deleteEventError, setDeleteEventError] = useState<string | null>(null)

  const [removeRelTarget, setRemoveRelTarget] = useState<string | null>(null)
  const [removingRel, setRemovingRel] = useState(false)
  const [removeRelError, setRemoveRelError] = useState<string | null>(null)

  const [quickAddMode, setQuickAddMode] = useState<'parent' | 'spouse' | 'child' | null>(null)

  const refreshLifeEvents = useCallback(() => setLifeEventsReloadKey((k) => k + 1), [])

  useEffect(() => {
    let active = true
    fetchLifeEvents(personId).then((rows) => {
      if (active) setLifeEvents(rows)
    })
    return () => {
      active = false
    }
  }, [personId, lifeEventsReloadKey])

  // Chuyen sang xem nguoi khac (onSelectPerson) trong cung 1 panel — don UI
  // state tam thoi cua nguoi truoc de tranh modal/confirm "dinh" sai ngu canh.
  useEffect(() => {
    setShowLifeEventModal(false)
    setEditingLifeEvent(null)
    setDeleteEventTarget(null)
    setRemoveRelTarget(null)
    setQuickAddMode(null)
  }, [personId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const relevantRels = useMemo(
    () => relationships.filter((r) => r.person_a === personId || r.person_b === personId),
    [relationships, personId],
  )

  const parentRows = useMemo<RelationRowData[]>(
    () =>
      relevantRels
        .filter((r) => r.relation_type === 'bo_me_con' && r.person_b === personId)
        .map((r) => ({ relId: r.id, otherId: r.person_a })),
    [relevantRels, personId],
  )

  const childRows = useMemo<RelationRowData[]>(
    () =>
      relevantRels
        .filter((r) => r.relation_type === 'bo_me_con' && r.person_a === personId)
        .map((r) => ({ relId: r.id, otherId: r.person_b })),
    [relevantRels, personId],
  )

  const spouseRows = useMemo<RelationRowData[]>(
    () =>
      relevantRels
        .filter((r) => r.relation_type === 'vo_chong')
        .map((r) => ({ relId: r.id, otherId: r.person_a === personId ? r.person_b : r.person_a })),
    [relevantRels, personId],
  )

  const person = persons.get(personId)

  if (!person) return null

  const displayName = personDisplayName(person)
  const lifespan = lifespanLabel(person)
  const genderLabel =
    person.gender === 'nam' ? t('person.gender_nam') : person.gender === 'nu' ? t('person.gender_nu') : null

  const hasLunarPair = person.death_lunar_day != null && person.death_lunar_month != null
  const isDeceased = !!(person.death_date || person.death_year != null || hasLunarPair)
  const gioLine = hasLunarPair
    ? `${formatLunar(person.death_lunar_day as number, person.death_lunar_month as number)} ${t(
        'person.lunar_suffix',
      )} — ${formatDateObj(
        nextLunarAnniversary(person.death_lunar_day as number, person.death_lunar_month as number, new Date()),
      )}`
    : null

  async function handleConfirmRemoveRel() {
    if (!removeRelTarget) return
    setRemovingRel(true)
    setRemoveRelError(null)
    const { error } = await deleteRelationship(removeRelTarget)
    setRemovingRel(false)
    if (error) {
      setRemoveRelError(error.message)
      return
    }
    setRemoveRelTarget(null)
    onChanged()
  }

  async function handleDeleteLifeEvent() {
    if (!deleteEventTarget) return
    setDeletingEvent(true)
    setDeleteEventError(null)
    const { error } = await deleteLifeEvent(deleteEventTarget.id)
    setDeletingEvent(false)
    if (error) {
      setDeleteEventError(error.message)
      return
    }
    setDeleteEventTarget(null)
    refreshLifeEvents()
  }

  function lifeEventActions(e: LifeEvent) {
    if (!canEdit) return undefined
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setEditingLifeEvent(e)
            setShowLifeEventModal(true)
          }}
          aria-label={t('actions.edit')}
          className="rounded-md p-0.5 text-muted transition-colors hover:text-ink"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={() => setDeleteEventTarget(e)}
          aria-label={t('actions.delete')}
          className="rounded-md p-0.5 text-muted transition-colors hover:text-rose"
        >
          ✕
        </button>
      </>
    )
  }

  const computedItems = buildComputedEvents(person, t)
  const computedKeys = computedEventSortKeys(person)

  const timelineEntries: { sortKey: string; item: TimelineItem }[] = [
    ...lifeEvents.map((e) => ({
      sortKey: lifeEventSortKey(e),
      item: lifeEventToTimelineItem(e, t, lifeEventActions(e)),
    })),
    ...computedItems.map((item) => ({ sortKey: computedKeys[item.id] ?? '', item })),
  ]
  timelineEntries.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0))
  const timelineItems = timelineEntries.map((e) => e.item)

  const hasFacts = !!(person.hometown || person.burial_place || person.biography)
  const hasAnyRelation = parentRows.length > 0 || spouseRows.length > 0 || childRows.length > 0

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 md:items-stretch md:justify-end"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="anim-slide-up md:anim-slide-in-right flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface md:h-full md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-2xl md:border-y-0 md:border-r-0"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={displayName}
      >
        <div className="flex flex-shrink-0 justify-end border-b border-line px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-md p-1 text-muted transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto" style={{ paddingBottom: 'calc(0px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4">
            <div className="flex items-start gap-3">
              <Avatar name={displayName} avatarUrl={person.avatar_url} size={64} grayscale={isDeceased} />
              <div className="min-w-0 flex-1">
                <div className="font-heading text-base font-bold text-ink">{displayName}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {lifespan && <span className="font-mono text-[11px] text-muted">{lifespan}</span>}
                  {genderLabel && (
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {genderLabel}
                    </span>
                  )}
                </div>
                {gioLine && <div className="mt-1 text-[11px] text-muted">🕯 {gioLine}</div>}
              </div>
            </div>

            {canEdit && (
              <AvatarUpload
                personId={person.id}
                currentUrl={person.avatar_url}
                name={displayName}
                onSaved={onChanged}
              />
            )}
          </div>

          {/* Facts */}
          {hasFacts && (
            <div className="flex flex-col gap-2 border-b border-line px-4 py-3">
              {person.hometown && (
                <div>
                  <div className="mb-0.5 text-[9px] tracking-[0.8px] text-muted uppercase">
                    {t('person.hometown')}
                  </div>
                  <div className="text-xs text-ink">{person.hometown}</div>
                </div>
              )}
              {person.burial_place && (
                <div>
                  <div className="mb-0.5 text-[9px] tracking-[0.8px] text-muted uppercase">
                    {t('person.burial_place')}
                  </div>
                  <div className="text-xs text-ink">{person.burial_place}</div>
                </div>
              )}
              {person.biography && (
                <div>
                  <div className="mb-0.5 text-[9px] tracking-[0.8px] text-muted uppercase">
                    {t('person.biography')}
                  </div>
                  <div className="line-clamp-3 text-[11px] leading-relaxed text-ink">{person.biography}</div>
                </div>
              )}
            </div>
          )}

          {/* Quan he gia dinh */}
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
            <div className="text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
              {t('panel.relations')}
            </div>

            {!hasAnyRelation && <p className="text-xs text-muted">{t('panel.no_relations')}</p>}

            {hasAnyRelation && (
              <div className="flex flex-col gap-2.5">
                <RelationGroup
                  title={t('panel.parents')}
                  rows={parentRows}
                  persons={persons}
                  canEdit={canEdit}
                  onSelect={(id) => onSelectPerson?.(id)}
                  onRemove={setRemoveRelTarget}
                />
                <RelationGroup
                  title={t('panel.spouse')}
                  rows={spouseRows}
                  persons={persons}
                  canEdit={canEdit}
                  onSelect={(id) => onSelectPerson?.(id)}
                  onRemove={setRemoveRelTarget}
                />
                <RelationGroup
                  title={t('panel.children')}
                  rows={childRows}
                  persons={persons}
                  canEdit={canEdit}
                  onSelect={(id) => onSelectPerson?.(id)}
                  onRemove={setRemoveRelTarget}
                />
              </div>
            )}

            {canEdit && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickAddMode('parent')}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary"
                >
                  + {t('panel.add_parent')}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAddMode('spouse')}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary"
                >
                  + {t('panel.add_spouse')}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAddMode('child')}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary"
                >
                  + {t('panel.add_child')}
                </button>
              </div>
            )}
          </div>

          {/* Dong doi */}
          <div className="flex flex-col gap-2.5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
                {t('panel.life_timeline')}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingLifeEvent(null)
                    setShowLifeEventModal(true)
                  }}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  + {t('life_event.add')}
                </button>
              )}
            </div>

            {timelineItems.length === 0 && <p className="text-xs text-muted">{t('empty.no_interactions')}</p>}
            {timelineItems.length > 0 && <Timeline items={timelineItems} />}
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(`/nguoi/${personId}`)}
            className="w-full rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-primary/30"
          >
            {t('panel.view_profile')}
          </button>
        </div>
      </div>

      {quickAddMode && (
        <QuickAddRelative
          open={!!quickAddMode}
          mode={quickAddMode}
          anchorPerson={person}
          persons={Array.from(persons.values())}
          onClose={() => setQuickAddMode(null)}
          onCreated={() => {
            setQuickAddMode(null)
            onChanged()
          }}
        />
      )}

      <LifeEventModal
        open={showLifeEventModal}
        personId={personId}
        event={editingLifeEvent}
        onClose={() => {
          setShowLifeEventModal(false)
          setEditingLifeEvent(null)
        }}
        onSaved={refreshLifeEvents}
      />

      <ConfirmDialog
        open={!!removeRelTarget}
        loading={removingRel}
        error={removeRelError}
        title={t('panel.remove_relation')}
        message={t('panel.remove_relation_confirm')}
        onConfirm={() => void handleConfirmRemoveRel()}
        onCancel={() => {
          setRemoveRelTarget(null)
          setRemoveRelError(null)
        }}
      />

      <ConfirmDialog
        open={!!deleteEventTarget}
        loading={deletingEvent}
        error={deleteEventError}
        message={t('life_event.delete_confirm')}
        onConfirm={() => void handleDeleteLifeEvent()}
        onCancel={() => {
          setDeleteEventTarget(null)
          setDeleteEventError(null)
        }}
      />
    </div>
  )
}

export default PersonPanel
