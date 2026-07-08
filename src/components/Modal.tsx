// Modal khung dung chung: overlay toi click-dong.
// - Mac dinh: mobile bottom-sheet full width (anim-slide-up), desktop card
//   giua man hinh (anim-fi).
// - center=true: card giua man hinh o MOI kich thuoc — dung cho dialog nho
//   (xac nhan xoa...) de khong bi thanh cong cu Safari/home-indicator tren
//   iOS de len nut o day man hinh.
// max-h dung dvh (dynamic viewport height) de tru phan thanh cong cu di dong.

import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidthClass?: string
  center?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClass = 'md:max-w-lg',
  center = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const overlayClass = center
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
    : 'fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-4'

  const sheetClass = center
    ? `anim-fi flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-card border border-line bg-surface ${maxWidthClass}`
    : `anim-slide-up md:anim-fi flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[13px] border border-line bg-surface md:max-h-[90vh] md:rounded-card ${maxWidthClass}`

  return (
    <div className={overlayClass} onClick={onClose} role="presentation">
      <div
        className={sheetClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-heading text-sm font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-md p-1 text-muted transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div
          className="overflow-y-auto px-4 py-4"
          style={center ? undefined : { paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
