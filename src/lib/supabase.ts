import { createClient } from '@supabase/supabase-js'

const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

// KHÔNG throw ở module scope: khi thiếu env lúc build, Vite thay biến bằng
// undefined → throw trở thành vô điều kiện và Rollup loại toàn bộ code phía
// sau khỏi bundle. App kiểm tra cờ này và hiện màn hình báo lỗi cấu hình.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
  supabaseUrl || 'https://chua-cau-hinh.supabase.co',
  supabaseAnonKey || 'chua-cau-hinh',
)
