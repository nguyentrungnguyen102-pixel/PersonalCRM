-- =====================================================================
-- PersonalCRM — Gia pha v2.1 (Phase 0): bang life_events (su kien cuoc doi,
-- dung chung cho ca CRM) + persons.birth_year/death_year (nam gan dung khi
-- Excel gia pha chi co nam, KHONG bia ngay yyyy-01-01 de tranh nhac sai).
-- Viet idempotent (if not exists / drop policy if exists) de co the gop vao
-- script dan-1-lan apply_pending_v21.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BANG life_events
-- ---------------------------------------------------------------------
create table if not exists public.life_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons (id) on delete cascade,
  -- Mot trong hai: ngay day du HOAC chi nam (event_year) — ca hai null thi
  -- van cho phep (su kien khong ro thoi gian), sort xuong cuoi.
  event_date date,
  event_year smallint check (event_year is null or event_year between 1000 and 2200),
  title text not null check (length(title) > 0),
  note text,
  -- Loai su kien: sinh/mat/hoc_hanh/su_nghiep/hon_nhan/khac — text tu do
  -- (khong enum) de sau them loai khong can migration.
  kind text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists life_events_person_idx on public.life_events (person_id);

comment on table public.life_events is 'Su kien cuoc doi/timeline cua 1 person (gia pha + CRM dung chung).';

-- ---------------------------------------------------------------------
-- 2. RLS life_events — cung pattern voi interactions
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. persons.birth_year / death_year (nam gan dung)
-- ---------------------------------------------------------------------
alter table public.persons
  add column if not exists birth_year smallint
    check (birth_year is null or birth_year between 1000 and 2200);
alter table public.persons
  add column if not exists death_year smallint
    check (death_year is null or death_year between 1000 and 2200);

comment on column public.persons.birth_year is 'Nam sinh gan dung (chi dung khi khong co birthday day du).';
comment on column public.persons.death_year is 'Nam mat gan dung (chi dung khi khong co death_date day du).';

-- ---------------------------------------------------------------------
-- 4. VIEW persons_safe — noi 2 cot moi vao CUOI (append-only vinh vien,
--    xem ghi chu o 20260716100000_giapha_persons.sql)
-- ---------------------------------------------------------------------
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
