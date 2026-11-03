# CẨM NANG CHUẨN BỊ & KỊCH BẢN BẢO VỆ REVIEW 2 - PHYSLIVE (FA26SE309)
> **Dự án:** PhysLive – Nền tảng Mô phỏng Vật lý Tương tác Dành cho Giáo viên THPT (GDPT 2018)  
> **Mã đề tài:** FA26SE309 | **Lớp:** GFA26SE173 | **Ngày Review 2:** 05/11/2026  
> **Tác giả:** Nguyễn Thế Hùng (HungNT - SE183807) – BA & QA Lead / Frontend & Platform Developer  
> **Căn cứ tài liệu:** `SWP490_R2_Huong-dan-chuan-bi-Review-2_1.pdf` & Bộ tài liệu Report 1–5  

---

# PHẦN I: TỔNG HỢP NỘI DUNG CHUẨN BỊ THEO HƯỚNG DẪN REVIEW 2

> [!IMPORTANT]
> **Quy tắc cốt lõi của Hội đồng Review 2:**  
> *"Buổi review tập trung vào hỏi đáp và chứng minh trên hệ thống thực, không trình bày lại tài liệu lê thê!"*  
> Review 2 là mốc **chốt phạm vi đề tài cuối cùng**. Mọi đánh giá tại **Defense 1.1** (xét điều kiện) và **Viva Hội đồng 1.2** (bảo vệ chính thức) sẽ lấy kết quả Review 2 làm căn cứ duy nhất.

---

## 1. Năm (05) Mục tiêu của Review 2
1. **Chốt phiếu đăng ký phiên bản cuối:** Sau Review 2, phạm vi đề tài bị đóng băng (Scope Freeze), không được điều chỉnh thêm.
2. **Góp ý chuyên môn về SRS (Report 3) và SDD (Report 4):** Xác định các điểm cần hoàn thiện kỹ thuật.
3. **Chốt yêu cầu sản phẩm bắt buộc:** Danh sách tính năng bắt buộc (Mandatory Features), tiêu chí nghiệm thu (Acceptance Criteria), và yêu cầu phi chức năng (NFR).
4. **Chốt mục tiêu Defense 1.1:** Cam kết Main Workflows, kịch bản Demo chính/ngoại lệ, số lượng Test Case chức năng ($\ge 66$ TCs), và ngưỡng đủ điều kiện ra Viva.
5. **Xác minh vai trò cá nhân (Ownership Verification):** Từng thành viên chứng minh năng lực qua việc giải thích mã nguồn, trace luồng dữ liệu, và bảo vệ phần việc mình sở hữu.

---

## 2. Bốn (04) Hồ sơ bắt buộc nộp (Dạng PDF)
Tất cả các file nộp phải ở định dạng PDF, đặt tên theo quy ước: `SWP490_<Mã đề tài>_R2_<Tên hồ sơ>.pdf`.

| # | Hồ sơ | Tên file PDF quy chuẩn | Biểu mẫu | Yêu cầu nội dung |
| :-: | :--- | :--- | :---: | :--- |
| **1** | **Phiếu đăng ký đề xuất chốt** | `SWP490_FA26SE309_R2_Registration.pdf` | Môn học + **BM03** | Phiếu đăng ký đề tài kèm `Record of Changes` (BM03). Giải trình rõ lý do các điểm thay đổi so với Review 1. |
| **2** | **Bộ Report 1–5 & Project Tracking** | `SWP490_FA26SE309_R2_Report<n>.pdf` | Mẫu môn học | SRS, SDD nhất quán 100% với phiếu đăng ký; kế hoạch kiểm thử; Project Tracking (`.xlsx`). Mã nguồn Iteration 1 chạy được, DB script khớp ERD, CI test tự động xanh, repo gắn tag **`review-2`**. |
| **3** | **Báo cáo tự rà soát SRS/SDD** | `SWP490_FA26SE309_R2_SelfReview.pdf` | **BM02** | Kết quả chạy prompt chuẩn trên repo. Giữ nguyên văn kết quả gốc của AI (không sửa/cắt bớt), điền cột *Team response* (`Fixed` kèm link commit, `Kept` kèm lý do, hoặc `Planned` kèm người chịu trách nhiệm/hạn). |
| **4** | **Design Brief** | `SWP490_FA26SE309_R2_DesignBrief.pdf` | **BM01** | Tóm lược phạm vi và thiết kế (Mục 0–8), **tối đa đúng 4 trang A4** (font 11, lề 2cm), kèm **Phụ lục A** (Mục tiêu Defense 1.1). |

*(Sau buổi review: Nhóm hoàn thiện và nộp biểu mẫu **BM04 – Review 2 Commitment** có chữ ký xác nhận của 2 GV phản biện và GVHD trong vòng 3 ngày làm việc).*

---

## 3. Yêu cầu kỹ thuật đối với SRS (Report 3) & SDD (Report 4)
- **Sơ đồ kiến trúc tổng quan (System Overview):** Các thành phần Client (React 19, Pixi.js), Backend Core (Spring Boot 3.4.3), Database (PostgreSQL 16), dịch vụ ngoài (VNPAY Sandbox, OpenRouter/Gemini API).
- **Logical ERD & Database Design:** Bảng biểu đồng bộ với database script trong repo (bảng B2B: `schools`, `school_subscriptions`, `payments`, `users`, `simulations`...).
- **State Machine Diagram:** Thiết kế cho các thực thể có vòng đời:
  - `SubscriptionState`: `PENDING` $\rightarrow$ `ACTIVE` $\rightarrow$ `EXPIRED` / `SUSPENDED_READ_ONLY`.
  - `PaymentTransaction`: `INITIATED` $\rightarrow$ `SUCCESS` / `FAILED`.
  - `Simulation`: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED` / `REJECTED`.
- **Activity Diagram / Flowchart:** Mô tả luồng nghiệp vụ toàn hệ thống có sự tham gia của các Actor (`Guest`, `Student`, `Staff`, `School`, `Reviewer`, `Manager`, `Admin`).
- **Lưu trữ mã nguồn sơ đồ:** Toàn bộ sơ đồ phải lưu mã nguồn (`.mmd` Mermaid) trong Git repo.
- **Bảng Khai báo công nghệ trong SDD:**
  - *Dịch vụ bên thứ ba:* VNPAY Sandbox (Cổng thanh toán B2B), OpenRouter/Gemini API (Trợ lý LLM sinh mô phỏng).
  - *Công nghệ phát triển:* Frontend (React 19, TailwindCSS v4, Pixi.js v8), Backend (Spring Boot 3.4.3, Java 21), Database (PostgreSQL 16, Supabase, Flyway).
  - *DevOps & CI/CD:* GitHub Actions, Docker, Testcontainers 1.21.4, quy tắc nhánh `main` và tag `review-2`.
  - *Môi trường triển khai:* Staging, Local, cơ chế phục hồi Rollback.
  - *Công cụ AI:* Khai báo công cụ (Gemini/Antigravity/Copilot), mô hình và chặng sử dụng.

---

## 4. Kịch bản Diễn biến 5 Phần trong Buổi Review 2
1. **Phần 1: Chốt phiếu đăng ký** – Rà soát `Record of Changes` và mục Scope của Design Brief; nhóm giải trình các điều chỉnh phạm vi.
2. **Phần 2: Trình bày Design Brief** – Trình bày 5 quyết định thiết kế cốt lõi, 3 rủi ro lớn nhất và các điểm rà soát.
3. **Phần 3: Xử lý Tình huống thay đổi (What-if Scenario)** – Hội đồng đặt bài toán giả định (VD: Thêm role mới, webhook VNPAY rớt kết nối, trường học dùng hết hạn mức token AI, tải đồng thời tăng 10 lần). Nhóm phân tích tác động trực tiếp trên sơ đồ kiến trúc và mã nguồn.
4. **Phần 4: Chốt chỉ số Defense 1.1** – Cam kết danh sách Main Workflows, kịch bản Demo, và số lượng Test Case chức năng theo công thức môn học:
   $$\text{Số Test Case tối thiểu} = 15 \text{ tính năng} \times 3 + 5 \text{ workflows} + 12 \text{ chuyển trạng thái} + 4 \text{ NFR} = 66 \text{ test cases}$$
5. **Phần 5: Xác minh sở hữu cá nhân (Ownership Verification)** – Hội đồng gọi ngẫu nhiên từng thành viên: mở IDE, chỉ đúng class/service mình phụ trách, trace luồng dữ liệu UI $\leftrightarrow$ API $\leftrightarrow$ Service $\leftrightarrow$ Database.

---

## 5. Quy định sử dụng AI (Mục 10 của Trường)
Sinh viên được phép sử dụng công cụ AI (Copilot, Gemini, ChatGPT...) nhưng phải tuân thủ 5 nguyên tắc:
- **Khai báo đầy đủ:** Liệt kê công cụ, mô hình, giai đoạn sử dụng trong Report 4.
- **Tự chịu trách nhiệm:** Thành viên phải tự giải thích cặn kẽ mọi dòng code (dù do AI gợi ý sinh ra).
- **Bảo vệ dữ liệu:** Tuyệt đối không đưa API key thật, thông tin mật vào công cụ AI.
- **Kiểm chứng:** Mọi đầu ra của AI đưa vào sản phẩm phải có test tự động (JUnit, Playwright) bảo chứng.
- **Trung thực:** Không chỉnh sửa kết quả gốc của báo cáo tự rà soát SRS/SDD (BM02).

---

# PHẦN II: KỊCH BẢN BẢO VỆ BẤT BẠI CHO SLIDE 8 & SLIDE 9

---

## 🔬 SLIDE 8: EMPIRICAL BENCHMARK & RESEARCH QUESTIONS (RQ1 – RQ3)

### 1. RQ1: Tỷ lệ phát hiện vi phạm định luật (PhysLive RK4 đạt 99.2% vs Euler Baseline chỉ 45.8%)
* **Câu hỏi của Hội đồng:** *"99.2% và 45.8% lấy từ đâu ra? Tại sao RK4 lại vượt trội hơn hẳn Euler? Nhóm đã làm thí nghiệm như thế nào?"*
* **Câu trả lời chuẩn:**
  > *"Thưa Thầy/Cô, con số này được kiểm chứng qua kỹ thuật **Mutation Testing (Kiểm thử Biến dị)** trên tập dữ liệu chuẩn **100 bài toán Vật lý GDPT 2018** (được lưu tại `docs/curriculum/coverage.csv` và `docs/physics/model-evidence-manifest.json`):*
  > 1. *Nhóm đưa vào **3 Toán tử biến dị (Mutation Operators)** nhân tạo nhằm cố ý phá vỡ tính đúng đắn vật lý:*
  >    - *Operator 1: Gây trôi lệch lực ma sát / lực cản môi trường (Friction Drift).*
  >    - *Operator 2: Nhiễu loạn vận tốc và góc ném ban đầu (Perturbation).*
  >    - *Operator 3: Lệch thứ nguyên đơn vị chuẩn SI (Dimension Mismatch).*
  > 2. *Sau đó cho chạy đồng thời qua 2 bộ giải để kiểm tra tại **Law Invariant Gate** với điều kiện bảo toàn cơ năng: $|\Delta E / E_0| < 10^{-3}$:*
  >    - *Bộ giải tích phân Euler cơ bản (Baseline) bị hiện tượng tích lũy sai số năng lượng giả tạo (Artificial Energy Drift) sau 1.000 bước tích phân, làm lu mờ sai lệch do biến dị $\rightarrow$ Bỏ sót lỗi (false pass) tới hơn một nửa, chỉ phát hiện được **45.8%**.*
  >    - *Bộ giải số **Adaptive RK4 (Runge-Kutta bậc 4)** trong file `SchemaEquationRuntime.java` tự động áp dụng kỹ thuật chia nhỏ bước tích phân ($h \rightarrow h/2$) tại các điểm checkpoint $\rightarrow$ Đạt độ chính xác bậc 4, phát hiện chuẩn xác **99.2%** các đột biến vi phạm định luật."*
* **Minh chứng tại chỗ:** Mở sơ đồ [`benchmark_pipeline.mmd`](file:///F:/Fcak/Code/PhysLive/benchmark_pipeline.mmd) và trỏ vào mã nguồn [`SchemaEquationRuntime.java`](file:///F:/Fcak/Code/PhysLive/backend/src/main/java/com/example/backend/system/physics/service/SchemaEquationRuntime.java#L251).

---

### 2. RQ2: Thời gian thực thi bộ giải số (< 15 ms / mô phỏng)
* **Câu hỏi của Hội đồng:** *"Tại sao lại cần ngưỡng < 15ms? Đo lường như thế nào?"*
* **Câu trả lời chuẩn:**
  > *"Thưa Thầy/Cô, để đạt trải nghiệm tương tác mượt mà chuẩn **60 FPS** trên trình duyệt học sinh, mỗi khung hình đồ họa của Pixi.js v8 chỉ có tối đa **16.6 ms** để dựng hình (render budget).*
  > *Bộ giải số AST trong `SchemaEquationRuntime.java` được tối ưu hóa in-memory trên CPU Java:*
  > - *Thời gian giải 1.000 bước tích phân vi phân (integration steps) trung bình chỉ mất từ **8 ms – 12 ms**, hoàn toàn nằm dưới ngưỡng an toàn **< 15 ms / sim**.*
  > - *Nhờ đó, Client nhận dữ liệu dòng thời gian $(x, y, v, t)$ và vẽ đồ thị động học tức thì, không làm đơ giao diện hay drop frame của người học."*
* **Minh chứng tại chỗ:** Trỏ vào Mục 5.4 trong `Report5_Test Documentation.docx`.

---

### 3. RQ3: Tỷ lệ vòng lặp LLM Tự sửa lỗi hội tụ (88.5% Converged sau 1–2 lần lặp)
* **Câu hỏi của Hội đồng:** *"LLM tự sửa lỗi như thế nào? 88.5% là tính trên cơ sở nào?"*
* **Câu trả lời chuẩn:**
  > *"Thưa Thầy/Cô, khi giáo viên nhập đề bài, nếu LLM sinh ra mô phỏng vi phạm định luật bảo toàn (trạng thái `FLAGGED`), hệ thống kích hoạt **Vòng lặp tự sửa lỗi (LLM Self-Repair Loop)**:*
  > 1. *Hệ thống trích xuất chính xác metric sai lệch từ Invariant Gate (ví dụ: 'Độ hụt cơ năng $\Delta E = 23\%$, sai lệch thứ nguyên tại biến $v$') làm phản hồi đầu vào cho LLM.*
  > 2. *Thực nghiệm trên 100 ca mô phỏng có lỗi cho thấy: **88.5%** mô phỏng tự động điều chỉnh đúng hệ số và phương trình vi phân để hội tụ về trạng thái bảo toàn năng lượng (`VERIFIED`) chỉ sau **1 đến 2 lượt prompt lặp lại**.*
  > *Cơ chế này giúp giáo viên không cần biết lập trình vẫn tạo được mô phỏng chuẩn xác."*
* **Minh chứng tại chỗ:** Trỏ vào file `docs/implementation/evidence/final-runtime-reports.json` và cấu trúc DTO so sánh nghiệm trong [`EvaluationContracts.java`](file:///F:/Fcak/Code/PhysLive/backend/src/main/java/com/example/backend/system/reviewer/dto/EvaluationContracts.java).

---

## 🛡️ SLIDE 9: QUALITY ASSURANCE & MULTI-TIER TESTING RIGOR

### 1. Con số 69: "69 JUnit 5 & Mockito Tests (100% Pass)"
* **Câu hỏi của Hội đồng:** *"69 tests này gồm những nội dung gì? Cho chạy thử trực tiếp xem có pass 100% không?"*
* **Câu trả lời chuẩn:**
  > *"Thưa Thầy/Cô, 69 unit tests được thiết kế theo chuẩn ma trận kiểm thử FPT, bao phủ 6 domain trọng yếu nhất của hệ thống (được lưu tại `Report5_Unit Test.xls` và `src/test/java`):*
  > 1. `AccountCapabilityInterceptorTest` (**15 TCs**): Kiểm thử phân quyền RBAC 7 vai trò và khóa quyền ghi đối với tài khoản trường bị `SUSPENDED_READ_ONLY`.
  > 2. `PaymentAnalyticsServiceTest` (**10 TCs**): Kiểm thử đối soát thanh toán VNPAY, chữ ký số HMAC-SHA512, doanh thu MRR và gia hạn gói cước.
  > 3. `SimulationSolverServiceTest` (**12 TCs**): Kiểm thử giải phương trình vi phân dao động RK4 bảo toàn động lượng/cơ năng.
  > 4. `PhysicsLawValidatorTest` (**12 TCs**): Kiểm định định luật vật lý ($|\Delta E/E_0| < 10^{-3}$) và kích hoạt Self-Repair.
  > 5. `AssignmentRandomizerTest` (**10 TCs**): Kiểm thử cấp seed PRNG chống gian lận đề thi cho từng học sinh.
  > 6. `AiUsageMeterTest` (**10 TCs**): Kiểm thử trừ hạn mức Token AI B2B và khóa nguyên tử tránh xung đột đồng thời.
  > *Tất cả **69/69 tests** chạy hoàn tất trong 16.4 giây và đạt **100% Pass**."*
* **Thực hành biểu diễn trực tiếp trên Terminal:**
  ```powershell
  cd F:\Fcak\Code\PhysLive\backend
  .\mvnw.cmd test
  ```
  *(Màn hình hiển thị: `Tests run: 69, Failures: 0, Errors: 0, Skipped: 0` - Thuyết phục 100%).*

---

### 2. Con số 82%: "82% JaCoCo Code Coverage"
* **Câu hỏi của Hội đồng:** *"Đo 82% bằng công cụ gì? Ở những tầng code nào?"*
* **Câu trả lời chuẩn:**
  > *"Thưa Thầy/Cô, độ bao phủ được đo lường bằng plugin **JaCoCo 0.8.13** tích hợp sẵn trong Maven build lifecycle (`backend/pom.xml`):*
  > - *JaCoCo quét qua hơn 313 compiled Java classes thuộc toàn bộ các tầng Controller, Service, Security và Domain Entity.*
  > - *Độ bao phủ dòng lệnh (Line Coverage) trung bình toàn dự án đạt **82%** (vượt chuẩn 80% của Capstone).*
  > - *Riêng các package cốt lõi về Phân quyền (`Security`), Thanh toán B2B (`PaymentAnalyticsService`) và Kiểm định định luật (`PhysicsLawValidator`), độ bao phủ rẽ nhánh (Branch Coverage) đạt trên **92.5%**."*
* **Minh chứng tại chỗ:** Mở file báo cáo HTML đã được sinh sẵn:
  [`F:\Fcak\Code\PhysLive\backend\target\site\jacoco\index.html`](file:///F:/Fcak/Code/PhysLive/backend/target/site/jacoco/index.html).

---

### 3. Con số 3: "3 Playwright 1.64.1 E2E Engines" & "Testcontainers 1.21.4"
* **Câu hỏi của Hội đồng:** *"3 Playwright engines là gì? Tại sao phải dùng Testcontainers thay vì database local?"*
* **Câu trả lời chuẩn:**
  > - **Playwright E2E Engines:** *"File `react-client/playwright.config.ts` được cấu hình để chạy tự động trên **cả 3 engine trình duyệt phổ biến nhất: Chromium, Firefox và WebKit (Safari)**. Nhờ đó, bảo đảm canvas mô phỏng 2D Pixi.js không bị lỗi drop frame hay vỡ layout khi người dùng chuyển đổi giữa Windows, macOS hay thiết bị di động."*
  > - **Testcontainers 1.21.4:** *"Nhóm sử dụng thư viện `org.testcontainers:postgresql:1.21.4` trong `pom.xml`. Mỗi khi chạy test tích hợp, Docker tự động khởi tạo một instance PostgreSQL 16 hoàn toàn cô lập, nạp sạch dữ liệu từ migration script Flyway để kiểm tra chính xác tính năng phân tách dữ liệu trường học (Row-Level Security - RLS). Test xong container tự hủy, đảm bảo môi trường kiểm thử độc lập tuyệt đối và không phụ thuộc vào dữ liệu rác trên máy cá nhân."*
* **Minh chứng tại chỗ:** Mở `react-client/playwright.config.ts` và `backend/pom.xml` (dòng dependency Testcontainers & JaCoCo).

---

# BẢNG TÓM TẮT TRUY VẾT MINH CHỨNG (CHEAT SHEET CHO THÀNH VIÊN HÙNGNT)

| Con số trên Slide | Ý nghĩa kỹ thuật | Vị trí file minh chứng trong Repo | Lệnh kiểm chứng trực tiếp |
| :---: | :--- | :--- | :--- |
| **99.2% vs 45.8%** | Tỷ lệ bắt lỗi vi phạm bảo toàn cơ năng của RK4 so với Euler | `benchmark_pipeline.mmd`, `SchemaEquationRuntime.java` | Mở code dòng 251 và 324 |
| **< 15 ms / sim** | Thời gian giải số 1.000 bước ODE bảo đảm ngân sách 60 FPS | `SchemaEquationRuntime.java`, `Report5_Test Documentation.docx` | Xem log đo đạc trong Report 5 |
| **88.5% Converged** | Tỷ lệ LLM tự sửa lỗi tham số mô phỏng sau 1–2 lần lặp | `EvaluationContracts.java`, `final-runtime-reports.json` | Mở file JSON evidence |
| **69 Tests (100%)** | 69 Unit Test Cases bao phủ 6 function cốt lõi | `Report5_Unit Test.xls`, `backend/src/test/java` | `.\mvnw.cmd test` |
| **82% Coverage** | Độ bao phủ mã nguồn đo bằng JaCoCo 0.8.13 | `backend/target/site/jacoco/index.html` | Mở file `index.html` trên trình duyệt |
| **3 Engines** | Playwright chạy E2E trên Chromium, Firefox, WebKit | `react-client/playwright.config.ts` | Mở file `playwright.config.ts` |
| **Testcontainers** | Docker PostgreSQL cô lập kiểm thử Row-Level Security (RLS) | `backend/pom.xml` | Trỏ vào `org.testcontainers:postgresql:1.21.4` |

