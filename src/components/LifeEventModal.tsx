// Form them/sua 1 su kien cuoc doi (life_events) — dung chung cho
// PersonProfile.tsx va PersonPanel.tsx (gia pha). Neu co prop `event` => che
// do sua, nguoc lai la them moi. Xoa do noi goi tu xu ly rieng (ConfirmDialog).

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLabels } from '../hooks/useSettings'
import { createLifeEvent, LIFE_EVENT_KINDS, updateLifeEvent } from '../lib/lifeEvents'
import type { LifeEvent, LifeEventKind } from '../lib/lifeEvents'
import { Modal } from './Modal'

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40'

interface LifeEventModalProps {
  open: boolean
  personId: string
  event?: LifeEvent | null
  onClose: () => void
  onSaved: () => void
}

export function LifeEventModal({ open, personId, event, onClose, onSaved }: LifeEventModalProps) {
  const { t } = useLabels()
  const isEdit = !!event

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<LifeEventKind>('khac')
  const [yearOnly, setYearOnly] = useState(false)
  const [date, setDate] = useState('')
  const [year, setYear] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (event) {
      setTitle(event.title)
      setKind((LIFE_EVENT_KINDS as readonly string[]).includes(event.kind ?? '') ? (event.kind as LifeEventKind) : 'khac')
      setYearOnly(event.event_date == null && event.event_year != null)
      setDate(event.event_date ?? '')
      setYear(event.event_year ?? '')
      setNote(event.note ?? '')
    } else {
      setTitle('')
      setKind('khac')
      setYearOnly(false)
      setDate('')
      setYear('')
      setNote('')
    }
    setError(null)
  }, [open, event])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError(t('life_event.title'))
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      person_id: personId,
      title: title.trim(),
      kind,
      note: note.trim() || null,
      event_date: yearOnly ? null : date || null,
      event_year: yearOnly ? (year === '' ? null : Number(year)) : null,
    }

    const result =
      isEdit && event ? await updateLifeEvent(event.id, payload) : await createLifeEvent(payload)

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('life_event.edit') : t('life_event.add')}
      maxWidthClass="md:max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('life_event.title')} *
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('life_event.kind')}
          </span>
          <select value={kind} onChange={(e) => setKind(e.target.value as LifeEventKind)} className={INPUT_CLASS}>
            {LIFE_EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`life_event.kind_${k}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={yearOnly}
            onChange={(e) => setYearOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          {t('life_event.year_only')}
        </label>

        {yearOnly ? (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              {t('life_event.year')}
            </span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
              className={INPUT_CLASS}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              {t('life_event.date')}
            </span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('life_event.note')}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={`${INPUT_CLASS} resize-none`}
          />
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

export default LifeEventModal
