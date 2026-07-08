// Thanh hanh dong hang loat — noi len khi co dong duoc chon trong ContactsTable.
// Fixed bottom, dat tren tab bar mobile (h-14) va sat day tren desktop.

import { useState } from 'react'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import { supabase } from '../lib/supabase'
import type { GroupType } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'

const GROUP_TYPES: GroupType[] = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']
const FREQ_OPTIONS: (number | null)[] = [null, 30, 60, 90, 180]

type Panel = 'group' | 'tag' | 'freq' | null

interface BulkActionBarProps {
  selectedIds: string[]
  rows: PersonWithMeta[]
  groupDefaults: Record<GroupType, number>
  isAdmin: boolean
  onDone: () => void
  onClear: () => void
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function BulkActionBar({
  selectedIds,
  rows,
  groupDefaults,
  isAdmin,
  onDone,
  onClear,
}: BulkActionBarProps) {
  const { t } = useLabels()

  const [panel, setPanel] = useState<Panel>(null)
  const [applying, setApplying] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)

  const [groupValue, setGroupValue] = useState<GroupType>('khac')
  const [withDefaultFreq, setWithDefaultFreq] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [freqValue, setFreqValue] = useState<number | null>(null)

  function togglePanel(next: Panel) {
    setErrorMsg(null)
    setPanel((cur) => (cur === next ? null : next))
  }

  function flashDone() {
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2000)
  }

  function finishSuccess() {
    setApplying(false)
    setPanel(null)
    setErrorMsg(null)
    flashDone()
    onDone()
  }

  function finishError(message: string) {
    setApplying(false)
    setErrorMsg(message)
  }

  async function applyGroup() {
    setApplying(true)
    setErrorMsg(null)

    const payload: Record<string, unknown> = { group_type: groupValue }
    if (withDefaultFreq) payload.contact_frequency_days = groupDefaults[groupValue] ?? null

    const { error } = await supabase.from('persons').update(payload).in('id', selectedIds)
    if (error) finishError(error.message)
    else finishSuccess()
  }

  async function applyTag() {
    const tag = tagInput.trim()
    if (!tag) return
    setApplying(true)
    setErrorMsg(null)

    const targets = selectedIds
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is PersonWithMeta => !!r && !r.tags.includes(tag))

    try {
      for (const group of chunk(targets, 20)) {
        const results = await Promise.all(
          group.map((r) =>
            supabase
              .from('persons')
              .update({ tags: [...r.tags, tag] })
              .eq('id', r.id),
          ),
        )
        const failed = results.find((res) => res.error)
        if (failed?.error) throw new Error(failed.error.message)
      }
      setTagInput('')
      finishSuccess()
    } catch (e) {
      finishError(e instanceof Error ? e.message : String(e))
    }
  }

  async function applyFrequency() {
    setApplying(true)
    setErrorMsg(null)

    const { error } = await supabase
      .from('persons')
      .update({ contact_frequency_days: freqValue })
      .in('id', selectedIds)

    if (error) finishError(error.message)
    else finishSuccess()
  }

  async function applyDelete() {
    setApplying(true)
    setErrorMsg(null)

    // TODO: don rac storage (anh/video) truoc khi xoa persons hang loat —
    // hien tai chi xoa ban ghi persons, media/interactions cascade o DB.
    const { error } = await supabase.from('persons').delete().in('id', selectedIds)

    if (error) {
      finishError(error.message)
      return
    }
    setConfirmOpen(false)
    finishSuccess()
  }

  const btnClass =
    'flex-shrink-0 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink'
  const btnActiveClass = 'border-primary/40 bg-primary/10 text-primary'

  return (
    <>
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-primary/20 bg-surface/95 px-3 py-2.5 backdrop-blur-xl md:bottom-0">
        {panel && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg/60 p-2">
            {panel === 'group' && (
              <>
                <select
                  value={groupValue}
                  onChange={(e) => setGroupValue(e.target.value as GroupType)}
                  className="rounded-md border border-line bg-card px-2 py-1.5 text-xs text-ink outline-none"
                >
                  {GROUP_TYPES.map((g) => (
                    <option key={g} value={g}>
                      {t(`groups.${g}`)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-[11px] text-ink">
                  <input
                    type="checkbox"
                    checked={withDefaultFreq}
                    onChange={(e) => setWithDefaultFreq(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {t('bulk.with_default_freq')}
                </label>
                <button
                  type="button"
                  disabled={applying}
                  onClick={() => void applyGroup()}
                  className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {applying ? '…' : t('bulk.apply')}
                </button>
              </>
            )}

            {panel === 'tag' && (
              <>
                <input
                  autoFocus
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void applyTag()
                  }}
                  placeholder={t('bulk.tag_placeholder')}
                  className="min-w-[140px] flex-1 rounded-md border border-line bg-card px-2 py-1.5 text-xs text-ink outline-none placeholder:text-muted"
                />
                <button
                  type="button"
                  disabled={applying || !tagInput.trim()}
                  onClick={() => void applyTag()}
                  className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {applying ? '…' : t('bulk.apply')}
                </button>
              </>
            )}

            {panel === 'freq' && (
              <>
                <select
                  value={freqValue ?? ''}
                  onChange={(e) => setFreqValue(e.target.value === '' ? null : Number(e.target.value))}
                  className="rounded-md border border-line bg-card px-2 py-1.5 text-xs text-ink outline-none"
                >
                  {FREQ_OPTIONS.map((opt) => (
                    <option key={opt ?? 'none'} value={opt ?? ''}>
                      {opt == null ? t('table.no_frequency') : opt}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={applying}
                  onClick={() => void applyFrequency()}
                  className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {applying ? '…' : t('bulk.apply')}
                </button>
              </>
            )}

            {errorMsg && <span className="text-[11px] text-rose">{errorMsg}</span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-0.5 flex-shrink-0 text-[11px] font-semibold text-ink">
            {selectedIds.length} {t('table.selected')}
          </span>

          <button
            type="button"
            onClick={() => togglePanel('group')}
            className={`${btnClass} ${panel === 'group' ? btnActiveClass : ''}`}
          >
            {t('bulk.change_group')}
          </button>
          <button
            type="button"
            onClick={() => togglePanel('tag')}
            className={`${btnClass} ${panel === 'tag' ? btnActiveClass : ''}`}
          >
            {t('bulk.add_tag')}
          </button>
          <button
            type="button"
            onClick={() => togglePanel('freq')}
            className={`${btnClass} ${panel === 'freq' ? btnActiveClass : ''}`}
          >
            {t('bulk.set_frequency')}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className={`${btnClass} border-rose/30 text-rose hover:text-rose`}
            >
              {t('bulk.delete')}
            </button>
          )}

          <button type="button" onClick={onClear} className={`${btnClass} ml-auto`}>
            {t('bulk.clear')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        loading={applying}
        error={errorMsg}
        onConfirm={() => void applyDelete()}
        onCancel={() => {
          setConfirmOpen(false)
          setErrorMsg(null)
        }}
      />

      {toastVisible && (
        <div className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald/30 bg-emerald/15 px-4 py-2 text-xs font-semibold text-emerald shadow-lg md:bottom-24">
          {t('bulk.done')}
        </div>
      )}
    </>
  )
}

export default BulkActionBar
