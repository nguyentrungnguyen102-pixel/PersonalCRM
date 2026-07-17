// Modal "them nhanh nguoi than" tu PersonPanel.tsx (/gia-pha) — 2 tab: chon
// nguoi co san (danh dau in_family_tree neu chua co) hoac tao nguoi moi toi
// gian, roi noi quan he voi anchorPerson theo mode (bo/me, vo/chong, con).
// Nhan chieu quan he lay tu app_settings.relation_types (fetchRelationTypes),
// cung fallback nhu RelationsPanel.handleSuggestAccept.

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { PersonWithMeta } from '../../hooks/usePersons'
import { useLabels } from '../../hooks/useSettings'
import { displayName as personDisplayName } from '../../lib/displayName'
import { vnNormalize } from '../../lib/normalize'
import { createRelationship, fetchRelationTypes } from '../../lib/relations'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../Avatar'
import { Modal } from '../Modal'
import { GROUP_COLORS } from '../PersonCard'

type QuickAddMode = 'parent' | 'spouse' | 'child'

interface QuickAddRelativeProps {
  open: boolean
  mode: QuickAddMode
  anchorPerson: PersonWithMeta
  persons: PersonWithMeta[]
  onClose: () => void
  onCreated: () => void
}

const GENDER_OPTIONS: ('nam' | 'nu' | null)[] = [null, 'nam', 'nu']

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/40'

export function QuickAddRelative({
  open,
  mode,
  anchorPerson,
  persons,
  onClose,
  onCreated,
}: QuickAddRelativeProps) {
  const { t } = useLabels()

  const [tab, setTab] = useState<'pick' | 'create'>('pick')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tab "Tao nguoi moi"
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<'nam' | 'nu' | null>(null)
  const [birthYear, setBirthYear] = useState<number | ''>('')
  const [deceased, setDeceased] = useState(false)
  const [deathYear, setDeathYear] = useState<number | ''>('')

  useEffect(() => {
    if (!open) return
    setTab('pick')
    setQuery('')
    setError(null)
    setFullName('')
    setGender(null)
    setBirthYear('')
    setDeceased(false)
    setDeathYear('')
  }, [open, mode])

  const filteredPersons = useMemo(() => {
    const q = vnNormalize(query.trim())
    const candidates = persons.filter((p) => p.id !== anchorPerson.id)
    if (!q) return candidates.slice(0, 8)
    return candidates
      .filter((p) => vnNormalize(`${p.nickname ?? ''} ${p.full_name}`).includes(q))
      .slice(0, 8)
  }, [persons, query, anchorPerson.id])

  const modeTitle =
    mode === 'parent' ? t('panel.add_parent') : mode === 'spouse' ? t('panel.add_spouse') : t('panel.add_child')

  // Tao 1 dong quan he giua anchorPerson va otherId theo dung chieu cua mode
  // — bo_me_con: A = bo/me, B = con; vo_chong: doi xung, khong quan trong ai
  // la A. Tra ve true neu thanh cong (23505 = da ton tai san -> coi nhu
  // thanh cong im lang, khong bao loi).
  async function linkRelationship(otherId: string): Promise<boolean> {
    const types = await fetchRelationTypes()
    const parentChildType = types.find((rt) => rt.value === 'bo_me_con')
    const spouseType = types.find((rt) => rt.value === 'vo_chong')

    let personA: string
    let personB: string
    let type: string
    let labelAB: string
    let labelBA: string

    if (mode === 'parent') {
      personA = otherId
      personB = anchorPerson.id
      type = 'bo_me_con'
      labelAB = parentChildType?.label_a_to_b ?? 'bố/mẹ của'
      labelBA = parentChildType?.label_b_to_a ?? 'con của'
    } else if (mode === 'child') {
      personA = anchorPerson.id
      personB = otherId
      type = 'bo_me_con'
      labelAB = parentChildType?.label_a_to_b ?? 'bố/mẹ của'
      labelBA = parentChildType?.label_b_to_a ?? 'con của'
    } else {
      personA = anchorPerson.id
      personB = otherId
      type = 'vo_chong'
      labelAB = spouseType?.label_a_to_b ?? 'vợ/chồng của'
      labelBA = spouseType?.label_b_to_a ?? 'vợ/chồng của'
    }

    const { error: err } = await createRelationship({ personA, personB, type, labelAB, labelBA, note: null })
    if (err && err.code !== '23505') {
      setError(err.message)
      return false
    }
    return true
  }

  async function handlePick(person: PersonWithMeta) {
    setSaving(true)
    setError(null)

    if (!person.in_family_tree) {
      const { error: err } = await supabase
        .from('persons')
        .update({ in_family_tree: true })
        .eq('id', person.id)
      if (err) {
        setSaving(false)
        setError(err.message)
        return
      }
    }

    const ok = await linkRelationship(person.id)
    setSaving(false)
    if (ok) {
      onCreated()
    }
  }

  async function handleCreateNew(e: FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      setError(t('person.contact_name'))
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      full_name: fullName.trim(),
      nickname: fullName.trim(),
      group_type: 'gia_dinh' as const,
      in_family_tree: true,
      gender,
      birth_year: birthYear === '' ? null : Number(birthYear),
      death_year: deceased && deathYear !== '' ? Number(deathYear) : null,
    }

    const insertRes = await supabase.from('persons').insert(payload).select('id').single()
    if (insertRes.error || !insertRes.data) {
      setSaving(false)
      setError(insertRes.error?.message ?? t('actions.save'))
      return
    }

    const newId = (insertRes.data as { id: string }).id
    const ok = await linkRelationship(newId)
    setSaving(false)
    if (ok) {
      onCreated()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={modeTitle} maxWidthClass="md:max-w-lg">
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 rounded-lg border border-line bg-card p-1">
          <button
            type="button"
            onClick={() => setTab('pick')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'pick' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink'
            }`}
          >
            {t('panel.pick_existing')}
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'create' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink'
            }`}
          >
            {t('panel.create_new')}
          </button>
        </div>

        {tab === 'pick' && (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('actions.search')}
              className={INPUT_CLASS}
            />
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {filteredPersons.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={saving}
                  onClick={() => void handlePick(p)}
                  className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-left transition-colors hover:border-primary/30 disabled:opacity-50"
                >
                  <Avatar name={personDisplayName(p)} avatarUrl={p.avatar_url} size={26} />
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
                </button>
              ))}
              {filteredPersons.length === 0 && (
                <p className="py-3 text-center text-xs text-muted">{t('empty.no_results')}</p>
              )}
            </div>
          </div>
        )}

        {tab === 'create' && (
          <form onSubmit={handleCreateNew} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('person.contact_name')} *
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </label>

            <div>
              <div className="mb-1.5 text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('person.gender')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GENDER_OPTIONS.map((g) => {
                  const active = gender === g
                  return (
                    <button
                      key={g ?? 'none'}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-line bg-card text-muted hover:text-ink'
                      }`}
                    >
                      {g === 'nam' ? t('person.gender_nam') : g === 'nu' ? t('person.gender_nu') : '—'}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                {t('person.birth_year')}
              </span>
              <input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value === '' ? '' : Number(e.target.value))}
                className={INPUT_CLASS}
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={deceased}
                onChange={(e) => setDeceased(e.target.checked)}
                className="h-3.5 w-3.5 accent-muted"
              />
              {t('person.deceased')}
            </label>

            {deceased && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
                  {t('person.death_year')}
                </span>
                <input
                  type="number"
                  value={deathYear}
                  onChange={(e) => setDeathYear(e.target.value === '' ? '' : Number(e.target.value))}
                  className={INPUT_CLASS}
                />
              </label>
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
        )}

        {error && (
          <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">{error}</p>
        )}
      </div>
    </Modal>
  )
}

export default QuickAddRelative
