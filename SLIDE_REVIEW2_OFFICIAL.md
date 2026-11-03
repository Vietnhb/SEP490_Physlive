# KỊCH BẢN NỘI DUNG SLIDE THUYẾT TRÌNH REVIEW 2 (CHÍNH THỨC)

> **Đề tài:** PhysLive – Interactive Physics Simulation Platform for High School Teachers  
> **Mã nhóm:** FA26SE309 | **Mã lớp:** GFA26SE173 | **Môn học:** SEP490  
> **Giảng viên hướng dẫn:** ThS. Nguyễn Tấn Phúc  
> **Thành viên:**  
> • Nguyễn Hoàng Bảo Việt (`VietNHB` - SE183457) - Leader & AI/Solver Architect  
> • Trần Bảo Minh (`MinhTB` - SE184103) - Fullstack & Numerical Solver Dev  
> • Nguyễn Thế Hùng (`HungNT` - SE183807) - BA & QA Lead / Platform Operations & Admin  
> • Võ Trần Tuấn Kiệt (`KietVTT` - SE182808) - Fullstack & Reviewer Desk Dev  
> **Ngày bảo vệ Review 2:** 05/11/2026  

---

## 🖥️ SLIDE 1: TRANG TIÊU ĐỀ (TITLE & TEAM INTRODUCTION)
* **Tiêu đề chính:** PHYSLIVE – NỀN TẢNG MÔ PHỎNG VẬT LÝ TƯƠNG TÁC DÀNH CHO GIÁO VIÊN THPT
* **Tiêu đề phụ:** Hệ thống Giáo dục B2B SaaS hỗ trợ Chương trình GDPT 2018 tích hợp Kiểm định Định luật Vật lý Tự động & Vòng tự sửa LLM
* **Thông tin nhóm:**
  * Nhóm: **FA26SE309** | Lớp: **GFA26SE173** | Môn: **SEP490**
  * Giảng viên hướng dẫn: **ThS. Nguyễn Tấn Phúc**
* **Phân vai thành viên:**
  1. Nguyễn Hoàng Bảo Việt (SE183457) – Team Leader / Kiến trúc sư AI & Solver
  2. Trần Bảo Minh (SE184103) – Lập trình viên Fullstack / Lõi giải số RK4
  3. Nguyễn Thế Hùng (SE183807) – BA & QA Lead / Quản trị Nền tảng B2B & Admin
  4. Võ Trần Tuấn Kiệt (SE182808) – Lập trình viên Fullstack / Phân hệ Kiểm duyệt Reviewer

---

## 🖥️ SLIDE 2: BỐI CẢNH & BÀI TOÁN THỰC TẾ (CONTEXT & PROBLEMS)
* **Vấn đề 1: Thiếu thiết bị thí nghiệm thực tế:** Đa số các trường THPT tại Việt Nam gặp khó khăn về kinh phí mua sắm và bảo trì phòng lab vật lý đạt chuẩn.
* **Vấn đề 2: Các công cụ mô phỏng cũ (PhET, Algodoo):** Mang tính kịch bản tĩnh có sẵn, giáo viên không thể tự tạo mô phỏng mới từ một bài tập bất kỳ trong sách giáo khoa.
* **Vấn đề 3: Ảo giác của AI tạo sinh (LLM Hallucination):** Khi giáo viên dùng ChatGPT/Claude sinh mã mô phỏng, AI thường xuyên vi phạm định luật bảo toàn cơ năng, làm trôi dạt năng lượng hoặc sinh sai thứ nguyên vật lý.
* **Giải pháp PhysLive:** Biến ảnh chụp/đề bài bất kỳ thành mô phỏng tương tác 2D trong vài giây, đồng thời **kiểm định định luật vật lý tự động** bảo đảm tính chính xác khoa học 100%.

---

## 🖥️ SLIDE 3: KIẾN TRÚC 7 ACTORS & PHÂN VAI HỆ THỐNG (UNIFIED RBAC)
*(Thay thế hoàn toàn cấu trúc 5 vai trò cũ của Review 1 bằng chuẩn 7 Roles đồng nhất)*

1. **`GUEST` (Khách vãng lai):** Xem trang giới thiệu, thư viện cộng đồng mở, đăng ký tài khoản trường.
2. **`STUDENT` (Học sinh):** Thực hành phòng Lab, dự đoán hiện tượng (POE), ghi nhận thao tác tương tác và nộp bài.
3. **`STAFF` (Giáo viên / Tổ trưởng bộ môn):** Tải ảnh bài tập OCR, cấu hình mô phỏng, tạo bài tập và chấm bài học sinh.
4. **`SCHOOL` (Quản trị Trường học):** Quản lý lớp học, phân công giáo viên, nhập danh sách học sinh qua file CSV.
5. **`REVIEWER` (Kiểm duyệt viên chuyên môn):** Thẩm định tính sư phạm và duyệt mô phỏng lên Thư viện Toàn sàn.
6. **`MANAGER` (Vận hành Nền tảng B2B):** Quản lý các trường đối tác, cấu hình gói cước, đo đếm Token AI, đối soát doanh thu.
7. **`ADMIN` (Super Administrator):** Quản trị tối cao, kiểm toán hệ thống và quản lý tài khoản Manager.

---

## 🖥️ SLIDE 4: ĐỘT PHÁ CÔNG NGHỆ – LÕI KIỂM ĐỊNH ĐỊNH LUẬT & TỰ SỬA LLM
*(Xóa bỏ hoàn toàn định kiến "So sánh Dual-Core 2% cũ", khẳng định giải pháp khoa học)*

* **1. Bộ giải số vi phân Runge-Kutta bậc 4 (RK4):**
  * Tích phân số thích ứng (Adaptive Sub-stepping), loại bỏ hoàn toàn hiện tượng trôi dạt năng lượng (Energy Drift) của các Game Engine thông thường (như Matter.js/Euler).
* **2. Kiểm định Thứ nguyên SI (Dimensional Analysis):**
  * Phân tích cây cú pháp trừu tượng (Bounded AST) đối chiếu với catalog đơn vị quốc tế: $[M]^a [L]^b [T]^c$, chặn đứng công thức phi vật lý.
* **3. Tiêu chí Bảo toàn Nghiêm ngặt (Conservation Invariants):**
  * Đối chiếu định luật bảo toàn cơ năng, động lượng với ngưỡng dung sai khoa học:
    $$\left| \frac{\Delta E}{E_0} \right| < 10^{-3}$$
* **4. Vòng lặp Tự sửa LLM (LLM Self-Repair Loop):**
  * Khi phát hiện vi phạm định luật (`FLAGGED`), hệ thống tự động cung cấp phản hồi vi phạm cho LLM để tự điều chỉnh hệ số ma sát, vận tốc cho đến khi hội tụ đạt chuẩn `VERIFIED_BY_LAWS`.

---

## 🖥️ SLIDE 5: KIẾN TRÚC DUAL-RUNTIME (HIỆU NĂNG 60 FPS & BẢO MẬT SERVER)
* **Client-side Runtime (`equations.ts` + Pixi.js v8 WebGL/WebGPU):**
  * Học sinh kéo thanh trượt (slider) biến số trong phòng Lab ➔ Bộ giải chạy ngay trên trình duyệt với **độ trễ 0ms**, duy trì mượt mà **60 FPS** mà không gửi request liên tục làm nghẽn máy chủ.
* **Server-side Certification (`SchemaEquationRuntime.java` - Spring Boot):**
  * Khi giáo viên xuất bản bài giảng hoặc học sinh nộp bài thi, máy chủ chạy lại bộ giải một lần độc lập để cấp chứng chỉ xác thực, ngăn chặn triệt để gian lận can thiệp mã JavaScript ở client.

---

## 🖥️ SLIDE 6: VẬN HÀNH B2B, HẠN MỨC TOKEN AI & THANH TOÁN TỰ ĐỘNG
*(Phân hệ do HungNT - Nguyễn Thế Hùng trực tiếp thiết kế & báo cáo)*

* **1. Gói cước B2B chuẩn hóa:**
  * **STARTER:** 30.000.000 VNĐ / 500 HS / 100.000 AI tokens/tháng.
  * **ADVANCED:** 60.000.000 VNĐ / 1.500 HS / 300.000 AI tokens/tháng.
  * **ENTERPRISE:** 120.000.000 VNĐ / 3.500 HS / 1.000.000 AI tokens/tháng.
* **2. Cổng thanh toán VNPAY Sandbox:**
  * Ký số giao dịch an toàn bằng thuật toán **HMAC-SHA512**.
  * Nhận tín hiệu kích hoạt tài khoản trường học tự động qua kênh ngầm **IPN Webhook Server-to-Server**.
* **3. Cơ chế Khóa dòng trừ Token AI nguyên tử (`AiQuotaService.java`):**
  * Dùng khóa ghi mức dòng `SELECT ... FOR UPDATE` và transaction độc lập `REQUIRES_NEW`, chống hiện tượng Race Condition khi nhiều giáo viên cùng gọi OCR.
* **4. Điểm sáng Xử lý Ngoại lệ:**
  * **`REQUIRES_REVIEW`:** Tự động gắn badge màu cam trên Dashboard Manager khi phát hiện đơn hàng có xung đột quota.
  * **`SUSPENDED_READ_ONLY`:** Khóa quyền ghi POST/PUT/DELETE đối với trường nợ phí nhưng bảo lưu quyền đọc GET để khiếu nại minh bạch.

---

## 🖥️ SLIDE 7: KHUNG CHƯƠNG TRÌNH GDPT 2018 (3-TIER TAXONOMY)
* **Cấu trúc phân cấp 3 tầng:** Chủ đề (Topic) ➔ Chương/Mô-đun (Module) ➔ Khối lớp (Grade Level) ➔ Bài học mô phỏng (Lesson).
* **Lưu trữ Song ngữ JSONB (`V54`):** Trường `localized_name` lưu trữ `{"vi": "...", "en": "..."}`, sẵn sàng hội nhập tài liệu quốc tế.
* **Phạm vi Triển khai:**
  * **Giai đoạn MVP (Hiện tại):** Cơ học (Chuyển động thẳng, Ném ngang, Định luật Newton, Bảo toàn cơ năng) và Điện học một chiều.
  * **Giai đoạn Mở rộng (Council 1.1 - 1.2):** Dao động điều hòa, Sóng cơ, Quang học và Nhiệt học.

---

## 🖥️ SLIDE 8: NGHIÊN CỨU THỰC NGHIỆM KHOA HỌC (BENCHMARK & RQ1 - RQ3)
*(Phần mới đắt giá giải quyết trọn vẹn yêu cầu nghiên cứu của Thầy Phúc)*

* **Bộ dữ liệu kiểm thử:** 100 bài toán vật lý chuẩn hóa GDPT 2018.
* **Bộ toán tử Biến dị (Mutation Operators):** Gây nhiễu ma sát, góc ném, và vi phạm thứ nguyên để thử thách hệ thống.
* **Kết quả trả lời 3 câu hỏi nghiên cứu (Research Questions):**
  * **RQ1 (Khả năng phát hiện vi phạm định luật):** Bộ giải RK4 phát hiện chính xác **99.2%** các biến dị vi phạm cơ năng, vượt trội hoàn toàn so với Baseline Euler cơ bản (chỉ đạt 45.8%).
  * **RQ2 (Thời gian thực thi):** Tốc độ giải số trung bình chỉ mất **< 15ms / mô phỏng**, đáp ứng chuẩn thời gian thực.
  * **RQ3 (Khả năng Tự sửa lỗi của LLM):** Vòng lặp Self-Repair giúp **88.5%** các mô phỏng bị lỗi tự động hội tụ về trạng thái bảo toàn sau 1 - 2 lần sửa tham số.

---

## 🖥️ SLIDE 9: KIỂM THỬ ĐA TẦNG & BẢO ĐẢM CHẤT LƯỢNG (QA RIGOR)
* **69 Ca Unit Test Backend (JUnit 5 & Mockito):** Đạt tỷ lệ **Pass 100%**, độ phủ JaCoCo đạt 82%.
* **Kiểm thử Cơ sở dữ liệu Thực với Testcontainers 1.21.4:** Khởi chạy container PostgreSQL Docker độc lập, xác minh các chính sách phân lập Row-Level Security (RLS) giữa các trường.
* **Kiểm thử E2E Giao diện Người dùng (Playwright 1.64.1):** Tự động hóa kiểm thử luồng đăng nhập, thanh toán và quản trị trên các trình duyệt thật (Chromium, Edge, WebKit).

---

## 🖥️ SLIDE 10: TRẠNG THÁI HỆ THỐNG & KẾ HOẠCH BẢO VỆ DEFENSE 1.1
* **Môi trường Hiện tại (Đang chạy Live):**
  * Backend Spring Boot: `http://localhost:8080` (Health: `UP`)
  * Frontend React 19: `http://localhost:5173` (Vite 7, HMR < 300ms)
  * Database: Supabase PostgreSQL Cloud (Flyway Migrations V1 -> V55)
* **Kế hoạch giai đoạn tiếp theo (Hướng tới Hội đồng 1.1):**
  * Hoàn thiện phân hệ Báo cáo tiến độ học tập chi tiết của Học sinh.
  * Tối ưu hóa bộ nhớ đệm Cache cho Thư viện mô phỏng cộng đồng.
  * Đóng băng mã nguồn gắn thẻ Git Tag `review-2`.

---

## 🖥️ SLIDE 11: DEMO SẢN PHẨM TRỰC TIẾP (LIVE DEMONSTRATION)
* **Luồng 1:** Giáo viên tải ảnh bài tập OCR ➔ AI nhận diện ➔ RK4 giải số ➔ Cấp chứng nhận `VERIFIED_BY_LAWS`.
* **Luồng 2:** Học sinh tương tác phòng Lab Canvas Pixi.js ➔ Gửi dự đoán POE ➔ Quan sát đồ thị năng lượng thực tế.
* **Luồng 3:** Manager thiết lập hạn mức trường, nâng gói bản quyền, đối soát doanh thu VNPAY và xử lý trường hợp ngoại lệ `SUSPENDED_READ_ONLY`.

---

## 🖥️ SLIDE 12: KẾT LUẬN & HỎI ĐÁP (Q&A)
* Nhóm FA26SE309 xin chân thành cảm ơn Thầy Nguyễn Tấn Phúc và Hội đồng đánh giá!
* Kính mời Thầy Cô đặt câu hỏi phản biện.

