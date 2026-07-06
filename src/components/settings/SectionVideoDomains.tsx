// Muc "Domain video cho phep" — danh sach domain duoc chap nhan khi dan link
// video, them/xoa tai cho.

import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import { DEFAULT_SETTINGS } from '../../lib/settingsDefaults'
import { SectionShell } from './SectionShell'

interface SectionVideoDomainsProps {
  showToast: (kind: 'success' | 'error', text: string) => void
  onDirtyChange: (dirty: boolean) => void
}

export function SectionVideoDomains({ showToast, onDirtyChange }: SectionVideoDomainsProps) {
  const { t, videoDomains, refresh } = useSettings()
  const [draft, setDraft] = useState<string[]>(videoDomains)
  const [newDomain, setNewDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(videoDomains), [videoDomains])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(videoDomains),
    [draft, videoDomains],
  )

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  function handleAdd() {
    const domain = newDomain.trim().toLowerCase()
    if (!domain || draft.includes(domain)) return
    setDraft((cur) => [...cur, domain])
    setNewDomain('')
  }

  function handleRemove(domain: string) {
    setDraft((cur) => cur.filter((d) => d !== domain))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('app_settings')
      .update({ value: draft })
      .eq('key', 'video_domains')
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
      .update({ value: DEFAULT_SETTINGS.video_domains })
      .eq('key', 'video_domains')
    if (err) {
      showToast('error', err.message)
      return
    }
    await refresh()
    showToast('success', t('settings.restored'))
  }

  return (
    <SectionShell
      title={t('settings.video_domains')}
      dirty={dirty}
      saving={saving}
      error={error}
      onSave={() => void handleSave()}
      onRestore={handleRestore}
    >
      <div className="flex flex-col gap-1.5">
        {draft.map((domain) => (
          <div
            key={domain}
            className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5"
          >
            <span className="font-mono text-xs text-ink">{domain}</span>
            <button
              type="button"
              onClick={() => handleRemove(domain)}
              aria-label={t('settings.remove')}
              className="text-xs text-muted transition-colors hover:text-rose"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2 border-t border-line pt-3">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder={t('settings.add_domain')}
          className="min-w-[140px] flex-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/50"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newDomain.trim()}
          className="flex-shrink-0 rounded-lg border border-line px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          {t('settings.add_domain')}
        </button>
      </div>
    </SectionShell>
  )
}

export default SectionVideoDomains
