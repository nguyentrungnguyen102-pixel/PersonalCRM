// Muc "Loai tuong tac" — bat/tat hien thi + sua nhan cac loai co san (7 gia
// tri enum public.interaction_type cua DB), them loai moi CHI de hien thi/loc
// (khong the ghi vao DB do enum co dinh) — loai moi luon enabled:false.

import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import { DEFAULT_SETTINGS } from '../../lib/settingsDefaults'
import { vnNormalize } from '../../lib/normalize'
import type { InteractionTypeOption, LabelTree } from '../../lib/types'
import { SectionShell } from './SectionShell'

interface SectionInteractionTypesProps {
  showToast: (kind: 'success' | 'error', text: string) => void
  onDirtyChange: (dirty: boolean) => void
}

function slugify(label: string): string {
  return vnNormalize(label)
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

export function SectionInteractionTypes({ showToast, onDirtyChange }: SectionInteractionTypesProps) {
  const { t, labels, interactionTypes, refresh } = useSettings()
  const [draft, setDraft] = useState<InteractionTypeOption[]>(interactionTypes)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(interactionTypes), [interactionTypes])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(interactionTypes),
    [draft, interactionTypes],
  )

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  function updateLabel(value: string, label: string) {
    setDraft((cur) => cur.map((item) => (item.value === value ? { ...item, label } : item)))
  }

  function toggleEnabled(value: string) {
    setDraft((cur) =>
      cur.map((item) => (item.value === value && !item.custom ? { ...item, enabled: !item.enabled } : item)),
    )
  }

  function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    let value = slugify(label)
    if (!value) return

    const existing = new Set(draft.map((i) => i.value))
    if (existing.has(value)) {
      let n = 2
      while (existing.has(`${value}_${n}`)) n += 1
      value = `${value}_${n}`
    }

    setDraft((cur) => [...cur, { value, label, enabled: false, custom: true }])
    setNewLabel('')
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const labelMap: Record<string, string> = {}
    for (const item of draft) labelMap[item.value] = item.label

    const currentInteractionLabels =
      labels.interaction_types && typeof labels.interaction_types === 'object'
        ? (labels.interaction_types as LabelTree)
        : {}
    const nextLabels: LabelTree = {
      ...labels,
      interaction_types: { ...currentInteractionLabels, ...labelMap },
    }

    const { error: errTypes } = await supabase
      .from('app_settings')
      .update({ value: draft })
      .eq('key', 'interaction_types')

    if (errTypes) {
      setSaving(false)
      setError(errTypes.message)
      showToast('error', errTypes.message)
      return
    }

    const { error: errLabels } = await supabase
      .from('app_settings')
      .update({ value: nextLabels })
      .eq('key', 'labels')

    setSaving(false)

    if (errLabels) {
      setError(errLabels.message)
      showToast('error', errLabels.message)
      return
    }

    await refresh()
    showToast('success', t('settings.saved'))
  }

  async function handleRestore() {
    const { error: err } = await supabase
      .from('app_settings')
      .update({ value: DEFAULT_SETTINGS.interaction_types })
      .eq('key', 'interaction_types')
    if (err) {
      showToast('error', err.message)
      return
    }
    await refresh()
    showToast('success', t('settings.restored'))
  }

  return (
    <SectionShell
      title={t('settings.interaction_types')}
      dirty={dirty}
      saving={saving}
      error={error}
      onSave={() => void handleSave()}
      onRestore={handleRestore}
    >
      <div className="flex flex-col gap-2">
        {draft.map((item) => (
          <div key={item.value} className="flex flex-wrap items-center gap-2">
            <span className="w-24 flex-shrink-0 font-mono text-[11px] text-muted">{item.value}</span>
            <input
              value={item.label}
              onChange={(e) => updateLabel(item.value, e.target.value)}
              className="min-w-[120px] flex-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary/50"
            />
            {!item.custom ? (
              <label className="flex flex-shrink-0 items-center gap-1.5 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={() => toggleEnabled(item.value)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                {t('settings.enabled')}
              </label>
            ) : (
              <label className="flex flex-shrink-0 items-center gap-1.5 text-[11px] text-muted italic opacity-60">
                <input type="checkbox" checked={false} disabled className="h-3.5 w-3.5" />
                {t('settings.enabled')}
              </label>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2 border-t border-line pt-3">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder={t('settings.add_type')}
          className="min-w-[140px] flex-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/50"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newLabel.trim()}
          className="flex-shrink-0 rounded-lg border border-line px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          {t('settings.add_type')}
        </button>
      </div>
    </SectionShell>
  )
}

export default SectionInteractionTypes
