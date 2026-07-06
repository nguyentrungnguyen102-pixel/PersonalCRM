// Form them tuong tac cho mot person cho truoc.

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSettings } from '../hooks/useSettings'
import { supabase } from '../lib/supabase'
import type { InteractionTypeOption, LabelTree } from '../lib/types'
import { Modal } from './Modal'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function typeLabel(labels: LabelTree, opt: InteractionTypeOption): string {
  const tree = labels.interaction_types
  if (tree && typeof tree === 'object') {
    const value = (tree as LabelTree)[opt.value]
    if (typeof value === 'string') return value
  }
  return opt.label
}

interface InteractionFormModalProps {
  open: boolean
  personId: string
  onClose: () => void
  onSaved: () => void
}

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40'

export function InteractionFormModal({ open, personId, onClose, onSaved }: InteractionFormModalProps) {
  const { t, labels, interactionTypes } = useSettings()
  const enabledTypes = interactionTypes.filter((o) => o.enabled)

  const [date, setDate] = useState(todayISO())
  const [type, setType] = useState(enabledTypes[0]?.value ?? 'khac')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDate(todayISO())
    setType(enabledTypes[0]?.value ?? 'khac')
    setTitle('')
    setNote('')
    setLocation('')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, personId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.from('interactions').insert({
      person_id: personId,
      date,
      type,
      title: title.trim() || null,
      note: note.trim() || null,
      location: location.trim() || null,
    })

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('actions.add_interaction')} maxWidthClass="md:max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('interactions.date')}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('quick_add.step_type')}
          </span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT_CLASS}>
            {enabledTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {typeLabel(labels, opt)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('interactions.title')}
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLASS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('quick_add.step_note')}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('person.address')}
          </span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={INPUT_CLASS} />
        </label>

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
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '…' : t('actions.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default InteractionFormModal
