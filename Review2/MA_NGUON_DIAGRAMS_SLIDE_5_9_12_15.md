# TỔNG HỢP MÃ NGUỒN MERMAID CÁC SƠ ĐỒ CHO SLIDE (5, 9, 12, 13, 14, 15)
> **Dự án:** PhysLive – Nền tảng Mô phỏng Vật lý Tương tác (GDPT 2018)  
> **Hướng dẫn sử dụng Draw.io:**  
> 1. Mở [draw.io](https://app.diagrams.net/).  
> 2. Chọn menu: **Arrange** ➔ **Insert** ➔ **Advanced** ➔ **Mermaid**.  
> 3. Dán mã nguồn tương ứng bên dưới vào ➔ Nhấn **Insert**.  
> 4. Xuất ảnh: **File** ➔ **Export as** ➔ **PNG** (Chọn *Transparent Background*, 300 DPI) ➔ Dán đè vào slide PowerPoint.  

---

# 1. SLIDE 5: SƠ ĐỒ KIẾN TRÚC HỆ THỐNG ĐƠN GIẢN (SIMPLE ARCHITECTURE)
*(Tách biệt 4 tầng công nghệ theo đúng góp ý của Thầy Phúc: Frontend, Backend, Database/Storage, và Third-Party Services).*

```mermaid
flowchart TD
    classDef client fill:#EFF6FF,stroke:#3B82F6,stroke-width:2px,color:#1E3A8A;
    classDef server fill:#F0FDF4,stroke:#22C55E,stroke-width:2px,color:#14532D;
    classDef db fill:#FEF3C7,stroke:#F59E0B,stroke-width:2px,color:#78350F;
    classDef ext fill:#F5F3FF,stroke:#8B5CF6,stroke-width:2px,color:#4C1D95;

    subgraph ClientTier ["1. FRONTEND TIER (React 19 SPA - Port 5173)"]
        UI["React 19 + Vite 7<br/>TailwindCSS v4 & Radix UI"]
        CanvasPlayer["Interactive Player<br/>Pixi.js v8 (WebGL/WebGPU 60 FPS)"]
        ClientRuntime["equations.ts<br/>(Client-Side Lightweight Ast Solver)"]
        UI --- CanvasPlayer --- ClientRuntime
    end

    subgraph BackendTier ["2. APPLICATION TIER (Spring Boot Core - Port 8080)"]
        Security["Spring Security<br/>Stateless JWT Filter & RBAC"]
        Controllers["REST API Controllers<br/>(Simulation, School, Payment, Support)"]
        SolverService["SchemaEquationRuntime.java<br/>(Adaptive RK4 Numerical Solver)"]
        LawGate["PhysicsLawValidator.java<br/>(Invariant Gate: |ΔE/E₀| < 10⁻³)"]
        QuotaMeter["AiUsageMeter.java<br/>(Atomic Token Locking & B2B Quota)"]
        Security --> Controllers --> SolverService --> LawGate
        Controllers --> QuotaMeter
    end

    subgraph DataTier ["3. DATA & PERSISTENCE TIER (Supabase Cloud)"]
        Postgres["PostgreSQL 16 Database (Flyway V1 - V55)"]
        Pooler["Supabase Transaction Pooler (Port 6543 / 5432)"]
        RLS["Row-Level Security (RLS) School Data Isolation"]
        Postgres --- Pooler --- RLS
    end

    subgraph ExternalTier ["4. THIRD-PARTY SERVICES TIER"]
        VNPAY["VNPAY Sandbox Gateway (IPN Webhook HMAC-SHA512)"]
        AI_API["AI Provider APIs (OpenRouter / Gemini 2.5 Pro)"]
    end

    ClientTier <== "HTTPS / REST API" ==> Security
    Controllers <== "Spring Data JPA" ==> Pooler
    Controllers <== "IPN Payment Notification" ==> VNPAY
    Controllers <== "OCR & Problem Ingestion" ==> AI_API
```

---

# 2. SLIDE 9: SƠ ĐỒ ERD KHÁI NIỆM (CHỈ SHOW QUAN HỆ - HOÀN TOÀN KHÔNG CÓ THUỘC TÍNH)
*(Đúng chuẩn yêu cầu của Thầy Phúc và hình mẫu Master gửi: CHỈ hiển thị tên các Thực thể và đường nối Quan hệ, không sinh bảng thuộc tính chi tiết).*

### Cách 1: Mã Mermaid ERD Chuẩn (Không thuộc tính)
```mermaid
erDiagram
    SCHOOL ||--o{ USER : "enrols"
    SCHOOL ||--o{ SUBSCRIPTION : "purchases"
    SUBSCRIPTION ||--o{ PAYMENT : "billed_by"
    USER ||--o{ SIMULATION : "creates"
    USER ||--o{ ASSIGNMENT : "assigns"
    ASSIGNMENT ||--o{ SUBMISSION : "receives"
    USER ||--o{ SUBMISSION : "submits"
    SIMULATION ||--o{ ASSIGNMENT : "embedded_in"
    USER ||--o{ SUPPORT_ITEM : "reports"
```

### Cách 2: Mã Mermaid Flowchart (Dạng các khối thẻ màu trực quan đẹp mắt trên Draw.io)
*(Nếu Master muốn hình hộp có icon màu sắc tương phản rõ nét để thuyết trình):*
```mermaid
flowchart TD
    classDef ent fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,font-weight:bold,color:#1E3A8A;

    SCHOOL["🏫 SCHOOL"]:::ent
    USER["👤 USER"]:::ent
    SUBSCRIPTION["📋 SUBSCRIPTION"]:::ent
    PAYMENT["💳 PAYMENT"]:::ent
    SIMULATION["⚡ SIMULATION"]:::ent
    ASSIGNMENT["📝 ASSIGNMENT"]:::ent
    SUBMISSION["📤 SUBMISSION"]:::ent
    SUPPORT_ITEM["🛠️ SUPPORT_ITEM"]:::ent

    SCHOOL -->|1 : N (enrols)| USER
    SCHOOL -->|1 : N (purchases)| SUBSCRIPTION
    SUBSCRIPTION -->|1 : N (billed_by)| PAYMENT
    USER -->|1 : N (creates)| SIMULATION
    USER -->|1 : N (assigns)| ASSIGNMENT
    ASSIGNMENT -->|1 : N (receives)| SUBMISSION
    USER -->|1 : N (submits)| SUBMISSION
    SIMULATION -->|1 : N (embedded_in)| ASSIGNMENT
    USER -->|1 : N (reports)| SUPPORT_ITEM
```

---

# 3. SLIDE 12: CORE FLOW 1 (VIETNHB) - SIMULATION LIFECYCLE
*(Vòng đời mô phỏng: từ ảnh đề bài SGK ➔ trích xuất tham số ➔ kiểm định RK4 ➔ AI tự sửa lỗi ➔ xuất bản cộng đồng).*

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Teacher Inputs Text / OCR Image
    
    DRAFT --> NEEDS_CLARIFICATION : Ambiguity Detected (Missing k, m, etc.)
    NEEDS_CLARIFICATION --> DRAFT : Teacher Selects Assumption Chips
    
    DRAFT --> PARSED_SPEC : AI Extracts Quantities & Builds AST
    
    PARSED_SPEC --> RK4_SOLVING : Trigger Adaptive RK4 Solver
    
    RK4_SOLVING --> VERIFIED : [|ΔE/E₀| < 10⁻³] Law Invariant Verified
    RK4_SOLVING --> FLAGGED : [|ΔE/E₀| ≥ 10⁻³] Energy Invariant Violated
    
    FLAGGED --> PARSED_SPEC : AI Self-Correction Loop (Auto-fix formula)
    
    VERIFIED --> SAVED_TO_LIBRARY : Render 2D Canvas (60 FPS)
    SAVED_TO_LIBRARY --> [*] : Ready for Classroom Teaching
```

---

# 4. SLIDE 13: CORE FLOW 2 (HUNGNT) - SUBSCRIPTION & QUOTA LIFECYCLE
*(Vòng đời thuê bao B2B, thanh toán VNPAY IPN, phân phối Quota Token AI nguyên tử và xử lý tranh chấp khiếu nại).*

```mermaid
stateDiagram-v2
    [*] --> REGISTERED : School Signs Up on B2B Portal
    
    REGISTERED --> PENDING_PAYMENT : Select B2B Plan & Redirect to VNPAY
    
    PENDING_PAYMENT --> REGISTERED : [Cancelled / Timeout] Return to Cart
    PENDING_PAYMENT --> ACTIVE : [VNPAY IPN HMAC-SHA512 Verified] Allocate Monthly AI Quota
    
    ACTIVE --> QUOTA_EXHAUSTED : [Atomic Balance <= 0] Lock AI Ingestion
    QUOTA_EXHAUSTED --> ACTIVE : Monthly Reset / Manager Quota Top-up
    
    ACTIVE --> NEAR_EXPIRY : [Auto Alert] 15 Days Before Contract End
    NEAR_EXPIRY --> ACTIVE : Annual Renewal Payment Success
    
    NEAR_EXPIRY --> SUSPENDED_READ_ONLY : [Grace Period Expired] Lock POST/PUT APIs
    
    SUSPENDED_READ_ONLY --> UNDER_REVIEW : School Files Billing Complaint Ticket
    UNDER_REVIEW --> ACTIVE : Manager Resolves & Restores Quota
    
    SUSPENDED_READ_ONLY --> ACTIVE : Overdue Invoice Paid via VNPAY
    SUSPENDED_READ_ONLY --> [*] : Contract Terminated / School Offboarded
```

---

# 5. SLIDE 14: CORE FLOW 3 (MINHTB) - MODERATION & COMPLAINT LIFECYCLE
*(Vòng đời duyệt bài cộng đồng & luồng tiếp nhận báo lỗi mô phỏng: Giáo viên báo lỗi ➔ Manager tiền trạm ➔ Reviewer thẩm định chuyên môn ➔ Hoàn tất).*

```mermaid
stateDiagram-v2
    [*] --> TICKET_OPENED : User Submits Support / Bug Ticket
    
    TICKET_OPENED --> ADMIN_TRIAGE : [Target: Manager Account] Direct to Admin
    ADMIN_TRIAGE --> TICKET_RESOLVED : Admin Audits & Resolves Account Appeal
    
    TICKET_OPENED --> MANAGER_TRIAGE : [General / Simulation Bug] Sent to Manager Desk
    
    MANAGER_TRIAGE --> TICKET_RESOLVED : [Billing / Account Issue] Manager Resolves Directly
    MANAGER_TRIAGE --> REFERRED_TO_REVIEWER : [Simulation Physics Bug] Manager Clicks "Chuyển Reviewer"
    
    REFERRED_TO_REVIEWER --> REVIEWER_INVESTIGATING : Reviewer Accesses Desk & Inspects RK4 Model
    
    REVIEWER_INVESTIGATING --> TICKET_RESOLVED : Reviewer Verifies Physics Law & Adds Resolution Notes
    
    TICKET_RESOLVED --> TICKET_CLOSED : Manager Reviews Conclusion, Sends Feedback & Closes
    
    TICKET_CLOSED --> [*] : User Receives Notification & Ticket Archived
```

---

# 6. SLIDE 15: CORE FLOW 4 (KIETVTT) - ASSIGNMENT & STUDENT POE LIFECYCLE
*(Vòng đời giao bài và học sinh làm bài tập theo mô hình POE: Dự đoán ➔ Quan sát 60 FPS ➔ Giải thích ➔ Tự động chấm điểm).*

```mermaid
stateDiagram-v2
    [*] --> DRAFT_ASSIGNMENT : Teacher Selects Simulation & Prepares Rubric
    
    DRAFT_ASSIGNMENT --> PUBLISHED : Publish to Class (Randomized PRNG Seeds)
    DRAFT_ASSIGNMENT --> ARCHIVED : Cancel / Delete Draft
    ARCHIVED --> [*]
    
    PUBLISHED --> OVERDUE_MISSED : [Deadline Expired] Unsubmitted
    OVERDUE_MISSED --> [*] : Mark Incomplete
    
    PUBLISHED --> STEP_PREDICT : Student Starts Task (Canvas Run Locked)
    
    STEP_PREDICT --> STEP_OBSERVE : [Prediction Submitted] Unlock 2D Canvas (60 FPS)
    
    STEP_OBSERVE --> STEP_EXPLAIN : Observe Graphs & Formulate Explanation
    STEP_EXPLAIN --> STEP_OBSERVE : [Need More Data] Re-run Simulation with New Variables
    
    STEP_EXPLAIN --> SUBMISSION_DELIVERED : Submit Final POE Scientific Report
    
    SUBMISSION_DELIVERED --> PENDING_TEACHER_REVIEW : [Subjective Essay] AI Generates Rubric Suggestion
    SUBMISSION_DELIVERED --> AUTO_GRADED : [Objective Kinematics] System Auto-Scoring
    
    PENDING_TEACHER_REVIEW --> GRADED_PUBLISHED : Teacher Confirms Score & Feedback
    AUTO_GRADED --> GRADED_PUBLISHED : Score Merged
    
    GRADED_PUBLISHED --> REGRADE_APPEAL : Student Queries Rubric / Feedback
    REGRADE_APPEAL --> GRADED_PUBLISHED : Teacher Reviews Appeal & Adjusts
    
    GRADED_PUBLISHED --> [*] : Student Reviews Report & Record Closed
```
