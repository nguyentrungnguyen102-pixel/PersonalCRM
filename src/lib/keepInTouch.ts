// Logic badge "sắp nguội" — dựa theo freqBadge() của bản mockup thiết kế.

export type KeepInTouchStatus = 'no_reminder' | 'on_track' | 'due_soon' | 'overdue'
export type KeepInTouchColor = 'muted' | 'emerald' | 'amber' | 'rose'

export interface KeepInTouchInput {
  lastContacted: string | null
  frequencyDays: number | null
  warningDays: number
}

export interface KeepInTouchResult {
  status: KeepInTouchStatus
  daysLeft: number | null
  color: KeepInTouchColor
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function keepInTouch({
  lastContacted,
  frequencyDays,
  warningDays,
}: KeepInTouchInput): KeepInTouchResult {
  if (frequencyDays == null) {
    return { status: 'no_reminder', daysLeft: null, color: 'muted' }
  }

  // Chưa từng liên hệ → coi như quá hạn, cần liên hệ lần đầu.
  if (!lastContacted) {
    return { status: 'overdue', daysLeft: -frequencyDays, color: 'rose' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const last = new Date(lastContacted)
  last.setHours(0, 0, 0, 0)

  const daysSince = Math.floor((today.getTime() - last.getTime()) / MS_PER_DAY)
  const daysLeft = frequencyDays - daysSince

  if (daysLeft < 0) {
    return { status: 'overdue', daysLeft, color: 'rose' }
  }

  if (daysSince >= frequencyDays * 0.7 || daysLeft <= warningDays) {
    return { status: 'due_soon', daysLeft, color: 'amber' }
  }

  return { status: 'on_track', daysLeft, color: 'emerald' }
}
