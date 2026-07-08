import { useNavigate } from 'react-router-dom'
import type { PersonWithMeta } from '../hooks/usePersons'
import { useLabels, useSettings } from '../hooks/useSettings'
import { displayName } from '../lib/displayName'
import { keepInTouch } from '../lib/keepInTouch'
import type { GroupType } from '../lib/types'
import { Avatar } from './Avatar'
import { Badge } from './Badge'

// Mau co dinh, deterministic theo nhom quan he — dung chung cho card,
// chip loc nhom va cac diem nhan mau sac lien quan toi group_type.
export const GROUP_COLORS: Record<GroupType, string> = {
  gia_dinh: '#fb7185',
  ban_be: '#34d399',
  doi_tac: '#f97316',
  dong_nghiep: '#38bdf8',
  con_cai: '#fbbf24',
  khac: '#a78bfa',
}

interface PersonCardProps {
  person: PersonWithMeta
  compact?: boolean
}

export function PersonCard({ person, compact = false }: PersonCardProps) {
  const navigate = useNavigate()
  const { t } = useLabels()
  const { warningDays } = useSettings()

  const color = GROUP_COLORS[person.group_type]
  const primaryName = displayName(person)
  const status = keepInTouch({
    lastContacted: person.last_contacted,
    frequencyDays: person.contact_frequency_days,
    warningDays,
  })

  const visibleTags = person.tags.slice(0, 3)
  const extraTagsCount = person.tags.length - visibleTags.length

  return (
    <div
      onClick={() => navigate(`/nguoi/${person.id}`)}
      className={`relative cursor-pointer overflow-hidden rounded-card border border-line bg-card transition-colors hover:border-primary/30 ${
        compact ? 'w-[168px] flex-shrink-0 p-3' : 'p-3.5'
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 h-[70px] w-[70px]"
        style={{ background: `radial-gradient(circle at top right, ${color}12, transparent 70%)` }}
      />

      {person.is_favorite && (
        <span className="absolute top-2.5 right-2.5 text-xs" aria-hidden>
          ⭐
        </span>
      )}

      <div className="mb-2.5 flex items-start gap-2.5">
        <Avatar name={primaryName} avatarUrl={person.avatar_url} size={compact ? 36 : 40} />
        <div className="min-w-0 flex-1 pr-4">
          <div className="truncate text-[13px] font-bold text-ink">{primaryName}</div>
          {person.full_name !== primaryName && (
            <div className="truncate text-[10px] text-muted">{person.full_name}</div>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="truncate text-[10px] text-muted">{t(`groups.${person.group_type}`)}</span>
      </div>

      {!compact && person.tags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-primary/15 bg-primary/[0.07] px-1.5 py-0.5 text-[9px] text-primary"
            >
              {tag}
            </span>
          ))}
          {extraTagsCount > 0 && (
            <span className="px-1 py-0.5 text-[9px] text-muted">+{extraTagsCount}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Badge result={status} />
      </div>
    </div>
  )
}

export default PersonCard
