// Hop xac nhan xoa dung chung — dung cho xoa person, media...

import { useLabels } from '../hooks/useSettings'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  loading?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, loading = false, error, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useLabels()

  return (
    <Modal open={open} onClose={onCancel} title={t('actions.delete')} maxWidthClass="md:max-w-sm">
      <p className="mb-4 text-sm text-ink">{t('actions.confirm_delete')}</p>

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
          className="rounded-lg bg-rose px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '…' : t('actions.delete')}
        </button>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
