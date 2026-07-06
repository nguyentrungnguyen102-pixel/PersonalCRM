# PersonalCRM

Hệ thống quản lý mối quan hệ cá nhân (gia đình, bạn bè, đối tác, đồng nghiệp, con cái) chạy web.

## Stack

- **Frontend**: React + Vite + Tailwind CSS (SPA, tiếng Việt, mobile-first)
- **Backend**: Supabase (PostgreSQL + Auth + RLS + Storage)
- **Hosting**: Netlify (auto-deploy từ branch `main`)

## Chạy local

```bash
npm install
cp .env.example .env   # điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

## Cấu trúc

- `src/` — code frontend (components, pages, lib, hooks)
- `supabase/migrations/` — schema, RLS, seed dữ liệu `app_settings`

## Nguyên tắc

- Supabase là single source of truth.
- Mọi nhãn hiển thị tiếng Việt đọc từ `app_settings.labels` — không hardcode.
- Video chỉ lưu link ngoài (Google Drive / Photos / YouTube unlisted), không upload vào Storage.
- Secrets chỉ nằm trong `.env` / Netlify env vars, không commit.
