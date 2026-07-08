# HƯỚNG DẪN SỬ DỤNG PERSONALCRM

> Dành cho người dùng cuối. Không cần biết kỹ thuật.
> App chạy trên web: **https://personalcrm102.pages.dev** — dùng được cả điện thoại lẫn máy tính (nên "Thêm vào màn hình chính" trên điện thoại để mở như app).

---

## 1. Đăng nhập & vai trò

Đăng nhập bằng **email + mật khẩu** do quản trị viên cấp. Đổi mật khẩu trong **Cài đặt → Đổi mật khẩu**.

Có 3 vai trò:

| Vai trò | Được làm gì |
|---|---|
| **Quản trị (admin)** | Toàn quyền: sửa/xóa mọi thứ, đổi cài đặt, quản lý người dùng, sao lưu |
| **Biên tập (editor)** | Xem tất cả, thêm/sửa người & tương tác, upload ảnh; chỉ xóa được thứ mình tạo |
| **Chỉ xem (viewer)** | Chỉ xem. **Không thấy** Ghi chú riêng tư & Ý tưởng quà tặng (hiện ô khóa 🔒) |

## 2. Màn hình chính

Thanh menu: **Tổng quan · Danh bạ · Nhập danh bạ · Hộp thư chờ · Sơ đồ · Nhắc nhở · Nhóm · Cài đặt** (một số mục chỉ admin/editor thấy). Trên điện thoại, các mục chính nằm ở thanh dưới cùng, mục phụ trong nút ☰ Menu.

### Tổng quan (Dashboard)
- **🌡️ Sắp nguội**: những người đến hạn liên lạc lại — mục quan trọng nhất, nên xem mỗi sáng thứ 2.
- **Việc sắp tới**: việc cần làm đến hạn/quá hạn.
- Thống kê, Hoạt động gần đây, Sinh nhật tháng này, Ưa thích.

## 3. Danh bạ

- **Tìm kiếm**: gõ có dấu hay không dấu đều được ("nguyen van a" ra "Nguyễn Văn A"). Tìm theo cả **Tên danh bạ** (tên gợi nhớ kiểu "A Ba Chiến") lẫn **Tên đầy đủ** (tên thật).
- **Lọc**: theo nhóm (Gia đình/Bạn bè/Đối tác/Đồng nghiệp/Con cái/Khác), theo thẻ (chọn nhiều), theo Ưa thích ⭐.
- **2 kiểu xem**: **Thẻ** (card đẹp) và **Bảng** (sửa nhanh hàng loạt):
  - Trong Bảng: **bấm thẳng vào ô để sửa** (tên, nhóm, SĐT, email, thẻ, nhịp liên lạc) — Enter/bấm ra ngoài là lưu.
  - Tick chọn nhiều dòng → thanh công cụ hiện ra: **đổi nhóm hàng loạt** (kèm tự gán nhịp), **gán thẻ**, **gán nhịp**, **xóa** (admin).
- Nút phụ: **✨ Gợi ý tên đầy đủ** (duyệt tên thật lấy từ ghi chú cũ), **📇 Quét danh thiếp**.

## 4. Hồ sơ một người (màn hình trung tâm)

Mở từ Danh bạ. Gồm:
- **Thông tin**: liên hệ, công ty, quê quán, sở thích, kiêng kỵ, quen nhau thế nào, ý tưởng quà tặng 🔒, ghi chú riêng tư 🔒.
- **Dòng thời gian**: mọi tương tác (gặp mặt, gọi điện, nhắn tin…) — bấm **+ Thêm tương tác** để ghi.
- **Ảnh & Video**: upload ảnh trực tiếp (ảnh nặng tự nén). **Video KHÔNG upload** — dán link Google Drive/Photos/YouTube.
- **Giữ liên lạc**: trạng thái Ổn định 🟢 / Sắp đến hạn 🟡 / Quá hạn 🔴 theo "nhịp liên lạc" (30/60/90/180 ngày) anh gán cho từng người.
- **Quan hệ**: vợ chồng, con cái, bố mẹ, đồng nghiệp… Bấm **+ Thêm quan hệ** → chọn người → chọn loại — hồ sơ hai bên tự hiện đúng chiều ("bố của" ↔ "con của").
- **Việc cần làm**: việc gắn với người này ("gửi hợp đồng", hạn 15/8…).
- **Làm giàu hồ sơ**: nút tìm nhanh Google/Facebook/LinkedIn/Zalo, dán link trang cá nhân về lưu.

## 5. Ghi nhanh trong 10 giây (thói quen quan trọng nhất!)

**Cách 1 — nút ＋ cam** (góc dưới phải, mọi màn hình): chọn người → chọn loại → gõ 1 dòng → Lưu.

**Cách 2 — nhắn tin cho bot Telegram** `@personalcrm102_bot` (nhanh nhất khi đang di chuyển):
| Nhắn | Kết quả |
|---|---|
| `A Ba / cà phê bàn vụ đất` | Ghi tương tác "nhắn tin" cho A Ba |
| `!viec A Lộc / gửi hợp đồng 15/8` | Tạo việc cần làm cho A Lộc, hạn 15/8 |
| Tên bot không nhận ra | Tin rơi vào **Hộp thư chờ** trong app — vào gán tay |
| `/help` | Bot nhắc lại cú pháp |

> Lần đầu dùng: nhắn `/start` cho bot rồi nhờ quản trị viên duyệt trong **Cài đặt → Kết nối**.

**Bot tự nhắn bạn mỗi sáng 7h**: sinh nhật sắp tới + ai sắp nguội + việc đến hạn.

## 6. Hộp thư chờ

Tin từ bot/cuộc gọi chưa nhận diện được người sẽ nằm ở đây (menu có chấm đỏ báo số lượng). Mỗi tin: chọn người → chọn loại tương tác → **Gán & lưu**, hoặc **Bỏ qua**.

## 7. Nhập danh bạ hàng loạt

Menu **Nhập danh bạ** (admin/editor), nhận 2 loại file:
1. **Google Contacts**: contacts.google.com → Export → Google CSV.
2. **LinkedIn**: linkedin.com → Settings → Data privacy → Get a copy of your data → Connections → chờ email tải `Connections.csv`.

Kéo file vào → xem trước (app tự đếm: bao nhiêu người mới / trùng / lỗi) → **Bắt đầu nhập**. **Nhập lại file cũ không bao giờ tạo trùng** — app đối chiếu theo SĐT → email → tên+sinh nhật, người trùng chỉ được bổ sung vào ô còn trống, không ghi đè thứ bạn đã sửa tay.

## 8. Quét danh thiếp

Danh bạ → **📇 Quét danh thiếp** → chụp/chọn ảnh → app đọc chữ ngay trên máy (lần đầu tải bộ nhận dạng hơi lâu) → kiểm tra tên/SĐT/email/công ty → lưu. Ảnh mờ thì kết quả kém — luôn xem lại trước khi lưu.

## 9. Sơ đồ quan hệ

Menu **Sơ đồ**, 2 chế độ:
- **Cây gia phả**: chọn người gốc → vẽ theo thế hệ, vợ chồng cạnh nhau.
- **Mạng lưới**: toàn bộ quan hệ, lọc theo loại, bấm vào người → xem hồ sơ.

## 10. Cài đặt (chỉ admin)

- **Nhãn hiển thị**: đổi MỌI chữ trên app (tên nhóm, tiêu đề mục…) — lưu là áp dụng ngay cho tất cả mọi người, không cần ai làm gì thêm.
- **Nhịp mặc định theo nhóm** & **Số ngày cảnh báo sắp nguội**.
- **Loại tương tác**: bật/tắt, đổi tên.
- **Thẻ**: xem toàn bộ thẻ + số người, đổi tên thẻ (áp dụng toàn danh bạ), gộp 2 thẻ, xóa thẻ.
- **Domain video cho phép**.
- **Người dùng & Phân quyền**: đổi vai trò; **＋ Mời người dùng** — nhập email → app tạo tài khoản + đưa mật khẩu tạm (chỉ hiện 1 lần, copy gửi cho người đó, dặn họ đổi mật khẩu).
- **Kết nối**: duyệt chat Telegram được dùng bot; hướng dẫn ghi tự động cuộc gọi Android (MacroDroid).
- **Sao lưu**: 1 nút tải file ZIP toàn bộ dữ liệu (CSV mở Excel không vỡ dấu) — nên làm **mùng 1 hằng tháng**, cất vào Google Drive.

## 11. Nhập nhanh bằng Google Sheets (tùy chọn, nhập nhiều dòng)

Sheet có 2 tab `Persons_Input` / `Interactions_Input`: gõ nhiều dòng → menu **PersonalCRM → Đồng bộ ngay** → cột `sync_status` hiện ✅/❌ từng dòng. Dòng ❌ sửa lại rồi Đồng bộ tiếp; dòng ✅ không bao giờ bị gửi lại. (Cài đặt Sheet lần đầu: xem `apps-script/Code.gs` hoặc nhờ quản trị viên.)

## 12. Quy tắc vàng để CRM "sống"

1. **Ghi tương tác ngay trong ngày** — nhắn bot là xong trong 5 giây. CRM chết vì lười ghi, không vì thiếu tính năng.
2. Ghi chú có ngữ cảnh dùng lại được: *"hỏi vay ý kiến vụ đất Huế, hẹn tháng 8 café"* tốt hơn *"gặp nhau"*.
3. Nghe được sở thích/kiêng kỵ/ý quà tặng → vào hồ sơ ghi ngay. Đây là phần đáng tiền nhất.
4. Sáng thứ 2: mở **Sắp nguội**, chọn 3–5 người nhắn/gọi luôn.
5. Mùng 1 hằng tháng: bấm **Sao lưu**, dọn Hộp thư chờ, gán nhóm/thẻ cho người mới.

## 13. Sự cố thường gặp

| Hiện tượng | Xử lý |
|---|---|
| Bot không trả lời | Kiểm tra đã `/start` chưa; nhờ admin duyệt trong Cài đặt → Kết nối |
| Bot ghi nhầm người | Vào hồ sơ người bị ghi nhầm xóa tương tác; lần sau nhắn tên dài hơn ("A Ba Chiến /" thay vì "Ba /") |
| Không thấy nút Sửa/Thêm | Tài khoản bạn là Chỉ xem — liên hệ admin nếu cần quyền |
| Video bấm không xem được | Người xem chưa được share file/folder trên Google Drive — share đích danh email họ |
| Import bị trùng người | Contact đó có 2 SĐT khác nhau ở 2 nguồn — mở Bảng, xóa bớt 1 người, giữ người đủ thông tin |
| Trang không tải trên máy tính | Xóa cache/DNS hoặc thử mạng khác (đổi DNS sang 1.1.1.1) |
