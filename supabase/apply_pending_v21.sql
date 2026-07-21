-- =====================================================================
-- PersonalCRM — SCRIPT DÁN-MỘT-LẦN kích hoạt Gia phả (v2.0 + v2.1)
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán TOÀN BỘ file này → Run.
-- Chạy lại lần nữa cũng VÔ HẠI (mọi lệnh đều idempotent).
--
-- Gộp 4 migration theo đúng thứ tự (bản viết lại an toàn khi chạy lặp):
--   1. 20260716100000_giapha_persons.sql  (7 cột gia phả + nhãn person.*)
--   2. 20260720100000_giapha_page_labels.sql (nhãn nav + giapha)
--   3. 20260801100000_v21_life_events.sql (bảng life_events + birth/death_year)
--   4. 20260801110000_v21_labels.sql      (nhãn v2.1)
-- View persons_safe chỉ tạo 1 lần ở bản CUỐI (9 cột nối thêm) — an toàn vì
-- CREATE OR REPLACE VIEW chỉ cho phép NỐI cột vào cuối.
-- =====================================================================

-- ============ [1] 7 CỘT GIA PHẢ TRÊN persons (v2.0) ==================
alter table public.persons add column if not exists in_family_tree boolean not null default false;
alter table public.persons add column if not exists gender text check (gender is null or gender in ('nam', 'nu'));
alter table public.persons add column if not exists death_date date;
alter table public.persons add column if not exists death_lunar_day smallint check (death_lunar_day between 1 and 30);
alter table public.persons add column if not exists death_lunar_month smallint check (death_lunar_month between 1 and 12);
alter table public.persons add column if not exists burial_place text;
alter table public.persons add column if not exists biography text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'persons_death_lunar_pair_check'
      and conrelid = 'public.persons'::regclass
  ) then
    alter table public.persons
      add constraint persons_death_lunar_pair_check
      check ((death_lunar_day is null) = (death_lunar_month is null));
  end if;
end $$;

comment on column public.persons.in_family_tree is 'Co thuoc cay gia pha (hien trong so do gia pha) hay khong.';
comment on column public.persons.gender is 'Gioi tinh: nam / nu / null (chua ro).';
comment on column public.persons.death_date is 'Ngay mat theo duong lich (neu con song thi de trong).';
comment on column public.persons.death_lunar_day is 'Ngay gio theo am lich (1-30) — luon di kem death_lunar_month.';
comment on column public.persons.death_lunar_month is 'Thang gio theo am lich (1-12) — luon di kem death_lunar_day.';
comment on column public.persons.burial_place is 'Mo phan / noi an tang.';
comment on column public.persons.biography is 'Tieu su ngan ve nguoi nay.';

update public.app_settings
set value = value
  || jsonb_build_object(
    'person',
    $j${
      "in_family_tree": "Thuộc dòng họ",
      "gender": "Giới tính",
      "gender_nam": "Nam",
      "gender_nu": "Nữ",
      "deceased": "Đã mất",
      "death_date": "Ngày mất (dương lịch)",
      "death_lunar": "Ngày giỗ (âm lịch)",
      "burial_place": "Mộ phần",
      "biography": "Tiểu sử",
      "lunar_suffix": "ÂL"
    }$j$::jsonb || coalesce(value -> 'person', '{}'::jsonb)
  )
where key = 'labels';

-- ============ [2] NHÃN TRANG GIA PHẢ (v2.0) ==========================
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

-- ============ [3] BẢNG life_events + birth/death_year (v2.1) =========
create table if not exists public.life_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons (id) on delete cascade,
  event_date date,
  event_year smallint check (event_year is null or event_year between 1000 and 2200),
  title text not null check (length(title) > 0),
  note text,
  kind text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists life_events_person_idx on public.life_events (person_id);

comment on table public.life_events is 'Su kien cuoc doi/timeline cua 1 person (gia pha + CRM dung chung).';

alter table public.life_events enable row level security;

drop policy if exists nguoi_dang_nhap_doc_life_events on public.life_events;
create policy nguoi_dang_nhap_doc_life_events
  on public.life_events for select
  to authenticated
  using (true);

drop policy if exists admin_editor_them_life_events on public.life_events;
create policy admin_editor_them_life_events
  on public.life_events for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'editor'));

drop policy if exists admin_editor_sua_life_events on public.life_events;
create policy admin_editor_sua_life_events
  on public.life_events for update
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'))
  with check (public.get_my_role() in ('admin', 'editor'));

drop policy if exists admin_xoa_hoac_editor_xoa_cua_minh_life_events on public.life_events;
create policy admin_xoa_hoac_editor_xoa_cua_minh_life_events
  on public.life_events for delete
  to authenticated
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'editor' and created_by = auth.uid())
  );

alter table public.persons
  add column if not exists birth_year smallint
    check (birth_year is null or birth_year between 1000 and 2200);
alter table public.persons
  add column if not exists death_year smallint
    check (death_year is null or death_year between 1000 and 2200);

comment on column public.persons.birth_year is 'Nam sinh gan dung (chi dung khi khong co birthday day du).';
comment on column public.persons.death_year is 'Nam mat gan dung (chi dung khi khong co death_date day du).';

-- View persons_safe — bản CUỐI: 9 cột gia phả nối sau search_text.
-- Thứ tự cột này là VĨNH VIỄN (CREATE OR REPLACE VIEW chỉ cho nối vào cuối).
create or replace view public.persons_safe as
select
  id, full_name, nickname, group_type, avatar_url, phone, email, birthday,
  company, job_title, address, hometown, hobbies, preferences, how_we_met,
  social_links, tags, is_favorite, contact_frequency_days,
  created_by, created_at, updated_at, search_text,
  in_family_tree, gender, death_date, death_lunar_day, death_lunar_month,
  burial_place, biography,
  birth_year, death_year
from public.persons;

-- ============ [4] NHÃN v2.1 ==========================================
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

-- ============ XONG ====================================================
-- Kiểm tra nhanh sau khi chạy:
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='persons_safe'
--     order by ordinal_position;  -- phải kết thúc bằng ...biography, birth_year, death_year
--   select count(*) from public.life_events;  -- = 0, không lỗi
