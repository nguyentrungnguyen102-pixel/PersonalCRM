// Modal khung dung chung: overlay toi click-dong, mobile bottom-sheet full
// width (anim-slide-up), desktop card giua man hinh (anim-fi).

import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidthClass?: string
}

export function Modal({ open, onClose, title, children, maxWidthClass = 'md:max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`anim-slide-up md:anim-fi flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-[13px] border border-line bg-surface md:rounded-card ${maxWidthClass}`}
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
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

export default Modal
