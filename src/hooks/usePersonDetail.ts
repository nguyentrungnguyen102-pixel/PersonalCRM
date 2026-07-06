// Hook load ho so day du cua 1 nguoi theo id: person + interactions + media,
// kem last_contacted (merge vao person, giong PersonWithMeta cua usePersons).

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Interaction, Media, PersonSafe } from '../lib/types'
import { useAuth } from './useAuth'
import type { PersonWithMeta } from './usePersons'

interface UsePersonDetailResult {
  person: PersonWithMeta | null
  interactions: Interaction[]
  media: Media[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function usePersonDetail(id: string | undefined): UsePersonDetailResult {
  const { canEdit } = useAuth()
  const personsTable = canEdit ? 'persons' : 'persons_safe'

  const [person, setPerson] = useState<PersonWithMeta | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) {
      setPerson(null)
      setInteractions([])
      setMedia([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    async function load() {
      const [personRes, interactionsRes, mediaRes, lastRes] = await Promise.all([
        supabase.from(personsTable).select('*').eq('id', id as string).maybeSingle(),
        supabase
          .from('interactions')
          .select('*')
          .eq('person_id', id as string)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('media')
          .select('*')
          .eq('person_id', id as string)
          .order('created_at', { ascending: false }),
        supabase
          .from('person_last_contacted')
          .select('*')
          .eq('person_id', id as string)
          .maybeSingle(),
      ])

      if (!active) return

      if (personRes.error) {
        setError(personRes.error.message)
        setPerson(null)
        setInteractions([])
        setMedia([])
        setLoading(false)
        return
      }

      const personRow = personRes.data as PersonSafe | null
      const lastContacted =
        (lastRes.data as { last_contacted: string | null } | null)?.last_contacted ?? null

      setPerson(personRow ? { ...personRow, last_contacted: lastContacted } : null)
      setInteractions((interactionsRes.data as Interaction[]) ?? [])
      setMedia((mediaRes.data as Media[]) ?? [])
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [id, personsTable, reloadKey])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  return { person, interactions, media, loading, error, refresh }
}
