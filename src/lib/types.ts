// Các kiểu dữ liệu dùng chung, khớp với schema Supabase.

export type Role = 'admin' | 'editor' | 'viewer'

export type GroupType =
  | 'gia_dinh'
  | 'ban_be'
  | 'doi_tac'
  | 'dong_nghiep'
  | 'con_cai'
  | 'khac'

export type InteractionType =
  | 'gap_mat'
  | 'goi_dien'
  | 'nhan_tin'
  | 'du_lich'
  | 'an_uong'
  | 'cong_viec'
  | 'khac'

export interface Person {
  id: string
  full_name: string
  nickname: string | null
  group_type: GroupType
  avatar_url: string | null
  phone: string | null
  email: string | null
  birthday: string | null
  company: string | null
  job_title: string | null
  address: string | null
  hometown: string | null
  hobbies: string[]
  preferences: Record<string, string>
  gift_ideas: string | null
  how_we_met: string | null
  social_links: Record<string, string>
  tags: string[]
  is_favorite: boolean
  contact_frequency_days: number | null
  in_family_tree: boolean
  gender: 'nam' | 'nu' | null
  death_date: string | null
  death_lunar_day: number | null
  death_lunar_month: number | null
  burial_place: string | null
  biography: string | null
  // Nam gan dung (chi dung khi khong co ngay day du) — xem migration
  // 20260801100000_v21_life_events.sql.
  birth_year: number | null
  death_year: number | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  search_text: string | null
}

// View persons_safe — như Person nhưng không có các trường riêng tư.
export type PersonSafe = Omit<Person, 'notes' | 'gift_ideas'>

export interface Interaction {
  id: string
  person_id: string
  date: string
  type: InteractionType
  title: string | null
  note: string | null
  location: string | null
  created_by: string
  created_at: string
}

export interface Media {
  id: string
  person_id: string
  interaction_id: string | null
  type: 'photo' | 'video_link'
  storage_path: string | null
  external_url: string | null
  caption: string | null
  taken_at: string | null
  uploaded_by: string
  created_at: string
}

export interface Profile {
  id: string
  display_name: string | null
  role: Role
}

// Cây nhãn tiếng Việt lồng nhau — dùng bởi useLabels().
export interface LabelTree {
  [key: string]: string | LabelTree
}

export interface InteractionTypeOption {
  value: string
  label: string
  enabled: boolean
  // Loai tuong tac them tu man Cai dat, KHONG co trong enum public.interaction_type
  // cua DB — chi dung de hien thi/loc phia UI, khong duoc chon khi ghi interactions.
  custom?: boolean
}

export interface AppSettings {
  labels: LabelTree
  group_defaults: Record<GroupType, number>
  interaction_types: InteractionTypeOption[]
  video_domains: string[]
  warning_days: number
}

export interface LastContacted {
  person_id: string
  last_contacted: string | null
}

export type InboxSource = 'telegram' | 'cuoc_goi' | 'khac'
export type InboxStatus = 'pending' | 'assigned' | 'dismissed'

// Tin nhan/du lieu vao (bot Telegram, webhook cuoc goi...) chua gan duoc
// nguoi trong danh ba — hien o trang Hop thu cho.
export interface InboxItem {
  id: string
  source: InboxSource
  raw_text: string
  suggested_person_id: string | null
  status: InboxStatus
  payload: Record<string, unknown>
  created_at: string
}

// Viec can lam / follow-up, co the gan voi 1 person (person_id) hoac viec
// chung (person_id = null).
export interface Task {
  id: string
  person_id: string | null
  title: string
  note: string | null
  due_date: string | null
  done: boolean
  done_at: string | null
  created_by: string | null
  created_at: string
}
