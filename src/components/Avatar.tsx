import type { CSSProperties } from 'react'

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
}

export function Avatar({ name, avatarUrl, size = 40, className = '' }: AvatarProps) {
  const color = colorForName(name)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
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
