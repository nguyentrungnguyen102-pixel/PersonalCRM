-- =====================================================================
-- PersonalCRM — Phase 4: hop thu cho (inbox), viec can lam (tasks),
-- tai khoan bot Telegram (bot_accounts), nhan UI moi
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BANG inbox_items — tin nhan/du lieu vao chua gan duoc nguoi
-- ---------------------------------------------------------------------
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'khac', -- 'telegram' / 'cuoc_goi' / 'khac'
  raw_text text not null,
  suggested_person_id uuid references public.persons (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'assigned', 'dismissed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index inbox_items_status_idx on public.inbox_items (status, created_at desc);

alter table public.inbox_items enable row level security;

-- admin/editor doc-ghi; viewer khong thay hop thu
create policy admin_editor_doc_inbox
  on public.inbox_items for select
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_them_inbox
  on public.inbox_items for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_sua_inbox
  on public.inbox_items for update
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'))
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_xoa_inbox
  on public.inbox_items for delete
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'));

-- ---------------------------------------------------------------------
-- 2. BANG tasks — viec can lam / follow-up (kieu HubSpot Tasks)
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.persons (id) on delete cascade, -- null = viec chung
  title text not null check (length(trim(title)) > 0),
  note text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index tasks_due_idx on public.tasks (done, due_date);
create index tasks_person_idx on public.tasks (person_id);

alter table public.tasks enable row level security;

create policy nguoi_dang_nhap_doc_tasks
  on public.tasks for select
  to authenticated
  using (auth.uid() is not null);

create policy admin_editor_them_tasks
  on public.tasks for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_editor_sua_tasks
  on public.tasks for update
  to authenticated
  using (public.get_my_role() in ('admin', 'editor'))
  with check (public.get_my_role() in ('admin', 'editor'));

create policy admin_xoa_hoac_editor_xoa_cua_minh_tasks
  on public.tasks for delete
  to authenticated
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'editor' and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3. BANG bot_accounts — chat Telegram duoc phep dung bot
-- ---------------------------------------------------------------------
create table public.bot_accounts (
  chat_id bigint primary key,
  profile_id uuid references public.profiles (id) on delete cascade,
  display_name text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bot_accounts enable row level security;

-- chi admin quan ly danh sach bot (Edge Function dung service_role, bypass RLS)
create policy admin_doc_bot_accounts
  on public.bot_accounts for select
  to authenticated
  using (public.get_my_role() = 'admin');

create policy admin_ghi_bot_accounts
  on public.bot_accounts for insert
  to authenticated
  with check (public.get_my_role() = 'admin');

create policy admin_sua_bot_accounts
  on public.bot_accounts for update
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy admin_xoa_bot_accounts
  on public.bot_accounts for delete
  to authenticated
  using (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------
-- 4. NHAN UI MOI — merge khong ghi de (pattern Phase 2/3)
-- ---------------------------------------------------------------------
update public.app_settings
set value = value
  || jsonb_build_object(
    'nav',
    coalesce(value -> 'nav', '{}'::jsonb) || '{"inbox": "Hộp thư chờ"}'::jsonb
  )
  || jsonb_build_object(
    'inbox',
    $j${
      "title": "Hộp thư chờ",
      "description": "Tin nhắn từ bot/cuộc gọi chưa nhận diện được người — gán tay tại đây.",
      "assign": "Gán & lưu",
      "dismiss": "Bỏ qua",
      "assigned": "Đã gán thành tương tác",
      "dismissed": "Đã bỏ qua",
      "empty": "Hộp thư trống 🎉",
      "suggested": "Gợi ý",
      "source_telegram": "Telegram",
      "source_cuoc_goi": "Cuộc gọi",
      "source_khac": "Khác"
    }$j$::jsonb || coalesce(value -> 'inbox', '{}'::jsonb)
  )
  || jsonb_build_object(
    'tasks',
    $j${
      "title": "Việc cần làm",
      "upcoming": "Việc sắp tới",
      "add": "Thêm việc",
      "task_title": "Việc gì",
      "due": "Hạn",
      "no_due": "Không hạn",
      "overdue": "Quá hạn",
      "today": "Hôm nay",
      "done": "Xong",
      "saved": "Đã thêm việc",
      "deleted": "Đã xóa việc",
      "empty": "Không có việc nào",
      "all_done": "Đã xong hết 🎉"
    }$j$::jsonb || coalesce(value -> 'tasks', '{}'::jsonb)
  )
  || jsonb_build_object(
    'backup',
    $j${
      "title": "Sao lưu dữ liệu",
      "description": "Tải toàn bộ dữ liệu về máy dạng ZIP (CSV mở được Excel, không vỡ dấu).",
      "export": "Tải bản sao lưu",
      "exporting": "Đang gom dữ liệu...",
      "done": "Đã tải xong"
    }$j$::jsonb || coalesce(value -> 'backup', '{}'::jsonb)
  )
  || jsonb_build_object(
    'bot',
    $j${
      "title": "Kết nối",
      "telegram": "Bot Telegram",
      "telegram_hint": "Nhắn tin cho bot để ghi nhanh tương tác. Cú pháp: Tên / nội dung. Thêm việc: !viec Tên / việc [dd/mm].",
      "approved": "Đã duyệt",
      "pending": "Chờ duyệt",
      "approve": "Duyệt",
      "revoke": "Thu hồi",
      "no_accounts": "Chưa có chat nào — nhắn /start cho bot rồi quay lại đây duyệt.",
      "call_webhook": "Ghi cuộc gọi Android (MacroDroid)",
      "call_hint": "Cài MacroDroid, tạo macro Call Ended → HTTP POST tới URL dưới đây kèm token."
    }$j$::jsonb || coalesce(value -> 'bot', '{}'::jsonb)
  )
  || jsonb_build_object(
    'enrich',
    $j${
      "title": "Làm giàu hồ sơ",
      "search_google": "Tìm Google",
      "search_facebook": "Tìm Facebook",
      "search_linkedin": "Tìm LinkedIn",
      "search_zalo": "Tìm Zalo",
      "paste_hint": "Tìm thấy trang cá nhân? Dán link vào đây",
      "saved": "Đã lưu link",
      "missing_fields": "Trường còn trống"
    }$j$::jsonb || coalesce(value -> 'enrich', '{}'::jsonb)
  )
  || jsonb_build_object(
    'scan',
    $j${
      "title": "Quét danh thiếp",
      "pick_image": "Chụp / chọn ảnh danh thiếp",
      "scanning": "Đang đọc ảnh (lần đầu tải bộ nhận dạng ~vài MB)...",
      "review_hint": "Kiểm tra và sửa lại trước khi lưu",
      "no_text": "Không đọc được chữ trên ảnh — thử ảnh rõ hơn",
      "use_result": "Dùng kết quả này"
    }$j$::jsonb || coalesce(value -> 'scan', '{}'::jsonb)
  )
  || jsonb_build_object(
    'invite',
    $j${
      "title": "Mời người dùng",
      "email": "Email người mới",
      "role": "Vai trò",
      "send": "Tạo tài khoản",
      "created": "Đã tạo — gửi mật khẩu tạm này cho họ (chỉ hiện 1 lần)",
      "exists": "Email này đã có tài khoản",
      "error": "Không tạo được tài khoản"
    }$j$::jsonb || coalesce(value -> 'invite', '{}'::jsonb)
  )
where key = 'labels';
