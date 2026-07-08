// Panel "Quan hệ" trong cột phải hồ sơ — liệt kê quan hệ 2 chiều với những
// người khác, cho phép thêm/xóa. Xem quy ước chiều nhãn trong src/lib/relations.ts.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import { displayName as personDisplayName } from '../lib/displayName'
import { vnNormalize } from '../lib/normalize'
import {
  createRelationship,
  deleteRelationship,
  fetchFamilySuggestionData,
  fetchRelationships,
  fetchRelationTypes,
  suggestParentChild,
} from '../lib/relations'
import type { ParentChildSuggestion, RelationType, RelationView } from '../lib/relations'
import { Avatar } from './Avatar'
import { ConfirmDialog } from './ConfirmDialog'
import { Modal } from './Modal'

const DISMISSED_KEY = 'personalcrm.rel_suggest_dismissed'

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(arr)
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // localStorage khong kha dung (vi du che do rieng tu) — bo qua im lang
  }
}

interface RelationsPanelProps {
  personId: string
  personName: string
}

export function RelationsPanel({ personId, personName }: RelationsPanelProps) {
  const { t } = useLabels()
  const { canEdit, role, user } = useAuth()
  const { persons } = usePersons()

  const [relations, setRelations] = useState<RelationView[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<RelationView | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [relationTypes, setRelationTypes] = useState<RelationType[]>([])
  const [suggestions, setSuggestions] = useState<ParentChildSuggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())
  const [suggestBusy, setSuggestBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await fetchRelationships(personId, canEdit)
    setRelations(rows)
    setLoading(false)
  }, [personId, canEdit])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void fetchRelationTypes().then(setRelationTypes)
  }, [])

  const loadSuggestions = useCallback(async () => {
    const rows = await fetchFamilySuggestionData(personId)
    const all = suggestParentChild(rows)
    const relevant = all.filter((s) => s.parent === personId || s.child === personId)
    setSuggestions(relevant)
  }, [personId])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions, relations])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    const { error } = await deleteRelationship(deleteTarget.id)
    setDeleting(false)
    if (error) {
      setDeleteError(error.message)
      return
    }
    setDeleteTarget(null)
    showToast(t('relations.deleted'))
    void load()
  }

  function canDelete(rel: RelationView): boolean {
    if (!canEdit) return false
    return role === 'admin' || (role === 'editor' && rel.createdBy === user?.id)
  }

  const personById = useMemo(() => {
    const map = new Map<string, PersonWithMeta>()
    for (const p of persons) map.set(p.id, p)
    return map
  }, [persons])

  async function handleSuggestAccept(s: ParentChildSuggestion) {
    const key = `${s.parent}:${s.child}`
    setSuggestBusy(key)
    const parentChildType = relationTypes.find((rt) => rt.value === 'bo_me_con')
    const labelAB = parentChildType?.label_a_to_b ?? 'bố/mẹ của'
    const labelBA = parentChildType?.label_b_to_a ?? 'con của'

    const { error } = await createRelationship({
      personA: s.parent,
      personB: s.child,
      type: 'bo_me_con',
      labelAB,
      labelBA,
      note: null,
    })
    setSuggestBusy(null)
    if (!error) {
      showToast(t('relations.saved'))
      void load()
    }
  }

  function handleSuggestDismiss(s: ParentChildSuggestion) {
    const key = `${s.parent}:${s.child}`
    const next = new Set(dismissed)
    next.add(key)
    setDismissed(next)
    saveDismissed(next)
  }

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissed.has(`${s.parent}:${s.child}`),
  )

  return (
    <div className="rounded-lg border border-line bg-card px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-[1.2px] text-muted uppercase">
          {t('relations.title')}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
          >
            + {t('relations.add')}
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-muted">…</p>}

      {!loading && relations.length === 0 && (
        <p className="text-xs text-muted">{t('relations.empty')}</p>
      )}

      {!loading && relations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {relations.map((rel) => (
            <div key={rel.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
              <Avatar name={rel.otherName || '?'} avatarUrl={rel.otherAvatarUrl} size={26} />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/nguoi/${rel.otherId}`}
                  className="block truncate text-xs font-medium text-ink hover:text-primary"
                >
                  {rel.otherName}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {rel.label}
                  </span>
                </div>
                {rel.note && <div className="mt-0.5 truncate text-[10px] text-muted">{rel.note}</div>}
              </div>
              {canDelete(rel) && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(rel)}
                  aria-label={t('actions.delete')}
                  className="flex-shrink-0 rounded-md p-1 text-muted transition-colors hover:text-rose"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {visibleSuggestions.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-line pt-2.5">
          {visibleSuggestions.map((s) => {
            const key = `${s.parent}:${s.child}`
            const parentPerson = personById.get(s.parent)
            const childPerson = personById.get(s.child)
            if (!parentPerson || !childPerson) return null
            return (
              <div
                key={key}
                className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber/25 bg-amber/5 px-2 py-1.5 text-[10px] text-ink"
              >
                <span className="font-semibold text-amber">{t('relations.suggest_title')}:</span>
                <span className="font-medium">{personDisplayName(parentPerson)}</span>
                <span className="text-muted">—</span>
                <span className="text-muted">
                  {relationTypes.find((rt) => rt.value === 'bo_me_con')?.label_a_to_b ?? 'bố/mẹ của'}
                </span>
                <span className="text-muted">—</span>
                <span className="font-medium">{personDisplayName(childPerson)}</span>
                <span className="ml-auto flex gap-1">
                  <button
                    type="button"
                    disabled={suggestBusy === key}
                    onClick={() => void handleSuggestAccept(s)}
                    className="rounded-md border border-emerald/30 bg-emerald/10 px-1.5 py-0.5 font-semibold text-emerald disabled:opacity-50"
                  >
                    {suggestBusy === key ? '…' : `✓ ${t('relations.suggest_yes')}`}
                  </button>
                  <button
                    type="button"
                    disabled={suggestBusy === key}
                    onClick={() => handleSuggestDismiss(s)}
                    className="rounded-md border border-line px-1.5 py-0.5 text-muted disabled:opacity-50"
                  >
                    ✕ {t('relations.suggest_no')}
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {canEdit && (
        <AddRelationModal
          open={showAddModal}
          personId={personId}
          personName={personName}
          persons={persons}
          relationTypes={relationTypes}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false)
            showToast(t('relations.saved'))
            void load()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        loading={deleting}
        error={deleteError}
        message={t('relations.delete_confirm')}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald/30 bg-emerald/15 px-4 py-2 text-xs font-semibold text-emerald shadow-lg md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  )
}

interface AddRelationModalProps {
  open: boolean
  personId: string
  personName: string
  persons: PersonWithMeta[]
  relationTypes: RelationType[]
  onClose: () => void
  onSaved: () => void
}

function AddRelationModal({
  open,
  personId,
  personName,
  persons,
  relationTypes,
  onClose,
  onSaved,
}: AddRelationModalProps) {
  const { t } = useLabels()

  const [query, setQuery] = useState('')
  const [selectedOther, setSelectedOther] = useState<PersonWithMeta | null>(null)
  const [selectedType, setSelectedType] = useState<RelationType | null>(null)
  const [labelAB, setLabelAB] = useState('')
  const [labelBA, setLabelBA] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedOther(null)
    setSelectedType(null)
    setLabelAB('')
    setLabelBA('')
    setNote('')
    setError(null)
  }, [open])

  const filteredPersons = useMemo(() => {
    const q = vnNormalize(query.trim())
    const candidates = persons.filter((p) => p.id !== personId)
    if (!q) return candidates.slice(0, 8)
    return candidates
      .filter((p) => vnNormalize(`${p.nickname ?? ''} ${p.full_name}`).includes(q))
      .slice(0, 8)
  }, [persons, query, personId])

  const familyTypes = relationTypes.filter((rt) => rt.family)
  const socialTypes = relationTypes.filter((rt) => !rt.family)

  function handleChooseType(rt: RelationType) {
    setSelectedType(rt)
    setLabelAB(rt.label_a_to_b)
    setLabelBA(rt.label_b_to_a)
  }

  async function handleSave() {
    if (!selectedOther || !selectedType) return
    if (!labelAB.trim() || !labelBA.trim()) {
      setError(t('relations.choose_type'))
      return
    }

    setSaving(true)
    setError(null)

    const { error: err } = await createRelationship({
      personA: personId,
      personB: selectedOther.id,
      type: selectedType.value,
      labelAB: labelAB.trim(),
      labelBA: labelBA.trim(),
      note: note.trim() || null,
    })

    setSaving(false)

    if (err) {
      if (err.code === '23505') {
        setError(t('relations.duplicate'))
      } else {
        setError(err.message)
      }
      return
    }

    onSaved()
  }

  const canSave = !!selectedOther && !!selectedType && labelAB.trim() && labelBA.trim()

  return (
    <Modal open={open} onClose={onClose} title={t('relations.add')} maxWidthClass="md:max-w-lg">
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-[10px] font-semibold tracking-[0.8px] text-muted uppercase">
            {t('relations.choose_person')}
          </div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('actions.search')}
            className="mb-2 w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40"
          />
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {filteredPersons.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedOther(p)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  selectedOther?.id === p.id
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-transparent hover:bg-bg/60'
                }`}
              >
                <Avatar name={personDisplayName(p)} avatarUrl={p.avatar_url} size={24} />
                <span className="truncate text-xs font-medium text-ink">
                  {personDisplayName(p)}
                </span>
              </button>
            ))}
            {filteredPersons.length === 0 && (
              <p className="py-3 text-center text-xs text-muted">{t('empty.no_results')}</p>
            )}
          </div>
        </div>

        {selectedOther && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold tracking-[0.8px] text-muted uppercase">
              {t('relations.choose_type')}
            </div>
            <div className="mb-1.5 text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              {t('relations.family_group')}
            </div>
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {familyTypes.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => handleChooseType(rt)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    selectedType?.value === rt.value
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-line bg-card text-muted hover:text-ink'
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
            <div className="mb-1.5 text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              {t('relations.social_group')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {socialTypes.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => handleChooseType(rt)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    selectedType?.value === rt.value
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-line bg-card text-muted hover:text-ink'
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedOther && selectedType && (
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg/40 px-3 py-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('relations.label_this_to_other')} ({personName})
              </span>
              <input
                value={labelAB}
                onChange={(e) => setLabelAB(e.target.value)}
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none focus:border-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('relations.label_other_to_this')} ({personDisplayName(selectedOther)})
              </span>
              <input
                value={labelBA}
                onChange={(e) => setLabelBA(e.target.value)}
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none focus:border-primary/40"
              />
            </label>
            <p className="text-[10px] leading-relaxed text-muted">
              {t('relations.label_this_to_other')} ({personName}):{' '}
              <span className="font-medium text-ink">{labelAB || '…'}</span>
              {' · '}
              {t('relations.label_other_to_this')} ({personDisplayName(selectedOther)}):{' '}
              <span className="font-medium text-ink">{labelBA || '…'}</span>
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('relations.note')}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none focus:border-primary/40"
              />
            </label>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !canSave}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '…' : t('actions.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default RelationsPanel
