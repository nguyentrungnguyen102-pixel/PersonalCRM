-- =====================================================================
-- PersonalCRM — Gia pha (Phase 2): nhan UI cho trang /gia-pha (cay gia pha
-- co mau theo phia, danh sach thanh vien theo doi, giO sap toi).
-- =====================================================================

-- ---------------------------------------------------------------------
-- NHAN UI MOI — merge khong ghi de (cung pattern voi
--    20260716100000_giapha_persons.sql): key moi dat truoc, gia tri admin
--    da tuy chinh (neu co) duoc coalesce de len sau nen luon thang.
-- ---------------------------------------------------------------------
update public.app_settings
set value = value
  || jsonb_build_object(
    'nav',
    $j${
      "giapha": "Gia phả"
    }$j$::jsonb || coalesce(value -> 'nav', '{}'::jsonb)
  )
  || jsonb_build_object(
    'giapha',
    $j${
      "title": "Gia phả",
      "tree": "Cây gia phả",
      "members": "Thành viên dòng họ",
      "generation": "Đời",
      "unlinked": "Chưa nối vào cây",
      "unlinked_hint": "Thêm quan hệ gia đình trong hồ sơ để nối người này vào cây.",
      "upcoming_gio": "Giỗ sắp tới",
      "no_gio": "Chưa có ngày giỗ nào được ghi.",
      "side_chong": "Phía chồng",
      "side_vo": "Phía vợ",
      "side_chung": "Con cháu chung",
      "side_prefix": "Phía",
      "add_members": "Thêm thành viên",
      "remove_member": "Bỏ khỏi dòng họ",
      "remove_confirm": "Bỏ người này khỏi dòng họ? Hồ sơ và quan hệ vẫn giữ nguyên.",
      "empty": "Chưa có thành viên nào trong dòng họ. Bấm \"Thêm thành viên\" để bắt đầu.",
      "root_couple": "Cặp gốc",
      "days_left": "còn",
      "days_unit": "ngày",
      "show_all": "Xem tất cả",
      "export_png": "Xuất ảnh PNG",
      "print": "In"
    }$j$::jsonb || coalesce(value -> 'giapha', '{}'::jsonb)
  )
where key = 'labels';
