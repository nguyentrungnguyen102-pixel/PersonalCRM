import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { GroupType, InteractionTypeOption, LabelTree } from '../lib/types'
import { useAuth } from './useAuth'

const DEFAULT_WARNING_DAYS = 7

// Fallback khớp với seed app_settings.group_defaults — DB luôn thắng sau khi load.
const DEFAULT_GROUP_DEFAULTS: Record<GroupType, number> = {
  gia_dinh: 30,
  ban_be: 90,
  doi_tac: 30,
  dong_nghiep: 60,
  con_cai: 30,
  khac: 180,
}

interface SettingsContextValue {
  labels: LabelTree
  groupDefaults: Record<GroupType, number>
  interactionTypes: InteractionTypeOption[]
  videoDomains: string[]
  warningDays: number
  loading: boolean
  t: (path: string) => string
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

function getByPath(tree: LabelTree, path: string): string | undefined {
  const parts = path.split('.')
  let cur: LabelTree | string | undefined = tree
  for (const part of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = cur[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

function fallbackFromPath(path: string): string {
  const parts = path.split('.')
  return parts[parts.length - 1] ?? path
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [labels, setLabels] = useState<LabelTree>({})
  const [groupDefaults, setGroupDefaults] =
    useState<Record<GroupType, number>>(DEFAULT_GROUP_DEFAULTS)
  const [interactionTypes, setInteractionTypes] = useState<InteractionTypeOption[]>([])
  const [videoDomains, setVideoDomains] = useState<string[]>([])
  const [warningDays, setWarningDays] = useState<number>(DEFAULT_WARNING_DAYS)
  const [loading, setLoading] = useState(true)
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null)

  // Load ca khi chua dang nhap (policy cho anon doc app_settings — man Login
  // can nhan tieng Viet); dang nhap xong load lai mot lan cho chac.
  const settingsKey = userId ?? 'anon'

  useEffect(() => {
    if (loadedForUser === settingsKey) return

    let active = true
    setLoading(true)

    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) {
          for (const row of data as { key: string; value: unknown }[]) {
            switch (row.key) {
              case 'labels':
                setLabels((row.value as LabelTree) ?? {})
                break
              case 'group_defaults':
                setGroupDefaults(
                  (row.value as Record<GroupType, number>) ?? DEFAULT_GROUP_DEFAULTS,
                )
                break
              case 'interaction_types':
                setInteractionTypes((row.value as InteractionTypeOption[]) ?? [])
                break
              case 'video_domains':
                setVideoDomains((row.value as string[]) ?? [])
                break
              case 'warning_days':
                setWarningDays(typeof row.value === 'number' ? row.value : DEFAULT_WARNING_DAYS)
                break
              default:
                break
            }
          }
        }
        setLoadedForUser(settingsKey)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [settingsKey, loadedForUser])

  const t = useCallback((path: string) => getByPath(labels, path) ?? fallbackFromPath(path), [labels])

  const value = useMemo<SettingsContextValue>(
    () => ({ labels, groupDefaults, interactionTypes, videoDomains, warningDays, loading, t }),
    [labels, groupDefaults, interactionTypes, videoDomains, warningDays, loading, t],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings phải được dùng bên trong <SettingsProvider>')
  return ctx
}

export function useLabels(): { t: (path: string) => string } {
  const { t } = useSettings()
  return { t }
}
