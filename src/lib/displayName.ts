// Ten hien thi chinh cua mot nguoi: uu tien nickname ("Ten danh ba" — kieu goi
// nho nhu "A Ba Chien"), roi moi fallback ve full_name (ten that).
export function displayName(p: { nickname?: string | null; full_name: string }): string {
  return (p.nickname && p.nickname.trim()) || p.full_name
}

export default displayName
