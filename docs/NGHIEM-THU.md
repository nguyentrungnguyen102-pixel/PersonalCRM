# BIÊN BẢN NGHIỆM THU PERSONALCRM v1.0

> Tổng hợp 4 phase, 06–08/07/2026. Người duyệt: anh Nguyên (chủ sản phẩm). Đơn vị thực hiện: Claude Code (Fable điều phối/QA, Sonnet thi công module).

## 1. Phạm vi đã bàn giao

| Phase | Nội dung | Duyệt |
|---|---|---|
| 1 — MVP lõi | Supabase (schema/RLS/Storage) + Auth 3 role, Danh bạ card + search không dấu, Hồ sơ 3 cột, CRUD person/interaction, FAB ghi nhanh, upload ảnh nén + video link, Dashboard (Sắp nguội/sinh nhật/thống kê), deploy | ✅ 06/07 |
| 2 — Import & quản trị | Import wizard Google CSV + dedupe (899 contact thật, re-import 0 trùng), Bảng chỉnh nhanh inline + bulk, trang Cài đặt (nhãn/thông số/user/mật khẩu), rebrand PersonalCRM | ✅ 07/07 |
| 3 — Quan hệ & tổ chức | Lọc thẻ + quản lý thẻ (RPC), tách Tên danh bạ/Tên đầy đủ + gợi ý tên từ Notes, bảng relationships 2 chiều + panel Quan hệ + Sơ đồ (cây gia phả + mạng lưới), chuyển hosting Netlify→Cloudflare Pages + CI GitHub Actions | ✅ 07/07 |
| 4 — Tự động hoá | Bot Telegram ghi nhanh + Hộp thư chờ, digest 7h (Telegram, email chờ key), Tasks kiểu HubSpot, Export ZIP, mời user từ app, import LinkedIn, quét danh thiếp OCR, panel làm giàu hồ sơ, webhook cuộc gọi Android (server sẵn sàng), sheet-sync + Apps Script | ✅ 08/07 ("Anh thấy ok rồi… Merge đi em") |

Merge `main`: commit `174a10d` (PR #1, 08/07/2026). Production: https://personalcrm102.pages.dev.

## 2. Số liệu nghiệm thu

- **Dữ liệu thật**: 900 persons (899 import từ danh bạ Google của chủ sản phẩm), 63 birthday, dedupe re-import = 0 trùng.
- **Kiểm thử**: 60+ test case tự động (Playwright UI + curl API + SQL verify) — chi tiết TESTCASE.md, tất cả PASS tại thời điểm nghiệm thu; RLS được test bằng token thật của cả 3 role.
- **Hạ tầng**: 8 migration đã áp; 5 Edge Functions ACTIVE; cron daily-digest chạy 0:00 UTC; CI xanh (build+deploy tự động).
- **Chi phí vận hành**: 0đ/tháng (toàn bộ free tier), đúng ràng buộc "không API trả phí".

## 3. Sự cố đã phát hiện & xử lý trong quá trình (đáng lưu ý khi bảo trì)

1. **Bundle rỗng khi thiếu env build-time**: throw ở module scope bị Rollup DCE cả app → thay bằng cờ `supabaseConfigured` + màn hình báo lỗi. (Phase 1)
2. **Nút xác nhận xóa không bấm được trên iPhone**: bottom-sheet bị thanh Safari che → ConfirmDialog chuyển dialog giữa màn + dvh/safe-area. (Phase 3)
3. **Bot match nhầm tên gần giống** ("A Ba" → "A Bách Bs"): chấm điểm lại theo ranh giới từ trên từng tên, hòa điểm ưu tiên tên ngắn. (Phase 4)
4. **Tesseract bị gộp vendor chunk** làm mất lazy-load → thêm nhánh manualChunks riêng. (Phase 4)
5. Netlify hết hạn mức miễn phí → chuyển Cloudflare Pages, giữ tên personalcrm102. (Phase 3)

## 4. Hạng mục treo (không chặn nghiệm thu)

| Hạng mục | Trạng thái | Việc còn lại |
|---|---|---|
| Ghi cuộc gọi Android | Server `call-log` live, đã test | Người dùng cài MacroDroid theo hướng dẫn trong app (Cài đặt → Kết nối) + lấy CALL_WEBHOOK_SECRET |
| Sheet nhập nhanh | Function `sheet-sync` live + Apps Script sẵn trong repo | Dán `apps-script/Code.gs` vào Sheet + set SYNC_URL/SYNC_TOKEN (5 phút) |
| Email digest | Code sẵn, tự bật khi có key | Đăng ký Resend, set secret `RESEND_API_KEY` |
| Tag `phase-N-done` trên GitHub | Môi trường CI chặn push tag | Tạo release/tag trên GitHub UI nếu cần mốc |
| Xóa site Netlify cũ | Ngừng dùng | Chủ tài khoản xóa trong app.netlify.com |

## 5. Tài khoản bàn giao

- Admin: nguyentrungnguyen102@gmail.com (đã đổi mật khẩu chủ động). Viewer test: nguyentrungnguyen102+viewer@gmail.com.
- Bot: @personalcrm102_bot (chat chủ sản phẩm đã duyệt).
- Secrets vận hành nằm tại: Supabase Edge Function secrets + GitHub Actions secrets (danh mục xem KIEN-TRUC §4).

## 6. Kết luận

Sản phẩm đạt toàn bộ yêu cầu BRD v1 (Phase 1–4), chạy ổn định trên production với dữ liệu thật, chi phí 0đ, đã được chủ sản phẩm duyệt từng phase và duyệt tổng khi merge. Hồ sơ phát triển tiếp: BRD.md (yêu cầu) → KIEN-TRUC.md (kỹ thuật) → TESTCASE.md (regression) → HDSD.md (người dùng).
