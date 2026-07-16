-- =====================================================================
-- PersonalCRM — Gia pha (Phase 1): bo sung cot cho persons (thuoc dong ho,
-- gioi tinh, ngay mat duong/am lich, mo phan, tieu su) + nhan UI moi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COT MOI tren bang persons
-- ---------------------------------------------------------------------
alter table public.persons
  add column in_family_tree boolean not null default false,
  add column gender text check (gender is null or gender in ('nam', 'nu')),
  add column death_date date,
  add column death_lunar_day smallint check (death_lunar_day between 1 and 30),
  add column death_lunar_month smallint check (death_lunar_month between 1 and 12),
  add column burial_place text,
  add column biography text,
  add constraint persons_death_lunar_pair_check
    check ((death_lunar_day is null) = (death_lunar_month is null));

comment on column public.persons.in_family_tree is 'Co thuoc cay gia pha (hien trong so do gia pha) hay khong.';
comment on column public.persons.gender is 'Gioi tinh: nam / nu / null (chua ro).';
comment on column public.persons.death_date is 'Ngay mat theo duong lich (neu con song thi de trong).';
comment on column public.persons.death_lunar_day is 'Ngay gio theo am lich (1-30) — luon di kem death_lunar_month.';
comment on column public.persons.death_lunar_month is 'Thang gio theo am lich (1-12) — luon di kem death_lunar_day.';
comment on column public.persons.burial_place is 'Mo phan / noi an tang.';
comment on column public.persons.biography is 'Tieu su ngan ve nguoi nay.';

-- ---------------------------------------------------------------------
-- 2. VIEW persons_safe — them 7 cot moi vao CUOI danh sach cot
-- ---------------------------------------------------------------------
-- Luu y quan trong: CREATE OR REPLACE VIEW chi cho phep THEM cot moi vao
-- CUOI danh sach SELECT hien co (khong duoc doi thu tu/xoa cot cu, neu
-- khong Postgres se bao loi "cannot change name/type of view column").
-- Vi vay thu tu cot ben duoi (7 cot moi nam sau search_text) la VINH VIEN,
-- moi lan them cot cho persons_safe sau nay cung phai noi vao CUOI cung.
create or replace view public.persons_safe as
select
  id, full_name, nickname, group_type, avatar_url, phone, email, birthday,
  company, job_title, address, hometown, hobbies, preferences, how_we_met,
  social_links, tags, is_favorite, contact_frequency_days,
  created_by, created_at, updated_at, search_text,
  in_family_tree, gender, death_date, death_lunar_day, death_lunar_month,
  burial_place, biography
from public.persons;

comment on view public.persons_safe is 'Ban an toan cua persons cho viewer: khong co cot notes va gift_ideas.';

-- Khong can re-issue grant/revoke: CREATE OR REPLACE VIEW giu nguyen quyen
-- da cap truoc do (revoke anon/public, grant select cho authenticated).

-- ---------------------------------------------------------------------
-- 3. NHAN UI MOI — merge khong ghi de (pattern Phase 2/3/4, xem
--    20260707180000_phase4_ui_labels.sql): key moi dat truoc, gia tri admin
--    da tuy chinh (neu co) duoc coalesce de len sau nen luon thang.
-- ---------------------------------------------------------------------
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
