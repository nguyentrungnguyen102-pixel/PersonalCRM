// Hook load toan bo danh sach nguoi trong danh ba, kem last_contacted merge
// tu view person_last_contacted. Ton trong RLS: viewer doc persons_safe.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LastContacted, PersonSafe } from '../lib/types'
import { useAuth } from './useAuth'

// Admin/editor nhan them notes + gift_ideas (tu bang persons goc).
// Viewer khong co 2 truong nay (undefined) vi persons_safe khong tra ve.
export type PersonWithMeta = PersonSafe & {
  notes?: string | null
  gift_ideas?: string | null
  last_contacted: string | null
}

interface UsePersonsResult {
  persons: PersonWithMeta[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function usePersons(): UsePersonsResult {
  const { canEdit } = useAuth()
  const personsTable = canEdit ? 'persons' : 'persons_safe'

  const [persons, setPersons] = useState<PersonWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    async function load() {
      const [personsRes, lastContactedRes] = await Promise.all([
        supabase.from(personsTable).select('*'),
        supabase.from('person_last_contacted').select('*'),
      ])

      if (!active) return

      if (personsRes.error) {
        setError(personsRes.error.message)
        setPersons([])
        setLoading(false)
        return
      }

      const lastMap = new Map<string, string | null>()
      if (!lastContactedRes.error && lastContactedRes.data) {
        for (const row of lastContactedRes.data as LastContacted[]) {
          lastMap.set(row.person_id, row.last_contacted)
        }
      }

      const rows = (personsRes.data ?? []) as PersonSafe[]
      const merged: PersonWithMeta[] = rows.map((p) => ({
        ...p,
        last_contacted: lastMap.get(p.id) ?? null,
      }))

      setPersons(merged)
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [personsTable, reloadKey])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  return { persons, loading, error, refresh }
}
