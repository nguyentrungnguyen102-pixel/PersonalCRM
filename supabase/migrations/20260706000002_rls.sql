-- =====================================================================
-- QuanHe360 — Migration 2/3: RLS POLICIES + STORAGE POLICIES
-- =====================================================================
-- Khong dung "force row level security": chu so huu bang (owner) can
-- bypass RLS de cac view persons_safe / trigger security definer hoat dong.

-- ---------------------------------------------------------------------
-- BAT RLS TREN MOI BANG
-- ---------------------------------------------------------------------
alter table public.persons enable row level security;
alter table public.interactions enable row level security;
alter table public.media enable row level security;
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------
-- POLICIES: persons
-- Viewer KHONG duoc SELECT truc tiep bang goc (doc qua view persons_safe)
-- ---------------------------------------------------------------------
create policy admin_editor_doc_persons
  on public.persons for select
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_them_persons
  on public.persons for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_sua_persons
  on public.persons for update
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'))
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_xoa_hoac_editor_xoa_cua_minh_persons
  on public.persons for delete
  to authenticated
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'editor' and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- POLICIES: interactions
-- Moi nguoi da dang nhap (ke ca viewer) duoc doc; chi admin/editor duoc ghi
-- ---------------------------------------------------------------------
create policy nguoi_dang_nhap_doc_interactions
  on public.interactions for select
  to authenticated
  using (auth.uid() is not null);

create policy admin_editor_them_interactions
  on public.interactions for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_sua_interactions
  on public.interactions for update
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'))
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_xoa_hoac_editor_xoa_cua_minh_interactions
  on public.interactions for delete
  to authenticated
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'editor' and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- POLICIES: media
-- Moi nguoi da dang nhap (ke ca viewer) duoc doc; chi admin/editor duoc ghi
-- ---------------------------------------------------------------------
create policy nguoi_dang_nhap_doc_media
  on public.media for select
  to authenticated
  using (auth.uid() is not null);

create policy admin_editor_them_media
  on public.media for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_sua_media
  on public.media for update
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'))
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_xoa_hoac_editor_xoa_cua_minh_media
  on public.media for delete
  to authenticated
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'editor' and uploaded_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- POLICIES: profiles
-- Moi nguoi da dang nhap doc duoc (biet ten nguoi tao + biet vai tro cua minh)
-- Insert chi qua trigger security definer handle_new_user (owner bypass RLS)
-- Chi admin duoc doi vai tro nguoi khac
-- ---------------------------------------------------------------------
create policy nguoi_dang_nhap_doc_profiles
  on public.profiles for select
  to authenticated
  using (auth.uid() is not null);

create policy khong_ai_duoc_them_profiles
  on public.profiles for insert
  to authenticated
  with check (false);

create policy admin_sua_profiles
  on public.profiles for update
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy admin_xoa_profiles
  on public.profiles for delete
  to authenticated
  using (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------
-- POLICIES: app_settings
-- Moi nguoi da dang nhap doc duoc; chi admin duoc ghi/sua/xoa
-- ---------------------------------------------------------------------
create policy nguoi_dang_nhap_doc_app_settings
  on public.app_settings for select
  to authenticated
  using (auth.uid() is not null);

create policy admin_them_app_settings
  on public.app_settings for insert
  to authenticated
  with check (public.get_my_role() = 'admin');

create policy admin_sua_app_settings
  on public.app_settings for update
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy admin_xoa_app_settings
  on public.app_settings for delete
  to authenticated
  using (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------
-- STORAGE: bucket "media" (private) + policies tren storage.objects
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Moi nguoi da dang nhap duoc xem/tai anh trong bucket media
create policy nguoi_dang_nhap_xem_storage_media
  on storage.objects for select
  to authenticated
  using (bucket_id = 'media');

-- Chi admin/editor duoc tai len
create policy admin_editor_tai_len_storage_media
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and public.get_my_role() in ('admin', 'editor'));

-- Chi admin/editor duoc sua metadata file
create policy admin_editor_sua_storage_media
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and public.get_my_role() in ('admin', 'editor'))
  with check (bucket_id = 'media' and public.get_my_role() in ('admin', 'editor'));

-- Admin xoa duoc moi file; editor chi xoa duoc file minh da tai len
-- Luu y: dung owner_id (text) thay vi owner (uuid, da deprecated) de tuong
-- thich voi cac phien ban storage moi hon.
create policy admin_hoac_editor_xoa_cua_minh_storage_media
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (
      public.get_my_role() = 'admin'
      or (public.get_my_role() = 'editor' and owner_id = auth.uid()::text)
    )
  );
