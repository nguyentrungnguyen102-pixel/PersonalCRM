# TEST CASE PERSONALCRM

> Bộ test đã thực thi trong Phase 1–4 (tự động bằng Playwright/curl + kiểm chứng DB) — dùng làm regression checklist khi phát triển tiếp. Ký hiệu: 🤖 = chạy được bằng script, 👤 = cần thao tác tay.

## Cách dựng môi trường test
- UI: build với env thật → `vite preview` → Playwright (Chromium, viewport 375×667 mobile & 1366×900 desktop). Trong môi trường có proxy, trỏ `VITE_SUPABASE_URL` vào forwarder localhost nếu browser không ra ngoài được.
- API/RLS: `curl` REST PostgREST với access_token lấy qua `/auth/v1/token?grant_type=password` cho từng role.
- DB verify: SQL qua Supabase Management API.

## TC-A. Xác thực & phân quyền (Phase 1)

| ID | Kịch bản | Kỳ vọng | KQ |
|---|---|---|---|
| A1 🤖 | Login đúng / sai mật khẩu / logout | Vào app · báo lỗi tiếng Việt · về /login | ✅ |
| A2 🤖 | Viewer curl `GET /rest/v1/persons` | `[]` (RLS chặn bảng gốc) | ✅ |
| A3 🤖 | Viewer đọc `persons_safe` | Có dữ liệu, KHÔNG có cột notes/gift_ideas (42703 nếu select) | ✅ |
| A4 🤖 | Viewer INSERT persons/interactions/relationships | 403 | ✅ |
| A5 🤖 | Viewer PATCH app_settings / tự thăng role profiles | 0 dòng | ✅ |
| A6 🤖 | Anon đọc app_settings / đọc persons_safe | Được (chỉ nhãn) / permission denied | ✅ |
| A7 🤖 | Viewer UI: không nút Sửa/Thêm/FAB; notes hiện ô khóa 🔒 | Đúng | ✅ |
| A8 🤖 | Viewer gõ thẳng URL /cai-dat, /nhap-danh-ba, /hop-thu | Redirect / | ✅ |
| A9 🤖 | Storage: viewer upload 400/403; anon đọc file chặn; admin upload OK | Đúng | ✅ |

## TC-B. CRUD & keep-in-touch (Phase 1)

| ID | Kịch bản | Kỳ vọng | KQ |
|---|---|---|---|
| B1 🤖 | Tạo person đủ trường (tên có dấu "Nguyễn Thị Nở") | Lưu, search_text sinh đúng | ✅ |
| B2 🤖 | Search "nguyen thi no" và "Nguyễn Thị" | Đều ra kết quả | ✅ |
| B3 🤖 | Xóa person có interaction + media | Cascade sạch DB + xóa file Storage | ✅ |
| B4 🤖 | Upload ảnh 39MB / file .txt | Nén còn <2MB rồi lưu / từ chối | ✅ |
| B5 🤖 | Person không avatar/interaction/birthday | Không crash | ✅ |
| B6 🤖 | FAB ghi nhanh 3 bước mobile 375px | Lưu + toast, ≤10s | ✅ |
| B7 🤖 | Người nhịp 30 ngày, chưa tương tác | Badge Quá hạn, vào Nhắc nhở + Sắp nguội | ✅ |
| B8 🤖 | Xác nhận xóa trên mobile | Dialog GIỮA màn, nút bấm được (fix Safari) | ✅ |

## TC-C. Import & dedupe (Phase 2/4)

| ID | Kịch bản | Kỳ vọng | KQ |
|---|---|---|---|
| C1 🤖 | Import Google CSV 901 dòng | 899 mới (2 trùng SĐT trong file tự gộp), 0 lỗi | ✅ |
| C2 🤖 | Import LẠI cùng file | 0 mới / 899 trùng / DB không đổi | ✅ |
| C3 🤖 | File rác không đúng format | Báo "không đúng định dạng" | ✅ |
| C4 🤖 | Bản ghi trùng phone nhưng app đã sửa tay | Chỉ điền ô trống, không ghi đè | ✅ |
| C5 🤖 | LinkedIn Connections.csv (có preamble) | Nhận diện format, map company/position, tag linkedin | ✅ (file mẫu) |
| C6 👤 | Quét danh thiếp ảnh thật | OCR prefill form, sửa được trước khi lưu | Cần ảnh thật của người dùng |

## TC-D. Quan hệ & sơ đồ (Phase 3)

| ID | Kịch bản | Kỳ vọng | KQ |
|---|---|---|---|
| D1 🤖 | Tạo "A bố/mẹ của B" | Hồ sơ B tự hiện "con của A" (đúng chiều ngược) | ✅ |
| D2 🤖 | Cây 3 thế hệ (ông bà→bố mẹ→con) | Đúng tầng, vợ chồng cùng hàng | ✅ |
| D3 🤖 | Xóa person có quan hệ | Relationship biến mất, sơ đồ không vỡ | ✅ |
| D4 🤖 | Viewer xem panel + sơ đồ | Xem được, không nút thêm/xóa | ✅ |
| D5 🤖 | Tạo trùng (A,B,type) | Báo `relations.duplicate` (unique 23505) | ✅ |

## TC-E. Thẻ, tên, cài đặt (Phase 3)

| ID | Kịch bản | Kỳ vọng | KQ |
|---|---|---|---|
| E1 🤖 | Đổi tên thẻ trong Cài đặt | Áp dụng toàn danh bạ (verify DB) | ✅ |
| E2 🤖 | Đổi tên thẻ thành thẻ đã có | Confirm gộp, mảng dedup | ✅ |
| E3 🤖 | Viewer gọi RPC rename_tag | Lỗi "chi admin" | ✅ |
| E4 🤖 | Lọc thẻ + nhóm + search kết hợp | AND giữa loại filter, OR trong thẻ | ✅ |
| E5 🤖 | Admin đổi nhãn dashboard.favorites | Viewer login thấy nhãn mới (chú ý CSS uppercase khi assert) | ✅ |
| E6 🤖 | Khôi phục mặc định từng mục | Về giá trị seed | ✅ |
| E7 🤖 | Gợi ý tên đầy đủ từ Notes | Chỉ dòng notes dạng họ tên Việt + full_name==nickname; áp dụng giữ nguyên notes | ✅ |

## TC-F. Bot, webhook, digest, tasks (Phase 4)

| ID | Kịch bản | Kỳ vọng | KQ |
|---|---|---|---|
| F1 🤖 | Webhook sai secret header | 401 | ✅ |
| F2 🤖 | Chat chưa duyệt nhắn tin | Từ chối lịch sự, không ghi | ✅ |
| F3 🤖 | `A Ba / cà phê` khi tồn tại "A Bách Bs" | Ghi đúng **A Ba** (ranh giới từ) | ✅ (bug đã fix) |
| F4 🤖 | `A Ba Chiến / hỏi sân bóng` | Ghi đúng A Ba Chiến | ✅ |
| F5 🤖 | `!viec A Lộc NT / gửi hợp đồng 15/8` | Task đúng người, due 2026-08-15 | ✅ |
| F6 🤖 | Tên không tồn tại | Vào inbox + bot báo 📥 | ✅ |
| F7 🤖 | Gán inbox item → interaction | Toast + status assigned | ✅ |
| F8 🤖 | call-log sai secret / số +84 có thật / gọi lại trong 2 phút | 401 / match + note "Cuộc gọi đến, 5 phút" / skipped | ✅ |
| F9 🤖 | daily-digest invoke tay | Telegram nhận bản tin thật; email skip khi thiếu key | ✅ |
| F10 🤖 | cron.job tồn tại lịch 0 0 * * * | 1 job | ✅ |
| F11 🤖 | invite-user: viewer gọi / admin tạo / email trùng | 403 / temp password / 409 exists | ✅ |
| F12 🤖 | sheet-sync: 2 đúng + 1 thiếu tên; gửi lại | per-row inserted/error/updated; không trùng | ✅ |
| F13 🤖 | sheet-sync sai token | 401 | ✅ |
| F14 🤖 | Export ZIP | 6 file, BOM đúng, counts khớp DB, mở Excel không vỡ dấu | ✅ (203KB/900 người) |
| F15 🤖 | Tesseract chunk | Không nằm trong vendor, không modulepreload, chỉ tải khi mở quét | ✅ |

## TC-G. Gia phả (v2.0)

| ID | Kịch bản | Kỳ vọng | KQ |
|---|---|---|---|
| G1 🤖 | Đánh dấu 3 người thuộc dòng họ (`in_family_tree`) | Hiện đủ trên /gia-pha (cây + danh sách thành viên) | — |
| G2 🤖 | Cây 3 đời có bố mẹ vợ cũng thuộc dòng họ | Cả 2 phía render, chú giải đúng theo giới tính (Phía chồng/Phía vợ) | — |
| G3 🤖 | Người có ngày giỗ 12/7 ÂL | Danh sách giỗ hiện đúng ngày dương tương ứng (đối chiếu lịch vạn niên) | — |
| G4 🤖 | Bỏ thành viên khỏi dòng họ | Dialog xác nhận giữa màn hình, quan hệ (relationships) giữ nguyên (SQL verify) | — |
| G5 🤖 | Cặp gốc thiếu giới tính (gender null) | Chú giải fallback "Phía <tên>" thay vì "Phía chồng/vợ" | — |
| G6 👤 | Xuất PNG (nút "Xuất ảnh PNG") | File tải về, mở lên đọc rõ tên ở scale 2× | — |
| G7 👤 | Chế độ in (nút "In") | Ẩn toàn bộ khung app (nav, FAB...), chỉ còn cây gia phả trên trang in | — |
| G8 👤 | Export cây có người không avatar + người đã mất | Hiện chữ cái đầu (initials) thay avatar + tiền tố 🕯 trước tên người đã mất | — |
| G9 🤖 | /so-do (cả 2 chế độ Cây + Mạng lưới) sau refactor FamilyTreeSvg | Không đổi hành vi (regression D2/D4) | — |
| G10 🤖 | Nhãn `giapha.*` hiển thị đúng tiếng Việt ("Gia phả"...), kể cả khi DB chưa có nhóm nhãn giapha | Không hiện key thô, fallback về DEFAULT_SETTINGS | — |
| G11 🤖 | Nhập Excel end-to-end (ghép cột + quan hệ + trùng tên ambiguous bị bỏ qua có báo cáo) | Người/quan hệ tạo đúng DB, tên trùng trong file bị bỏ qua kèm cảnh báo `import_family.ambiguous`, không tạo nhầm quan hệ | — |
| G12 🤖 | Panel người: thêm bố/mẹ, vợ/chồng, con + xóa quan hệ + viewer chỉ xem | Thêm/xóa đúng bảng relationships; viewer mở panel không thấy nút thêm/xóa | — |
| G13 👤 | Upload avatar trong panel/hồ sơ | Ảnh hiện qua signed URL (Storage); người đã mất hiển thị avatar trắng đen (grayscale) trên thẻ cây | — |
| G14 👤 | Thẻ cây màu theo đời + chú giải + chấm giỗ ≤30 ngày, xuất PNG/in | Dải màu đỉnh thẻ đúng theo đời, viền trái theo phía, chấm hổ phách khi giỗ ≤ `GIO_WARN_DAYS`; legend liệt kê đủ các đời có mặt; PNG/print khớp giao diện tương tác (cùng CARD_H/màu) | — |
| G15 🤖 | Digest Telegram có mục "🕯 Giỗ sắp tới" (invoke tay `daily-digest`) | Mục hiện đúng khi có người giỗ ≤7 ngày, dòng "HÔM NAY" khi daysLeft=0; không lỗi khi DB chưa có cột giỗ âm lịch (trả `[]`, không vỡ các mục khác) | — |
| G16 🤖 | `/so-do` chế độ Cây vẫn hoạt động với kích thước card mới (regression D2) | Cây 3 thế hệ vẫn đúng tầng, vợ chồng cùng hàng, không vỡ layout với NODE_W/CARD_H/ROW_H mới | — |

## Lưu ý khi viết test mới
- Assert text: dùng so sánh **case-insensitive** (nhiều heading CSS `text-transform: uppercase`).
- Chọn person theo **id** (route /nguoi/:id) thay vì click text — "A Lộc NT" khớp cả "A Lộc NT 2".
- Sau bulk/optimistic action, verify bằng **SQL** thay vì chỉ toast.
- Dọn dữ liệu test sau khi chạy (persons/tasks/inbox tạo trong test).
