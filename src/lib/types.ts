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
