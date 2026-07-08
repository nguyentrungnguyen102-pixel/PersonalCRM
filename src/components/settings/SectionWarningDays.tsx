// Muc "So ngay canh bao sap nguoi" — 1 input so.

import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import { DEFAULT_SETTINGS } from '../../lib/settingsDefaults'
import { SectionShell } from './SectionShell'

interface SectionWarningDaysProps {
  showToast: (kind: 'success' | 'error', text: string) => void
  onDirtyChange: (dirty: boolean) => void
}

export function SectionWarningDays({ showToast, onDirtyChange }: SectionWarningDaysProps) {
  const { t, warningDays, refresh } = useSettings()
  const [draft, setDraft] = useState<number>(warningDays)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(warningDays), [warningDays])

  const dirty = useMemo(() => draft !== warningDays, [draft, warningDays])

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('app_settings')
      .update({ value: draft })
      .eq('key', 'warning_days')
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
      .update({ value: DEFAULT_SETTINGS.warning_days })
      .eq('key', 'warning_days')
    if (err) {
      showToast('error', err.message)
      return
    }
    await refresh()
    showToast('success', t('settings.restored'))
  }

  return (
    <SectionShell
      title={t('settings.warning_days')}
      dirty={dirty}
      saving={saving}
      error={error}
      onSave={() => void handleSave()}
      onRestore={handleRestore}
    >
      <div className="flex items-center gap-2.5">
        <input
          type="number"
          min={1}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          className="w-24 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary/50"
        />
        <span className="text-[11px] text-muted">{t('settings.days_unit')}</span>
      </div>
    </SectionShell>
  )
}

export default SectionWarningDays
