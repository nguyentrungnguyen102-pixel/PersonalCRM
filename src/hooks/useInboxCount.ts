// Dem so inbox_items dang cho (status='pending') — dung lam badge tren nav
// "Hop thu cho". Refetch dinh ky + moi khi chuyen trang. Viewer khong query
// (khong co quyen doc inbox_items, nav item da bi an truoc).

import { useCallback, useEffect } from 'react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const POLL_MS = 60000

export function useInboxCount(): number {
  const { canEdit } = useAuth()
  const location = useLocation()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!canEdit) {
      setCount(0)
      return
    }
    const { count: c, error } = await supabase
      .from('inbox_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (!error) setCount(c ?? 0)
  }, [canEdit])

  // Refetch moi khi chuyen trang (khong chi khi vao /hop-thu).
  useEffect(() => {
    void refresh()
  }, [refresh, location.pathname])

  // Refetch dinh ky de bat tin nhan moi den tu bot trong luc dang dung app.
  useEffect(() => {
    const id = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return count
}

export default useInboxCount
