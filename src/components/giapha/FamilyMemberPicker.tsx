// Modal "Them thanh vien" cua trang /gia-pha — liet ke nguoi CHUA thuoc dong
// ho (in_family_tree = false), tim theo ten, bam + de danh dau
// in_family_tree = true. Cap nhat lac quan (optimistic): danh dau da them
// ngay tai cho, khong xoa khoi danh sach — GiaPha.tsx se refresh usePersons()
// (qua onChanged) va item se tu bien mat khoi danh sach o lan render ke tiep.

import { useEffect, useMemo, useState } from 'react'
import type { PersonWithMeta } from '../../hooks/usePersons'
import { useLabels } from '../../hooks/useSettings'
import { displayName as personDisplayName } from '../../lib/displayName'
import { vnNormalize } from '../../lib/normalize'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../Avatar'
import { Modal } from '../Modal'
import { GROUP_COLORS } from '../PersonCard'

interface FamilyMemberPickerProps {
  open: boolean
  onClose: () => void
  persons: PersonWithMeta[]
  onChanged: () => void
}

export function FamilyMemberPicker({ open, onClose, persons, onChanged }: FamilyMemberPickerProps) {
  const { t } = useLabels()

  const [query, setQuery] = useState('')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setAddedIds(new Set())
    setError(null)
  }, [open])

  const candidates = useMemo(() => {
    const base = persons.filter((p) => !p.in_family_tree)
    const q = vnNormalize(query.trim())
    if (!q) return base
    return base.filter((p) => vnNormalize(`${p.nickname ?? ''} ${p.full_name}`).includes(q))
  }, [persons, query])

  async function handleAdd(id: string) {
    setBusyId(id)
    setError(null)
    const { error: err } = await supabase.from('persons').update({ in_family_tree: true }).eq('id', id)
    setBusyId(null)
    if (err) {
      setError(err.message)
      return
    }
    setAddedIds((prev) => new Set(prev).add(id))
    onChanged()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('giapha.add_members')}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('actions.search')}
          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40"
        />

        {error && (
          <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">{error}</p>
        )}

        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {candidates.map((p) => {
            const added = addedIds.has(p.id)
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"
              >
                <Avatar name={personDisplayName(p)} avatarUrl={p.avatar_url} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-ink">{personDisplayName(p)}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: GROUP_COLORS[p.group_type] }}
                      aria-hidden
                    />
                    <span className="truncate text-[10px] text-muted">{t(`groups.${p.group_type}`)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={added || busyId === p.id}
                  onClick={() => void handleAdd(p.id)}
                  className={`flex-shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                    added
                      ? 'border-emerald/30 bg-emerald/10 text-emerald'
                      : 'border-primary/30 bg-primary/10 text-primary'
                  }`}
                >
                  {added ? '✓' : busyId === p.id ? '…' : `+ ${t('actions.add')}`}
                </button>
              </div>
            )
          })}
          {candidates.length === 0 && (
            <p className="py-4 text-center text-xs text-muted">{t('empty.no_results')}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default FamilyMemberPicker
