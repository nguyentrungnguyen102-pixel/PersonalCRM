-- =====================================================================
-- QuanHe360 — Migration 1/3: SCHEMA (extensions, enum, bang, ham, view)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
-- unaccent: bo dau tieng Viet phuc vu tim kiem khong dau
-- pg_trgm: index gin trigram cho tim kiem gan dung (ilike/search_text)
-- pgcrypto: cung cap gen_random_uuid() tren cac phien ban Postgres cu hon
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 2. ENUM TYPES
-- ---------------------------------------------------------------------
-- Nhom moi quan he
create type public.group_type as enum (
  'gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac'
);

-- Loai tuong tac voi mot nguoi
create type public.interaction_type as enum (
  'gap_mat', 'goi_dien', 'nhan_tin', 'du_lich', 'an_uong', 'cong_viec', 'khac'
);

-- Loai media dinh kem (anh luu tren storage hoac link video ngoai)
create type public.media_type as enum (
  'photo', 'video_link'
);

-- Vai tro nguoi dung trong he thong
create type public.user_role as enum (
  'admin', 'editor', 'viewer'
);

-- ---------------------------------------------------------------------
-- 3. HAM TIEN ICH: bo dau + ha chu thuong, dung cho tim kiem khong dau
-- ---------------------------------------------------------------------
-- Luu y: extension unaccent duoc tao trong schema "extensions" (chuan Supabase)
-- nen phai tham chieu dictionary theo dung schema do: 'extensions.unaccent'.
create or replace function public.vn_unaccent(text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(extensions.unaccent('extensions.unaccent', $1))
$$;

-- ---------------------------------------------------------------------
-- 4. BANG profiles — gan voi auth.users, luu vai tro nguoi dung
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Ho so nguoi dung, mo rong tu auth.users, luu vai tro phan quyen.';

-- Ham trigger: tu dong tao profile khi co user moi dang ky trong auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 5. HAM lay vai tro cua nguoi dung dang dang nhap (dung trong RLS)
-- ---------------------------------------------------------------------
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 6. HAM DUNG CHUNG: tu dong cap nhat cot updated_at khi UPDATE
-- ---------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. BANG persons — thong tin ho so tung nguoi trong CRM
-- ---------------------------------------------------------------------
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  nickname text,
  group_type public.group_type not null default 'khac',
  avatar_url text,
  phone text,
  email text,
  birthday date,
  company text,
  job_title text,
  address text,
  hometown text,
  hobbies text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb, -- {do_an, do_uong, kieng_ky, mau_sac...}
  gift_ideas text, -- rieng tu, chi admin/editor duoc doc/sua
  how_we_met text,
  social_links jsonb not null default '{}'::jsonb, -- {facebook, zalo, linkedin, instagram, tiktok...}
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  contact_frequency_days integer, -- null = khong nhac giu lien lac
  notes text, -- rieng tu, chi admin/editor duoc doc/sua
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    public.vn_unaccent(full_name || ' ' || coalesce(nickname, ''))
  ) stored
);

comment on table public.persons is 'Ho so tung nguoi trong so lien lac ca nhan.';
comment on column public.persons.gift_ideas is 'Rieng tu: chi admin/editor duoc xem, viewer khong thay (qua persons_safe).';
comment on column public.persons.notes is 'Rieng tu: chi admin/editor duoc xem, viewer khong thay (qua persons_safe).';

-- Index phuc vu tim kiem khong dau, gan dung tren search_text
create index persons_search_idx on public.persons using gin (search_text extensions.gin_trgm_ops);

-- Index phu tro cho cac truy van pho bien
create index persons_group_type_idx on public.persons (group_type);
create index persons_created_by_idx on public.persons (created_by);

create trigger set_updated_at
  before update on public.persons
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- 8. BANG interactions — lich su tuong tac voi tung nguoi
-- ---------------------------------------------------------------------
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons (id) on delete cascade,
  date date not null default current_date,
  type public.interaction_type not null default 'khac',
  title text,
  note text,
  location text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

comment on table public.interactions is 'Dong thoi gian tuong tac (gap mat, goi dien...) voi tung nguoi.';

create index interactions_person_date_idx on public.interactions (person_id, date desc);

-- ---------------------------------------------------------------------
-- 9. BANG media — anh/video dinh kem cho tung nguoi hoac tuong tac
-- ---------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons (id) on delete cascade,
  interaction_id uuid references public.interactions (id) on delete set null,
  type public.media_type not null,
  storage_path text, -- chi dung cho type = 'photo'
  external_url text, -- chi dung cho type = 'video_link'
  caption text,
  taken_at date,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint media_type_source_check check (
    (type = 'photo' and storage_path is not null)
    or (type = 'video_link' and external_url is not null)
  )
);

comment on table public.media is 'Anh (luu Supabase Storage) va link video (Google Drive/YouTube...) gan voi mot nguoi.';

create index media_person_idx on public.media (person_id);
create index media_interaction_idx on public.media (interaction_id);

-- ---------------------------------------------------------------------
-- 10. BANG app_settings — cau hinh/nhan UI luu duoi dang key-value jsonb
-- ---------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.app_settings is 'Cau hinh ung dung va nhan UI, luu duoi dang key-value jsonb.';

create or replace function public.tg_app_settings_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger set_updated_meta
  before update on public.app_settings
  for each row execute function public.tg_app_settings_touch();

-- ---------------------------------------------------------------------
-- 11. VIEW person_last_contacted — ngay tuong tac gan nhat cua tung nguoi
-- ---------------------------------------------------------------------
create view public.person_last_contacted
with (security_invoker = true) as
select
  person_id,
  max(date) as last_contacted
from public.interactions
group by person_id;

comment on view public.person_last_contacted is 'Ngay tuong tac gan nhat theo tung person_id (security_invoker: ap dung RLS cua nguoi goi).';

-- Chi cho phep nguoi da dang nhap doc view nay
revoke all on public.person_last_contacted from anon, public;
grant select on public.person_last_contacted to authenticated;

-- ---------------------------------------------------------------------
-- 12. VIEW persons_safe — ban an toan cho viewer, an notes + gift_ideas
-- ---------------------------------------------------------------------
-- Khong dung security_invoker: view chay theo quyen chu so huu (bypass RLS
-- cua bang persons) vi viewer bi RLS chan SELECT truc tiep tren persons.
create view public.persons_safe as
select
  id, full_name, nickname, group_type, avatar_url, phone, email, birthday,
  company, job_title, address, hometown, hobbies, preferences, how_we_met,
  social_links, tags, is_favorite, contact_frequency_days,
  created_by, created_at, updated_at, search_text
from public.persons;

comment on view public.persons_safe is 'Ban an toan cua persons cho viewer: khong co cot notes va gift_ideas.';

-- Chi cho phep nguoi da dang nhap doc view nay (bat buoc, view bypass RLS goc)
revoke all on public.persons_safe from anon, public;
grant select on public.persons_safe to authenticated;
