import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { cachedAvatarUrl, resolveAvatarUrl } from '../lib/avatarUrl'

const PALETTE = ['#f97316', '#fb7185', '#fbbf24', '#34d399', '#a78bfa', '#38bdf8']

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function colorForName(name: string): string {
  if (!name) return PALETTE[0]
  return PALETTE[hashName(name) % PALETTE.length]
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  // Tên Việt: lấy chữ đầu của từ đầu (họ) + chữ đầu của từ cuối (tên gọi).
  const first = parts[0][0]
  const last = parts[parts.length - 1][0]
  return `${first}${last}`.toUpperCase()
}

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: number
  className?: string
  // Lam anh xam + mo nhe — dung danh dau nguoi da mat trong PersonPanel.tsx
  // (gia pha).
  grayscale?: boolean
}

export function Avatar({ name, avatarUrl, size = 40, className = '', grayscale = false }: AvatarProps) {
  const color = colorForName(name)

  // avatarUrl co the la URL http(s) day du HOAC storage path (bucket
  // 'media') can ky signed URL — xem src/lib/avatarUrl.ts. Khoi tao dong bo
  // tu cache de tranh nhap nhay, roi resolve bat dong bo neu chua co san.
  const [src, setSrc] = useState<string | null>(() => cachedAvatarUrl(avatarUrl ?? null))

  useEffect(() => {
    let active = true
    const value = avatarUrl ?? null
    const cached = cachedAvatarUrl(value)
    setSrc(cached)
    if (cached || !value) return

    resolveAvatarUrl(value).then((url) => {
      if (active) setSrc(url)
    })

    return () => {
      active = false
    }
  }, [avatarUrl])

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          ...(grayscale ? { filter: 'grayscale(1) opacity(0.85)' } : undefined),
        }}
        className={`flex-shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  const style: CSSProperties = {
    width: size,
    height: size,
    background: `${color}20`,
    borderColor: `${color}50`,
    color,
    fontSize: Math.max(10, Math.round(size * 0.32)),
    boxShadow: `0 0 ${Math.round(size * 0.5)}px ${color}25`,
  }

  return (
    <div
      style={style}
      className={`flex flex-shrink-0 items-center justify-center rounded-full border-[1.5px] font-bold ${className}`}
    >
      {initialsFromName(name)}
    </div>
  )
}
