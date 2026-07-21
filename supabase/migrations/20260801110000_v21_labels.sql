-- =====================================================================
-- PersonalCRM — Gia pha v2.1 (Phase 0): nhan UI cho wizard nhap Excel,
-- panel cay (PersonPanel), su kien cuoc doi (life_events), avatar va cac
-- nhan giapha/person bo sung. Merge khong ghi de (key moi dat truoc, gia
-- tri admin da tuy chinh coalesce de len sau nen luon thang).
-- =====================================================================
update public.app_settings
set value = value
  || jsonb_build_object(
    'person',
    $j${
      "avatar_upload": "Đổi ảnh đại diện",
      "avatar_uploading": "Đang tải ảnh…",
      "avatar_error": "Không tải được ảnh — thử lại.",
      "birth_year": "Năm sinh (gần đúng)",
      "death_year": "Năm mất (gần đúng)"
    }$j$::jsonb || coalesce(value -> 'person', '{}'::jsonb)
  )
  || jsonb_build_object(
    'giapha',
    $j${
      "invite_hint": "Mời người thân cùng xem và ghi chép gia phả",
      "invite_cta": "Quản lý người dùng",
      "gen_legend": "Màu theo đời",
      "import_excel": "Nhập từ Excel"
    }$j$::jsonb || coalesce(value -> 'giapha', '{}'::jsonb)
  )
  || jsonb_build_object(
    'import_family',
    $j${
      "title": "Nhập gia phả từ Excel",
      "intro": "Nhận file .xlsx hoặc .csv bất kỳ — không cần theo mẫu. Ghép cột xong là nhập được.",
      "step_upload": "Chọn file",
      "step_mapping": "Ghép cột",
      "step_preview": "Xem trước",
      "step_result": "Kết quả",
      "drop_hint": "Kéo thả hoặc bấm để chọn file Excel (.xlsx) / CSV",
      "sheet_pick": "Chọn sheet",
      "col_data": "Cột trong file",
      "col_field": "Là dữ liệu gì?",
      "col_skip": "— Bỏ qua cột này —",
      "need_name": "Cần ghép ít nhất một cột là Tên đầy đủ",
      "preview_sample": "5 dòng đầu tiên",
      "stat_new": "Tạo mới",
      "stat_update": "Trùng — chỉ điền ô trống",
      "stat_error": "Lỗi",
      "stat_rel": "Quan hệ sẽ tạo",
      "stat_rel_review": "Quan hệ cần xem lại",
      "ambiguous": "Trùng tên trong file — bỏ qua quan hệ này, thêm tay sau",
      "not_found": "Không tìm thấy tên này trong file/dòng họ",
      "run": "Bắt đầu nhập",
      "importing": "Đang nhập…",
      "done": "Đã nhập xong",
      "rel_created": "quan hệ đã tạo",
      "rel_skipped": "quan hệ bỏ qua",
      "open_giapha": "Mở trang Gia phả",
      "field_full_name": "Tên đầy đủ",
      "field_nickname": "Tên danh bạ",
      "field_gender": "Giới tính",
      "field_birthday": "Ngày/năm sinh",
      "field_death_date": "Ngày/năm mất",
      "field_death_lunar": "Ngày giỗ (âm lịch)",
      "field_father_name": "Tên bố",
      "field_mother_name": "Tên mẹ",
      "field_spouse_name": "Tên vợ/chồng",
      "field_generation": "Đời",
      "field_branch": "Chi/nhánh",
      "field_hometown": "Quê quán",
      "field_burial_place": "Mộ phần",
      "field_biography": "Tiểu sử",
      "field_phone": "Điện thoại",
      "field_email": "Email",
      "field_note": "Ghi chú"
    }$j$::jsonb || coalesce(value -> 'import_family', '{}'::jsonb)
  )
  || jsonb_build_object(
    'panel',
    $j${
      "relations": "Quan hệ gia đình",
      "parents": "Bố mẹ",
      "spouse": "Vợ/Chồng",
      "children": "Con",
      "add_parent": "Thêm bố/mẹ",
      "add_spouse": "Thêm vợ/chồng",
      "add_child": "Thêm con",
      "pick_existing": "Chọn người có sẵn",
      "create_new": "Tạo người mới",
      "remove_relation": "Xóa quan hệ",
      "remove_relation_confirm": "Xóa quan hệ này? Hồ sơ hai người vẫn giữ nguyên.",
      "no_relations": "Chưa có quan hệ nào — dùng các nút bên dưới để nối.",
      "life_timeline": "Dòng đời",
      "view_profile": "Xem hồ sơ đầy đủ"
    }$j$::jsonb || coalesce(value -> 'panel', '{}'::jsonb)
  )
  || jsonb_build_object(
    'life_event',
    $j${
      "add": "Thêm sự kiện",
      "edit": "Sửa sự kiện",
      "delete_confirm": "Xóa sự kiện này?",
      "title": "Sự kiện",
      "kind": "Loại",
      "date": "Ngày",
      "year": "Năm",
      "year_only": "Chỉ biết năm",
      "note": "Ghi chú",
      "kind_sinh": "Sinh",
      "kind_mat": "Mất",
      "kind_hoc_hanh": "Học hành",
      "kind_su_nghiep": "Sự nghiệp",
      "kind_hon_nhan": "Hôn nhân",
      "kind_khac": "Khác"
    }$j$::jsonb || coalesce(value -> 'life_event', '{}'::jsonb)
  )
where key = 'labels';
