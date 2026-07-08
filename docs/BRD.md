# BRD — YÊU CẦU NGHIỆP VỤ PERSONALCRM

> Business Requirements Document · v1.0 (08/07/2026) · Trạng thái: Phase 1–4 đã triển khai xong, merged `main`.

## 1. Mục tiêu sản phẩm

Personal CRM chạy web giúp cá nhân quản lý toàn diện mối quan hệ (gia đình, bạn bè, đối tác, đồng nghiệp, con cái):
- Hồ sơ chi tiết từng người kể cả thông tin riêng tư (sở thích, kiêng kỵ, quà tặng, quen nhau thế nào).
- Nhiều người truy cập, phân quyền xem/sửa; dữ liệu nhạy cảm chỉ admin/editor thấy.
- Nhắc giữ liên lạc theo nhịp; ghi tương tác không ma sát (≤10 giây, kể cả qua Telegram).
- Nhập liệu hàng loạt từ Google Contacts, LinkedIn, Google Sheets, danh thiếp.
- **Nguyên tắc chi phí: 100% dịch vụ free-tier, không API trả phí.**

Benchmark tham chiếu: Monica (trường personal: how_we_met, gift_ideas, preferences), Dex (dedupe import, keep-in-touch, network map), Covve (ghi nhanh mobile), folk (multi-user role), HubSpot (association 2 chiều, tasks, kênh log tự động).

## 2. Người dùng & phân quyền

| Hành động | admin | editor | viewer |
|---|---|---|---|
| Xem danh sách + hồ sơ | ✅ | ✅ | ✅ |
| Xem `notes`, `gift_ideas` | ✅ | ✅ | ❌ (ô khóa, API cũng chặn) |
| Thêm/sửa person, interaction, task, quan hệ | ✅ | ✅ | ❌ |
| Upload media | ✅ | ✅ | ❌ |
| Xóa | ✅ mọi thứ | chỉ bản ghi mình tạo | ❌ |
| Hộp thư chờ, Nhập danh bạ, Quét danh thiếp | ✅ | ✅ | ❌ (chặn cả URL) |
| Cài đặt, quản lý user/bot, sao lưu, quản lý thẻ | ✅ | ❌ | ❌ |

Ràng buộc: phân quyền thực thi ở **tầng DB (RLS)**, UI chỉ là lớp che; mọi policy phải chặn được gọi API trực tiếp.

## 3. Yêu cầu chức năng (đã triển khai)

### 3.1 Quản lý liên hệ
- FR-01 Hồ sơ đầy đủ trường theo data model (xem KIEN-TRUC §3): 2 tên (Tên danh bạ = nickname hiển thị chính; Tên đầy đủ = full_name), nhóm enum 6 loại, thẻ tự do, ưa thích, nhịp liên lạc, preferences jsonb, social_links jsonb.
- FR-02 Search có dấu + không dấu (unaccent), khớp cả 2 tên.
- FR-03 Danh bạ 2 view: card + bảng inline-edit; bulk: đổi nhóm (kèm gán nhịp mặc định theo nhóm), gán thẻ, gán nhịp, xóa (admin).
- FR-04 Lọc: nhóm, thẻ (multi, OR trong thẻ, AND với filter khác), ưa thích, kết hợp search.
- FR-05 Gợi ý tên đầy đủ từ Notes (regex họ tên Việt), duyệt hàng loạt, không tự ghi.
- FR-06 Xóa person cascade interactions/media/relationships/tasks + dọn file Storage (xóa đơn lẻ).

### 3.2 Tương tác & giữ liên lạc
- FR-10 Interaction 7 loại enum; timeline theo người; FAB ghi nhanh 3 bước.
- FR-11 Keep-in-touch: `last_contacted` (view) + `contact_frequency_days` → trạng thái: quá hạn (đỏ) khi daysLeft<0; sắp đến hạn (vàng) khi daysSince ≥ 70% nhịp hoặc daysLeft ≤ warning_days; chưa từng tương tác + có nhịp = quá hạn.
- FR-12 Dashboard: Sắp nguội nổi bật, thống kê, hoạt động gần đây, sinh nhật tháng, việc sắp tới.

### 3.3 Quan hệ (HubSpot association + gia phả)
- FR-20 Bảng relationships 2 chiều: type + 2 nhãn chiều (sửa được), unique (a,b,type), cascade khi xóa person.
- FR-21 Panel Quan hệ trong hồ sơ: nhãn hiển thị đúng chiều mỗi bên; gợi ý suy luận bố/mẹ-con (chỉ gợi ý, người dùng xác nhận).
- FR-22 Sơ đồ 2 chế độ: cây gia phả phân tầng thế hệ (vợ chồng cạnh nhau) + mạng lưới force-directed có lọc loại.

### 3.4 Nhập liệu đa kênh
- FR-30 Import wizard: Google Contacts CSV + LinkedIn Connections.csv (tự nhận format, bỏ preamble); preview đếm mới/trùng/lỗi; chunk 50.
- FR-31 **Dedupe chuẩn chung mọi kênh**: khóa phone (chuẩn hóa +84→0) → email → tên+sinh nhật (LinkedIn: cho phép trùng tên khi cả 2 phía thiếu birthday); bản ghi trùng CHỈ điền ô trống — dữ liệu sửa tay trên app luôn thắng; import lại không tạo trùng.
- FR-32 Bot Telegram (whitelist chat duyệt bởi admin): `Tên / nội dung` → interaction; `!viec Tên / việc [dd/mm]` → task; không match → Hộp thư chờ; match tên ưu tiên ranh giới từ, tên ngắn hơn thắng khi hòa.
- FR-33 Webhook cuộc gọi Android (MacroDroid): match phone → interaction gọi điện, chống trùng ±2 phút; không match → Hộp thư chờ.
- FR-34 Google Sheets: menu Đồng bộ ngay, một chiều Sheet→app, chỉ INSERT/UPDATE không DELETE, per-row sync_status ✅/❌, dòng ✅ không gửi lại.
- FR-35 Quét danh thiếp: OCR client-side (vie+eng), parse heuristic, prefill form, luôn duyệt tay.
- FR-36 Hộp thư chờ: gán người + loại → interaction, hoặc bỏ qua; badge đếm trên nav.

### 3.5 Nhắc nhở & tự động
- FR-40 Digest 7:00 VN hằng ngày qua Telegram (mọi chat duyệt): sinh nhật hôm nay+7 ngày, top 10 sắp nguội, task đến hạn/quá hạn; không có gì thì không gửi. Email (Resend) là tùy chọn — tự bật khi có `RESEND_API_KEY`.
- FR-41 Tasks: gắn person (hoặc chung), due_date, done; hiện ở hồ sơ/Dashboard/Nhắc nhở.

### 3.6 Quản trị
- FR-50 Cài đặt (admin): sửa toàn bộ nhãn UI + thông số từ `app_settings`, hiệu lực ngay không deploy; khôi phục mặc định từng mục. **Frontend cấm hardcode nhãn tiếng Việt** (ngoại lệ đã ghi chú: brand name, hướng dẫn kỹ thuật MacroDroid, thông báo lỗi cấu hình hạ tầng).
- FR-51 Quản lý thẻ: đổi tên/gộp/xóa toàn danh bạ (RPC, chỉ admin).
- FR-52 Người dùng: đổi role (không tự hạ mình), mời user mới qua Edge Function (mật khẩu tạm hiện 1 lần); tự đổi mật khẩu.
- FR-53 Sao lưu ZIP: 5 CSV UTF-8 BOM + metadata.json, client-side.
- FR-54 Quản lý bot: duyệt/thu hồi chat_id.

## 4. Yêu cầu phi chức năng

- NFR-01 Mobile-first ≤768px; hộp thoại xác nhận đặt giữa màn (tránh thanh Safari iOS che nút).
- NFR-02 Font hỗ trợ trọn tiếng Việt: Be Vietnam Pro (body), Space Grotesk (heading), IBM Plex Mono (số).
- NFR-03 Thẩm mỹ cố định: nền tối #080407, cam #f97316, hồng #fb7185, vàng #fbbf24, xanh #34d399, card bo 13px.
- NFR-04 Free tier: Supabase 500MB DB/1GB Storage (video chỉ lưu link ngoài), Cloudflare Pages, Telegram Bot API.
- NFR-05 Bundle: vendor/supabase tách chunk; tesseract.js lazy-load riêng (không tải nếu không quét danh thiếp).
- NFR-06 Secrets không nằm trong repo (trừ anon key — public theo thiết kế Supabase); service_role/token chỉ ở Supabase secrets & GitHub secrets.

## 5. Ngoài phạm vi (đã đánh giá, loại có chủ đích)

| Hạng mục | Lý do |
|---|---|
| Đọc tin nhắn Zalo/Viber/Telegram cá nhân | Nền tảng không mở API tài khoản cá nhân — bot inbox là thay thế đúng |
| LinkedIn sync API | LinkedIn đóng API connections từ 2015 — thay bằng import file export |
| Enrichment tự động (Clay/Clearbit/Apollo) | API trả phí, dữ liệu người Việt kém — thay bằng panel tìm nhanh thủ công; backlog nếu mua key |
| Google People API OAuth | CSV export đủ dùng cho v1 |

## 6. Backlog đề xuất (chưa làm)

Webhook cuộc gọi đã có server — còn hướng dẫn cài MacroDroid phía máy người dùng; email digest (chờ Resend key); gộp 2 người trùng thủ công (merge UI); tủy chỉnh dashboard; enrichment trả phí; PWA offline; đa ngôn ngữ.
