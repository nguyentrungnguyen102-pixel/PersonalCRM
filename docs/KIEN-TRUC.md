# MÔ HÌNH KỸ THUẬT PERSONALCRM

> Dành cho developer tiếp nhận phát triển. v1.0 (08/07/2026).

## 1. Kiến trúc tổng thể

```
┌─────────────┐  HTTPS   ┌──────────────────────── Supabase (yzlpegtomgtdiwvuvftw, SG) ─┐
│ React SPA   │────────► │ PostgREST ──► PostgreSQL (RLS trên mọi bảng)                 │
│ (CF Pages)  │          │ Auth (GoTrue, email/password)                                 │
│ personalcrm │          │ Storage: bucket `media` (private, ảnh)                        │
│ 102.pages   │          │ Edge Functions (Deno):                                        │
│ .dev        │          │   telegram-webhook ◄── Telegram Bot API (@personalcrm102_bot) │
└─────────────┘          │   call-log         ◄── MacroDroid (Android HTTP POST)         │
      ▲                  │   sheet-sync       ◄── Google Apps Script (Sheet nhập nhanh)  │
      │ build+deploy     │   daily-digest     ◄── pg_cron 0:00 UTC (7h VN) qua pg_net    │
GitHub Actions           │   invite-user      ◄── App (admin JWT)                        │
(push main→prod,         └──────────────────────────────────────────────────────────────┘
 push nhánh→preview)
```

- **Nguyên tắc**: Supabase = single source of truth; mọi kênh nhập (Sheet, bot, cuộc gọi) chỉ INSERT/UPDATE, không DELETE.
- **Bảo mật**: phân quyền thật nằm ở RLS; anon key là public; Edge Functions xác thực riêng (secret header/token/JWT admin).

## 2. Stack & repo

| Lớp | Công nghệ |
|---|---|
| FE | React 19, Vite 8 (rolldown), TypeScript strict, Tailwind v4 (`@theme` token trong `src/index.css`), react-router v7 |
| Libs FE | @supabase/supabase-js v2, papaparse, jszip, tesseract.js (lazy), d3-force + d3-hierarchy |
| BE | Supabase: Postgres 17, GoTrue, Storage, Edge Functions (Deno, `npm:@supabase/supabase-js@2`) |
| Hosting | Cloudflare Pages project `personalcrm102` (SPA fallback `public/_redirects`) |
| CI/CD | `.github/workflows/deploy.yml`: build (env VITE_* trong YAML) + wrangler-action; secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; main→production, nhánh khác→preview |

Cấu trúc thư mục chính:

```
src/
  lib/        supabase.ts (client + cờ supabaseConfigured), types.ts, displayName.ts,
              normalize.ts (vnNormalize), keepInTouch.ts (freqBadge 70%), importCsv.ts
              (parse/map/dedupe Google+LinkedIn), relations.ts, familyLayout.ts,
              tasks.ts, backup.ts, settingsDefaults.ts
  hooks/      useAuth (session+role), useSettings (labels/t()/refresh), usePersons,
              usePersonDetail, useInboxCount
  components/ AppLayout (nav+badge), Modal (center prop!), ConfirmDialog, Avatar, Badge,
              PersonCard (GROUP_COLORS), PersonFormModal (initialValues), ContactsTable,
              BulkActionBar, TagFilterDropdown, QuickAddFab, MediaAddModal,
              RelationsPanel, TasksPanel, EnrichPanel, ScanCardModal, settings/*
  pages/      Login, Dashboard, Contacts, PersonProfile, ImportCsv, NameSuggestions,
              Inbox, Diagram, Reminders, Groups, Settings
supabase/
  migrations/ 8 file đánh số thời gian — schema/RLS/seed/cron (xem §3)
  functions/  5 function + _shared/normalize.ts
apps-script/  Code.gs (Sheet nhập nhanh) + appsscript.json
docs/         HDSD, BRD, KIEN-TRUC, TESTCASE, NGHIEM-THU
```

## 3. Data model (Postgres, schema `public`)

**Enum**: `group_type` (gia_dinh/ban_be/doi_tac/dong_nghiep/con_cai/khac), `interaction_type` (gap_mat/goi_dien/nhan_tin/du_lich/an_uong/cong_viec/khac), `media_type` (photo/video_link), `user_role` (admin/editor/viewer).

**Bảng** (chi tiết cột xem migration tương ứng):
- `persons` — hồ sơ; NGỮ NGHĨA TÊN: `nickname` = Tên danh bạ (hiển thị chính), `full_name` = Tên đầy đủ (not null, fallback = nickname); `search_text` GENERATED = vn_unaccent(full_name+nickname), index gin_trgm; `created_by default auth.uid()`.
- `interactions` — person_id CASCADE, date, type, note…; index (person_id, date desc).
- `media` — photo: `storage_path` (bucket media); video: `external_url` (domain whitelist ở app_settings); check constraint theo type.
- `relationships` — person_a/b CASCADE, relation_type + `direction_label_a_to_b/b_to_a` (2 chiều kiểu HubSpot), unique(a,b,type). Quy ước hiển thị trên hồ sơ P với người kia K: K=A → nhãn a_to_b, K=B → nhãn b_to_a (đọc "K là <nhãn> của P").
- `tasks` — person_id nullable CASCADE, title, due_date, done/done_at.
- `inbox_items` — source (telegram/cuoc_goi/khac), raw_text, suggested_person_id, status (pending/assigned/dismissed), payload jsonb.
- `bot_accounts` — chat_id PK (Telegram), profile_id, approved.
- `profiles` — id = auth.users.id, role; trigger `handle_new_user` (security definer) tự tạo khi signup.
- `app_settings` — key/value jsonb: `labels` (TOÀN BỘ nhãn UI — FE đọc qua `t('path.key')`, fallback = key cuối), `group_defaults`, `interaction_types`, `video_domains`, `warning_days`, `relation_types`.

**View**: `person_last_contacted` (security_invoker, max date theo person); `persons_safe` (**definer** — bản không có notes/gift_ideas cho viewer; revoke anon; FE chọn bảng theo `canEdit`).

**Function**: `get_my_role()` (security definer, dùng trong policy); `vn_unaccent()` (immutable wrapper unaccent); RPC thẻ `list_tags()/rename_tag()/delete_tag()` (chặn non-admin trong hàm).

**RLS** (mọi bảng bật): persons SELECT chỉ admin/editor (viewer đọc persons_safe); interactions/media/relationships/tasks SELECT authenticated, INSERT/UPDATE admin+editor, DELETE admin hoặc editor-bản-ghi-mình; inbox admin/editor; bot_accounts/app_settings ghi chỉ admin; app_settings **SELECT mở cả anon** (màn Login cần nhãn — bảng chỉ chứa nhãn+thông số). Storage bucket `media` private: đọc authenticated, ghi admin/editor.

**Migrations** (áp tuần tự; đã áp trên project live): `..0001_schema` → `..0002_rls` → `..0003_seed_app_settings` → `phase2_labels` → `phase3` (relationships+RPC thẻ+backfill nickname) → `phase4` (inbox/tasks/bot) → `phase4_cron` → `phase4_ui_labels`.

## 4. Edge Functions (supabase/functions/)

| Function | Auth | Vai trò |
|---|---|---|
| `telegram-webhook` | header `x-telegram-bot-api-secret-token` = TELEGRAM_WEBHOOK_SECRET; chat phải approved trong bot_accounts; **verify_jwt=off** | Parse `Tên / nội dung`, `!viec …`, free-text n-gram; match tên: scoreName ranh giới từ trên nickname/full_name riêng lẻ, hòa điểm → tên ngắn thắng; luôn trả 200 cho Telegram |
| `call-log` | body.secret = CALL_WEBHOOK_SECRET; verify_jwt=off | Match phone (variants 0/+84) → interaction goi_dien; chống trùng ±2 phút; miss → inbox |
| `sheet-sync` | body.token = SYNC_TOKEN; verify_jwt=off | UPSERT persons (dedupe chuẩn chung, chỉ điền ô trống) + interactions (lookup phone/email); trả kết quả per-row |
| `daily-digest` | JWT (anon) — pg_cron gọi kèm Bearer | Sinh nhật +7 ngày, top 10 sắp nguội, task đến hạn (múi giờ +7); gửi Telegram mọi chat approved; email nếu có RESEND_API_KEY |
| `invite-user` | JWT user, kiểm tra `get_my_role()==='admin'` | Tạo user (admin API) + set role, trả mật khẩu tạm; email trùng → 409 `exists` |

**Secrets** (Supabase → Edge Functions secrets): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CALL_WEBHOOK_SECRET`, `SYNC_TOKEN`, `DIGEST_EMAIL`, (`RESEND_API_KEY` tùy chọn). `SUPABASE_URL/SERVICE_ROLE_KEY/ANON_KEY` platform tự cấp.

**Cron**: `cron.schedule('daily-digest','0 0 * * *')` → `net.http_post` URL function kèm anon Bearer (migration phase4_cron). Kiểm tra: `select * from cron.job_run_details order by start_time desc`.

## 5. Quy ước frontend

1. **Nhãn**: mọi chuỗi UI qua `t('nhom.key')` từ `app_settings.labels`; thêm nhãn mới = migration merge `||` + coalesce (không đè), apply live. Fallback: key cuối.
2. **Tên hiển thị**: luôn `displayName(p)` (nickname ưu tiên).
3. **Data access**: viewer → `persons_safe`, admin/editor → `persons` (pattern trong usePersons); ghi thẳng bảng.
4. **Modal**: bottom-sheet mobile mặc định; dialog nhỏ dùng prop `center` (tránh Safari iOS che nút).
5. **Optimistic update**: patch state → gọi API → lỗi revert + toast (pattern ContactsTable).
6. **Chunk**: manualChunks trong vite.config — thư viện nặng dynamic-import phải return tên chunk riêng TRƯỚC nhánh `vendor` (bài học tesseract).
7. **Env build-time**: thiếu VITE_* khi build ⇒ app compile thành màn "Chưa cấu hình Supabase" (cờ `supabaseConfigured` — đừng throw ở module scope, Rollup sẽ xóa cả app).

## 6. Vận hành & phát triển

**Chạy local**: `npm i` → `.env` theo `.env.example` → `npm run dev`. Build: `npm run build`.

**Thêm migration**: file mới `supabase/migrations/<timestamp>_<ten>.sql` → áp lên live bằng Management API (`POST /v1/projects/{ref}/database/query`, Bearer = personal access token) hoặc `supabase db push` → commit.

**Deploy function**: sửa `supabase/functions/<slug>/index.ts` → `POST /v1/projects/{ref}/functions/deploy?slug=<slug>` (multipart: metadata + file index.ts + file _shared/normalize.ts) hoặc `supabase functions deploy <slug>`; function nhận webhook ngoài phải PATCH `verify_jwt=false` sau deploy.

**Deploy FE**: push → GitHub Actions tự chạy (main = production). Thủ công: `wrangler pages deploy dist --project-name=personalcrm102 --branch=main`.

**Đổi bot Telegram**: BotFather token mới → cập nhật secret `TELEGRAM_BOT_TOKEN` → gọi lại `setWebhook` (URL function + secret_token=TELEGRAM_WEBHOOK_SECRET).

**Tài khoản/hạ tầng**: Supabase project "Personal CRM 102" (`yzlpegtomgtdiwvuvftw`, ap-southeast-1); Cloudflare account `b2954ff...393`, Pages `personalcrm102`; GitHub `nguyentrungnguyen102-pixel/PersonalCRM`; bot `@personalcrm102_bot`. Netlify cũ đã bỏ (xóa tay nếu còn).

**Giới hạn free tier cần canh**: Supabase 500MB DB / 1GB Storage (chỉ ảnh đã nén ~≤2MB/ảnh; video là link ngoài), Edge Functions 500K req/tháng, pg_cron ok; CF Pages 500 build/tháng (build qua GitHub Actions nên không tính), Telegram miễn phí.
