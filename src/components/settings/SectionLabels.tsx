// Muc "Nhan hien thi" — sua truc tiep cay labels 2 cap (nhom -> key). Moi
// nhom la 1 collapse; ten nhom/key la ten ky thuat (mono, chi doc), chi value
// (chuoi tieng Viet hien thi) la cho sua.

import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import { DEFAULT_SETTINGS } from '../../lib/settingsDefaults'
import type { LabelTree } from '../../lib/types'
import { SectionShell } from './SectionShell'

interface SectionLabelsProps {
  showToast: (kind: 'success' | 'error', text: string) => void
  onDirtyChange: (dirty: boolean) => void
}

function cloneTree(tree: LabelTree): LabelTree {
  return JSON.parse(JSON.stringify(tree)) as LabelTree
}

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary/50'

export function SectionLabels({ showToast, onDirtyChange }: SectionLabelsProps) {
  const { t, labels, refresh } = useSettings()
  const [draft, setDraft] = useState<LabelTree>(() => cloneTree(labels))
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(cloneTree(labels))
  }, [labels])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(labels), [draft, labels])

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  function toggleGroup(key: string) {
    setOpenGroups((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function updateField(groupKey: string, itemKey: string, value: string) {
    setDraft((cur) => {
      const next = cloneTree(cur)
      const group = next[groupKey]
      if (group && typeof group === 'object') {
        ;(group as LabelTree)[itemKey] = value
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('app_settings').update({ value: draft }).eq('key', 'labels')
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
      .update({ value: DEFAULT_SETTINGS.labels })
      .eq('key', 'labels')
    if (err) {
      showToast('error', err.message)
      return
    }
    await refresh()
    showToast('success', t('settings.restored'))
  }

  const groupEntries = Object.entries(draft).filter(
    (entry): entry is [string, LabelTree] => typeof entry[1] === 'object' && entry[1] !== null,
  )

  return (
    <SectionShell
      title={t('settings.labels')}
      dirty={dirty}
      saving={saving}
      error={error}
      onSave={() => void handleSave()}
      onRestore={handleRestore}
    >
      <div className="flex flex-col gap-2">
        {groupEntries.map(([groupKey, group]) => {
          const isOpen = openGroups.has(groupKey)
          const itemEntries = Object.entries(group).filter(
            (e): e is [string, string] => typeof e[1] === 'string',
          )
          return (
            <div key={groupKey} className="rounded-lg border border-line">
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                className="flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <span className="font-mono text-xs text-muted">{groupKey}</span>
                <span className="text-[11px] text-muted">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-2 border-t border-line px-3 py-2.5">
                  {itemEntries.map(([itemKey, value]) => (
                    <div key={itemKey} className="flex items-center gap-2">
                      <span
                        className="w-32 flex-shrink-0 truncate font-mono text-[11px] text-muted"
                        title={itemKey}
                      >
                        {itemKey}
                      </span>
                      <input
                        value={value}
                        onChange={(e) => updateField(groupKey, itemKey, e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </SectionShell>
  )
}

export default SectionLabels
