-- =====================================================================
-- QuanHe360 — Migration 3/3: SEED du lieu mac dinh cho app_settings
-- =====================================================================
-- Dung on conflict do nothing de migration idempotent, khong ghi de neu
-- da co du lieu (vi du admin da tuy chinh nhan qua man hinh Cai dat).

-- ---------------------------------------------------------------------
-- 1) labels — toan bo nhan giao dien tieng Viet
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'labels',
  $json${
    "app_name": "QuanHe360",
    "groups": {
      "gia_dinh": "Gia đình",
      "ban_be": "Bạn bè",
      "doi_tac": "Đối tác",
      "dong_nghiep": "Đồng nghiệp",
      "con_cai": "Con cái",
      "khac": "Khác"
    },
    "interaction_types": {
      "gap_mat": "Gặp mặt",
      "goi_dien": "Gọi điện",
      "nhan_tin": "Nhắn tin",
      "du_lich": "Du lịch",
      "an_uong": "Ăn uống",
      "cong_viec": "Công việc",
      "khac": "Khác"
    },
    "roles": {
      "admin": "Quản trị",
      "editor": "Biên tập",
      "viewer": "Chỉ xem"
    },
    "nav": {
      "dashboard": "Tổng quan",
      "contacts": "Danh bạ",
      "map": "Sơ đồ",
      "reminders": "Nhắc nhở",
      "groups": "Nhóm",
      "settings": "Cài đặt",
      "menu": "Menu"
    },
    "dashboard": {
      "greeting": "Xin chào",
      "sap_nguoi": "Sắp nguội — cần giữ liên lạc",
      "favorites": "Ưa thích",
      "recent": "Hoạt động gần đây",
      "birthdays": "Sinh nhật tháng này",
      "stats": "Thống kê",
      "top_groups": "Nhóm nổi bật",
      "need_attention": "mối quan hệ cần chú ý"
    },
    "person": {
      "profile": "Hồ sơ",
      "info": "Thông tin",
      "timeline": "Dòng thời gian",
      "gallery": "Ảnh & Video",
      "social": "Mạng xã hội",
      "keep_in_touch": "Giữ liên lạc",
      "notes": "Ghi chú riêng tư",
      "gift_ideas": "Ý tưởng quà tặng",
      "how_we_met": "Quen nhau thế nào",
      "preferences": "Sở thích & kiêng kỵ",
      "hobbies": "Sở thích",
      "tags": "Thẻ",
      "birthday": "Sinh nhật",
      "phone": "Điện thoại",
      "email": "Email",
      "company": "Công ty",
      "job_title": "Chức danh",
      "address": "Địa chỉ",
      "hometown": "Quê quán",
      "locked_field": "🔒 Chỉ Admin/Editor",
      "favorite": "Ưa thích",
      "last_contact": "Tương tác gần nhất",
      "no_contact_yet": "Chưa có tương tác"
    },
    "actions": {
      "add": "Thêm",
      "edit": "Sửa",
      "delete": "Xóa",
      "save": "Lưu",
      "cancel": "Hủy",
      "search": "Tìm kiếm...",
      "quick_add": "Ghi nhanh",
      "add_person": "Thêm liên hệ",
      "add_interaction": "Thêm tương tác",
      "upload_photo": "Tải ảnh lên",
      "add_video_link": "Dán link video",
      "login": "Đăng nhập",
      "logout": "Đăng xuất",
      "confirm_delete": "Bạn chắc chắn muốn xóa?"
    },
    "status": {
      "on_track": "Ổn định",
      "due_soon": "Sắp đến hạn",
      "overdue": "Quá hạn",
      "no_reminder": "Không nhắc"
    },
    "quick_add": {
      "step_person": "Chọn người",
      "step_type": "Loại tương tác",
      "step_note": "Ghi chú",
      "success": "Đã ghi tương tác"
    },
    "auth": {
      "email": "Email",
      "password": "Mật khẩu",
      "email_placeholder": "ban@email.com",
      "password_placeholder": "••••••••",
      "login_button": "Đăng nhập",
      "signing_in": "Đang đăng nhập...",
      "subtitle": "Đăng nhập để tiếp tục",
      "wrong_credentials": "Email hoặc mật khẩu không đúng",
      "welcome": "Chào mừng trở lại"
    },
    "empty": {
      "no_persons": "Chưa có liên hệ nào",
      "no_results": "Không tìm thấy kết quả",
      "no_interactions": "Chưa có tương tác",
      "no_media": "Chưa có ảnh/video",
      "coming_soon": "Sắp ra mắt"
    }
  }$json$::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2) group_defaults — so ngay mac dinh de nhac giu lien lac theo nhom
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'group_defaults',
  $json${
    "gia_dinh": 30,
    "ban_be": 90,
    "doi_tac": 30,
    "dong_nghiep": 60,
    "con_cai": 30,
    "khac": 180
  }$json$::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 3) interaction_types — danh sach loai tuong tac hien thi tren UI
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'interaction_types',
  $json$[
    {"value": "gap_mat", "label": "Gặp mặt", "enabled": true},
    {"value": "goi_dien", "label": "Gọi điện", "enabled": true},
    {"value": "nhan_tin", "label": "Nhắn tin", "enabled": true},
    {"value": "du_lich", "label": "Du lịch", "enabled": true},
    {"value": "an_uong", "label": "Ăn uống", "enabled": true},
    {"value": "cong_viec", "label": "Công việc", "enabled": true},
    {"value": "khac", "label": "Khác", "enabled": true}
  ]$json$::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 4) video_domains — danh sach domain video duoc chap nhan khi dan link
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'video_domains',
  $json$[
    "drive.google.com",
    "photos.google.com",
    "photos.app.goo.gl",
    "youtube.com",
    "youtu.be"
  ]$json$::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 5) warning_days — so ngay canh bao truoc khi den han nhac giu lien lac
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'warning_days',
  '7'::jsonb
)
on conflict (key) do nothing;
