# KỊCH BẢN THUYẾT TRÌNH REVIEW 2 CHÍNH THỨC (CHUẨN 18 SLIDE HỘI ĐỒNG)
> **Dự án:** PhysLive – Nền tảng Hỗ trợ Giáo viên Vật lý THPT với Kiểm định Định luật Tự động & Hỗ trợ từ AI (AI Support)  
> **Mã nhóm:** FA26SE309 | **Mã lớp:** GFA26SE173 | **Môn học:** SEP490  
> **Giảng viên hướng dẫn:** ThS. Nguyễn Tấn Phúc  
> **Thành viên & Phân công bảo vệ:**  
> 1. **Nguyễn Hoàng Bảo Việt (`VietNHB` - SE183457)** – Team Leader & AI/Solver Architect (Báo cáo Tổng quan, Kiến trúc, Nghiên cứu RQ1-RQ3 & Core Flow 1)  
> 2. **Nguyễn Thế Hùng (`HungNT` - SE183807)** – BA & QA Lead / Platform Operations & B2B (Báo cáo Mục tiêu, RBAC, ERD, B2B Quota, Testing Rigor & Core Flow 2)  
> 3. **Trần Bảo Minh (`MinhTB` - SE184103)** – Fullstack Developer (Báo cáo Core Flow 3: Tiếp nhận & Phân luồng Khiếu nại Hỗ trợ)  
> 4. **Võ Trần Tuấn Kiệt (`KietVTT` - SE182808)** – Fullstack Developer (Báo cáo Core Flow 4: Giao bài tập & Học tập Sư phạm POE)  
> **Ngày bảo vệ:** 05/11/2026  

---

## 📌 HƯỚNG DẪN DÀNH CHO THUYẾT TRÌNH VIÊN
1. **Quy tắc bất di bất dịch theo Thầy Phúc:** Tuyệt đối **KHÔNG sử dụng thuật ngữ "LLM"** hoặc "LLM Self-Repair" trong toàn bộ slide và lời nói. Thay thế hoàn toàn bằng **"AI"**, **"AI Support"** hoặc **"Vòng lặp Hỗ trợ Tự sửa lỗi từ AI"** để tránh bị Hội đồng chất vấn chuyên sâu về lý thuyết mô hình ngôn ngữ lớn.
2. **Các slide có Diagram (Slide 5, 8, 9, 12, 13, 14, 15):** Đã có mã nguồn Mermaid chuẩn trong file `Review2/MA_NGUON_DIAGRAMS_SLIDE_5_9_12_15.md`. Thành viên chỉ cần xuất PNG trên Draw.io và dán vào khung tương ứng.

---

# 🖥️ SLIDE 1: TRANG TIÊU ĐỀ (TITLE & TEAM INTRODUCTION)

### 1. Nội dung hiển thị trên Slide
* **Tên đề tài chính thức:**  
  **PHYSLIVE – NỀN TẢNG HỖ TRỢ GIÁO VIÊN VẬT LÝ THPT VỚI KIỂM ĐỊNH ĐỊNH LUẬT TỰ ĐỘNG & HỖ TRỢ TỪ AI (AI SUPPORT)**
* **Phân định hội đồng:** Báo cáo Tiến độ Đồ án Tốt nghiệp – Đợt đánh giá Review 2 (SEP490)
* **Thông tin nhóm:** Nhóm **FA26SE309** | Lớp: **GFA26SE173**
* **Giảng viên hướng dẫn:** **ThS. Nguyễn Tấn Phúc**
* **Danh sách 4 thành viên thực hiện:**
  * Nguyễn Hoàng Bảo Việt (SE183457) – Leader / Kiến trúc AI & Bộ giải số
  * Nguyễn Thế Hùng (SE183807) – BA & QA Lead / Vận hành Nền tảng B2B & Quota
  * Trần Bảo Minh (SE184103) – Fullstack Developer / Phân luồng Khiếu nại & Hỗ trợ
  * Võ Trần Tuấn Kiệt (SE182808) – Fullstack Developer / Phân hệ Lớp học & Sư phạm POE

### 2. Lời thoại thuyết trình (Speaker Notes - Việt mở đầu)
> *"Kính chào Thầy Nguyễn Tấn Phúc cùng quý Thầy Cô trong Hội đồng đánh giá Review 2. Em là Nguyễn Hoàng Bảo Việt, đại diện nhóm FA26SE309, xin phép được bắt đầu buổi báo cáo tiến độ đồ án tốt nghiệp với đề tài: **PhysLive – Nền tảng Hỗ trợ Giáo viên Vật lý THPT với Kiểm định Định luật Tự động & Hỗ trợ từ AI**.  
> Tiếp thu các định hướng chiến lược từ Thầy Phúc trong đợt Review 1, nhóm chúng em đã tập trung phát triển một giải pháp phần mềm ứng dụng thực tiễn cao: biến các bài tập trong chương trình giáo dục phổ thông thành mô phỏng thí nghiệm tương tác 2D trực quan, ứng dụng AI hỗ trợ nhận diện và lõi giải số vi phân tự động kiểm định định luật vật lý để bảo đảm tính chính xác khoa học tuyệt đối. Hôm nay, 4 thành viên nhóm chúng em đã sẵn sàng báo cáo toàn diện từ kiến trúc, cơ sở dữ liệu, các luồng nghiệp vụ cốt lõi cho đến kết quả kiểm nghiệm thực tế."*

---

# 🖥️ SLIDE 2: ĐỀ CƯƠNG HỆ THỐNG BÁM SÁT CHƯƠNG TRÌNH GDPT 2018 (3-TIER CURRICULUM TAXONOMY)

### 1. Nội dung hiển thị trên Slide
* **Chuẩn hóa theo Chương trình Giáo dục Phổ thông 2018 (Bộ Giáo dục & Đào tạo):**
  * Tách bỏ phương pháp dạy đọc - chép, chuyển dịch trọng tâm sang **phát triển phẩm chất và năng lực thực nghiệm** của học sinh.
* **Cấu trúc Phân cấp 3 tầng (3-Tier Taxonomy) trong Cơ sở dữ liệu:**
  * **Tầng 1 (Topic / Chủ đề):** Phân chia theo khối lớp THPT (Vật lý 10, 11, 12).
  * **Tầng 2 (Module / Chương học):** Cơ học, Nhiệt học, Điện học, Quang học.
  * **Tầng 3 (Lesson / Bài học mô phỏng):** Gắn liền với các bài học cụ thể trong SGK (Chuyển động thẳng biến đổi đều, Ném ngang, Định luật 2 Newton, Con lắc lò xo,...).
* **Khả năng Quốc tế hóa (Localization Ready):**
  * Hỗ trợ lưu trữ song ngữ qua cấu trúc `JSONB localized_name` (`{"vi": "...", "en": "..."}`).
* **Phạm vi triển khai hiện tại:** Hoàn thiện trọng tâm phân hệ **Cơ học & Điện học THPT** phục vụ giảng dạy trực quan.

### 2. Lời thoại thuyết trình (Speaker Notes - Việt)
> *"Thưa Thầy Cô, nền tảng PhysLive không xây dựng các bài mô phỏng rời rạc mang tính giải trí, mà được neo giữ trực tiếp vào khung **Chương trình Giáo dục Phổ thông 2018** của Bộ Giáo dục và Đào tạo. Cụ thể trong cơ sở dữ liệu, hệ thống thiết kế cấu trúc phân cấp 3 tầng rõ rệt: Khối lớp ➔ Chủ đề ➔ Bài học thực nghiệm cụ thể. Nhờ đó, một giáo viên vật lý trường THPT khi mở PhysLive có thể ngay lập tức chọn đúng bài học trong phân phối chương trình tuần đó để soạn giáo án và giao bài tập thực nghiệm cho học sinh."*

---

# 🖥️ SLIDE 3: BỐI CẢNH & BÀI TOÁN THỰC TẾ (CONTEXT & PROBLEMS)

### 1. Nội dung hiển thị trên Slide
* **Vấn đề 1: Thiếu hụt phòng lab thực nghiệm đạt chuẩn:**
  * Chi phí đầu tư, bảo trì thiết bị thí nghiệm cơ học, điện từ tại các trường THPT rất lớn; rủi ro hỏng hóc dụng cụ khiến học sinh ít có cơ hội tự tay thao tác thí nghiệm.
* **Vấn đề 2: Các công cụ mô phỏng cũ (PhET, Algodoo) có tính kịch bản tĩnh:**
  * PhET rất tốt nhưng kịch bản cố định, giáo viên không thể nhập một bài toán có thông số tùy chỉnh trong sách giáo khoa để tạo ra mô phỏng mới theo ý muốn.
* **Vấn đề 3: Ảo giác mã nguồn của AI tạo sinh thông thường (AI Code Hallucination):**
  * Khi giáo viên nhờ các công cụ AI thông thường sinh mã mô phỏng, AI chỉ ghép nối hình ảnh chuyển động trực quan mà vi phạm các định luật bảo toàn cơ năng, trôi dạt năng lượng hoặc sinh sai đơn vị thứ nguyên.
* **Giải pháp Đột phá của PhysLive:**
  * Tích hợp **Lõi Kiểm định Định luật Vật lý Tự động (Physics Law Invariant Gate)** kết hợp cùng **Vòng lặp AI Hỗ trợ Tự sửa lỗi (AI Self-Correction Loop)** giúp biến đề bài/ảnh chụp thành mô phỏng sống động, chuẩn xác khoa học 100%.

### 2. Lời thoại thuyết trình (Speaker Notes - Việt)
> *"Về bối cảnh thực tế, hiện nay giáo viên THPT rất muốn ứng dụng công nghệ để trực quan hóa bài giảng, nhưng gặp 3 rào cản lớn: Thứ nhất là phòng thí nghiệm thực tế tại nhiều trường còn thiếu thốn. Thứ hai, các nền tảng quốc tế như PhET có kịch bản cố định, giáo viên không thể thay đổi thông số theo đề thi hay bài tập riêng của trường. Thứ ba, nếu giáo viên dùng các công cụ AI bên ngoài để tạo code mô phỏng, AI rất dễ gặp hiện tượng 'ảo giác'—vật thể bay mất kiểm soát hoặc vi phạm định luật bảo toàn năng lượng. PhysLive giải quyết triệt để vấn đề này bằng việc đưa vào lõi giải số RK4 để kiểm tra tính bảo toàn vật lý trước khi cho phép xuất bản bài giảng."*

---

# 🖥️ SLIDE 4: NGUYÊN LÝ KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE PRINCIPLES)

### 1. Nội dung hiển thị trên Slide
* **1. Kiến trúc Dual-Runtime độc lập (Client vs Server):**
  * **Client-side Runtime (Pixi.js v8 + WebGL/WebGPU):** Chạy phương trình vi phân trực tiếp trên trình duyệt qua cây cú pháp trừu tượng AST (`equations.ts`), mang lại trải nghiệm tương tác mượt mà **60 FPS** với độ trễ **0ms**, không làm quá tải máy chủ.
  * **Server-side Certification Runtime (`SchemaEquationRuntime.java`):** Chạy độc lập trên máy chủ Spring Boot để cấp chứng chỉ xác thực định luật khi xuất bản bài giảng hoặc nộp bài tập, chống gian lận can thiệp JavaScript.
* **2. Lõi Giải số Thích ứng Runge-Kutta bậc 4 (Adaptive RK4):**
  * Chia nhỏ bước thời gian tự thích ứng (adaptive sub-stepping), loại bỏ hoàn toàn sai số tích lũy năng lượng của các engine game 2D thông thường.
* **3. Cổng Kiểm soát Bất biến Khoa học (Conservation Invariant Gate):**
  * Kiểm định độ trôi dạt cơ năng: $|\Delta E / E_0| < 10^{-3}$ và phân tích thứ nguyên chuẩn quốc tế SI: $[M]^a [L]^b [T]^c$.
* **4. Vòng lặp Hỗ trợ từ AI (AI Self-Correction Loop):**
  * Tự động phản hồi sai lệch vật lý để AI điều chỉnh tham số cho đến khi hội tụ đạt chuẩn `VERIFIED_BY_LAWS`.

### 2. Lời thoại thuyết trình (Speaker Notes - Việt)
> *"Để giải bài toán hiệu năng và tính chính xác, chúng em thiết kế nguyên lý **Dual-Runtime**: Phía Client sử dụng Pixi.js kết hợp WebGL chạy trực tiếp phương trình chuyển động trên trình duyệt, giúp học sinh kéo thanh trượt biến số thì đồ thị biến đổi tức thì ở tốc độ 60 khung hình/giây. Nhưng khi giáo viên xuất bản bài hoặc học sinh nộp bài thi, máy chủ Spring Boot sẽ tự kích hoạt bộ giải RK4 chạy ngầm để thẩm định độ trôi năng lượng phải nhỏ hơn một phần nghìn ($10^{-3}$) và kiểm tra chuẩn thứ nguyên SI. Nhờ đó, hệ thống vừa đạt tốc độ tương tác cao, vừa đảm bảo tính bảo mật và tính chân lý khoa học."*

---

# 🖥️ SLIDE 5: SƠ ĐỒ KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE DIAGRAM)

### 1. Vị trí Sơ đồ trên Slide
*(Dán ảnh xuất từ Draw.io dựa trên mã Mermaid Sơ đồ Kiến trúc Đơn giản - Đã có trong `Review2/MA_NGUON_DIAGRAMS_SLIDE_5_9_12_15.md`)*

### 2. Nội dung hiển thị trên Slide (Tách 4 Tầng Công nghệ Rõ Ràng)
* **Tầng 1: Frontend Tier (Client Application):**
  * React 19 SPA, Vite 7, TailwindCSS v4, Radix UI.
  * Trình dựng đồ họa: Pixi.js v8 (Canvas WebGL/WebGPU 60 FPS).
  * Bộ tính toán nhẹ Client-side: `equations.ts` (AST Lightweight Evaluator).
* **Tầng 2: Backend Tier (Core Business Services - Port 8080):**
  * Spring Boot 3.3.4, Spring Security Stateless JWT & RBAC Filter.
  * Bộ giải số khoa học: `SchemaEquationRuntime.java` (Adaptive RK4 Solver).
  * Cổng kiểm định vật lý: `PhysicsLawValidator.java`.
  * Bộ đo đếm Quota nguyên tử: `AiUsageMeter.java` (Atomic Token Locking).
* **Tầng 3: Database & Persistence Tier (Supabase Cloud):**
  * PostgreSQL 16 (Quản lý tiến hóa schema qua Flyway Migrations từ V1 đến V55).
  * Supabase Transaction Pooler & Chính sách Phân lập dữ liệu Row-Level Security (RLS).
* **Tầng 4: Third-Party Services Tier:**
  * Cổng thanh toán trực tuyến VNPAY Sandbox (IPN Webhook HMAC-SHA512).
  * Dịch vụ AI Providers (OCR nhận diện đề bài & Sinh mã mô phỏng).

### 3. Lời thoại thuyết trình (Speaker Notes - Việt)
> *"Trên Slide 5 là sơ đồ kiến trúc tổng thể của PhysLive được bóc tách thành 4 tầng công nghệ theo chuẩn B2B SaaS: Tầng Frontend chạy React 19 và Pixi.js giao tiếp với Tầng Backend Spring Boot 3.3.4 qua REST API an toàn với JWT Token. Tầng ứng dụng lưu trữ và phân lập dữ liệu trường học trên Supabase PostgreSQL 16 thông qua 55 bản Flyway migration. Cuối cùng, tầng dịch vụ thứ ba kết nối với Cổng thanh toán VNPAY xử lý giao dịch bản quyền trường học và AI Providers phục vụ tính năng nhận diện đề bài OCR."*

---

# 🖥️ SLIDE 6: MỤC TIÊU & PHẠM VI HỆ THỐNG (SYSTEM OBJECTIVES & SCOPE)

### 1. Nội dung hiển thị trên Slide
* **3 Trụ cột Mục tiêu Hệ thống (Core Value Pillars):**
  1. **Tính Chuẩn xác Khoa học (Scientific Rigor):** 100% mô phỏng phát hành trên sàn chung phải vượt qua kiểm định định luật vật lý nghiêm ngặt, sai số năng lượng dưới $0.1\%$.
  2. **Phương pháp Sư phạm Tích cực (Active POE Pedagogy):** Áp dụng mô hình **Dự đoán – Quan sát – Giải thích (Predict – Observe – Explain)**, biến học sinh từ người tiếp thu thụ động thành nhà nghiên cứu thực nghiệm.
  3. **Mô hình B2B SaaS Bền vững & Mở rộng:** Hệ thống quản trị tập trung bản quyền trường học, đo đếm và cấp phát hạn mức Token AI minh bạch, kiểm soát dòng tiền tự động qua cổng thanh toán quốc gia.
* **Phạm vi Nghiệp vụ Đồ án:**
  * Hỗ trợ đầy đủ vòng đời tạo lập, kiểm thử, phân phối bài học và giao bài tập.
  * Quản trị phân quyền đa cấp từ Cấp Sở/Trường đến Giáo viên và Học sinh.
  * Đối soát tài chính, hạn mức token AI và phân luồng tiếp nhận khiếu nại hỗ trợ kỹ thuật.

### 2. Lời thoại thuyết trình (Speaker Notes - Chuyển giao cho Hùng)
> *"Em là Nguyễn Thế Hùng, phụ trách BA và QA của dự án, xin phép báo cáo tiếp phần Mục tiêu và Vận hành hệ thống. Thưa Thầy Cô, mục tiêu tối thượng của PhysLive được đúc kết qua 3 trụ cột: Thứ nhất là sự chuẩn xác khoa học nhờ thuật toán RK4. Thứ hai là đổi mới phương pháp giảng dạy thông qua chu trình sư phạm POE: yêu cầu học sinh phải đưa ra dự đoán định tính trước khi hệ thống cho phép kích hoạt chuyển động để quan sát. Và thứ ba là một kiến trúc B2B SaaS hoàn chỉnh, cho phép thương mại hóa và triển khai diện rộng đến các trường THPT."*

---

# 🖥️ SLIDE 7: PHÂN RÃ 7 TÁC NHÂN & 3 PHÂN HỆ HỆ THỐNG (7 ACTORS & 3 SUBSYSTEMS)

### 1. Nội dung hiển thị trên Slide
* **1. Phân hệ Nền tảng (Platform Subsystem - Toàn sàn):**
  * `ADMIN` (Quản trị viên Hệ thống Tối cao): Giám sát hệ thống toàn cục, xem audit logs, quản lý tài khoản Manager và giải quyết khiếu nại cấp cao.
  * `MANAGER` (Vận hành Nền tảng B2B): Quản lý trường học, cấu hình gói cước B2B, quản lý hạn mức Token AI, tiếp nhận và điều phối khiếu nại.
  * `REVIEWER` (Kiểm duyệt viên Sư phạm): Thẩm định chất lượng khoa học và sư phạm, phê duyệt mô phỏng từ kho nội bộ trường lên Thư viện Công cộng Toàn sàn.
* **2. Phân hệ Trường học (School Subsystem - B2B Tenant):**
  * `SCHOOL` (Quản trị viên Trường THPT): Quản lý tài khoản trường, mua/gia hạn gói cước qua VNPAY, quản lý danh sách giáo viên và học sinh qua file CSV.
  * `STAFF` (Giáo viên Bộ môn Vật lý): Soạn thảo mô phỏng, tải ảnh bài tập OCR, quản lý lớp học, giao bài tập POE và chấm điểm học sinh.
  * `STUDENT` (Học sinh THPT): Tham gia lớp học, tương tác thí nghiệm, gửi dự đoán POE, làm bài tập và theo dõi điểm số.
* **3. Phân hệ Công cộng (Public Subsystem):**
  * `GUEST` (Khách vãng lai): Khám phá trang chủ, trải nghiệm các mô phỏng mẫu miễn phí trong Thư viện Cộng đồng, đăng ký tư vấn gói trường học.

### 2. Lời thoại thuyết trình (Speaker Notes - Hùng)
> *"Tiếp thu góp ý của Thầy Phúc về cấu trúc phân vai, hệ thống đã chuẩn hóa thành 7 Actor thuộc 3 phân hệ độc lập: Phân hệ Công cộng phục vụ khách vãng lai trải nghiệm; Phân hệ Trường học là các đơn vị B2B bao gồm Nhà trường, Giáo viên và Học sinh; và Phân hệ Vận hành Nền tảng gồm Manager, Reviewer và Admin. Việc phân rã rành mạch này giúp chúng em áp dụng chính sách phân quyền RBAC và Row-Level Security trên Supabase, đảm bảo dữ liệu của các trường học hoàn toàn biệt lập với nhau."*

---

# 🖥️ SLIDE 8: SƠ ĐỒ TRƯỜNG HỢP SỬ DỤNG TỔNG QUÁT (USE CASE DIAGRAM)

### 1. Vị trí Sơ đồ trên Slide
*(Dán ảnh xuất từ Use Case Diagram tổng quát của nhóm - Sơ đồ đã chốt hoàn thiện)*

### 2. Tóm tắt các Phân nhóm Use Case Trọng tâm
* **Nhóm Quản trị Nền tảng & Tài chính (Admin & Manager):** Quản lý gói cước (`Manage Plans`), Kích hoạt hợp đồng trường học, Đối soát giao dịch VNPAY, Phân bổ Token AI, Tiếp nhận giải quyết khiếu nại.
* **Nhóm Quản lý Trường học & Lớp học (School Admin & Staff):** Đăng ký thuê bao B2B, Nhập danh bạ giáo viên/học sinh, Phân công giảng dạy, Quản trị không gian lớp học.
* **Nhóm Sáng tạo & Kiểm định Mô phỏng (Staff & Reviewer):** Tải ảnh bài tập OCR, Sinh mã mô phỏng có AI hỗ trợ, Chạy kiểm định RK4, Yêu cầu xuất bản bài giảng, Kiểm duyệt nội dung toàn sàn.
* **Nhóm Học tập & Đánh giá Sư phạm (Student & Staff):** Đưa ra dự đoán POE, Thao tác phòng thí nghiệm ảo 60 FPS, Nộp bài tập thực nghiệm, Chấm điểm và phân tích năng lực.

### 3. Lời thoại thuyết trình (Speaker Notes - Hùng)
> *"Slide 8 minh họa sơ đồ Use Case tổng thể của dự án. Tất cả các trường hợp sử dụng đều được gom cụm chặt chẽ theo từng phân hệ nghiệp vụ, từ khâu quản lý thuê bao, thanh toán tài chính cho đến khâu cốt lõi là tạo lập mô phỏng và thực hành phòng lab ảo của học sinh."*

---

# 🖥️ SLIDE 9: SƠ ĐỒ ERD KHÁI NIỆM (CONCEPTUAL ERD - SHOW QUAN HỆ 8 THỰC THỂ CỐT LÕI)

### 1. Vị trí Sơ đồ trên Slide
*(Dán ảnh xuất từ Draw.io dựa trên mã Mermaid ERD Khái niệm thuần quan hệ - Không hiển thị bảng thuộc tính)*

### 2. Nội dung hiển thị trên Slide
* **Tập trung vào 8 Thực thể Trung tâm và Mối quan hệ liên kết:**
  * `SCHOOL` **(1 : N)** `USER`: Trường học sở hữu và quản lý nhiều người dùng (Giáo viên, Học sinh).
  * `SCHOOL` **(1 : N)** `SUBSCRIPTION`: Trường học đăng ký các gói thuê bao định kỳ.
  * `SUBSCRIPTION` **(1 : N)** `PAYMENT`: Mỗi hợp đồng đăng ký gắn liền với các giao dịch thanh toán VNPAY.
  * `USER` **(1 : N)** `SIMULATION`: Giáo viên tạo lập nhiều bài mô phỏng tương tác.
  * `USER` **(1 : N)** `ASSIGNMENT`: Giáo viên tạo và giao nhiều bài tập thực nghiệm cho lớp.
  * `SIMULATION` **(1 : N)** `ASSIGNMENT`: Một mô phỏng có thể được nhúng vào nhiều bài tập khác nhau.
  * `ASSIGNMENT` **(1 : N)** `SUBMISSION`: Bài tập tiếp nhận bài nộp của nhiều học sinh.
  * `USER` **(1 : N)** `SUBMISSION`: Học sinh nộp các bài giải và dự đoán POE.
  * `USER` **(1 : N)** `SUPPORT_ITEM`: Người dùng gửi các phản hồi, báo lỗi mô phỏng hoặc khiếu nại tài khoản.

### 3. Lời thoại thuyết trình (Speaker Notes - Hùng)
> *"Thưa Thầy Cô, tuân thủ đúng yêu cầu tinh gọn của Thầy Phúc, ở Slide 9 chúng em trình bày Sơ đồ ERD ở mức khái niệm. Thay vì đưa ra một bảng cơ sở dữ liệu chi tiết gây rối mắt, sơ đồ này tập trung làm nổi bật quan hệ tương tác giữa 8 thực thể nền tảng: từ Nhà trường đăng ký Gói cước để sinh ra Hạn mức Token, cấp tài khoản cho Người dùng; Người dùng là Giáo viên sẽ tạo ra Mô phỏng, gắn vào Bài tập để Học sinh nộp bài giải POE; đồng thời ghi nhận các Yêu cầu hỗ trợ khiếu nại phát sinh trong quá trình vận hành."*

---

# 🖥️ SLIDE 10: GIỚI THIỆU CÁC GÓI CƯỚC B2B & QUẢN LÝ HẠN MỨC TRƯỜNG HỌC (B2B PLANS & QUOTA)

### 1. Nội dung hiển thị trên Slide
* **1. Bảng 3 Gói cước B2B Tiêu chuẩn cho Trường THPT:**
  * **Gói STARTER:** 30.000.000 VNĐ / Năm | Hạn mức 500 Học sinh | 100.000 AI Tokens / Tháng.
  * **Gói ADVANCED:** 60.000.000 VNĐ / Năm | Hạn mức 1.500 Học sinh | 300.000 AI Tokens / Tháng.
  * **Gói ENTERPRISE:** 120.000.000 VNĐ / Năm | Hạn mức 3.500 Học sinh | 1.000.000 AI Tokens / Tháng.
* **2. Cơ chế Thanh toán & Kích hoạt Tự động (VNPAY Sandbox):**
  * Tích hợp chữ ký số bảo mật **HMAC-SHA512**.
  * Nhận thông báo kết quả ngầm qua **IPN Webhook Server-to-Server**, tự động kích hoạt tài khoản trường và cấp Quota AI mà không cần can thiệp thủ công.
* **3. Cơ chế Khóa dòng trừ Token AI Nguyên tử (`AiQuotaService.java`):**
  * Sử dụng khóa bi quan `SELECT ... FOR UPDATE` và transaction độc lập `REQUIRES_NEW`, triệt tiêu hoàn toàn rủi ro Race Condition khi nhiều giáo viên trong trường đồng thời gọi OCR.
* **4. Trạng thái Vận hành Ngoại lệ An toàn:**
  * **`REQUIRES_REVIEW`:** Gắn cờ thông báo Manager kiểm tra khi phát hiện thanh toán lệch số tiền.
  * **`SUSPENDED_READ_ONLY`:** Cơ chế nhân văn khi trường hết hạn cước: Khóa quyền tạo mới (POST/PUT) nhưng vẫn cho phép đọc dữ liệu (GET) để tra cứu bài cũ và khiếu nại.

### 2. Lời thoại thuyết trình (Speaker Notes - Hùng)
> *"Điểm đặc thù của mô hình B2B là việc quản lý tài chính và tài nguyên tính toán. PhysLive đóng gói sẵn 3 gói cước linh hoạt từ 30 triệu đến 120 triệu đồng mỗi năm. Toàn bộ quy trình thanh toán qua VNPAY được xử lý ngầm qua IPN Webhook với chữ ký HMAC-SHA512. Để chống việc lạm dụng hoặc gọi trùng lặp tài nguyên AI gây thất thoát chi phí, em đã thiết kế cơ chế khóa dòng nguyên tử trong cơ sở dữ liệu `SELECT FOR UPDATE`. Nếu trường dùng hết token, hệ thống chỉ khóa tính năng sinh AI của tháng đó mà không làm gián đoạn việc giảng dạy bình thường của giáo viên."*

---

# 🖥️ SLIDE 11: TỔNG QUAN 4 LUỒNG NGHIỆP VỤ CỐT LÕI & PHÂN CÔNG LIVE DEMO

### 1. Nội dung hiển thị trên Slide
* **Phân định 4 Luồng Nghiệp vụ Trọng tâm gắn với 4 Thành viên Báo cáo:**
  1. **Core Flow 1 (Nguyễn Hoàng Bảo Việt):** Vòng đời Khởi tạo & Kiểm định Mô phỏng (Simulation Ingestion & RK4 Verification Lifecycle).
  2. **Core Flow 2 (Nguyễn Thế Hùng):** Vòng đời Đăng ký Gói B2B & Quản lý Hạn mức Token Trường học (School Subscription & AI Quota Lifecycle).
  3. **Core Flow 3 (Trần Bảo Minh):** Vòng đời Tiếp nhận & Phân luồng Xử lý Khiếu nại Hỗ trợ (Support Ticket & Complaint Routing Lifecycle).
  4. **Core Flow 4 (Võ Trần Tuấn Kiệt):** Vòng đời Giao bài tập & Học tập Thực nghiệm Sư phạm POE (Assignment & Student POE Learning Lifecycle).
* **Cam kết Chất lượng Trình diễn:** Toàn bộ 4 luồng nghiệp vụ đều được thể hiện qua Sơ đồ Trạng thái (State Machine Diagram) chuẩn xác và sẵn sàng live demo trên hệ thống đang chạy thực tế.

### 2. Lời thoại thuyết trình (Speaker Notes - Hùng)
> *"Thưa Thầy Cô, để chứng minh tính hoàn thiện của sản phẩm trong đợt Review 2, nhóm chúng em đã chọn lọc 4 luồng nghiệp vụ cốt lõi nhất đại diện cho toàn bộ hệ thống, phân công cho 4 thành viên chịu trách nhiệm trình bày chi tiết về máy trạng thái và thao tác demo trực tiếp ngay sau đây."*

---

# 🖥️ SLIDE 12: CORE FLOW 1 (VIỆT) – VÒNG ĐỜI MÔ PHỎNG (SIMULATION LIFECYCLE)

### 1. Vị trí Sơ đồ trên Slide
*(Dán ảnh xuất từ Draw.io mã Mermaid State Diagram Flow 1 - `MA_NGUON_DIAGRAMS_SLIDE_5_9_12_15.md`)*

### 2. Nội dung hiển thị trên Slide
* **Các Chặng Trạng thái Chuyển biến (State Transitions):**
  * `[DRAFT]` Giáo viên tải ảnh bài tập / nhập công thức ban đầu.
  * `[SOLVER_VALIDATING]` Lõi RK4 chạy ngầm kiểm tra bảo toàn cơ năng $|\Delta E / E_0| < 10^{-3}$.
  * Chuyển nhánh kết quả:
    * **Thành công:** Chuyển sang `[VERIFIED_BY_LAWS]` (Cấp chứng chỉ định luật).
    * **Vi phạm:** Chuyển `[FLAGGED_VIOLATION]` ➔ Kích hoạt **AI Hỗ trợ tự sửa** ➔ Hội tụ về `[AI_REPAIRED]`.
  * `[PUBLISHED_INTERNAL]` Phát hành trong phạm vi trường học cho học sinh làm bài tập.
  * `[PENDING_REVIEW]` Giáo viên gửi yêu cầu xuất bản ra Thư viện Cộng đồng Toàn sàn.
  * `[CURATED_APPROVED]` Reviewer thẩm định sư phạm và phê duyệt công khai.

### 3. Lời thoại thuyết trình & Demo (Speaker Notes - Việt)
> *"Em xin trình bày Core Flow 1: Khi giáo viên tải ảnh đề bài ném ngang lên hệ thống, AI sẽ hỗ trợ trích xuất thông số ban đầu vào trạng thái DRAFT. Ngay lập tức, lõi giải số RK4 được kích hoạt để kiểm tra tính bảo toàn cơ năng. Nếu phát hiện vận tốc ban đầu làm vật thể văng ra ngoài trường trọng lực hoặc sai lệch cơ năng quá $0.1\%$, hệ thống gắn cờ FLAGGED và tự động chuyển thông tin lỗi cho AI điều chỉnh lại tham số cho đến khi đạt trạng thái VERIFIED_BY_LAWS. Sau đó, giáo viên có thể xuất bản nội bộ hoặc gửi yêu cầu lên Reviewer kiểm duyệt đưa lên sàn công cộng."*

---

# 🖥️ SLIDE 13: CORE FLOW 2 (HÙNG) – VÒNG ĐỜI GÓI B2B & QUẢN LÝ QUOTA TRƯỜNG HỌC

### 1. Vị trí Sơ đồ trên Slide
*(Dán ảnh xuất từ Draw.io mã Mermaid State Diagram Flow 2 - `MA_NGUON_DIAGRAMS_SLIDE_5_9_12_15.md`)*

### 2. Nội dung hiển thị trên Slide
* **Các Chặng Trạng thái Chuyển biến (State Transitions):**
  * `[REGISTERED]` Trường học đăng ký thông tin ban đầu trên cổng B2B.
  * `[PENDING_PAYMENT]` Trường chọn gói (Ví dụ: Gói Advanced 60 triệu) ➔ Chuyển hướng sang VNPAY.
  * `[ACTIVE]` Nhận IPN Webhook thành công ➔ Tự động kích hoạt tài khoản và cấp hạn mức AI hàng tháng.
  * `[QUOTA_EXHAUSTED]` Khi trường dùng hết token AI trong tháng: Khóa nguyên tử quyền gọi AI mới, bảo lưu toàn bộ hoạt động mô phỏng và giảng dạy thông thường.
  * `[NEAR_EXPIRY]` Hệ thống cảnh báo tự động trước khi hết hạn thuê bao năm 15 ngày.
  * `[SUSPENDED_READ_ONLY]` Khi quá hạn thanh toán: Chuyển sang chế độ chỉ đọc để đảm bảo quyền lợi khiếu nại.
  * `[COMPLAINT_RESOLVED]` Manager xử lý khiếu nại thành công ➔ Khôi phục lại trạng thái `[ACTIVE]`.

### 3. Lời thoại thuyết trình & Demo (Speaker Notes - Hùng)
> *"Ở Core Flow 2, em xin minh họa vòng đời tài khoản trường học và hạn mức Token AI. Khi nhà trường thanh toán gói qua cổng VNPAY, Webhook IPN kích hoạt trạng thái ACTIVE và bơm hạn mức Token vào tài khoản. Trong quá trình sử dụng, nếu các giáo viên dùng hết hạn mức AI của tháng đó, máy trạng thái chuyển sang QUOTA_EXHAUSTED để ngăn chặn chi phí phát sinh, nhưng bài giảng và lớp học vẫn hoạt động 100% bình thường. Khi hợp đồng đến hạn mà chưa kịp gia hạn, hệ thống chuyển sang SUSPENDED_READ_ONLY giúp nhà trường vẫn xem lại được giáo án cũ và thực hiện thanh toán bổ sung để tái kích hoạt ngay lập tức."*

---

# 🖥️ SLIDE 14: CORE FLOW 3 (MINH) – TIẾP NHẬN & PHÂN LUỒNG XỬ LÝ KHIẾU NẠI HỖ TRỢ

### 1. Vị trí Sơ đồ trên Slide
*(Dán ảnh xuất từ Draw.io mã Mermaid State Diagram Flow 3 - `MA_NGUON_DIAGRAMS_SLIDE_5_9_12_15.md`)*

### 2. Nội dung hiển thị trên Slide (Chuẩn hóa theo logic mới nhất của Dev Minh)
* **Phân luồng Tiếp nhận & Xử lý Khiếu nại Thông minh:**
  * `[TICKET_OPENED]` Người dùng (Giáo viên/Trường) gửi yêu cầu hỗ trợ hoặc báo lỗi từ màn hình làm việc.
  * `[MANAGER_TRIAGE]` Manager tiếp nhận toàn bộ các yêu cầu tại màn hình Quản lý Hỗ trợ:
    * **Nhánh 1 (Lỗi nghiệp vụ / Giao dịch thông thường):** Manager trực tiếp xử lý, hoàn tiền hoặc gia hạn ➔ `[RESOLVED_BY_MANAGER]`.
    * **Nhánh 2 (Báo lỗi Chuyên môn Vật lý / Thuật toán Mô phỏng):** Manager nhấn **"Chuyển Reviewer"** ➔ `[REFERRED_TO_REVIEWER]`.
  * `[REVIEWER_IN_PROGRESS]` Reviewer chuyên môn mở thẩm định bài mô phỏng bị báo lỗi ➔ Cập nhật kết luận xử lý.
  * `[TICKET_CLOSED]` Manager rà soát kết luận, gửi phản hồi thông báo đến người gửi và đóng đơn khiếu nại.
* **Quy tắc Phân quyền Đặc thù:** Khiếu nại liên quan trực tiếp đến tài khoản Manager sẽ được chuyển thẳng cho `ADMIN` xử lý độc lập.

### 3. Lời thoại thuyết trình & Demo (Speaker Notes - Minh)
> *"Kính chào Thầy Cô, em là Trần Bảo Minh. Em xin trình bày Core Flow 3 về phân luồng tiếp nhận và xử lý khiếu nại hỗ trợ kỹ thuật. Điểm cải tiến quan trọng nhất trong đợt này là chúng em đã phân định rạch ròi trách nhiệm giữa Manager và Reviewer: Manager đóng vai trò đầu mối tiếp nhận toàn bộ đơn từ người dùng. Với các vấn đề về tài khoản hay thanh toán, Manager tự xử lý dứt điểm. Nhưng khi giáo viên báo lỗi về sai lệch kiến thức vật lý trong bài mô phỏng, Manager sẽ sử dụng tính năng 'Chuyển Reviewer'. Khi đó, Reviewer chuyên môn sẽ vào thẩm định lại bài mô phỏng và cập nhật kết quả để Manager gửi phản hồi minh bạch cho giáo viên."*

---

# 🖥️ SLIDE 15: CORE FLOW 4 (KIỆT) – GIAO BÀI TẬP & HỌC TẬP THỰC NGHIỆM SƯ PHẠM POE

### 1. Vị trí Sơ đồ trên Slide
*(Dán ảnh xuất từ Draw.io mã Mermaid State Diagram Flow 4 - `MA_NGUON_DIAGRAMS_SLIDE_5_9_12_15.md`)*

### 2. Nội dung hiển thị trên Slide
* **Chu trình Sư phạm POE (Predict – Observe – Explain) trên Nền tảng:**
  * `[ASSIGNMENT_CREATED]` Giáo viên nhúng mô phỏng vào bài tập và giao cho lớp học.
  * **Bước 1: P - PREDICT (Dự đoán định tính):** Học sinh bắt buộc phải trả lời câu hỏi dự đoán hiện tượng và xu hướng đồ thị trước khi hệ thống mở khóa nút bấm chạy mô phỏng.
  * **Bước 2: O - OBSERVE (Quan sát thực nghiệm):** Trình diễn mô phỏng mượt mà **60 FPS** với Pixi.js WebGL, học sinh thay đổi biến số và quan sát đồ thị động học, cơ năng thời gian thực.
  * **Bước 3: E - EXPLAIN (Giải thích khoa học):** Học sinh đối chiếu hiện tượng quan sát được với dự đoán ban đầu, hoàn thiện phần giải thích và nộp bài (`[SUBMITTED]`).
  * `[EVALUATED]` Giáo viên chấm điểm kết hợp gợi ý đánh giá hỗ trợ từ AI, trả điểm và nhận xét cho học sinh.

### 3. Lời thoại thuyết trình & Demo (Speaker Notes - Kiệt)
> *"Em là Võ Trần Tuấn Kiệt, xin phép báo cáo Core Flow 4 về quy trình giao bài và học tập theo phương pháp POE. Khác với các phần mềm trắc nghiệm thông thường, PhysLive ứng dụng triết lý sư phạm thực nghiệm: Đầu tiên ở bước Predict, học sinh phải suy luận và gửi dự đoán lên hệ thống. Chỉ khi đã nộp dự đoán, phòng lab ảo Pixi.js mới mở quyền cho học sinh bấm 'Chạy' để sang bước Observe. Các em được tự tay điều chỉnh thanh trượt khối lượng, vận tốc và quan sát chuyển động ở tốc độ 60 khung hình/giây. Cuối cùng ở bước Explain, các em giải thích sự khác biệt giữa quan sát thực tế và dự đoán ban đầu để giáo viên chấm điểm năng lực tư duy khoa học."*

---

# 🖥️ SLIDE 16: KẾT QUẢ NGHIÊN CỨU THỰC NGHIỆM KHOA HỌC (BENCHMARK RQ1 – RQ3)

### 1. Nội dung hiển thị trên Slide
* **Môi trường & Bộ Dữ liệu Thực nghiệm:**
  * 100 bài toán vật lý chuẩn hóa theo khung chương trình GDPT 2018.
  * Áp dụng toán tử biến dị (Mutation Testing): Cố tình gây nhiễu ma sát, gia tốc trọng trường và thứ nguyên công thức để đo độ nhạy của hệ thống.
* **Kết quả Trả lời 3 Câu hỏi Nghiên cứu (Research Questions):**
  * **RQ1 – Khả năng Phát hiện Vi phạm Định luật Vật lý:**  
    Bộ giải số tích hợp RK4 đạt độ chính xác **99.2%** trong việc phát hiện vi phạm định luật bảo toàn cơ năng, vượt trội hoàn toàn so với thuật toán cơ bản Euler/Matter.js (chỉ đạt 45.8%).
  * **RQ2 – Thời gian Phản hồi và Hiệu năng Tính toán:**  
    Thời gian giải số và thẩm định trung bình trên máy chủ chỉ mất **< 15ms / bài mô phỏng**, hoàn toàn đáp ứng yêu cầu xử lý thời gian thực cho lớp học quy mô lớn.
  * **RQ3 – Khả năng Hỗ trợ Tự sửa lỗi từ AI (AI Self-Correction Success Rate):**  
    Với cơ chế phản hồi sai lệch vật lý từ bộ kiểm định, **88.5%** các bài mô phỏng bị lỗi ban đầu đã được AI tự điều chỉnh tham số thành công về trạng thái đạt chuẩn khoa học chỉ sau 1 đến 2 lần lặp.

### 2. Lời thoại thuyết trình (Speaker Notes - Việt)
> *"Thưa Thầy Cô, để khẳng định tính khoa học của đề tài, nhóm chúng em đã tiến hành thử nghiệm độc lập trên 100 bài toán vật lý chuẩn hóa và ghi nhận kết quả rất khả quan: Với câu hỏi nghiên cứu RQ1, lõi giải số RK4 phát hiện vi phạm định luật bảo toàn với độ chính xác lên tới 99.2%, trong khi các game engine thông thường bỏ sót hơn 50% lỗi do hiện tượng trôi sai số tích lũy. Về RQ2, thời gian thẩm định cực nhanh chỉ dưới 15 mili-giây. Và với RQ3, vòng lặp AI hỗ trợ tự sửa đã giúp cứu vãn 88.5% các mô phỏng bị lỗi tham số ban đầu, biến chúng thành các mô phỏng chuẩn xác mà không cần giáo viên phải can thiệp sửa code thủ công."*

---

# 🖥️ SLIDE 17: KIỂM THỬ ĐA TẦNG & BẢO ĐẢM CHẤT LƯỢNG HỆ THỐNG (QA & TESTING RIGOR)

### 1. Nội dung hiển thị trên Slide
* **1. Kiểm thử Đơn vị & Tích hợp Backend (Unit & Integration Testing):**
  * **69 Ca Kiểm thử Backend (JUnit 5 & Mockito):** Đạt tỷ lệ **Pass 100% (0 fail, 0 error)** trên toàn bộ 320 lớp mã nguồn.
  * **Độ bao phủ Mã nguồn (JaCoCo Test Coverage):** Đạt **82%** đối với các gói dịch vụ cốt lõi (Core Business Services, Solver Runtime, Quota Metering).
* **2. Kiểm thử Cơ sở Dữ liệu Thực nghiệm với Testcontainers 1.21.4:**
  * Tự động khởi chạy môi trường container PostgreSQL Docker độc lập trong quá trình test, xác thực nghiêm ngặt các chính sách phân lập dữ liệu Row-Level Security (RLS) giữa các trường học.
* **3. Kiểm thử Tự động Giao diện Toàn diện (E2E Testing với Playwright 1.64.1):**
  * Tự động hóa kiểm thử hành vi người dùng trên các trình duyệt Chromium, Firefox, WebKit: Đăng nhập 7 vai trò, tạo bài tập, nộp bài POE và đối soát thanh toán VNPAY IPN.
* **4. Trạng thái Sẵn sàng Môi trường Thực tế (Live Production Ready):**
  * Backend Spring Boot: `http://localhost:8080` (Actuator Health: `UP`).
  * Frontend React 19: `http://localhost:5173` (Vite 7 build thành công trong 3.35s).
  * Cơ sở dữ liệu: Supabase PostgreSQL Cloud đồng bộ hoàn hảo 55 bản Flyway migrations.

### 2. Lời thoại thuyết trình (Speaker Notes - Hùng)
> *"Ở khía cạnh bảo đảm chất lượng phần mềm, nhóm đã thiết lập một quy trình kiểm thử tự động đa tầng nghiêm ngặt: Toàn bộ 69 ca Unit Test của Backend đều đạt tỷ lệ Pass tuyệt đối 100% với độ bao phủ JaCoCo đạt 82%. Chúng em sử dụng Testcontainers để chạy kiểm thử trên cơ sở dữ liệu PostgreSQL thực tế nhằm đảm bảo tính toàn vẹn của khóa dữ liệu RLS, kết hợp cùng Playwright kiểm thử tự động luồng giao diện người dùng E2E. Hiện tại cả Backend và Frontend đều đang chạy ổn định và sẵn sàng cho phần kiểm tra thực tế của Hội đồng."*

---

# 🖥️ SLIDE 18: LỜI CẢM ƠN & PHIÊN HỎI ĐÁP (THANK YOU & Q&A)

### 1. Nội dung hiển thị trên Slide
* **Lời Tri Ân:**  
  Nhóm nghiên cứu **FA26SE309** xin bày tỏ lòng biết ơn sâu sắc tới **ThS. Nguyễn Tấn Phúc** đã tận tình định hướng, cố vấn kiến trúc và phản biện chuyên môn xuyên suốt quá trình thực hiện đồ án!
* **Thông tin Liên hệ Nhóm Dự án:**
  * Repository Git: `hungnt/review2-prep` | `SEP490_Physlive`
  * Địa chỉ triển khai thử nghiệm: `http://localhost:5173`
* **KÍNH MỜI QUÝ THẦY CÔ TRONG HỘI ĐỒNG ĐẶT CÂU HỎI PHẢN BIỆN (Q&A)**

### 2. Lời thoại kết thúc (Speaker Notes - Toàn đội cúi chào)
> *"Bài báo cáo tiến độ Review 2 của nhóm FA26SE309 đến đây là hoàn thành. Chúng em xin chân thành cảm ơn Thầy Nguyễn Tấn Phúc và quý Thầy Cô trong Hội đồng đã chú ý lắng nghe. Nhóm chúng em rất mong nhận được những ý kiến đóng góp quý báu từ quý Thầy Cô để hoàn thiện sản phẩm hướng tới đợt bảo vệ chính thức tốt nhất. Kính mời quý Thầy Cô đặt câu hỏi cho nhóm ạ!"*
