// Hook pan/zoom dung chung cho canvas SVG (so-do quan he + cay gia pha) —
// tach nguyen ven tu src/pages/Diagram.tsx (khong doi logic).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'

const MIN_SCALE = 0.35
const MAX_SCALE = 2.5
const DRAG_CLICK_THRESHOLD = 5 // px — duoi nguong nay tinh la click, khong phai keo pan

interface PanZoomState {
  scale: number
  x: number
  y: number
}

export function usePanZoom(resetKey: unknown) {
  const [view, setView] = useState<PanZoomState>({ scale: 1, x: 0, y: 0 })
  const dragRef = useRef<{
    active: boolean
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setView({ scale: 1, x: 0, y: 0 }), [resetKey])

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = {
      active: true,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: view.x,
      startY: view.y,
      moved: false,
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }, [view.x, view.y])

  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag?.active) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    if (Math.abs(dx) > DRAG_CLICK_THRESHOLD || Math.abs(dy) > DRAG_CLICK_THRESHOLD) drag.moved = true
    setView((v) => ({ ...v, x: drag.startX + dx, y: drag.startY + dy }))
  }, [])

  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current) dragRef.current.active = false
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }, [])

  const onWheel = useCallback((e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor)) }))
  }, [])

  const zoomBy = useCallback((factor: number) => {
    setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor)) }))
  }, [])

  // Cho biet lan pointerdown/up vua roi co phai la "keo" hay khong (de nut
  // node phan biet click chon vs click ket thuc mot thao tac pan ngang qua no).
  const wasDragged = useCallback(() => !!dragRef.current?.moved, [])

  return { view, onPointerDown, onPointerMove, onPointerUp, onWheel, zoomBy, wasDragged }
}

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 800, height: 520 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function measure() {
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height })
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}
