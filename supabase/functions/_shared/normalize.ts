// Ham dung chung cho cac Edge Function: chuan hoa chuoi/so dien thoai/ngay
// gio VN. Port tu src/lib/normalize.ts, src/lib/importCsv.ts, src/lib/displayName.ts
// (khong import truc tiep tu src/ vi Deno khong resolve duoc alias/tooling cua Vite).

// ---------------------------------------------------------------------
// Chuoi tieng Viet: bo dau + ha chu thuong, dung de so khop khong dau
// ---------------------------------------------------------------------
export function vnNormalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim()
}

// ---------------------------------------------------------------------
// So dien thoai: bo ky tu thua, +84 -> 0 dau (giong importCsv.ts)
// ---------------------------------------------------------------------
export function normalizePhone(s: string | null | undefined): string {
  if (!s) return ''
  const trimmed = s.trim()
  if (!trimmed) return ''

  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/[^0-9]/g, '')
  if (!digits) return ''

  let result = (hasLeadingPlus ? '+' : '') + digits
  if (result.startsWith('+84')) {
    result = '0' + result.slice(3)
  }
  return result
}

// Cac bien the co the co trong DB cho cung 1 so (0xxx <-> +84xxx)
export function phoneVariants(phone: string): string[] {
  const norm = normalizePhone(phone)
  if (!norm) return []
  const variants = new Set<string>([norm])
  if (norm.startsWith('0')) variants.add('+84' + norm.slice(1))
  if (norm.startsWith('+84')) variants.add('0' + norm.slice(3))
  return [...variants]
}

// ---------------------------------------------------------------------
// Ten hien thi: uu tien nickname, fallback full_name
// ---------------------------------------------------------------------
export function displayName(p: { nickname?: string | null; full_name: string }): string {
  return (p.nickname && p.nickname.trim()) || p.full_name
}

// ---------------------------------------------------------------------
// Gio VN (UTC+7) — moi truong Edge Function chay UTC, tinh thu cong offset
// ---------------------------------------------------------------------
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

// Tra ve mot Date "gia" ma cac getter UTC* doc dung nhu gio VN thuc te.
export function vnNow(): Date {
  return new Date(Date.now() + VN_OFFSET_MS)
}

// yyyy-mm-dd theo gio VN, tu 1 thoi diem bat ky (mac dinh: bay gio)
export function vnDateStr(d?: Date): string {
  const base = d ? new Date(d.getTime() + VN_OFFSET_MS) : vnNow()
  const y = base.getUTCFullYear()
  const m = String(base.getUTCMonth() + 1).padStart(2, '0')
  const day = String(base.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------------------------------------------------------------------
// Parse ngay dd/mm/yyyy -> yyyy-mm-dd (dung cho sheet-sync)
// ---------------------------------------------------------------------
export function parseDdMmYyyy(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = m[3]
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

// Chap nhan ca yyyy-mm-dd (da chuan) lan dd/mm/yyyy (tu sheet)
export function parseFlexibleDate(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return parseDdMmYyyy(t)
}
