# QUY CHUẨN PHÁT TRIỂN & RÀNG BUỘC KIẾN TRÚC DỰ ÁN (RULES.MD)
> **Dự án:** PhysLive – Interactive Physics Simulation Platform for High School Teachers  
> **Áp dụng cho:** Toàn bộ thành viên nhóm Capstone FA26SE309 và AI Coding Assistant  
> **Hiệu lực từ:** 31/10/2026  

---

## 1. RÀNG BUỘC WORKSPACE & MÔI TRƯỜNG THỰC THI
1. **Duy nhất một Workspace hoạt động:**
   - Toàn bộ thao tác đọc code, viết mã, sửa lỗi, chạy kiểm thử tự động, build dự án và quản lý tài liệu được thực hiện **DUY NHẤT** tại:
     `F:\Fcak\Code\PhysLive`
2. **Tuyệt đối không đụng vào `f:\Fcak\Mẫu\preview`:**
   - Không được đọc, sửa, ghi đè hoặc can thiệp vào bất kỳ tệp tin nào thuộc `f:\Fcak\Mẫu\preview`. Thư mục này được coi là frozen archive. Mọi tài liệu và sơ đồ cần thiết đã được chuyển toàn diện sang `F:\Fcak\Code\PhysLive`.

---

## 2. RÀNG BUỘC VAI TRÒ & PHÂN QUYỀN (RBAC BOUNDARIES)
Tuân thủ nghiêm ngặt **Phiếu đăng ký đề tài Capstone v2.0 (`FA26SE309_v2_leader.docx`)**:
1. **ADMIN:**
   - Quản trị tối cao nền tảng (`school_id = NULL`).
   - Chỉ quản lý các tài khoản `MANAGER` (tạo mới, cập nhật, khóa/mở khóa, đặt lại mật khẩu).
   - Xem danh sách người dùng toàn sàn và giám sát tổng quan doanh thu/giao dịch.
   - **Tuyệt đối không:** Can thiệp vận hành trường học, không tạo mô phỏng, không duyệt mô phỏng.
2. **MANAGER:**
   - Vận hành nền tảng B2B (`school_id = NULL`).
   - Quản lý trường học (`/manager/schools`), quản lý gói thuê bao B2B & hạn mức AI token (`/manager/plans`), đối soát thanh toán VietQR PayOS (`/manager/payments`), xem thống kê kiểm định vật lý (`/manager/validation`), quản lý chương trình học GDPT 2018 (`/manager/curriculum`), hỗ trợ phản hồi & khiếu nại (`/manager/feedback`).
   - **Tuyệt đối không:** Tạo mô phỏng (Create simulation - thuộc về `STAFF`) và không Duyệt mô phỏng công khai (Review simulation - thuộc về `REVIEWER`).
3. **STAFF (Giáo viên có quyền TEACH):**
   - Tạo mô phỏng từ text/OCR, chạy bộ giải RK4, lưu thư viện cá nhân, chia sẻ nội bộ trường, giao bài tập POE và chấm điểm.
4. **REVIEWER (Kiểm duyệt viên có quyền CONTENT_REVIEW):**
   - Độc lập kiểm duyệt các mô phỏng chia sẻ công khai lên cộng đồng, đảm bảo tính bảo toàn định luật vật lý và tính sư phạm.

---

## 3. QUY CHUẨN TÀI LIỆU & ĐỊNH DẠNG (FORMATTING STANDARDS)
1. **Font chữ & Kích thước:**
   - Toàn bộ văn bản tài liệu Word và bảng tính Excel phải tuân thủ nghiêm ngặt **Font Arial, Size 11**.
2. **Ký hiệu & Ngôn ngữ Toán học:**
   - Sử dụng 100% ký hiệu Unicode kỹ thuật sạch (`ΔE/E0 < 10^-3`, `60 FPS`, `k = 100 N/m`).
   - Tuyệt đối không dùng cú pháp LaTeX thô trong tài liệu báo cáo và tin nhắn (`$...$`, `\text{}`).
3. **Thuật ngữ Kiểm định Vật lý:**
   - Sử dụng chuẩn hóa: **Physics Law Invariant Verification & Self-Repair Integrity Gate**.
   - Tuyệt đối không sử dụng lại thuật ngữ cũ *"Discrepancy <= 2%"*.
4. **Độ sạch của tài liệu:**
   - 0 placeholder mẫu dư thừa (`<...>`, `[...]`, `TODO`, `FIXME`, `xxx`).

---

## 4. QUY TRÌNH KIỂM THỬ TRƯỚC KHI COMMIT / BẢO VỆ
1. **Frontend:** Chạy kiểm tra linting và build:
   ```powershell
   cd F:\Fcak\Code\PhysLive\react-client
   npm run build
   ```
2. **Backend:** Chạy kiểm thử tự động bảo đảm 100% Unit Tests Pass:
   ```powershell
   cd F:\Fcak\Code\PhysLive\backend
   .\mvnw.cmd test
   ```
3. **Kiểm tra trạng thái Git:** Luôn rà soát `git status` trước khi kết thúc phiên làm việc để đảm bảo không sót thay đổi.

