-- =====================================================================
-- PersonalCRM — Phase 3: quan he (relationships), RPC quan ly the,
-- nhan UI moi, backfill nickname (ten danh ba)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BANG relationships — quan he 2 chieu kieu HubSpot associations
-- ---------------------------------------------------------------------
create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  person_a uuid not null references public.persons (id) on delete cascade,
  person_b uuid not null references public.persons (id) on delete cascade,
  relation_type text not null,
  direction_label_a_to_b text not null, -- VD: "bố/mẹ của" (A doi voi B)
  direction_label_b_to_a text not null, -- VD: "con của" (B doi voi A)
  note text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint relationships_khac_nhau check (person_a <> person_b),
  constraint relationships_duy_nhat unique (person_a, person_b, relation_type)
);

comment on table public.relationships is 'Quan he giua 2 nguoi: type + nhan 2 chieu, hien thi dung chieu o moi ho so.';

create index relationships_person_a_idx on public.relationships (person_a);
create index relationships_person_b_idx on public.relationships (person_b);

alter table public.relationships enable row level security;

create policy nguoi_dang_nhap_doc_relationships
  on public.relationships for select
  to authenticated
  using (auth.uid() is not null);

create policy admin_editor_them_relationships
  on public.relationships for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_sua_relationships
  on public.relationships for update
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'))
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_xoa_hoac_editor_xoa_cua_minh_relationships
  on public.relationships for delete
  to authenticated
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'editor' and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 2. SEED app_settings.relation_types — 2 nhom: Gia dinh / Xa hoi
--    direction: 'down' = a la be tren (bo/me, ong/ba); 'same' = ngang hang
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'relation_types',
  $j$[
    {"value": "vo_chong",   "label": "Vợ / Chồng",        "family": true,  "direction": "same", "label_a_to_b": "vợ/chồng của",   "label_b_to_a": "vợ/chồng của"},
    {"value": "bo_me_con",  "label": "Bố / Mẹ — Con",     "family": true,  "direction": "down", "label_a_to_b": "bố/mẹ của",      "label_b_to_a": "con của"},
    {"value": "anh_chi_em", "label": "Anh / Chị — Em",    "family": true,  "direction": "same", "label_a_to_b": "anh/chị của",    "label_b_to_a": "em của"},
    {"value": "ong_ba_chau","label": "Ông / Bà — Cháu",   "family": true,  "direction": "down", "label_a_to_b": "ông/bà của",     "label_b_to_a": "cháu của"},
    {"value": "dong_nghiep","label": "Đồng nghiệp",       "family": false, "direction": "same", "label_a_to_b": "đồng nghiệp của","label_b_to_a": "đồng nghiệp của"},
    {"value": "doi_tac",    "label": "Đối tác",           "family": false, "direction": "same", "label_a_to_b": "đối tác của",    "label_b_to_a": "đối tác của"},
    {"value": "gioi_thieu", "label": "Giới thiệu",        "family": false, "direction": "same", "label_a_to_b": "đã giới thiệu",  "label_b_to_a": "được giới thiệu bởi"},
    {"value": "cung_du_an", "label": "Cùng dự án",        "family": false, "direction": "same", "label_a_to_b": "cùng dự án với", "label_b_to_a": "cùng dự án với"},
    {"value": "ban_hoc",    "label": "Bạn học",           "family": false, "direction": "same", "label_a_to_b": "bạn học của",    "label_b_to_a": "bạn học của"},
    {"value": "hang_xom",   "label": "Hàng xóm",          "family": false, "direction": "same", "label_a_to_b": "hàng xóm của",   "label_b_to_a": "hàng xóm của"}
  ]$j$::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 3. RPC QUAN LY THE — chay quyen invoker, RLS persons van ap dung;
--    chan them o tang ham: chi admin duoc goi thao tac ghi hang loat.
-- ---------------------------------------------------------------------
create or replace function public.list_tags()
returns table (tag text, so_nguoi bigint)
language sql
stable
as $$
  select t.tag, count(*) as so_nguoi
  from public.persons p, unnest(p.tags) as t(tag)
  group by t.tag
  order by so_nguoi desc, t.tag
$$;

create or replace function public.rename_tag(old_tag text, new_tag text)
returns integer
language plpgsql
as $$
declare
  so_dong integer;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'chi admin duoc doi ten the';
  end if;
  if new_tag is null or length(trim(new_tag)) = 0 then
    raise exception 'ten the moi khong duoc rong';
  end if;
  update public.persons
  set tags = (
    select array_agg(distinct x) from unnest(array_replace(tags, old_tag, trim(new_tag))) as x
  )
  where old_tag = any(tags);
  get diagnostics so_dong = row_count;
  return so_dong;
end;
$$;

create or replace function public.delete_tag(tag_can_xoa text)
returns integer
language plpgsql
as $$
declare
  so_dong integer;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'chi admin duoc xoa the';
  end if;
  update public.persons
  set tags = array_remove(tags, tag_can_xoa)
  where tag_can_xoa = any(tags);
  get diagnostics so_dong = row_count;
  return so_dong;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. NHAN UI MOI — merge, khong ghi de tuy chinh (pattern Phase 2)
-- ---------------------------------------------------------------------
update public.app_settings
set value = value
  || jsonb_build_object(
    'person',
    coalesce(value -> 'person', '{}'::jsonb) || $j${
      "contact_name": "Tên danh bạ",
      "full_name_label": "Tên đầy đủ"
    }$j$::jsonb
  )
  || jsonb_build_object(
    'filters',
    $j${
      "by_tag": "Lọc theo thẻ",
      "all_tags": "Tất cả thẻ",
      "clear": "Xóa lọc"
    }$j$::jsonb || coalesce(value -> 'filters', '{}'::jsonb)
  )
  || jsonb_build_object(
    'tags',
    $j${
      "title": "Thẻ",
      "count": "Số người",
      "rename": "Đổi tên",
      "merge_confirm": "Thẻ đích đã tồn tại — sẽ GỘP hai thẻ làm một. Tiếp tục?",
      "delete_confirm": "Xóa thẻ này khỏi tất cả liên hệ?",
      "renamed": "Đã đổi tên thẻ",
      "deleted": "Đã xóa thẻ",
      "empty": "Chưa có thẻ nào"
    }$j$::jsonb || coalesce(value -> 'tags', '{}'::jsonb)
  )
  || jsonb_build_object(
    'relations',
    $j${
      "title": "Quan hệ",
      "add": "Thêm quan hệ",
      "choose_person": "Chọn người",
      "choose_type": "Loại quan hệ",
      "family_group": "Gia đình",
      "social_group": "Xã hội",
      "label_this_to_other": "Người này là",
      "label_other_to_this": "Người kia là",
      "note": "Ghi chú ngữ cảnh",
      "saved": "Đã thêm quan hệ",
      "deleted": "Đã xóa quan hệ",
      "delete_confirm": "Xóa quan hệ này?",
      "duplicate": "Hai người này đã có quan hệ loại này",
      "empty": "Chưa có quan hệ nào",
      "suggest_yes": "Tạo",
      "suggest_no": "Bỏ qua",
      "suggest_title": "Gợi ý"
    }$j$::jsonb || coalesce(value -> 'relations', '{}'::jsonb)
  )
  || jsonb_build_object(
    'diagram',
    $j${
      "title": "Sơ đồ quan hệ",
      "mode_tree": "Cây gia phả",
      "mode_network": "Mạng lưới",
      "root_person": "Người gốc",
      "filter_type": "Lọc theo loại",
      "view_profile": "Xem hồ sơ",
      "zoom_in": "Phóng to",
      "zoom_out": "Thu nhỏ",
      "empty": "Chưa có quan hệ nào để vẽ — thêm quan hệ trong hồ sơ từng người",
      "empty_family": "Người này chưa có quan hệ gia đình nào"
    }$j$::jsonb || coalesce(value -> 'diagram', '{}'::jsonb)
  )
  || jsonb_build_object(
    'names',
    $j${
      "title": "Gợi ý tên đầy đủ",
      "from_notes": "Từ ghi chú",
      "description": "Các liên hệ dưới đây có ghi chú trông giống họ tên đầy đủ. Chọn dòng đúng rồi bấm Áp dụng — ghi chú gốc được giữ nguyên.",
      "apply": "Áp dụng đã chọn",
      "applied": "Đã cập nhật tên đầy đủ",
      "empty": "Không còn dòng nào cần duyệt",
      "found": "dòng có gợi ý"
    }$j$::jsonb || coalesce(value -> 'names', '{}'::jsonb)
  )
where key = 'labels';

-- ---------------------------------------------------------------------
-- 5. BACKFILL: nickname (ten danh ba) = full_name cho ban ghi chua co
-- ---------------------------------------------------------------------
update public.persons set nickname = full_name where nickname is null or length(trim(nickname)) = 0;
