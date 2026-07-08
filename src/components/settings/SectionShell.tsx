// Khung dung chung cho cac muc trong trang Cai dat: the (card) + tieu de +
// nut Luu (dirty-aware) + nut Khoi phuc mac dinh (co xac nhan). Cac section
// cu the (Labels, GroupDefaults, InteractionTypes, VideoDomains, WarningDays)
// chi can truyen noi dung (children) + trang thai dirty/saving/loi.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useLabels } from '../../hooks/useSettings'
import { ConfirmDialog } from '../ConfirmDialog'

interface SectionShellProps {
  title: string
  dirty: boolean
  saving: boolean
  error?: string | null
  onSave: () => void
  onRestore?: () => Promise<void> | void
  children: ReactNode
}

export function SectionShell({ title, dirty, saving, error, onSave, onRestore, children }: SectionShellProps) {
  const { t } = useLabels()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function handleRestore() {
    if (!onRestore) return
    setRestoring(true)
    await onRestore()
    setRestoring(false)
    setConfirmOpen(false)
  }

  return (
    <div className="rounded-card border border-line bg-card p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-bold text-ink">{title}</h2>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[11px] text-amber">{t('settings.unsaved')}</span>}
          {onRestore && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink"
            >
              {t('settings.restore')}
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onSave}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? '…' : t('settings.save')}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">{error}</p>
      )}

      {children}

      {onRestore && (
        <ConfirmDialog
          open={confirmOpen}
          loading={restoring}
          title={t('settings.restore')}
          message={`${t('settings.restore')} — ${title}?`}
          confirmLabel={t('settings.restore')}
          tone="default"
          onConfirm={() => void handleRestore()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}

export default SectionShell
