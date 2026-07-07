// FAB "Ghi nhanh": mo modal 3 buoc (chon nguoi -> loai tuong tac -> ghi chu)
// de ghi mot interaction that nhanh, uu tien trai nghiem mobile.

import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useSettings } from '../hooks/useSettings'
import { displayName } from '../lib/displayName'
import { vnNormalize } from '../lib/normalize'
import { supabase } from '../lib/supabase'
import type { InteractionTypeOption, LabelTree } from '../lib/types'
import { Avatar } from './Avatar'
import { Modal } from './Modal'

const TYPE_ICONS: Record<string, string> = {
  gap_mat: '🤝',
  goi_dien: '📞',
  nhan_tin: '💬',
  du_lich: '✈️',
  an_uong: '🍜',
  cong_viec: '💼',
  khac: '📌',
}

function typeLabel(labels: LabelTree, opt: InteractionTypeOption): string {
  const tree = labels.interaction_types
  if (tree && typeof tree === 'object') {
    const value = (tree as LabelTree)[opt.value]
    if (typeof value === 'string') return value
  }
  return opt.label
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function QuickAddFab() {
  const { canEdit } = useAuth()
  const { persons } = usePersons()
  const { t, labels, interactionTypes } = useSettings()

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [query, setQuery] = useState('')
  const [person, setPerson] = useState<PersonWithMeta | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState(false)

  const enabledTypes = interactionTypes.filter((o) => o.enabled)

  const filteredPersons = useMemo(() => {
    const q = vnNormalize(query.trim())
    if (!q) return persons.slice(0, 30)
    return persons
      .filter((p) => vnNormalize(`${p.full_name} ${p.nickname ?? ''}`).includes(q))
      .slice(0, 30)
  }, [persons, query])

  function reset() {
    setStep(1)
    setQuery('')
    setPerson(null)
    setType(null)
    setNote('')
    setError(null)
  }

  function handleClose() {
    setOpen(false)
    reset()
  }

  function handleOpen() {
    reset()
    setOpen(true)
  }

  async function handleSave() {
    if (!person || !type) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.from('interactions').insert({
      person_id: person.id,
      type,
      note: note.trim() || null,
      date: todayISO(),
    })

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    setOpen(false)
    reset()
    setToast(true)
    setTimeout(() => setToast(false), 2000)
  }

  if (!canEdit) return null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('actions.quick_add')}
        className="fixed right-4 bottom-20 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-2xl font-light text-white shadow-[0_4px_20px_rgba(249,115,22,0.5)] transition-transform hover:scale-105 md:right-6 md:bottom-6 md:h-12 md:w-12"
      >
        +
      </button>

      <Modal open={open} onClose={handleClose} title={`⚡ ${t('actions.quick_add')}`} maxWidthClass="md:max-w-sm">
        <div className="mb-3 flex justify-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`h-[3px] w-5 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-line'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <div className="mb-2 text-xs font-semibold text-ink">{t('quick_add.step_person')}</div>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('actions.search')}
              className="mb-3 w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted"
            />
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {filteredPersons.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPerson(p)
                    setStep(2)
                  }}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    person?.id === p.id
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-transparent hover:bg-card'
                  }`}
                >
                  <Avatar name={displayName(p)} avatarUrl={p.avatar_url} size={28} />
                  <span className="truncate text-xs font-medium text-ink">{displayName(p)}</span>
                </button>
              ))}
              {filteredPersons.length === 0 && (
                <p className="py-6 text-center text-xs text-muted">{t('empty.no_results')}</p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="mb-2 text-xs font-semibold text-ink">{t('quick_add.step_type')}</div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {enabledTypes.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setType(opt.value)
                    setStep(3)
                  }}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-colors ${
                    type === opt.value
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-line bg-card hover:border-primary/20'
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {TYPE_ICONS[opt.value] ?? '📌'}
                  </span>
                  <span className="text-[11px] font-medium text-ink">{typeLabel(labels, opt)}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              ← {t('actions.cancel')}
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-2 text-xs font-semibold text-ink">{t('quick_add.step_note')}</div>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mb-3 w-full resize-none rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted"
            />

            {error && (
              <p className="mb-3 rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={saving}
                className="flex-1 rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                ← {t('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-[2] rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? '…' : `✓ ${t('actions.save')}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald/30 bg-emerald/15 px-4 py-2 text-xs font-semibold text-emerald shadow-lg md:bottom-8">
          {t('quick_add.success')}
        </div>
      )}
    </>
  )
}

export default QuickAddFab
