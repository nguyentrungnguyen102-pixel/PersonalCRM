import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePersons } from '../hooks/usePersons'
import { useLabels } from '../hooks/useSettings'
import { vnNormalize } from '../lib/normalize'
import type { GroupType } from '../lib/types'
import { GROUP_COLORS, PersonCard } from '../components/PersonCard'
import { PersonFormModal, type PersonFormInitialValues } from '../components/PersonFormModal'
import { ScanCardModal } from '../components/ScanCardModal'
import { ContactsTable } from '../components/ContactsTable'
import { TagFilterDropdown, type TagCount } from '../components/TagFilterDropdown'

const GROUP_TYPES: GroupType[] = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac']
const VIEW_MODE_KEY = 'personalcrm.contacts.view_mode'

type ViewMode = 'card' | 'table'

function loadViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'card'
  const saved = window.localStorage.getItem(VIEW_MODE_KEY)
  return saved === 'table' ? 'table' : 'card'
}

export function Contacts() {
  const { t } = useLabels()
  const { canEdit, isAdmin } = useAuth()
  const { persons, loading, error, refresh } = usePersons()

  const [query, setQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<GroupType | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)
  const [scanInitialValues, setScanInitialValues] = useState<PersonFormInitialValues | undefined>(
    undefined,
  )
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode)

  function toggleTag(tag: string) {
    setSelectedTags((cur) => {
      const next = new Set(cur)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function clearTags() {
    setSelectedTags(new Set())
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode)
    window.localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  const vips = useMemo(() => persons.filter((p) => p.is_favorite), [persons])

  const tagCounts = useMemo<TagCount[]>(() => {
    const counts = new Map<string, number>()
    for (const p of persons) {
      for (const tag of p.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'vi'))
  }, [persons])

  const filtered = useMemo(() => {
    const normalizedQuery = vnNormalize(query.trim())

    return persons.filter((p) => {
      if (favoriteOnly && !p.is_favorite) return false
      if (selectedGroup && p.group_type !== selectedGroup) return false
      if (selectedTags.size > 0 && !p.tags.some((tag) => selectedTags.has(tag))) return false

      if (!normalizedQuery) return true

      const haystack = p.search_text
        ? vnNormalize(p.search_text)
        : vnNormalize(`${p.full_name} ${p.nickname ?? ''}`)

      return haystack.includes(normalizedQuery)
    })
  }, [persons, query, selectedGroup, favoriteOnly, selectedTags])

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t('nav.contacts')}</h1>
          <p className="mt-0.5 font-mono text-xs text-muted">{persons.length}</p>
        </div>
        {canEdit && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <Link
              to="/goi-y-ten"
              className="rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              ✨ {t('names.title')}
            </Link>
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              className="rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              📇 {t('scan.title')}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              + {t('actions.add_person')}
            </button>
          </div>
        )}
      </div>

      <PersonFormModal
        open={showAddModal}
        initialValues={scanInitialValues}
        onClose={() => {
          setShowAddModal(false)
          setScanInitialValues(undefined)
        }}
        onSaved={refresh}
      />

      <ScanCardModal
        open={showScanModal}
        onClose={() => setShowScanModal(false)}
        onUseResult={(values) => {
          setScanInitialValues(values)
          setShowScanModal(false)
          setShowAddModal(true)
        }}
      />

      {viewMode === 'card' && vips.length > 0 && (
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
        <TagFilterDropdown
          tagCounts={tagCounts}
          selected={selectedTags}
          onToggle={toggleTag}
          onClear={clearTags}
        />
        <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-line">
          <button
            type="button"
            onClick={() => changeViewMode('card')}
            className={`px-2.5 py-2 text-xs font-medium transition-colors ${
              viewMode === 'card' ? 'bg-primary/15 text-primary' : 'bg-card text-muted hover:text-ink'
            }`}
          >
            ⊞ {t('table.view_card')}
          </button>
          <button
            type="button"
            onClick={() => changeViewMode('table')}
            className={`border-l border-line px-2.5 py-2 text-xs font-medium transition-colors ${
              viewMode === 'table' ? 'bg-primary/15 text-primary' : 'bg-card text-muted hover:text-ink'
            }`}
          >
            ☰ {t('table.view_table')}
          </button>
        </div>
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

      {!loading && !error && persons.length > 0 && viewMode === 'card' && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <p className="text-sm text-muted">{t('empty.no_results')}</p>
        </div>
      )}

      {!loading && !error && viewMode === 'card' && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}

      {!loading && !error && persons.length > 0 && viewMode === 'table' && (
        <ContactsTable persons={filtered} refresh={refresh} canEdit={canEdit} isAdmin={isAdmin} />
      )}
    </div>
  )
}

export default Contacts
