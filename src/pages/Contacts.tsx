import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import { vnNormalize } from '../lib/normalize'
import type { GroupType } from '../lib/types'
import { GROUP_COLORS, PersonCard } from '../components/PersonCard'

const GROUP_TYPES: GroupType[] = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']

interface ContactsProps {
  // TODO(module sau): noi modal "Them lien he" — hien tai chi la stub.
  onAddPerson?: () => void
}

export function Contacts({ onAddPerson }: ContactsProps) {
  const { t } = useLabels()
  const { canEdit } = useAuth()
  const { persons, loading, error } = usePersons()

  const [query, setQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<GroupType | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)

  const vips = useMemo(() => persons.filter((p) => p.is_favorite), [persons])

  const filtered = useMemo(() => {
    const normalizedQuery = vnNormalize(query.trim())

    return persons.filter((p) => {
      if (favoriteOnly && !p.is_favorite) return false
      if (selectedGroup && p.group_type !== selectedGroup) return false

      if (!normalizedQuery) return true

      const haystack = p.search_text
        ? vnNormalize(p.search_text)
        : vnNormalize(`${p.full_name} ${p.nickname ?? ''}`)

      return haystack.includes(normalizedQuery)
    })
  }, [persons, query, selectedGroup, favoriteOnly])

  const handleAddPerson = () => {
    // TODO(module sau): mo modal them lien he. Hien tai chi la stub.
    onAddPerson?.()
  }

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t('nav.contacts')}</h1>
          <p className="mt-0.5 font-mono text-xs text-muted">{persons.length}</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleAddPerson}
            className="flex-shrink-0 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            + {t('actions.add_person')}
          </button>
        )}
      </div>

      {vips.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-[10px] font-semibold tracking-[1.2px] text-primary uppercase">
            ⭐ {t('person.favorite')}
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5">
            {vips.map((person) => (
              <PersonCard key={person.id} person={person} compact />
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted">
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('actions.search')}
            className="w-full rounded-lg border border-line bg-card py-2 pr-3 pl-8 text-xs text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="button"
          onClick={() => setFavoriteOnly((v) => !v)}
          className={`flex-shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            favoriteOnly
              ? 'border-amber/40 bg-amber/15 text-amber'
              : 'border-line bg-card text-muted hover:text-ink'
          }`}
        >
          ⭐ {t('person.favorite')}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {GROUP_TYPES.map((group) => {
          const active = selectedGroup === group
          const color = GROUP_COLORS[group]
          return (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup((cur) => (cur === group ? null : group))}
              style={
                active
                  ? { background: `${color}22`, color, borderColor: `${color}55` }
                  : undefined
              }
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active ? '' : 'border-line bg-card text-muted hover:text-ink'
              }`}
            >
              {t(`groups.${group}`)}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-card border border-rose/30 bg-rose/5 px-4 py-3 text-xs text-rose">
          {error}
        </div>
      )}

      {!loading && !error && persons.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <p className="text-sm text-muted">{t('empty.no_persons')}</p>
        </div>
      )}

      {!loading && !error && persons.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <p className="text-sm text-muted">{t('empty.no_results')}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Contacts
