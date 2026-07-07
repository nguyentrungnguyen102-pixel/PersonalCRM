// Hop xac nhan xoa dung chung — dung cho xoa person, media...

import { useLabels } from '../hooks/useSettings'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  loading?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
  // Cho phep tai su dung cho cac xac nhan khac ngoai xoa (vi du "Khoi phuc
  // mac dinh" o trang Cai dat) — mac dinh giu nguyen van ban xoa cu.
  title?: string
  message?: string
  confirmLabel?: string
  tone?: 'danger' | 'default'
}

export function ConfirmDialog({
  open,
  loading = false,
  error,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel,
  tone = 'danger',
}: ConfirmDialogProps) {
  const { t } = useLabels()
  const dialogTitle = title ?? t('actions.delete')
  const dialogMessage = message ?? t('actions.confirm_delete')
  const dialogConfirmLabel = confirmLabel ?? t('actions.delete')
  const confirmBtnClass =
    tone === 'danger'
      ? 'bg-rose'
      : 'bg-primary'

  return (
    <Modal open={open} onClose={onCancel} title={dialogTitle} maxWidthClass="md:max-w-sm" center>
      <p className="mb-4 text-sm text-ink">{dialogMessage}</p>

      {error && (
        <p className="mb-3 rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${confirmBtnClass}`}
        >
          {loading ? '…' : dialogConfirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
