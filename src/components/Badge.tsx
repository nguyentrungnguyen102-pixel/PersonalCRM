import type { KeepInTouchColor, KeepInTouchResult } from '../lib/keepInTouch'
import { useLabels } from '../hooks/useSettings'

const COLOR_HEX: Record<KeepInTouchColor, string> = {
  muted: '#78716c',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
}

interface BadgeProps {
  result: KeepInTouchResult
  className?: string
}

export function Badge({ result, className = '' }: BadgeProps) {
  const { t } = useLabels()
  const color = COLOR_HEX[result.color]

  return (
    <span
      style={{ color, background: `${color}18`, borderColor: `${color}40` }}
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}
    >
      {t(`status.${result.status}`)}
    </span>
  )
}
