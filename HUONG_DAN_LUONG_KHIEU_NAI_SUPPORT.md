# HƯỚNG DẪN LUỒNG KHIẾU NẠI & HỖ TRỢ HỆ THỐNG PHYSLIVE
> **Dự án:** PhysLive – Nền tảng Mô phỏng Vật lý Tương tác (GDPT 2018)  
> **Mã đề tài:** FA26SE309 | **Tác giả tài liệu:** Nguyễn Thế Hùng (HungNT - SE183807)  
> **Áp dụng cho:** Review 2 & Kiểm thử chức năng toàn hệ thống  

---

# I. TỔNG QUAN KIẾN TRÚC 2 LUỒNG KHIẾU NẠI

Hệ thống PhysLive phân biệt rõ ràng giữa **hai bài toán khiếu nại hoàn toàn độc lập**, tránh việc chồng chéo quyền hạn và thông tin rác:

```
                       ┌────────────────────────────────────────────────────────┐
                       │               HỆ THỐNG KHIẾU NẠI PHYSLIVE              │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                 ┌─────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                  ▼
   [LUỒNG 1: BÁO LỖI MÔ PHỎNG / SUPPORT]                               [LUỒNG 2: MỞ KHÓA TÀI KHOẢN]
   (SupportService / SupportItem)                                      (AccountAppealService / AccountAppeal)
   
   Giáo viên phát hiện mô phỏng sai                                   Tài khoản bị tạm khóa (SUSPENDED_READ_ONLY)
                 │                                                                  │
                 ▼                                                                  ▼
      Gửi COMPLAINT + simulationId                                      Gửi đơn giải trình (PENDING)
                 │                                                                  │
                 ▼                                                                  ▼
      Hòm thư MANAGER (/manager/support)                                 Phân cấp thụ lý (canHandle):
                 │                                                       ├─ Nếu là MANAGER ──► ADMIN xử lý
        ┌────────┴────────┐                                              └─ Khác (School/GV) ─► MANAGER xử lý
        ▼                 ▼                                                         │
  [Tự xử lý]       [Chuyển Reviewer]                                                ▼
  (Đổi RESOLVED)    (isReviewerReferred = true)                         APPROVED ──► Mở khóa ACTIVE tự động
                          │                                             REJECTED ──► Giữ nguyên khóa
                          ▼
              Hàng đợi REVIEWER (/reviewer/complaints)
                          │
                          ▼
              Reviewer kiểm định & phản hồi
              (Trạng thái ──► RESOLVED)
```

---

## 1. Luồng 1: Hỗ trợ & Báo lỗi Mô phỏng (`SupportService` / `SupportItem`)
- **Đối tượng:** Báo lỗi sai lệch vật lý trong phòng thí nghiệm ảo (`COMPLAINT` kèm `simulationId`) và các thắc mắc chung (`MESSAGE`).
- **Người gửi (`Sender`):** Giáo viên (`STAFF` có quyền `canTeach`) hoặc người dùng hệ thống.
- **Tiền trạm & Phân luồng (`MANAGER` tại `SupportInbox`):**
  - Quản lý đóng vai trò bộ lọc tiền trạm (Triage).
  - Nếu là câu hỏi hành chính $\rightarrow$ Manager tự trả lời và đánh dấu `RESOLVED`.
  - Nếu là lỗi chuyên môn mô phỏng Vật lý $\rightarrow$ Manager bấm **"Chuyển Reviewer"** (`reviewerReferred = true`, trạng thái chuyển `READ`).
- **Thẩm định chuyên môn (`REVIEWER` tại `ComplaintsDesk`):**
  - Reviewer **chỉ thấy** các đơn đã được Manager chuyển sang (`reviewerReferred == true`).
  - Reviewer chạy lại mô phỏng, nhập phản hồi kiểm định chuyên môn và bấm `RESOLVED`.
  - Chống xung đột lợi ích: Reviewer **không thể tự giải quyết khiếu nại của chính mình**.
- **Người gửi (`Sender` tại `MySupport`):**
  - Theo dõi tiến trình: `OPEN` (Đang chờ) $\rightarrow$ `READ` (Đang xử lý / Đã chuyển Reviewer) $\rightarrow$ `RESOLVED` (Đã xử lý xong, đọc rõ phản hồi của Reviewer).

---

## 2. Luồng 2: Khiếu nại Mở khóa Tài khoản (`AccountAppealService` / `AccountAppeal`)
- **Đối tượng:** Tài khoản bị rơi vào diện đình chỉ / tạm khóa (`SUSPENDED_READ_ONLY` hoặc `active = false`).
- **Phân cấp thụ lý nghiêm ngặt (`canHandle`):**
  - **Tài khoản `MANAGER` khiếu nại:** Bắt buộc **`ADMIN`** (Super Admin) trực tiếp thụ lý và mở khóa.
  - **Tài khoản `SCHOOL`, `STAFF`, `STUDENT`, `REVIEWER` khiếu nại:** **`MANAGER`** có thẩm quyền thụ lý và mở khóa.
  - **Chống vi phạm quyền lợi:** Không ai được tự tha bổng / mở khóa cho chính mình (`actor.id != target.id`).
- **Kết quả xử lý:**
  - `APPROVED`: Tự động kích hoạt tài khoản về `ACTIVE`, xóa lý do khóa.
  - `REJECTED`: Ghi nhận lý do từ chối, tài khoản tiếp tục bị khóa.

---

# II. DANH SÁCH TÀI KHOẢN & MẬT KHẨU KIỂM THỬ (100% ACTIVE)

| STT | Vai trò (Role) | Email đăng nhập | Mật khẩu | Phạm vi quyền hạn | Đường dẫn thao tác |
| :-: | :--- | :--- | :---: | :--- | :--- |
| **1** | **`ADMIN`** (Super Admin) | `admin@gmail.com` | `12345678` | Quản trị nền tảng, duyệt khiếu nại Manager | `/admin`, `/admin/appeals` |
| **2** | **`MANAGER`** (Vận hành B2B) | `manager@gmail.com` | `123456789` *(9 số)* | Tiền trạm hỗ trợ, chuyển Reviewer, duyệt khiếu nại trường/GV | `/manager/support`, `/manager/appeals` |
| **3** | **`REVIEWER`** (Kiểm duyệt viên) | `review@gmail.com` | `12345678` | Duyệt mô phỏng cộng đồng, xử lý báo lỗi Vật lý | `/reviewer/complaints` |
| **4** | **`STAFF`** (Giáo viên) | `teacher@gmail.com` | `12345678` | Soạn giáo án, chạy Canvas 2D, gửi báo lỗi mô phỏng | `/workspace`, `/my/support` |
| **5** | **`SCHOOL`** (Quản trị trường) | `school@gmail.com` | `12345678` | Quản lý giáo viên, lớp học, mua gói B2B | `/school` |
| **6** | **`STUDENT`** (Học sinh) | `student@gmail.com` | `12345678` | Làm bài tập POE, chạy mô phỏng | `/student` |

---

# III. KỊCH BẢN KIỂM THỬ THỰC TẾ TRÊN TRÌNH DUYỆT (STEP-BY-STEP)

Địa chỉ chạy ứng dụng: **`http://127.0.0.1:5173`**

### Kịch bản 1: Báo lỗi Mô phỏng Vật lý (4 Bước Hoàn Chỉnh)

#### Bước 1: Giáo viên gửi báo lỗi
1. Đăng nhập: `teacher@gmail.com` / `12345678`.
2. Mở Avatar góc trên bên phải $\rightarrow$ Chọn **"Yêu cầu hỗ trợ"** (`/my/support`).
3. Bấm **"Gửi yêu cầu mới"**:
   - Loại yêu cầu: Chọn **"Báo lỗi mô phỏng"** (`COMPLAINT`).
   - Tiêu đề: *Nghiệm dao động con lắc lò xo bị lệch cơ năng*.
   - Nội dung: *Mô phỏng chạy sau 10s có hiện tượng năng lượng tăng dần không đúng định luật bảo toàn.*
   - Bấm **Gửi**.
4. Trạng thái hiển thị: Badge màu vàng **`Đang chờ` (OPEN)**.

#### Bước 2: Manager tiếp nhận & chuyển Reviewer
1. Đăng xuất giáo viên $\rightarrow$ Đăng nhập: `manager@gmail.com` / `123456789`.
2. Vào Menu $\rightarrow$ **"Hỗ trợ & Khiếu nại"** (`/manager/support`).
3. Mở chi tiết đơn của giáo viên vừa gửi $\rightarrow$ Bấm nút **"Chuyển Reviewer"**.
4. Trạng thái chuyển thành: Badge **`Đã xem / Đang xử lý`** kèm cờ chuyển Reviewer.

#### Bước 3: Reviewer thẩm định chuyên môn
1. Đăng xuất $\rightarrow$ Đăng nhập: `review@gmail.com` / `12345678`.
2. Vào mục **"Khiếu nại mô phỏng"** (`/reviewer/complaints`).
3. Reviewer thấy đúng đơn được chuyển tới. Bấm vào đơn, nhập kết quả xử lý:
   - Ghi nhận: *Đã kiểm tra lại thuật toán RK4 và tinh chỉnh bước tích phân thích ứng.*
   - Bấm **"Hoàn tất xử lý"** (`RESOLVED`).

#### Bước 4: Giáo viên kiểm tra phản hồi
1. Đăng nhập lại: `teacher@gmail.com` / `12345678` vào `/my/support`.
2. Đơn đã chuyển thành badge màu xanh lá **`Đã giải quyết` (RESOLVED)**, hiển thị rõ người xử lý là Reviewer cùng nội dung phản hồi chuyên môn.

---

### Kịch bản 2: Khiếu nại Mở khóa Tài khoản (Appeals)

1. **Manager duyệt mở khóa Trường / Giáo viên / Học sinh:**
   - Đăng nhập: `manager@gmail.com` / `123456789`.
   - Vào `/manager/appeals`: Xem các đơn giải trình của trường học/giáo viên bị khóa $\rightarrow$ Chọn `APPROVED` để mở khóa tức thì hoặc `REJECTED`.
2. **Admin duyệt mở khóa tài khoản Manager:**
   - Đăng nhập: `admin@gmail.com` / `12345678`.
   - Vào `/admin/appeals`: Admin độc quyền thụ lý các khiếu nại tài khoản của cấp Quản lý (`MANAGER`).

---

# IV. CÁCH KHỞI ĐỘNG HỆ THỐNG TRÊN LAPTOP

Khi Master kéo code về laptop, khởi động theo 2 lệnh đơn giản sau:

### 1. Khởi động Backend (Spring Boot Core)
```powershell
cd F:\Fcak\Code_final\SEP490_Physlive\backend
.\mvnw.cmd spring-boot:run
```
*(Server chạy tại `http://localhost:8080`, tự động kết nối Supabase Cloud Database).*

### 2. Khởi động Frontend (React 19 / Vite)
```powershell
cd F:\Fcak\Code_final\SEP490_Physlive\react-client
npm install      # (Chỉ cần chạy 1 lần đầu tiên trên laptop)
npm run dev -- --host 127.0.0.1 --port 5173
```
*(Giao diện web mở tại `http://127.0.0.1:5173`, tự động proxy API sang `8080`).*
