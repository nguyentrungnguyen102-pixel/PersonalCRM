// Muc "Nhip mac dinh theo nhom" — 6 dong (1 dong / nhom) + input so ngay.

import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import { DEFAULT_SETTINGS } from '../../lib/settingsDefaults'
import type { GroupType } from '../../lib/types'
import { SectionShell } from './SectionShell'

const GROUP_TYPES: GroupType[] = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']

interface SectionGroupDefaultsProps {
  showToast: (kind: 'success' | 'error', text: string) => void
  onDirtyChange: (dirty: boolean) => void
}

export function SectionGroupDefaults({ showToast, onDirtyChange }: SectionGroupDefaultsProps) {
  const { t, groupDefaults, refresh } = useSettings()
  const [draft, setDraft] = useState<Record<GroupType, number>>(groupDefaults)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(groupDefaults), [groupDefaults])

  const dirty = useMemo(
    () => GROUP_TYPES.some((g) => draft[g] !== groupDefaults[g]),
    [draft, groupDefaults],
  )

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('app_settings')
      .update({ value: draft })
      .eq('key', 'group_defaults')
    setSaving(false)
    if (err) {
      setError(err.message)
      showToast('error', err.message)
      return
    }
    await refresh()
    showToast('success', t('settings.saved'))
  }

  async function handleRestore() {
    const { error: err } = await supabase
      .from('app_settings')
      .update({ value: DEFAULT_SETTINGS.group_defaults })
      .eq('key', 'group_defaults')
    if (err) {
      showToast('error', err.message)
      return
    }
    await refresh()
    showToast('success', t('settings.restored'))
  }

  return (
    <SectionShell
      title={t('settings.group_defaults')}
      dirty={dirty}
      saving={saving}
      error={error}
      onSave={() => void handleSave()}
      onRestore={handleRestore}
    >
      <div className="flex flex-col gap-2.5">
        {GROUP_TYPES.map((g) => (
          <div key={g} className="flex items-center gap-2.5">
            <span className="w-32 flex-shrink-0 text-xs text-ink">{t(`groups.${g}`)}</span>
            <input
              type="number"
              min={0}
              value={draft[g]}
              onChange={(e) => setDraft((cur) => ({ ...cur, [g]: Number(e.target.value) }))}
              className="w-24 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary/50"
            />
            <span className="text-[11px] text-muted">{t('settings.days_unit')}</span>
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

export default SectionGroupDefaults
