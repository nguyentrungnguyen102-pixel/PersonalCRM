-- =====================================================================
-- PersonalCRM — Phase 2: doi ten app + bo sung nhan UI moi
-- Dung merge (||) tung nhom de KHONG ghi de tuy chinh cua admin.
-- =====================================================================

update public.app_settings
set value = value
  -- doi ten app
  || jsonb_build_object('app_name', to_jsonb('PersonalCRM'::text))
  -- them muc nav "Nhap danh ba" (merge vao nav hien co)
  || jsonb_build_object(
    'nav',
    coalesce(value -> 'nav', '{}'::jsonb) || '{"import": "Nhập danh bạ"}'::jsonb
  )
  -- nhom nhan moi: chi them key con thieu (merge nguoc: gia tri hien co thang)
  || jsonb_build_object(
    'import',
    $j${
      "title": "Nhập danh bạ từ Google Contacts",
      "step_upload": "Chọn file",
      "step_preview": "Xem trước & đối chiếu",
      "step_result": "Kết quả",
      "drop_hint": "Kéo thả hoặc bấm để chọn file CSV",
      "not_csv": "Chỉ nhận file .csv",
      "wrong_format": "File không đúng định dạng Google Contacts CSV",
      "total": "Tổng số dòng",
      "will_insert": "Thêm mới",
      "will_update": "Cập nhật (trùng)",
      "has_error": "Dòng lỗi",
      "run": "Bắt đầu nhập",
      "importing": "Đang nhập...",
      "done": "Nhập xong",
      "inserted": "Đã thêm",
      "updated": "Đã cập nhật",
      "failed": "Lỗi",
      "download_errors": "Tải danh sách lỗi",
      "row": "Dòng",
      "reason": "Lý do",
      "no_identity": "Thiếu cả tên lẫn số điện thoại",
      "try_again": "Nhập file khác"
    }$j$::jsonb || coalesce(value -> 'import', '{}'::jsonb)
  )
  || jsonb_build_object(
    'table',
    $j${
      "view_card": "Thẻ",
      "view_table": "Bảng",
      "name": "Tên",
      "group": "Nhóm",
      "phone": "SĐT",
      "email": "Email",
      "tags": "Tags",
      "frequency": "Nhịp",
      "last_contact": "Lần cuối",
      "status": "Trạng thái",
      "selected": "đã chọn",
      "select_all": "Chọn tất cả",
      "page": "Trang",
      "no_frequency": "Không nhắc",
      "saved": "Đã lưu",
      "save_error": "Lỗi lưu, đã hoàn tác"
    }$j$::jsonb || coalesce(value -> 'table', '{}'::jsonb)
  )
  || jsonb_build_object(
    'bulk',
    $j${
      "change_group": "Đổi nhóm",
      "add_tag": "Gán tag",
      "set_frequency": "Gán nhịp",
      "delete": "Xóa",
      "apply": "Áp dụng",
      "with_default_freq": "Gán kèm nhịp mặc định theo nhóm",
      "tag_placeholder": "Nhập tag...",
      "done": "Đã cập nhật",
      "clear": "Bỏ chọn"
    }$j$::jsonb || coalesce(value -> 'bulk', '{}'::jsonb)
  )
  || jsonb_build_object(
    'settings',
    $j${
      "title": "Cài đặt",
      "labels": "Nhãn hiển thị",
      "group_defaults": "Nhịp mặc định theo nhóm",
      "interaction_types": "Loại tương tác",
      "video_domains": "Domain video cho phép",
      "warning_days": "Số ngày cảnh báo sắp nguội",
      "users": "Người dùng & Phân quyền",
      "password": "Đổi mật khẩu",
      "save": "Lưu thay đổi",
      "saved": "Đã lưu — hiệu lực ngay",
      "restore": "Khôi phục mặc định",
      "restored": "Đã khôi phục",
      "add": "Thêm",
      "remove": "Xóa",
      "enabled": "Bật",
      "add_type": "Thêm loại",
      "add_domain": "Thêm domain",
      "days_unit": "ngày",
      "role": "Vai trò",
      "cannot_demote_self": "Không thể tự hạ quyền chính mình",
      "admin_only": "Chỉ quản trị viên truy cập được trang này",
      "unsaved": "Có thay đổi chưa lưu"
    }$j$::jsonb || coalesce(value -> 'settings', '{}'::jsonb)
  )
  || jsonb_build_object(
    'password',
    $j${
      "new_password": "Mật khẩu mới",
      "confirm": "Nhập lại mật khẩu",
      "change": "Đổi mật khẩu",
      "changed": "Đã đổi mật khẩu",
      "mismatch": "Mật khẩu nhập lại không khớp",
      "too_short": "Mật khẩu tối thiểu 8 ký tự"
    }$j$::jsonb || coalesce(value -> 'password', '{}'::jsonb)
  )
where key = 'labels';
