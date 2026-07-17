// Dong thoi gian dang cham-noi (dot + connector) dung chung — tach nguyen ven
// tu phan hien thi tuong tac trong src/pages/PersonProfile.tsx de tai su dung
// cho ca "Dong doi" (life_events) trong PersonPanel.tsx (gia pha). Component
// THUAN hien thi (khong fetch, khong biet du lieu tu dau) — noi goi tu chuan
// bi san mang TimelineItem DA SAP XEP (moi -> cu).

import type { ReactNode } from 'react'

export interface TimelineItem {
  id: string
  icon?: string
  chipLabel?: string
  dateLabel: string
  title?: string
  note?: string
  footer?: string
  actions?: ReactNode
}

interface TimelineProps {
  items: TimelineItem[]
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="flex flex-col">
      {items.map((item, idx) => (
        <div key={item.id} className="flex gap-2.5 pb-3.5">
          <div className="flex flex-shrink-0 flex-col items-center pt-0.5">
            <div
              className="h-2 w-2 rounded-full bg-primary"
              style={{ boxShadow: '0 0 7px rgba(249,115,22,0.5)' }}
              aria-hidden
            />
            {idx < items.length - 1 && (
              <div className="mt-1 min-h-6 w-px flex-1 bg-line" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {item.icon && <span aria-hidden>{item.icon}</span>}
              {item.chipLabel && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {item.chipLabel}
                </span>
              )}
              <span className="font-mono text-[10px] text-muted">{item.dateLabel}</span>
              {item.actions && (
                <span className="ml-auto flex flex-shrink-0 items-center gap-1">{item.actions}</span>
              )}
            </div>
            {item.title && <div className="text-xs font-semibold text-ink">{item.title}</div>}
            {item.note && <div className="text-xs leading-relaxed text-ink">{item.note}</div>}
            {item.footer && <div className="mt-0.5 text-[10px] text-muted">{item.footer}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Timeline
