// Trang Cai dat (route /cai-dat) — CHI admin (guard RequireAdmin trong
// App.tsx). Sidebar doc tren desktop, accordion tren mobile — nhung chi mot
// cay DOM duoc mount (dua theo matchMedia) de tranh mount trung 2 lan cho
// cung mot section (moi section co state cuc bo/goi API rieng).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLabels } from '../hooks/useSettings'
import { SectionLabels } from '../components/settings/SectionLabels'
import { SectionGroupDefaults } from '../components/settings/SectionGroupDefaults'
import { SectionInteractionTypes } from '../components/settings/SectionInteractionTypes'
import { SectionVideoDomains } from '../components/settings/SectionVideoDomains'
import { SectionWarningDays } from '../components/settings/SectionWarningDays'
import { SectionTags } from '../components/settings/SectionTags'
import { SectionUsers } from '../components/settings/SectionUsers'
import { SectionPassword } from '../components/settings/SectionPassword'

type SectionId =
  | 'labels'
  | 'group_defaults'
  | 'interaction_types'
  | 'video_domains'
  | 'warning_days'
  | 'tags'
  | 'users'
  | 'password'

const SECTION_IDS: SectionId[] = [
  'labels',
  'group_defaults',
  'interaction_types',
  'video_domains',
  'warning_days',
  'tags',
  'users',
  'password',
]

// "tags" dung nhan tags.title (da co san — "The") thay vi settings.tags
// (chua duoc seed) de tranh phai them migration moi cho 1 nhan sidebar.
const NAV_LABEL_OVERRIDE: Partial<Record<SectionId, string>> = {
  tags: 'tags.title',
}

type ToastMsg = { kind: 'success' | 'error'; text: string } | null

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isDesktop
}

export function Settings() {
  const { t } = useLabels()
  const isDesktop = useIsDesktop()
  const [active, setActive] = useState<SectionId>('labels')
  const [dirtyMap, setDirtyMap] = useState<Partial<Record<SectionId, boolean>>>({})
  const [toast, setToast] = useState<ToastMsg>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((kind: 'success' | 'error', text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ kind, text })
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  const setSectionDirty = useCallback((id: SectionId, dirty: boolean) => {
    setDirtyMap((m) => (m[id] === dirty ? m : { ...m, [id]: dirty }))
  }, [])

  function navLabel(id: SectionId): string {
    return t(NAV_LABEL_OVERRIDE[id] ?? `settings.${id}`)
  }

  function handleSelect(next: SectionId) {
    if (active !== next && dirtyMap[active]) {
      showToast('error', t('settings.unsaved'))
    }
    setActive((cur) => (cur === next ? cur : next))
  }

  function renderSection(id: SectionId) {
    switch (id) {
      case 'labels':
        return <SectionLabels showToast={showToast} onDirtyChange={(d) => setSectionDirty('labels', d)} />
      case 'group_defaults':
        return (
          <SectionGroupDefaults
            showToast={showToast}
            onDirtyChange={(d) => setSectionDirty('group_defaults', d)}
          />
        )
      case 'interaction_types':
        return (
          <SectionInteractionTypes
            showToast={showToast}
            onDirtyChange={(d) => setSectionDirty('interaction_types', d)}
          />
        )
      case 'video_domains':
        return (
          <SectionVideoDomains
            showToast={showToast}
            onDirtyChange={(d) => setSectionDirty('video_domains', d)}
          />
        )
      case 'warning_days':
        return (
          <SectionWarningDays
            showToast={showToast}
            onDirtyChange={(d) => setSectionDirty('warning_days', d)}
          />
        )
      case 'tags':
        return <SectionTags showToast={showToast} />
      case 'users':
        return <SectionUsers showToast={showToast} />
      case 'password':
        return <SectionPassword showToast={showToast} onDirtyChange={(d) => setSectionDirty('password', d)} />
      default:
        return null
    }
  }

  return (
    <div className="anim-fi px-5 py-5 md:px-7">
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
      </div>

      {isDesktop ? (
        <div className="flex items-start gap-6">
          <nav className="flex w-52 flex-shrink-0 flex-col gap-1">
            {SECTION_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                  active === id ? 'bg-card font-semibold text-primary' : 'text-muted hover:text-ink'
                }`}
              >
                <span>{navLabel(id)}</span>
                {dirtyMap[id] && (
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber" aria-hidden />
                )}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1">{renderSection(active)}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {SECTION_IDS.map((id) => {
            const isOpen = active === id
            return (
              <div key={id}>
                <button
                  type="button"
                  onClick={() => handleSelect(id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isOpen ? 'bg-card font-semibold text-primary' : 'text-ink'
                  }`}
                >
                  <span>{navLabel(id)}</span>
                  <span className="flex items-center gap-2">
                    {dirtyMap[id] && <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />}
                    <span className="text-xs text-muted">{isOpen ? '−' : '+'}</span>
                  </span>
                </button>
                {isOpen && <div className="mt-2 mb-1">{renderSection(id)}</div>}
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg md:bottom-8 ${
            toast.kind === 'success'
              ? 'border-emerald/30 bg-emerald/15 text-emerald'
              : 'border-rose/30 bg-rose/15 text-rose'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}

export default Settings
