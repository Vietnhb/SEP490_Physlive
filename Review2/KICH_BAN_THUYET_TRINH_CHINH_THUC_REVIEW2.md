# KỊCH BẢN THUYẾT TRÌNH REVIEW 2 CHÍNH THỨC (PHÂN VAI 4 THÀNH VIÊN)
> **Dự án:** PhysLive – Nền tảng Hỗ trợ Giáo viên Vật lý THPT với Kiểm định Định luật Tự động & Hỗ trợ từ AI (AI Support)  
> **Mã nhóm:** FA26SE309 | **Mã lớp:** GFA26SE173 | **Môn học:** SEP490  
> **Giảng viên hướng dẫn:** ThS. Nguyễn Tấn Phúc  
> **Ngày bảo vệ:** 05/11/2026 | **Thời lượng chuẩn:** 18 – 20 phút (Mỗi thành viên ~ 4 – 5 phút)

---

## 👥 BẢNG PHÂN CÔNG THUYẾT TRÌNH BẢN CHÍNH THỨC
| Thành viên | Vai trò | Các Slide phụ trách | Nội dung trọng tâm |
| :--- | :--- | :---: | :--- |
| **Võ Trần Tuấn Kiệt (`KietVTT`)** | Fullstack Dev | **Slide 1, 2, 3, 4, 5, 14** | Mở đầu, Bối cảnh GDPT 2018, Nguyên lý Kiến trúc & Core Flow 3 (Kiểm duyệt 2 cấp độ) |
| **Trần Bảo Minh (`MinhTB`)** | Fullstack Dev | **Slide 6, 7, 8, 15** | Mục tiêu hệ thống, 7 Actor phân 3 hệ, Use Case & Core Flow 4 (Giao bài POE & Reopen) |
| **Nguyễn Hoàng Bảo Việt (`VietNHB`)** | Team Leader | **Slide 9, 10, 11, 12** | Conceptual ERD 20 thực thể, Gói B2B, Tổng quan 4 Flow & Core Flow 1 (Lõi RK4) |
| **Nguyễn Thế Hùng (`HungNT`)** | BA & QA Lead | **Slide 13, 16, 17, 18** | Core Flow 2 (B2B Quota VNPAY), Thực nghiệm RQ1-RQ3, Kiểm thử QA Rigor & Kết bài |

---

# PHẦN 1: VÕ TRẦN TUẤN KIỆT (SLIDE 1 ➔ SLIDE 5 & SLIDE 14)

---

### 🖥️ SLIDE 1: TRANG TIÊU ĐỀ & GIỚI THIỆU NHÓM
* **Nội dung hiển thị:**
  * Đề tài: *PhysLive – Nền tảng Hỗ trợ Giáo viên Vật lý THPT với Kiểm định Định luật Tự động & Hỗ trợ từ AI (AI Support)*
  * Nhóm: FA26SE309 | GVHD: ThS. Nguyễn Tấn Phúc
  * 4 Thành viên: Nguyễn Hoàng Bảo Việt, Trần Bảo Minh, Nguyễn Thế Hùng, Võ Trần Tuấn Kiệt.
* **🎙️ Lời thoại Kiệt (Mở đầu):**
> *"Kính chào Thầy Nguyễn Tấn Phúc cùng quý Thầy Cô trong Hội đồng đánh giá Review 2. Em là Võ Trần Tuấn Kiệt, đại diện nhóm FA26SE309, xin phép được mở đầu buổi báo cáo tiến độ đồ án tốt nghiệp với đề tài: **PhysLive – Nền tảng Hỗ trợ Giáo viên Vật lý THPT với Kiểm định Định luật Tự động & Hỗ trợ từ AI**.  
> Tiếp thu các định hướng chiến lược từ Thầy Phúc trong đợt Review 1, nhóm chúng em đã tập trung phát triển một giải pháp phần mềm mang tính ứng dụng thực tiễn cao: số hóa các bài toán trong chương trình giáo dục phổ thông thành mô phỏng thí nghiệm tương tác 2D trực quan, ứng dụng AI hỗ trợ nhận diện và lõi giải số vi phân tự động kiểm định định luật để bảo đảm tính chuẩn xác khoa học tuyệt đối. Hôm nay, 4 thành viên nhóm chúng em đã sẵn sàng báo cáo chi tiết toàn bộ hệ thống tới Thầy Cô ạ."*

---

### 🖥️ SLIDE 2: ĐỀ CƯƠNG HỆ THỐNG BÁM SÁT CHƯƠNG TRÌNH GDPT 2018
* **Nội dung hiển thị:** Cấu trúc phân cấp 3 tầng (Topic ➔ Module ➔ Grade Level ➔ Lesson), Hỗ trợ song ngữ JSONB `localized_name`, Tập trung Cơ học & Điện học THPT.
* **🎙️ Lời thoại Kiệt:**
> *"Thưa Thầy Cô, PhysLive không xây dựng các bài mô phỏng rời rạc mang tính giải trí, mà được neo giữ trực tiếp vào khung **Chương trình Giáo dục Phổ thông 2018** của Bộ Giáo dục và Đào tạo. Cụ thể trong cơ sở dữ liệu, hệ thống thiết kế cấu trúc phân cấp 3 tầng rõ rệt: Chủ đề ➔ Chương học ➔ Khối lớp 10, 11, 12 ➔ và Bài học thực nghiệm cụ thể. Nhờ đó, một giáo viên vật lý khi mở PhysLive có thể ngay lập tức chọn đúng bài học trong phân phối chương trình tuần đó để soạn giáo án và giao bài tập thực nghiệm cho học sinh."*

---

### 🖥️ SLIDE 3: BỐI CẢNH & BÀI TOÁN THỰC TẾ (CONTEXT & PROBLEMS)
* **Nội dung hiển thị:**
  * Vấn đề 1: Thiếu thiết bị phòng lab đạt chuẩn tại các trường phổ thông.
  * Vấn đề 2: Công cụ cũ (PhET, Algodoo) mang tính kịch bản tĩnh, đóng băng thông số.
  * Vấn đề 3: Ảo giác mã nguồn của AI tạo sinh thông thường (vi phạm định luật bảo toàn, trôi dạt năng lượng).
  * Giải pháp PhysLive: Tự động hóa tạo mô phỏng từ bài tập và kiểm định định luật tự động.
* **🎙️ Lời thoại Kiệt:**
> *"Về bối cảnh thực tế, hiện nay giáo viên THPT rất muốn ứng dụng công nghệ trực quan vào bài giảng nhưng gặp 3 rào cản lớn: Thứ nhất là phòng thí nghiệm thực tế tại nhiều trường còn thiếu thốn kinh phí bảo trì. Thứ hai, các nền tảng như PhET có kịch bản cố định, giáo viên không thể thay đổi thông số theo bài tập riêng của trường. Thứ ba, nếu giáo viên dùng các công cụ AI thông thường để tạo code mô phỏng, AI rất dễ gặp hiện tượng 'ảo giác'—vật thể chuyển động phi thực tế hoặc vi phạm định luật bảo toàn cơ năng. PhysLive giải quyết bài toán này bằng việc kết hợp AI nhận diện đề bài cùng bộ giải số kiểm định định luật tự động trước khi xuất bản."*

---

### 🖥️ SLIDE 4: NGUYÊN LÝ KIẾN TRÚC HỆ THỐNG (ARCHITECTURE PRINCIPLES)
* **Nội dung hiển thị:**
  * 01 • Dual-Runtime Engine: 60 FPS Client (Pixi.js v8) + Server Certification Gate (Spring Boot).
  * 02 • Numerical Precision: Adaptive RK4 Solver (Khắc phục trôi dạt năng lượng của Euler).
  * 03 • Conservation Gate: Cổng kiểm định định luật bảo toàn (sai số cơ năng $|\Delta E / E_0| < 0.1\%$ và chuẩn hóa thứ nguyên SI).
  * 04 • AI Self-Correction Loop: Vòng lặp AI hỗ trợ tự sửa lỗi tham số theo phản hồi từ bộ giải.
* **🎙️ Lời thoại Kiệt:**
> *"Để giải bài toán hiệu năng và tính chính xác, chúng em thiết kế nguyên lý **Dual-Runtime**: Phía Client sử dụng Pixi.js kết hợp WebGL chạy trực tiếp phương trình chuyển động trên trình duyệt, giúp học sinh kéo thanh trượt biến số thì đồ thị biến đổi tức thì ở tốc độ 60 khung hình/giây. Nhưng khi giáo viên xuất bản bài hoặc học sinh nộp bài thi, máy chủ Spring Boot sẽ kích hoạt bộ giải RK4 chạy ngầm để thẩm định sai số cơ năng phải nhỏ hơn 0.1% ($|\Delta E / E_0| < 10^{-3}$) và kiểm tra chuẩn thứ nguyên SI. Nếu phát hiện sai số, vòng lặp AI sẽ tự động điều chỉnh tham số cho đến khi hội tụ đạt chuẩn khoa học."*

---

### 🖥️ SLIDE 5: SƠ ĐỒ KIẾN TRÚC ĐƠN GIẢN (SYSTEM ARCHITECTURE DIAGRAM)
* **Nội dung hiển thị:** Sơ đồ 4 tầng công nghệ: Frontend React 19, Backend Spring Boot 3.3.4, Database Supabase PostgreSQL 16 (Flyway V1-V55), Third-party VNPAY Sandbox & AI API.
* **🎙️ Lời thoại Kiệt (Kiệt kết thúc Phần 1 & Chuyển giao):**
> *"Trên Slide 5 là sơ đồ kiến trúc 4 tầng phân tách rành mạch: Tầng Frontend SPA chạy React 19 giao tiếp với Tầng Backend Spring Boot qua REST API an toàn với JWT Token. Tầng lưu trữ dữ liệu trường học đặt trên Supabase PostgreSQL 16 đồng bộ qua 55 bản Flyway migrations và phân lập an toàn bằng Row-Level Security. Tầng dịch vụ tích hợp kết nối cổng thanh toán VNPAY xử lý giao dịch bản quyền và AI APIs phục vụ nhận diện đề bài OCR.  
> Tiếp theo, em xin kính mời bạn **Trần Bảo Minh** trình bày về Mục tiêu hệ thống, Ma trận phân quyền và Use Case ạ!"*

---

# PHẦN 2: TRẦN BẢO MINH (SLIDE 6, 7, 8 & SLIDE 15)

---

### 🖥️ SLIDE 6: MỤC TIÊU & PHẠM VI HỆ THỐNG (SYSTEM OBJECTIVES & SCOPE)
* **Nội dung hiển thị:**
  * Trụ cột 1: Tính chuẩn xác khoa học (Scientific Rigor - 100% mô phỏng vượt qua cổng kiểm định).
  * Trụ cột 2: Phương pháp sư phạm tích cực (Active POE Pedagogy - Dự đoán, Quan sát, Giải thích).
  * Trụ cột 3: Mô hình B2B SaaS mở rộng (Quản lý trường, phân bổ Quota AI, VNPAY IPN).
* **🎙️ Lời thoại Minh:**
> *"Kính chào Thầy Cô, em là Trần Bảo Minh. Em xin phép trình bày mục tiêu và phạm vi của PhysLive. Hệ thống được định hình vững chắc dựa trên 3 trụ cột: Thứ nhất là tính chuẩn xác khoa học bảo đảm sai số dưới 0.1%. Thứ hai là đổi mới phương pháp giảng dạy qua chu trình sư phạm POE: buộc học sinh phải dự đoán định tính trước khi thực nghiệm quan sát. Và thứ ba là một kiến trúc B2B SaaS hoàn chỉnh, quản lý hạn mức trường học minh bạch và thương mại hóa bền vững."*

---

### 🖥️ SLIDE 7: PHÂN RÃ 7 TÁC NHÂN & 3 PHÂN HỆ (7 ACTORS & 3 SUBSYSTEMS)
* **Nội dung hiển thị:**
  * 1. Phân hệ Nền tảng: Admin, Manager, Reviewer.
  * 2. Phân hệ Trường học: School Admin, Staff (Giáo viên), Student (Học sinh).
  * 3. Phân hệ Công cộng: Guest (Khách vãng lai).
* **🎙️ Lời thoại Minh:**
> *"Tiếp thu góp ý của Thầy Phúc, hệ thống đã chuẩn hóa thành 7 vai trò thuộc 3 phân hệ độc lập: Phân hệ Công cộng dành cho khách vãng lai trải nghiệm; Phân hệ Trường học gồm Quản trị trường, Giáo viên và Học sinh thao tác học liệu nội bộ; và Phân hệ Vận hành Nền tảng gồm Manager đối soát cước, Reviewer kiểm duyệt chuyên môn và Admin kiểm toán hệ thống. Cấu trúc này giúp chúng em áp dụng chính sách phân quyền RBAC và phân lập dữ liệu Row-Level Security triệt để giữa các trường đối tác."*

---

### 🖥️ SLIDE 8: SƠ ĐỒ TRƯỜNG HỢP SỬ DỤNG TỔNG QUÁT (USE CASE DIAGRAM)
* **Nội dung hiển thị:** Sơ đồ Use Case tổng thể gom 4 cụm: Quản trị nền tảng & Tài chính, Quản lý Trường & Lớp, Sáng tạo & Kiểm định mô phỏng, Học tập & Đánh giá sư phạm.
* **🎙️ Lời thoại Minh (Minh kết thúc Phần 2 & Chuyển giao):**
> *"Slide 8 minh họa sơ đồ Use Case tổng quát của dự án. Tất cả các trường hợp sử dụng đều được gom cụm chặt chẽ theo từng miền nghiệp vụ: từ thanh toán thuê bao, phân bổ lớp học cho đến cốt lõi là tạo lập mô phỏng và thực hành phòng lab ảo.  
> Sau đây, em xin kính mời bạn **Nguyễn Hoàng Bảo Việt** – Team Leader trình bày về Sơ đồ Dữ liệu Khái niệm, B2B Quota và Luồng khởi tạo mô phỏng RK4 ạ!"*

---

# PHẦN 3: NGUYỄN HOÀNG BẢO VIỆT - LEADER (SLIDE 9 ➔ SLIDE 12)

---

### 🖥️ SLIDE 9: SƠ ĐỒ ERD KHÁI NIỆM (CONCEPTUAL ERD - 20 THỰC THỂ)
* **Nội dung hiển thị:** Sơ đồ ERD Khái niệm 20 thực thể (Crow's foot, không hiển thị thuộc tính chi tiết, gom 4 cụm rõ nét).
* **🎙️ Lời thoại Việt:**
> *"Kính thưa Thầy Cô, em là Nguyễn Hoàng Bảo Việt. Ở Slide 9, em xin trình bày Sơ đồ ERD ở mức Khái niệm. Để tránh đưa ra bảng thuộc tính vật lý gây rối mắt, sơ đồ tập trung làm rõ kiến trúc dữ liệu qua **4 Cụm Thực thể Trọng tâm**:  
> 1. Cụm Khung GDPT 2018 (phía trên bên trái): Phân cấp từ `CURRICULUM_TOPIC` ➔ `CONTENT_MODULE` ➔ `GRADE_LEVEL` ➔ `LESSON`.  
> 2. Cụm B2B SaaS & Trường học (phía trên bên phải): `SCHOOL` đăng ký `LICENSE_PLAN`, gắn với `SCHOOL_PAYMENT`, quản trị `USER` và tổ chức lớp học `SCHOOL_CLASS` qua bảng liên kết `CLASS_TEACHER` và `CLASS_ENROLLMENT`.  
> 3. Cụm Sáng tạo & Mô phỏng (trung tâm): Giáo viên nhập đề bài `PROBLEM_SUBMISSION`, trích xuất `SPECIFICATION` để dựng `SIMULATION`, ghi nhận phiên chạy `SIMULATION_RUN` và xuất bản vào `LIBRARY_ITEM`.  
> 4. Cụm Giao bài POE (phía dưới bên phải): Giáo viên tạo `ASSIGNMENT` giao cho lớp học để học sinh nộp bài giải vào `SUBMISSION`."*

---

### 🖥️ SLIDE 10: CÁC GÓI CƯỚC B2B & QUẢN LÝ HẠN MỨC TRƯỜNG HỌC
* **Nội dung hiển thị:**
  * Bảng 3 gói cước B2B: STARTER (30M/500 HS/100k Token), ADVANCED (60M/1.500 HS/300k Token), ENTERPRISE (120M/3.500 HS/1.000k Token).
  * Tích hợp thanh toán VNPAY Sandbox tự động kích hoạt qua IPN Webhook HMAC-SHA512.
  * Cơ chế khóa dòng nguyên tử `SELECT ... FOR UPDATE` và trạng thái ngoại lệ `REQUIRES_REVIEW`, `SUSPENDED_READ_ONLY`.
* **🎙️ Lời thoại Việt:**
> *"Ở khía cạnh thương mại hóa B2B, PhysLive đóng gói 3 gói cước từ 30 triệu đến 120 triệu đồng mỗi năm. Toàn bộ quy trình thanh toán qua VNPAY được xử lý tự động qua IPN Webhook Server-to-Server với chữ ký số HMAC-SHA512. Hệ thống kiểm soát việc tiêu thụ tài nguyên AI bằng cơ chế khóa dòng nguyên tử trong cơ sở dữ liệu. Nếu trường dùng hết hạn mức của tháng, hệ thống chỉ tạm dừng tính năng gọi AI mới mà không làm gián đoạn việc giảng dạy bình thường của giáo viên."*

---

### 🖥️ SLIDE 11: TỔNG QUAN 4 LUỒNG NGHIỆP VỤ CỐT LÕI (4 CORE WORKFLOWS)
* **Nội dung hiển thị:** Phân định 4 Core Flows gắn với 4 thành viên:
  * Flow 1 (Việt): Vòng đời Khởi tạo & Kiểm định Mô phỏng RK4.
  * Flow 2 (Hùng): Vòng đời Thuê bao B2B & Quản lý Quota AI Nguyên tử.
  * Flow 3 (Kiệt): Vòng đời Kiểm duyệt 2 Cấp độ & Phân luồng Khiếu nại Hỗ trợ.
  * Flow 4 (Minh): Vòng đời Giao bài tập & Sư phạm POE (Có tính năng Reopen trả bài).
* **🎙️ Lời thoại Việt:**
> *"Để chứng minh tính hoàn thiện của hệ thống trong đợt Review 2, nhóm chúng em đã chọn lọc 4 luồng nghiệp vụ cốt lõi nhất đại diện cho toàn bộ kiến trúc sản phẩm, phân công cho 4 thành viên trực tiếp báo cáo và sẵn sàng thao tác demo trực tiếp ngay sau đây."*

---

### 🖥️ SLIDE 12: CORE FLOW 1 (VIỆT) – VÒNG ĐỜI MÔ PHỎNG & KIỂM ĐỊNH RK4
* **Nội dung hiển thị:** Sơ đồ State Machine Flow 1: `DRAFT` ➔ `NEEDS_CLARIFICATION` (Assumption Chips) ➔ `PARSED_SPEC` ➔ `RK4_SOLVING` ➔ Phân nhánh `VERIFIED` ($|\Delta E/E_0| < 10^{-3}$) vs `FLAGGED` ($|\Delta E/E_0| \ge 10^{-3}$) ➔ Vòng lặp AI Hỗ trợ tự sửa ➔ `SAVED_TO_LIBRARY`.
* **🎙️ Lời thoại Việt (Việt kết thúc Phần 3 & Chuyển giao):**
> *"Em xin trình bày Core Flow 1: Khi giáo viên tải ảnh bài tập lên hệ thống, nếu đề bài thiếu giả thiết, hệ thống chuyển sang `NEEDS_CLARIFICATION` để giáo viên chọn các thẻ giả định (*ví dụ: Bỏ qua ma sát*). Khi đủ thông số, bộ giải số RK4 được kích hoạt để kiểm tra tính bảo toàn cơ năng. Nếu sai số cơ năng nhỏ hơn 0.1% ($< 10^{-3}$), bài được cấp chứng chỉ `VERIFIED`. Ngược lại nếu vi phạm, bài bị gắn cờ `FLAGGED` và kích hoạt vòng lặp AI tự động điều chỉnh lại tham số cho đến khi hội tụ đạt chuẩn khoa học trước khi lưu vào thư viện.  
> Tiếp theo, em xin kính mời bạn **Kiệt** trình bày Core Flow 3 và bạn **Minh** trình bày Core Flow 4 ạ!"*

---

# PHẦN QUAY LẠI: KIỆT (SLIDE 14) & MINH (SLIDE 15)

---

### 🖥️ SLIDE 14: CORE FLOW 3 (KIỆT) – KIỂM DUYỆT 2 CẤP ĐỘ & PHÂN LUỒNG KHIẾU NẠI
* **Nội dung hiển thị:** Sơ đồ State Machine Flow 3:
  * Nhánh 1 (Duyệt bài để Clone): Tổ trưởng duyệt nội bộ trường ➔ Reviewer duyệt toàn sàn ➔ Giáo viên khác Clone/Fork bài.
  * Nhánh 2 (Khiếu nại hỗ trợ): Manager tiếp nhận tiền trạm ➔ Tự xử lý lỗi thường ➔ Chuyển Reviewer xử lý lỗi mô phỏng ➔ Đóng ticket. Khiếu nại tài khoản Manager chuyển thẳng cho Admin.
* **🎙️ Lời thoại Kiệt:**
> *"Em xin trình bày Core Flow 3 về Kiểm duyệt nội dung và Phân luồng khiếu nại:  
> Thứ nhất là luồng duyệt bài 2 cấp độ: Giáo viên tạo bài xuất sắc sẽ được Tổ trưởng chuyên môn duyệt dùng nội bộ trường. Sau đó gửi lên sàn công cộng để Reviewer thẩm định chất lượng sư phạm. Khi được duyệt, toàn bộ giáo viên trường khác có thể bấm 'Clone / Nhân bản' về kho cá nhân để sử dụng.  
> Thứ hai là luồng khiếu nại hỗ trợ: Manager đóng vai trò đầu mối tiếp nhận toàn bộ đơn từ người dùng. Với các vấn đề về tài khoản hay thanh toán, Manager tự xử lý dứt điểm. Nhưng khi giáo viên báo lỗi về sai lệch kiến thức vật lý trong bài mô phỏng, Manager sẽ sử dụng tính năng 'Chuyển Reviewer' để chuyên gia vật lý thẩm định và phản hồi minh bạch cho giáo viên."*

---

### 🖥️ SLIDE 15: CORE FLOW 4 (MINH) – GIAO BÀI TẬP, SƯ PHẠM POE & TÍNH NĂNG REOPEN
* **Nội dung hiển thị:** Sơ đồ State Machine Flow 4:
  * `DRAFT_ASSIGNMENT` ➔ `PUBLISHED` (Cá nhân hóa PRNG chống gian lận) ➔ Quá hạn `OVERDUE_MISSED`.
  * Chu trình POE: Khóa Canvas ở `STEP_PREDICT` ➔ Nộp dự đoán mới mở khóa `STEP_OBSERVE` (60 FPS) ➔ Vòng lặp đối chiếu quay lại `STEP_EXPLAIN`.
  * Chấm điểm & Nhánh Reopen: Giáo viên bấm "Trả bài làm lại" (`retryAllowed = true`) ➔ Học sinh nhận bài làm lại lần 2.
* **🎙️ Lời thoại Minh:**
> *"Em xin trình bày Core Flow 4 về quy trình giao bài và học tập POE: Khi giao bài, hệ thống tự động sinh số ngẫu nhiên PRNG để đổi thông số bài toán cho từng học sinh nhằm chống gian lận. Khi học sinh mở bài, hệ thống **khóa chặt nút chạy Canvas**. Các em bắt buộc phải tư duy nộp dự đoán định tính trước thì phòng lab ảo Pixi.js mới mở khóa cho thao tác thực nghiệm. Đặc biệt trong code thực tế, hệ thống đã cài đặt hoàn chỉnh tính năng **Reopen trả bài làm lại**: khi giáo viên chấm bài thấy học sinh giải thích sai bản chất, giáo viên bấm nút 'Trả bài làm lại', cờ `retryAllowed` bật lên để học sinh nhận nhận xét và thực nghiệm lại lần 2.  
> Sau đây, em xin kính mời bạn **Nguyễn Thế Hùng** – BA & QA Lead trình bày Core Flow 2 về Vận hành cước B2B, Kết quả nghiên cứu thực nghiệm và Báo cáo kiểm thử đa tầng của nhóm ạ!"*

---

# PHẦN 4: NGUYỄN THẾ HÙNG - BA & QA LEAD (SLIDE 13, 16, 17, 18)
*(Phần cực kỳ quan trọng, chứa toàn bộ số liệu kỹ thuật đắt giá nhất của đồ án)*

---

### 🖥️ SLIDE 13: CORE FLOW 2 (HÙNG) – THUÊ BAO B2B & QUẢN LÝ QUOTA AI NGUYÊN TỬ
* **Vị trí Sơ đồ:** Sơ đồ State Machine Flow 2 (`flow2_subscription_state.txt`).
* **Nội dung hiển thị:**
  * `REGISTERED` ➔ `PENDING_PAYMENT` (VNPAY Sandbox) ➔ Kích hoạt ngầm qua IPN Webhook (HMAC-SHA512) ➔ `ACTIVE`.
  * Cơ chế trừ Quota AI nguyên tử: `SELECT ... FOR UPDATE` + `REQUIRES_NEW`. Hết token ➔ `QUOTA_EXHAUSTED` (Chỉ khóa gọi AI, bài giảng cũ vẫn hoạt động 100%).
  * Hết hạn hợp đồng: Cảnh báo `NEAR_EXPIRY` trước 15 ngày ➔ Chế độ Grace Mode `SUSPENDED_READ_ONLY` (Khóa ghi POST/PUT, bảo lưu quyền đọc GET để khiếu nại minh bạch).
* **🎙️ Lời thoại Master Hùng:**
> *"Kính thưa Thầy Cô, em là Nguyễn Thế Hùng, phụ trách BA & QA của dự án. Em xin phép trình bày Core Flow 2 về Vòng đời thuê bao trường học B2B và quản lý hạn mức Token AI:  
> 
> 1. **Về Thanh toán & Kích hoạt:** Toàn bộ quy trình thanh toán qua VNPAY được xử lý tự động ngầm qua kênh **IPN Webhook Server-to-Server** với chữ ký số mã hóa **HMAC-SHA512**. Hệ thống không kích hoạt tài khoản dựa trên redirect của trình duyệt người dùng để chống gian lận, mà chỉ chuyển sang `ACTIVE` và cấp hạn mức Token khi nhận được tín hiệu xác thực từ VNPAY.  
> 
> 2. **Về Khóa dòng Nguyên tử (Atomic Quota):** Mỗi khi giáo viên trong trường gọi AI nhận diện đề bài, hệ thống kích hoạt câu lệnh khóa ghi mức dòng `SELECT ... FOR UPDATE` và transaction độc lập `REQUIRES_NEW`. Điều này triệt tiêu hoàn toàn hiện tượng Race Condition khi nhiều giáo viên cùng thao tác. Nếu trường dùng hết số dư trong tháng, máy trạng thái chuyển sang `QUOTA_EXHAUSTED`. **Điểm đặc biệt là hệ thống chỉ khóa tính năng gọi AI mới**, còn toàn bộ bài giảng và việc học tập bình thường của học sinh vẫn diễn ra 100% không bị gián đoạn.  
> 
> 3. **Về Cơ chế Grace Mode Nhân văn:** Khi hợp đồng năm đến hạn mà trường chưa kịp gia hạn, hệ thống chuyển sang trạng thái `SUSPENDED_READ_ONLY`. Ở trạng thái này, chúng em khóa toàn bộ quyền ghi (POST/PUT/DELETE) nhưng **bảo lưu toàn bộ quyền đọc (GET)**: giáo viên vẫn mở được giáo án cũ để dạy học sinh, và nhà trường có thể gửi phiếu khiếu nại cước để Manager hỗ trợ trước khi đóng hẳn dịch vụ ạ."*

---

### 🖥️ SLIDE 16: KẾT QUẢ NGHIÊN CỨU THỰC NGHIỆM KHOA HỌC (BENCHMARK RQ1 – RQ3)
* **Vị trí Sơ đồ:** Biểu đồ Benchmark và 3 con số lớn (`99.2%`, `< 15ms`, `88.5%`).
* **Nội dung hiển thị:**
  * Bộ dữ liệu: 100 bài toán vật lý chuẩn hóa GDPT 2018 áp dụng toán tử gây nhiễu (Mutation Operators).
  * **RQ1 (99.2%):** Độ chính xác phát hiện vi phạm định luật bảo toàn cơ năng của bộ giải RK4 (so với 45.8% của baseline Matter.js).
  * **RQ2 (< 15ms):** Độ trễ kiểm định máy chủ trên mỗi bài mô phỏng, bảo đảm xử lý thời gian thực.
  * **RQ3 (88.5%):** Tỷ lệ vòng lặp AI tự động sửa lỗi tham số thành công về trạng thái bảo toàn sau 1 - 2 lần lặp.
* **🎙️ Lời thoại Master Hùng:**
> *"Tiếp theo ở Slide 16, em xin báo cáo kết quả nghiên cứu thực nghiệm khoa học nhằm trả lời 3 câu hỏi nghiên cứu (Research Questions) trên bộ 100 bài toán vật lý chuẩn hóa mà nhóm đã cố tình gây nhiễu tham số để thử thách hệ thống:  
> 
> * **Với RQ1 (Khả năng phát hiện vi phạm định luật):** Lõi giải số thích ứng RK4 của PhysLive đạt độ chính xác lên tới **99.2%** trong việc phát hiện các bài toán vi phạm định luật bảo toàn cơ năng. Trong khi đó, các game engine thông thường như Matter.js chỉ đạt 45.8%, bỏ lọt hơn một nửa số lỗi do hiện tượng trôi dạt năng lượng tích lũy của thuật toán Euler thô sơ.  
> * **Với RQ2 (Thời gian thực thi máy chủ):** Thời gian máy chủ Spring Boot giải số và thẩm định trung bình chỉ mất **dưới 15 mili-giây** cho mỗi bài mô phỏng, hoàn toàn đáp ứng khả năng phục vụ đồng thời cho hàng ngàn học sinh trong giờ học thực tế.  
> * **Với RQ3 (Khả năng hỗ trợ từ AI):** Khi phát hiện bài mô phỏng bị sai lệch vật lý, cơ chế phản hồi sai số từ bộ giải đã giúp **88.5%** các bài mô phỏng được AI tự động điều chỉnh tham số thành công về trạng thái đạt chuẩn khoa học mà không cần giáo viên phải can thiệp sửa code thủ công ạ."*

---

### 🖥️ SLIDE 17: KIỂM THỬ ĐA TẦNG & BẢO ĐẢM CHẤT LƯỢNG HỆ THỐNG (QA RIGOR)
* **Vị trí Sơ đồ:** 4 thẻ đo lường chất lượng kiểm thử.
* **Nội dung hiển thị:**
  * Thẻ 1: 69 ca Unit Test Backend (JUnit 5 & Mockito) Pass 100%, độ phủ JaCoCo đạt 82%.
  * Thẻ 2: Kiểm thử Cơ sở dữ liệu Thực với Testcontainers 1.21.4 (Xác thực an toàn phân lập Row-Level Security giữa các trường).
  * Thẻ 3: Kiểm thử Tự động Giao diện E2E với Playwright 1.64.1 (Xuyên suốt 7 vai trò trên Chromium, Firefox, WebKit).
  * Thẻ 4: Môi trường Live sẵn sàng 100% (Đồng bộ 55 Flyway Migrations, Spring Boot Actuator Health: `UP`).
* **🎙️ Lời thoại Master Hùng:**
> *"Dưới góc độ bảo đảm chất lượng phần mềm (QA), nhóm đã thiết lập một quy trình kiểm thử tự động đa tầng nghiêm ngặt:  
> 
> * **Về Backend:** Toàn bộ **69 ca Unit & Integration Test** được viết bằng JUnit 5 và Mockito đều đạt tỷ lệ **Pass 100% (0 fail, 0 error)** trên toàn bộ 320 lớp mã nguồn, với độ bao phủ JaCoCo đạt **82%** đối với các phân hệ nghiệp vụ cốt lõi như Bộ giải số RK4, Quota AI và Thanh toán.  
> * **Về Cơ sở dữ liệu:** Chúng em sử dụng thư viện **Testcontainers 1.21.4** để khởi chạy container PostgreSQL Docker độc lập ngay trong quá trình test, nhằm kiểm thử nghiêm ngặt chính sách bảo mật **Row-Level Security (RLS)**, đảm bảo dữ liệu học sinh và bài thi của trường này tuyệt đối không bị rò rỉ sang trường khác.  
> * **Về Giao diện Người dùng:** Sử dụng công cụ **Playwright 1.64.1** tự động hóa kiểm thử luồng thao tác thực tế E2E cho cả 7 vai trò người dùng trên đa trình duyệt.  
> * Hiện tại hệ thống đã đồng bộ trọn vẹn **55 bản Flyway migrations** trên Supabase Cloud, cả Backend và Frontend đều đang chạy ổn định và sẵn sàng cho phần kiểm tra thực tế của Hội đồng ạ!"*

---

### 🖥️ SLIDE 18: LỜI CẢM ƠN & PHIÊN HỎI ĐÁP (Q&A)
* **Nội dung hiển thị:** Lời tri ân ThS. Nguyễn Tấn Phúc, Thông tin Repo Git `hungnt/review2-prep`, Mời Thầy Cô đặt câu hỏi.
* **🎙️ Lời thoại Master Hùng (Đại diện nhóm kết bài):**
> *"Kính thưa Thầy Nguyễn Tấn Phúc cùng quý Thầy Cô trong Hội đồng, bài báo cáo tiến độ Review 2 của nhóm FA26SE309 đến đây xin được khép lại. Nhóm chúng em xin bày tỏ lòng biết ơn sâu sắc tới Thầy Phúc đã tận tình định hướng kiến trúc và phản biện chuyên môn cho nhóm suốt thời gian qua.  
> Nhóm chúng em rất mong nhận được những ý kiến đóng góp quý báu từ quý Thầy Cô để hoàn thiện sản phẩm tốt nhất chuẩn bị cho đợt bảo vệ tốt nghiệp chính thức sắp tới.  
> Chúng em xin trân trọng kính mời quý Thầy Cô trong Hội đồng đặt câu hỏi phản biện cho nhóm ạ!"* *(Toàn đội đứng nghiêm cúi chào)*

---

## 💡 PHỤ LỤC: BỘ CÂU TRẢ LỜI CỨU SINH KHI HỘI ĐỒNG HỎI SỐ LIỆU CỦA HÙNG

| Câu hỏi của Hội đồng | 👉 Master Hùng trả lời tự tin 100% |
| :--- | :--- |
| **"Tại sao lại lấy con số 99.2% và so sánh với Matter.js?"** | *"Dạ thưa Thầy Cô, các game 2D như Matter.js chỉ dùng tích phân Euler bậc 1 để tối ưu tốc độ render đồ họa nên sau vài giây chuyển động, năng lượng bị trôi dạt và bỏ sót lỗi. Chúng em dùng bộ giải số Runge-Kutta bậc 4 (RK4) giải đúng hệ phương trình vi phân ODE nên phát hiện chuẩn xác 99.2% các sai lệch vật lý ạ."* |
| **"Testcontainers là gì và tại sao phải dùng Docker trong test?"** | *"Dạ, nếu chỉ dùng database giả lập H2 trong bộ nhớ thì không thể kiểm thử được tính năng Row-Level Security (RLS) của PostgreSQL. Testcontainers cho phép kéo container PostgreSQL thật về để test chính sách cô lập dữ liệu trường học, test xong tự hủy container rất sạch sẽ ạ."* |
| **"Hết hạn mức Quota AI thì học sinh có làm bài tập được không?"** | *"Dạ hoàn toàn bình thường ạ! Quota AI chỉ phục vụ tính năng OCR nhận diện ảnh đề bài của giáo viên. Còn học sinh làm bài tập, chạy mô phỏng 60 FPS là chạy bằng Pixi.js trên máy client nên không tốn một token AI nào của trường ạ."* |
| **"Học sinh có tự reopen bài để làm lại được không?"** | *"Dạ không ạ! Chỉ giáo viên sau khi chấm bài thấy học sinh giải thích chưa đạt mới có quyền bấm nút 'Trả bài làm lại' trong `AssignmentService.java` để bật cờ `retryAllowed = true` cho học sinh làm lại lần 2 ạ."* |
