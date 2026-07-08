// Trang Hop thu cho (route /hop-thu): tin nhan/du lieu vao (bot Telegram,
// webhook cuoc goi...) chua gan duoc nguoi trong danh ba — gan tay tai day.
// Chi admin/editor duoc vao (viewer bi day ve trang chu).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useSettings } from '../hooks/useSettings'
import { displayName as personDisplayName } from '../lib/displayName'
import { vnNormalize } from '../lib/normalize'
import { supabase } from '../lib/supabase'
import type { InboxItem, InboxSource, InteractionTypeOption, LabelTree } from '../lib/types'

function formatDateTime(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${min} ${dd}/${mm}/${yyyy}`
}

function sourceLabel(t: (path: string) => string, source: InboxSource): string {
  if (source === 'telegram') return t('inbox.source_telegram')
  if (source === 'cuoc_goi') return t('inbox.source_cuoc_goi')
  return t('inbox.source_khac')
}

function typeLabel(labels: LabelTree, opt: InteractionTypeOption): string {
  const tree = labels.interaction_types
  if (tree && typeof tree === 'object') {
    const value = (tree as LabelTree)[opt.value]
    if (typeof value === 'string') return value
  }
  return opt.label
}

export function Inbox() {
  const { canEdit } = useAuth()
  const { t, labels, interactionTypes } = useSettings()
  const { persons } = usePersons()

  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const enabledTypes = interactionTypes.filter((o) => o.enabled)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inbox_items')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setItems((data as InboxItem[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!canEdit) return
    void load()
  }, [canEdit, load])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  function handleAssigned(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
    showToast(t('inbox.assigned'))
  }

  function handleDismissed(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
    showToast(t('inbox.dismissed'))
  }

  if (!canEdit) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t('inbox.title')}</h1>
        <p className="mt-0.5 text-xs text-muted">{t('inbox.description')}</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <p className="text-sm text-muted">{t('inbox.empty')}</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <InboxItemCard
              key={item.id}
              item={item}
              persons={persons}
              enabledTypes={enabledTypes}
              labels={labels}
              t={t}
              onAssigned={() => handleAssigned(item.id)}
              onDismissed={() => handleDismissed(item.id)}
            />
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald/30 bg-emerald/15 px-4 py-2 text-xs font-semibold text-emerald shadow-lg md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  )
}

interface InboxItemCardProps {
  item: InboxItem
  persons: PersonWithMeta[]
  enabledTypes: InteractionTypeOption[]
  labels: LabelTree
  t: (path: string) => string
  onAssigned: () => void
  onDismissed: () => void
}

function InboxItemCard({ item, persons, enabledTypes, labels, t, onAssigned, onDismissed }: InboxItemCardProps) {
  const suggested = item.suggested_person_id
    ? persons.find((p) => p.id === item.suggested_person_id)
    : undefined

  const [query, setQuery] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<PersonWithMeta | null>(null)
  const [type, setType] = useState(enabledTypes[0]?.value ?? 'khac')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredPersons = useMemo(() => {
    const q = vnNormalize(query.trim())
    if (!q) return persons.slice(0, 6)
    return persons
      .filter((p) => vnNormalize(`${p.nickname ?? ''} ${p.full_name}`).includes(q))
      .slice(0, 6)
  }, [persons, query])

  async function handleAssign() {
    if (!selectedPerson) return
    setSaving(true)
    setError(null)

    const dateOnly = item.created_at.slice(0, 10)
    const { error: interErr } = await supabase.from('interactions').insert({
      person_id: selectedPerson.id,
      type,
      note: item.raw_text,
      date: dateOnly,
    })

    if (interErr) {
      setSaving(false)
      setError(interErr.message)
      return
    }

    const { error: updErr } = await supabase
      .from('inbox_items')
      .update({ status: 'assigned' })
      .eq('id', item.id)

    setSaving(false)

    if (updErr) {
      setError(updErr.message)
      return
    }

    onAssigned()
  }

  async function handleDismiss() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('inbox_items')
      .update({ status: 'dismissed' })
      .eq('id', item.id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onDismissed()
  }

  return (
    <div className="rounded-card border border-line bg-card px-4 py-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {sourceLabel(t, item.source)}
        </span>
        <span className="font-mono text-[10px] text-muted">{formatDateTime(item.created_at)}</span>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-ink">{item.raw_text}</p>

      {suggested && !selectedPerson && (
        <button
          type="button"
          onClick={() => setSelectedPerson(suggested)}
          className="mb-3 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-2.5 py-1.5 text-left transition-colors hover:bg-amber/15"
        >
          <span className="text-[10px] font-semibold text-amber">{t('inbox.suggested')}:</span>
          <Avatar name={personDisplayName(suggested)} avatarUrl={suggested.avatar_url} size={22} />
          <span className="text-xs font-medium text-ink">{personDisplayName(suggested)}</span>
        </button>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg/40 px-3 py-2.5">
        <div>
          <input
            value={selectedPerson ? personDisplayName(selectedPerson) : query}
            onChange={(e) => {
              setSelectedPerson(null)
              setQuery(e.target.value)
            }}
            placeholder={t('actions.search')}
            className="mb-1.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40"
          />
          {!selectedPerson && query.trim() && (
            <div className="flex flex-col gap-1">
              {filteredPersons.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPerson(p)
                    setQuery('')
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-card"
                >
                  <Avatar name={personDisplayName(p)} avatarUrl={p.avatar_url} size={20} />
                  <span className="truncate text-xs text-ink">{personDisplayName(p)}</span>
                </button>
              ))}
              {filteredPersons.length === 0 && (
                <p className="px-2 py-1 text-[11px] text-muted">{t('empty.no_results')}</p>
              )}
            </div>
          )}
        </div>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary/40"
        >
          {enabledTypes.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {typeLabel(labels, opt)}
            </option>
          ))}
        </select>

        {error && (
          <p className="rounded-lg border border-rose/30 bg-rose/5 px-2.5 py-1.5 text-[11px] text-rose">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void handleDismiss()}
            disabled={saving}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            {t('inbox.dismiss')}
          </button>
          <button
            type="button"
            onClick={() => void handleAssign()}
            disabled={saving || !selectedPerson}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '…' : t('inbox.assign')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Inbox
