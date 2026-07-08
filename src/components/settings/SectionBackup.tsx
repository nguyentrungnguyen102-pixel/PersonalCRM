// Muc "Sao lưu dữ liệu" trong Cai dat — xuat toan bo persons/interactions/
// media/relationships/tasks ra 1 file .zip (CSV + metadata.json) va tai ve
// may. Chi admin dung duoc (Settings da guard admin-only o cap route/nav,
// component nay double-check role phong khi duoc render sai cho).

import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLabels } from '../../hooks/useSettings'
import { exportBackup } from '../../lib/backup'

interface SectionBackupProps {
  showToast: (kind: 'success' | 'error', text: string) => void
}

export function SectionBackup({ showToast }: SectionBackupProps) {
  const { t } = useLabels()
  const { isAdmin } = useAuth()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await exportBackup()
      showToast('success', t('backup.done'))
    } catch (err) {
      const message = err instanceof Error ? err.message : t('backup.error')
      showToast('error', message)
    } finally {
      setExporting(false)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="rounded-card border border-line bg-card p-4 md:p-5">
      <h2 className="mb-2 font-heading text-sm font-bold text-ink">{t('backup.title')}</h2>
      <p className="mb-4 max-w-md text-xs text-muted">{t('backup.description')}</p>

      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {exporting && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {exporting ? t('backup.exporting') : t('backup.export')}
      </button>
    </div>
  )
}

export default SectionBackup
