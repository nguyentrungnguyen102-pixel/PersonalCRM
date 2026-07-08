// Form them/sua ho so person. Neu co prop `person` => che do sua, nguoc lai
// la them moi. Luu truc tiep vao bang `persons` (RLS chi cho phep admin/editor).

import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useSettings } from '../hooks/useSettings'
import { supabase } from '../lib/supabase'
import type { GroupType } from '../lib/types'
import { Modal } from './Modal'

const GROUP_TYPES: GroupType[] = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']
const FREQ_OPTIONS: (number | null)[] = [null, 30, 60, 90, 180]

// Gia tri goi y de dien san khi THEM MOI (vd tu Quet danh thiep) — chi ap
// dung o che do them moi, khong bao gio ghi de khi dang sua nguoi da co.
export interface PersonFormInitialValues {
  nickname?: string
  full_name?: string
  phone?: string
  email?: string
  company?: string
  job_title?: string
}

interface PersonFormModalProps {
  open: boolean
  person?: PersonWithMeta
  initialValues?: PersonFormInitialValues
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  full_name: string
  nickname: string
  group_type: GroupType
  phone: string
  email: string
  birthday: string
  company: string
  job_title: string
  address: string
  hometown: string
  hobbies: string
  tags: string
  how_we_met: string
  do_an: string
  do_uong: string
  kieng_ky: string
  facebook: string
  zalo: string
  linkedin: string
  instagram: string
  gift_ideas: string
  notes: string
  is_favorite: boolean
  contact_frequency_days: number | null
}

function emptyForm(
  defaultGroup: GroupType,
  defaultFreq: number | null,
  initialValues?: PersonFormInitialValues,
): FormState {
  return {
    full_name: initialValues?.full_name ?? '',
    nickname: initialValues?.nickname ?? '',
    group_type: defaultGroup,
    phone: initialValues?.phone ?? '',
    email: initialValues?.email ?? '',
    birthday: '',
    company: initialValues?.company ?? '',
    job_title: initialValues?.job_title ?? '',
    address: '',
    hometown: '',
    hobbies: '',
    tags: '',
    how_we_met: '',
    do_an: '',
    do_uong: '',
    kieng_ky: '',
    facebook: '',
    zalo: '',
    linkedin: '',
    instagram: '',
    gift_ideas: '',
    notes: '',
    is_favorite: false,
    contact_frequency_days: defaultFreq,
  }
}

function formFromPerson(person: PersonWithMeta): FormState {
  const prefs = (person.preferences ?? {}) as Record<string, string>
  const social = (person.social_links ?? {}) as Record<string, string>
  return {
    full_name: person.full_name,
    nickname: person.nickname ?? '',
    group_type: person.group_type,
    phone: person.phone ?? '',
    email: person.email ?? '',
    birthday: person.birthday ?? '',
    company: person.company ?? '',
    job_title: person.job_title ?? '',
    address: person.address ?? '',
    hometown: person.hometown ?? '',
    hobbies: person.hobbies.join(', '),
    tags: person.tags.join(', '),
    how_we_met: person.how_we_met ?? '',
    do_an: prefs.do_an ?? '',
    do_uong: prefs.do_uong ?? '',
    kieng_ky: prefs.kieng_ky ?? '',
    facebook: social.facebook ?? '',
    zalo: social.zalo ?? '',
    linkedin: social.linkedin ?? '',
    instagram: social.instagram ?? '',
    gift_ideas: person.gift_ideas ?? '',
    notes: person.notes ?? '',
    is_favorite: person.is_favorite,
    contact_frequency_days: person.contact_frequency_days,
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40'

interface FieldProps {
  label: string
  children: ReactNode
  full?: boolean
}

function Field({ label, children, full = false }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">{label}</span>
      {children}
    </label>
  )
}

export function PersonFormModal({ open, person, initialValues, onClose, onSaved }: PersonFormModalProps) {
  const { t, groupDefaults } = useSettings()
  const isEdit = !!person

  const [form, setForm] = useState<FormState>(() =>
    person ? formFromPerson(person) : emptyForm('khac', groupDefaults.khac ?? null, initialValues),
  )
  const [freqTouched, setFreqTouched] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (person) {
      setForm(formFromPerson(person))
      setFreqTouched(true)
    } else {
      setForm(emptyForm('khac', groupDefaults.khac ?? null, initialValues))
      setFreqTouched(false)
    }
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleGroupChange(group: GroupType) {
    setForm((f) => ({
      ...f,
      group_type: group,
      contact_frequency_days: freqTouched ? f.contact_frequency_days : (groupDefaults[group] ?? null),
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.nickname.trim()) {
      setError(t('person.info'))
      return
    }

    setSaving(true)
    setError(null)

    const preferences: Record<string, string> = {}
    if (form.do_an.trim()) preferences.do_an = form.do_an.trim()
    if (form.do_uong.trim()) preferences.do_uong = form.do_uong.trim()
    if (form.kieng_ky.trim()) preferences.kieng_ky = form.kieng_ky.trim()

    const social_links: Record<string, string> = {}
    if (form.facebook.trim()) social_links.facebook = form.facebook.trim()
    if (form.zalo.trim()) social_links.zalo = form.zalo.trim()
    if (form.linkedin.trim()) social_links.linkedin = form.linkedin.trim()
    if (form.instagram.trim()) social_links.instagram = form.instagram.trim()

    // full_name khong duoc null trong DB — neu bo trong o "Ten day du" thi
    // dung lai gia tri "Ten danh ba" (nickname) lam full_name.
    const nicknameTrimmed = form.nickname.trim()
    const fullNameTrimmed = form.full_name.trim() || nicknameTrimmed

    const payload = {
      full_name: fullNameTrimmed,
      nickname: nicknameTrimmed,
      group_type: form.group_type,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      birthday: form.birthday || null,
      company: form.company.trim() || null,
      job_title: form.job_title.trim() || null,
      address: form.address.trim() || null,
      hometown: form.hometown.trim() || null,
      hobbies: splitList(form.hobbies),
      tags: splitList(form.tags),
      how_we_met: form.how_we_met.trim() || null,
      preferences,
      social_links,
      gift_ideas: form.gift_ideas.trim() || null,
      notes: form.notes.trim() || null,
      is_favorite: form.is_favorite,
      contact_frequency_days: form.contact_frequency_days,
    }

    const result =
      isEdit && person
        ? await supabase.from('persons').update(payload).eq('id', person.id)
        : await supabase.from('persons').insert(payload)

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t('actions.edit') : t('actions.add_person')} maxWidthClass="md:max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={`${t('person.contact_name')} *`} full>
            <input
              value={form.nickname}
              onChange={(e) => update('nickname', e.target.value)}
              required
              className={INPUT_CLASS}
              placeholder={t('person.contact_name')}
            />
          </Field>

          <Field label={t('person.full_name_label')}>
            <input
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              className={INPUT_CLASS}
              placeholder={t('person.full_name_label')}
            />
          </Field>

          <Field label={t('person.phone')}>
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} className={INPUT_CLASS} />
          </Field>

          <Field label={t('person.email')}>
            <input value={form.email} onChange={(e) => update('email', e.target.value)} className={INPUT_CLASS} />
          </Field>

          <Field label={t('person.birthday')}>
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => update('birthday', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label={t('person.company')}>
            <input value={form.company} onChange={(e) => update('company', e.target.value)} className={INPUT_CLASS} />
          </Field>

          <Field label={t('person.job_title')}>
            <input
              value={form.job_title}
              onChange={(e) => update('job_title', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label={t('person.address')}>
            <input value={form.address} onChange={(e) => update('address', e.target.value)} className={INPUT_CLASS} />
          </Field>

          <Field label={t('person.hometown')}>
            <input
              value={form.hometown}
              onChange={(e) => update('hometown', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label={t('person.how_we_met')}>
            <input
              value={form.how_we_met}
              onChange={(e) => update('how_we_met', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label={t('person.hobbies')}>
            <input value={form.hobbies} onChange={(e) => update('hobbies', e.target.value)} className={INPUT_CLASS} />
          </Field>

          <Field label={t('person.tags')}>
            <input value={form.tags} onChange={(e) => update('tags', e.target.value)} className={INPUT_CLASS} />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('nav.groups')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_TYPES.map((group) => {
              const active = form.group_type === group
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => handleGroupChange(group)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-line bg-card text-muted hover:text-ink'
                  }`}
                >
                  {t(`groups.${group}`)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={`${t('person.preferences')} — ${t('person.preferences.do_an')}`}>
            <input value={form.do_an} onChange={(e) => update('do_an', e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label={t('person.preferences.do_uong')}>
            <input value={form.do_uong} onChange={(e) => update('do_uong', e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label={t('person.preferences.kieng_ky')}>
            <input
              value={form.kieng_ky}
              onChange={(e) => update('kieng_ky', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Facebook">
            <input value={form.facebook} onChange={(e) => update('facebook', e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label="Zalo">
            <input value={form.zalo} onChange={(e) => update('zalo', e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label="LinkedIn">
            <input
              value={form.linkedin}
              onChange={(e) => update('linkedin', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Instagram">
            <input
              value={form.instagram}
              onChange={(e) => update('instagram', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label={t('person.gift_ideas')}>
          <textarea
            value={form.gift_ideas}
            onChange={(e) => update('gift_ideas', e.target.value)}
            rows={2}
            className={`${INPUT_CLASS} resize-none`}
          />
        </Field>

        <Field label={t('person.notes')}>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={2}
            className={`${INPUT_CLASS} resize-none`}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={form.is_favorite}
              onChange={(e) => update('is_favorite', e.target.checked)}
              className="h-3.5 w-3.5 accent-amber"
            />
            ⭐ {t('person.favorite')}
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
              {t('person.keep_in_touch')}
            </span>
            <select
              value={form.contact_frequency_days ?? ''}
              onChange={(e) => {
                setFreqTouched(true)
                const raw = e.target.value
                update('contact_frequency_days', raw === '' ? null : Number(raw))
              }}
              className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-ink outline-none"
            >
              {FREQ_OPTIONS.map((opt) => (
                <option key={opt ?? 'none'} value={opt ?? ''}>
                  {opt == null ? t('status.no_reminder') : opt}
                </option>
              ))}
            </select>
          </div>
        </div>

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

export default PersonFormModal
