// Helper thuan (khong phai component) dung chung cho ca 2 che do ve
// (/so-do va /gia-pha) — tach rieng khoi FamilyTreeSvg.tsx de file do chi
// export component (tranh warning react/only-export-components cua oxlint
// khi 1 file .tsx vua export component vua export ham/hang so khac).

import type { FamilySide } from '../../lib/familyLayout'

// Ten viet tat 2 chu cai — cung quy uoc voi src/components/Avatar.tsx (khong
// import truc tiep vi Avatar.tsx khong export ham nay). Dung cho node Mang
// luoi (NetworkView, o Diagram.tsx).
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function truncateName(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

// Mau accent theo "phia" — dung chung cho vien card trong cay (FamilyTreeSvg)
// va legend o trang /gia-pha (primary = 'a', rose = 'b' — token "hong" gan
// nhat trong bang mau hien co, xem src/index.css — emerald = 'chung').
export const FAMILY_SIDE_COLORS: Record<FamilySide, string> = {
  a: '#f97316',
  b: '#fb7185',
  chung: '#34d399',
}

// Mau theo "doi" (generation) — dai chu ky qua modulo, dung cho dai mau tren
// dinh the (FamilyTreeSvg) va legend o trang /gia-pha. `gen` da duoc chuan
// hoa 0..n boi layoutFamilyTree (xem src/lib/familyLayout.ts, buoc 5).
export const GEN_COLORS = [
  '#f97316',
  '#38bdf8',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#f472b6',
]

export function genColor(gen: number): string {
  const idx = ((gen % GEN_COLORS.length) + GEN_COLORS.length) % GEN_COLORS.length
  return GEN_COLORS[idx]
}
