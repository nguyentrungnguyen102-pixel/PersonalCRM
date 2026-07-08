// Muc "Doi mat khau" — dat cuoi trang Cai dat, validate do dai + khop nhau
// truoc khi goi supabase.auth.updateUser.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLabels } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'

interface SectionPasswordProps {
  showToast: (kind: 'success' | 'error', text: string) => void
  onDirtyChange: (dirty: boolean) => void
}

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-primary/50'

export function SectionPassword({ showToast, onDirtyChange }: SectionPasswordProps) {
  const { t } = useLabels()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updatePassword(v: string) {
    setPassword(v)
    onDirtyChange(v.length > 0 || confirm.length > 0)
  }

  function updateConfirm(v: string) {
    setConfirm(v)
    onDirtyChange(password.length > 0 || v.length > 0)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('password.too_short'))
      return
    }
    if (password !== confirm) {
      setError(t('password.mismatch'))
      return
    }

    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    setPassword('')
    setConfirm('')
    onDirtyChange(false)
    showToast('success', t('password.changed'))
  }

  return (
    <div className="rounded-card border border-line bg-card p-4 md:p-5">
      <h2 className="mb-4 font-heading text-sm font-bold text-ink">{t('settings.password')}</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('password.new_password')}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => updatePassword(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-[0.4px] text-muted uppercase">
            {t('password.confirm')}
          </span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => updateConfirm(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        {error && (
          <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || !password || !confirm}
          className="self-start rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? '…' : t('password.change')}
        </button>
      </form>
    </div>
  )
}

export default SectionPassword
