-- =====================================================================
-- PersonalCRM — Phase 4 (bổ sung): vài nhãn UI nhỏ còn thiếu cho các mục
-- Sao lưu / Kết nối / Mời người dùng ở trang Cài đặt — merge không ghi đè
-- (cùng pattern với 20260707160000_phase4.sql).
-- =====================================================================
update public.app_settings
set value = value
  || jsonb_build_object(
    'actions',
    coalesce(value -> 'actions', '{}'::jsonb)
      || jsonb_build_object('copy', 'Sao chép', 'copied', 'Đã sao chép')
  )
  || jsonb_build_object(
    'bot',
    coalesce(value -> 'bot', '{}'::jsonb)
      || jsonb_build_object('revoke_confirm', 'Thu hồi quyền dùng bot của chat này?')
  )
  || jsonb_build_object(
    'backup',
    coalesce(value -> 'backup', '{}'::jsonb)
      || jsonb_build_object('error', 'Không tạo được bản sao lưu — thử lại sau.')
  )
where key = 'labels';
