import sys
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_presentation(output_path):
    prs = pptx.Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette
    DARK_BG = RGBColor(11, 15, 25)       # #0B0F19
    LIGHT_BG = RGBColor(248, 250, 252)   # #F8FAFC
    WHITE_BG = RGBColor(255, 255, 255)   # #FFFFFF
    PRIMARY_BLUE = RGBColor(37, 99, 235) # #2563EB
    DARK_TEXT = RGBColor(15, 23, 42)     # #0F172A
    MUTED_TEXT = RGBColor(100, 116, 139) # #64748B
    CARD_BG = RGBColor(255, 255, 255)    # #FFFFFF
    BORDER_COLOR = RGBColor(226, 232, 240) # #E2E8F0
    ACCENT_GREEN = RGBColor(16, 185, 129)# #10B981
    PLACEHOLDER_BG = RGBColor(241, 245, 249) # #F1F5F9
    PLACEHOLDER_BORDER = RGBColor(148, 163, 184) # #94A3B8

    def set_slide_background(slide, color):
        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = color

    def add_header(slide, tracker_text, title_text, dark=False):
        # Tracker category
        tb1 = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.35))
        p1 = tb1.text_frame.paragraphs[0]
        p1.text = tracker_text.upper()
        p1.font.name = "Arial"
        p1.font.size = Pt(11)
        p1.font.bold = True
        p1.font.color.rgb = PRIMARY_BLUE if not dark else RGBColor(96, 165, 250)

        # Main slide title
        tb2 = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.7), Inches(0.6))
        p2 = tb2.text_frame.paragraphs[0]
        p2.text = title_text
        p2.font.name = "Arial"
        p2.font.size = Pt(22)
        p2.font.bold = True
        p2.font.color.rgb = DARK_TEXT if not dark else RGBColor(248, 250, 252)

    def add_diagram_placeholder(slide, subtitle_text, diagram_label):
        # Subtitle description
        tb_sub = slide.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(11.7), Inches(0.4))
        p_sub = tb_sub.text_frame.paragraphs[0]
        p_sub.text = subtitle_text
        p_sub.font.name = "Arial"
        p_sub.font.size = Pt(13)
        p_sub.font.color.rgb = MUTED_TEXT

        # Diagram box placeholder
        box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(2.0), Inches(11.733), Inches(4.9))
        box.fill.solid()
        box.fill.fore_color.rgb = PLACEHOLDER_BG
        box.line.color.rgb = PLACEHOLDER_BORDER
        box.line.width = Pt(1.5)

        tf = box.text_frame
        tf.word_wrap = True
        p_center = tf.paragraphs[0]
        p_center.text = f"📷 [ KHUNG DÁN SƠ ĐỒ {diagram_label.upper()} TỪ DRAW.IO ]"
        p_center.alignment = PP_ALIGN.CENTER
        p_center.font.name = "Arial"
        p_center.font.size = Pt(18)
        p_center.font.bold = True
        p_center.font.color.rgb = PRIMARY_BLUE

        p_desc = tf.add_paragraph()
        p_desc.text = "Hướng dẫn: Xuất sơ đồ từ Draw.io (định dạng PNG 300 DPI hoặc SVG) và dán đè vào vị trí khung này."
        p_desc.alignment = PP_ALIGN.CENTER
        p_desc.font.name = "Arial"
        p_desc.font.size = Pt(12)
        p_desc.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 1: TITLE SLIDE (Dark Theme)
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1, DARK_BG)

    tb = s1.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.3), Inches(0.4))
    p = tb.text_frame.paragraphs[0]
    p.text = "SEP490 REVIEW 2 • FA26SE309 • GFA26SE173 • 05/11/2026"
    p.font.name = "Arial"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = RGBColor(96, 165, 250)

    tb = s1.shapes.add_textbox(Inches(1.0), Inches(1.3), Inches(11.3), Inches(1.2))
    p = tb.text_frame.paragraphs[0]
    p.text = "PHYSLIVE – INTERACTIVE PHYSICS SIMULATION PLATFORM"
    p.font.name = "Arial"
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = RGBColor(255, 255, 255)

    tb = s1.shapes.add_textbox(Inches(1.0), Inches(2.6), Inches(11.3), Inches(0.8))
    p = tb.text_frame.paragraphs[0]
    p.text = "The Educational Support Platform for High School Teachers with Automated Physics Law Verification & AI Support"
    p.font.name = "Arial"
    p.font.size = Pt(15)
    p.font.color.rgb = RGBColor(148, 163, 184)

    tb = s1.shapes.add_textbox(Inches(1.0), Inches(3.6), Inches(11.3), Inches(0.5))
    p = tb.text_frame.paragraphs[0]
    p.text = "Supervisor: M.Sc. Nguyen Tan Phuc"
    p.font.name = "Arial"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = RGBColor(226, 232, 240)

    members = [
        ("Nguyen Hoang Bao Viet", "SE183457 • Leader & AI Solver"),
        ("Tran Bao Minh", "SE184103 • Fullstack & RK4 Core"),
        ("Nguyen The Hung", "SE183807 • BA/QA Lead & B2B"),
        ("Vo Tran Tuan Kiet", "SE182808 • Fullstack & Classroom")
    ]
    for idx, (m_name, m_role) in enumerate(members):
        left = Inches(1.0 + idx * 2.85)
        card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(4.5), Inches(2.7), Inches(1.8))
        card.fill.solid()
        card.fill.fore_color.rgb = RGBColor(24, 33, 47)
        card.line.color.rgb = RGBColor(51, 65, 85)
        tf = card.text_frame
        p1 = tf.paragraphs[0]
        p1.text = m_name
        p1.font.name = "Arial"
        p1.font.size = Pt(13)
        p1.font.bold = True
        p1.font.color.rgb = RGBColor(255, 255, 255)
        p2 = tf.add_paragraph()
        p2.text = m_role
        p2.font.name = "Arial"
        p2.font.size = Pt(10)
        p2.font.color.rgb = RGBColor(148, 163, 184)

    # ==========================================
    # SLIDE 2: 2018 CURRICULUM TAXONOMY
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2, LIGHT_BG)
    add_header(s2, "01 • 3-Tier Curriculum Taxonomy", "2018 National Curriculum Alignment & Topic Structure")

    curriculum_cards = [
        ("Content Hierarchy", "Topic ➔ Module ➔ Grade Level ➔ Simulation Lesson.", "Strict alignment with Circular 32/2018/TT-BGDĐT across High School Physics."),
        ("Bilingual Taxonomy (V54)", "The localized_name JSONB field stores both Vietnamese & English names.", "Full bilingual support for international schools and national curriculum programs."),
        ("Current Scope (Review 2)", "Grade 10-11 Mechanics & DC Circuits.", "Kinematics, Projectiles, Newton's Laws, Mechanical Energy, and DC Series/Parallel Circuits."),
        ("Council 1.1 Expansion", "Harmonic Waves, Optics & Thermodynamics.", "Expanding to AC RLC Circuits, Wave Interference, and Ideal Gas Law simulations.")
    ]
    for idx, (c_title, c_sub, c_desc) in enumerate(curriculum_cards):
        left = Inches(0.8 + (idx % 2) * 5.95)
        top = Inches(1.8 + (idx // 2) * 2.5)
        card = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.75), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = c_title
        p.font.name = "Arial"
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_BLUE
        p2 = tf.add_paragraph()
        p2.text = c_sub
        p2.font.name = "Arial"
        p2.font.size = Pt(12)
        p2.font.bold = True
        p2.font.color.rgb = DARK_TEXT
        p3 = tf.add_paragraph()
        p3.text = c_desc
        p3.font.name = "Arial"
        p3.font.size = Pt(11)
        p3.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 3: CONTEXT & PROBLEMS
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3, LIGHT_BG)
    add_header(s3, "02 • Context & Problems", "The Gap Between Physics Labs & Generative AI")

    # Left Column: 3 Challenges
    left_card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(6.8), Inches(4.9))
    left_card.fill.solid()
    left_card.fill.fore_color.rgb = CARD_BG
    left_card.line.color.rgb = BORDER_COLOR
    tf = left_card.text_frame
    p = tf.paragraphs[0]
    p.text = "3 Major Current Challenges in Physics Education"
    p.font.name = "Arial"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = DARK_TEXT

    challenges = [
        ("Lack of Lab Equipment", "High procurement and maintenance costs prevent schools from having fully functional modern physics laboratories."),
        ("Rigid Legacy Tools (PhET, Algodoo)", "Fixed, pre-baked scenarios. Teachers cannot dynamically generate new interactive labs from textbook exam questions."),
        ("AI Code Hallucination", "Raw code generated by AI models frequently breaks energy conservation laws, introduces artificial drift, and violates SI units.")
    ]
    for ch_title, ch_desc in challenges:
        p_t = tf.add_paragraph()
        p_t.text = f"• {ch_title}: "
        p_t.font.name = "Arial"
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = PRIMARY_BLUE
        p_d = tf.add_paragraph()
        p_d.text = f"   {ch_desc}"
        p_d.font.name = "Arial"
        p_d.font.size = Pt(11)
        p_d.font.color.rgb = MUTED_TEXT

    # Right Column: The PhysLive Solution
    right_card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.8), Inches(1.8), Inches(4.7), Inches(4.9))
    right_card.fill.solid()
    right_card.fill.fore_color.rgb = RGBColor(239, 246, 255)
    right_card.line.color.rgb = RGBColor(191, 219, 254)
    tf2 = right_card.text_frame
    p = tf2.paragraphs[0]
    p.text = "THE PHYSLIVE SOLUTION"
    p.font.name = "Arial"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE

    p_stat = tf2.add_paragraph()
    p_stat.text = "100%"
    p_stat.font.name = "Arial"
    p_stat.font.size = Pt(40)
    p_stat.font.bold = True
    p_stat.font.color.rgb = PRIMARY_BLUE

    p_stat_desc = tf2.add_paragraph()
    p_stat_desc.text = "Scientific Law Accuracy Guaranteed"
    p_stat_desc.font.name = "Arial"
    p_stat_desc.font.size = Pt(13)
    p_stat_desc.font.bold = True
    p_stat_desc.font.color.rgb = DARK_TEXT

    p_sol = tf2.add_paragraph()
    p_sol.text = "\nTurns any textbook exercise photo into a scientifically verified 2D interactive simulation in seconds.\n\nCombines AI ingestion with deterministic Runge-Kutta 4th order (RK4) numerical solving to enforce physical invariants."
    p_sol.font.name = "Arial"
    p_sol.font.size = Pt(11)
    p_sol.font.color.rgb = DARK_TEXT

    # ==========================================
    # SLIDE 4: SYSTEM ARCHITECTURE PRINCIPLES
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4, LIGHT_BG)
    add_header(s4, "03 • System Architecture", "Core Architectural Principles: Dual-Runtime & Invariant Gate")

    arch_cols = [
        ("CLIENT-SIDE RUNTIME", "equations.ts + Pixi.js v8", [
            ("~0ms Latency", "Runs simulation solving directly inside the browser using lightweight numerical AST."),
            ("60 FPS Smooth Canvas", "Hardware-accelerated WebGL / WebGPU 2D rendering with dynamic vectors."),
            ("Zero Server Load", "Dragging parameter sliders updates trajectories locally without continuous API calls.")
        ]),
        ("SERVER-SIDE CERTIFICATION", "SchemaEquationRuntime.java", [
            ("Adaptive RK4 Solver", "Spring Boot executes 4th-order Runge-Kutta numerical integration with sub-stepping."),
            ("Physics Law Gate", "Enforces mechanical energy conservation |ΔE/E₀| < 10⁻³ and SI dimension checks."),
            ("AI Self-Correction", "Automated feedback loop rectifies flawed parameters into VERIFIED_BY_LAWS.")
        ])
    ]
    for idx, (col_title, col_sub, col_items) in enumerate(arch_cols):
        left = Inches(0.8 + idx * 5.95)
        card = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(1.8), Inches(5.75), Inches(4.9))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = col_title
        p.font.name = "Arial"
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_BLUE
        p_sub = tf.add_paragraph()
        p_sub.text = col_sub
        p_sub.font.name = "Arial"
        p_sub.font.size = Pt(12)
        p_sub.font.bold = True
        p_sub.font.color.rgb = DARK_TEXT
        for it_title, it_desc in col_items:
            pt = tf.add_paragraph()
            pt.text = f"• {it_title}: "
            pt.font.name = "Arial"
            pt.font.size = Pt(12)
            pt.font.bold = True
            pt.font.color.rgb = DARK_TEXT
            pd = tf.add_paragraph()
            pd.text = f"   {it_desc}"
            pd.font.name = "Arial"
            pd.font.size = Pt(11)
            pd.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 5: SYSTEM ARCHITECTURE DIAGRAM (Placeholder)
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5, LIGHT_BG)
    add_header(s5, "03 • System Architecture Diagram", "High-Level Multi-Tier Architectural Topology")
    add_diagram_placeholder(s5, "Tách biệt rõ ràng 4 tầng: Presentation (React 19), Business Logic (Spring Boot), Database (Supabase PostgreSQL) và External (VNPAY, AI APIs).", "Kiến trúc hệ thống")

    # ==========================================
    # SLIDE 6: SYSTEM OBJECTIVES & SCOPE
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6, LIGHT_BG)
    add_header(s6, "04 • System Objectives", "Core Mission & Educational Value Proposition")

    obj_cards = [
        ("1. Scientific Rigor", "Bảo toàn Định luật Vật lý", "Triệt tiêu hiện tượng hallucination của AI. Đảm bảo mọi mô phỏng chuyển động và mạch điện tuân thủ nghiêm ngặt định luật bảo toàn cơ năng |ΔE/E₀| < 10⁻³ và thứ nguyên đơn vị SI."),
        ("2. Active POE Pedagogy", "Phương pháp Dự đoán - Quan sát - Giải thích", "Chuyển đổi học sinh từ quan sát thụ động sang tương tác chủ động. Tích hợp thuật toán cấp seed ngẫu nhiên (PRNG) chống gian lận khi làm bài tập trên lớp."),
        ("3. Scalable B2B SaaS", "Mô hình Nền tảng Bản quyền Trường học", "Cung cấp phân hệ quản trị trường học chuyên nghiệp, phân phối và khóa hạn mức AI Token nguyên tử, tự động hóa thanh toán học phí qua VNPAY IPN webhook.")
    ]
    for idx, (o_title, o_sub, o_desc) in enumerate(obj_cards):
        left = Inches(0.8 + idx * 3.95)
        card = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(1.8), Inches(3.8), Inches(4.9))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = o_title
        p.font.name = "Arial"
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_BLUE
        p2 = tf.add_paragraph()
        p2.text = o_sub
        p2.font.name = "Arial"
        p2.font.size = Pt(13)
        p2.font.bold = True
        p2.font.color.rgb = DARK_TEXT
        p3 = tf.add_paragraph()
        p3.text = f"\n{o_desc}"
        p3.font.name = "Arial"
        p3.font.size = Pt(11)
        p3.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 7: 7 ACTORS & 3 SUBSYSTEMS
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7, LIGHT_BG)
    add_header(s7, "05 • Unified RBAC Architecture", "7 Actors Categorized into 3 Enterprise Subsystems")

    subsystems = [
        ("PHÂN HỆ HỆ THỐNG", "Platform Operations", [
            ("ADMIN (Super Admin)", "Quản trị tối cao sàn, quản lý Manager, giải quyết tranh chấp tài khoản Manager."),
            ("MANAGER (B2B Ops)", "Quản lý hợp đồng trường, hạn mức Quota Token AI, phân luồng hỗ trợ & khiếu nại."),
            ("REVIEWER (Kiểm duyệt)", "Thẩm định giáo án cộng đồng, kiểm định lỗi mô phỏng từ Manager chuyển sang.")
        ]),
        ("PHÂN HỆ TRƯỜNG HỌC", "Institutional Subsystem", [
            ("SCHOOL (Quản trị trường)", "Quản lý danh sách giáo viên, học sinh, lớp học và thanh toán gia hạn gói B2B."),
            ("STAFF (Giáo viên)", "Tải ảnh đề bài OCR, tạo mô phỏng RK4, giao bài tập POE và chấm điểm học sinh."),
            ("STUDENT (Học sinh)", "Thực hành thí nghiệm ảo 60 FPS, nộp dự đoán POE và giải thích hiện tượng.")
        ]),
        ("PHÂN HỆ CÔNG CỘNG", "Public Visitors", [
            ("GUEST (Khách vãng lai)", "Xem kho mô phỏng cộng đồng, đăng ký dùng thử và chọn mua gói dịch vụ trường học.")
        ])
    ]
    for idx, (sub_name, sub_tag, sub_roles) in enumerate(subsystems):
        left = Inches(0.8 + idx * 3.95)
        card = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(1.8), Inches(3.8), Inches(4.9))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = sub_name
        p.font.name = "Arial"
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_BLUE
        p_tag = tf.add_paragraph()
        p_tag.text = sub_tag
        p_tag.font.name = "Arial"
        p_tag.font.size = Pt(11)
        p_tag.font.bold = True
        p_tag.font.color.rgb = MUTED_TEXT
        for r_name, r_desc in sub_roles:
            pr = tf.add_paragraph()
            pr.text = f"\n• {r_name}:"
            pr.font.name = "Arial"
            pr.font.size = Pt(11)
            pr.font.bold = True
            pr.font.color.rgb = DARK_TEXT
            prd = tf.add_paragraph()
            prd.text = f"  {r_desc}"
            prd.font.name = "Arial"
            prd.font.size = Pt(10)
            prd.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 8: SYSTEM USE CASE DIAGRAM (Placeholder)
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8, LIGHT_BG)
    add_header(s8, "05 • System Use Case Diagram", "Complete Functional Scope Across 3 Subsystems")
    add_diagram_placeholder(s8, "Ma trận Use Case bao quát 19 chức năng chính của 7 tác nhân trên 3 phân hệ độc lập.", "Use Case tổng quan")

    # ==========================================
    # SLIDE 9: CONCEPTUAL DATABASE DESIGN (ERD Placeholder)
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9, LIGHT_BG)
    add_header(s9, "06 • Conceptual Database Design", "High-Level Entity Relationship Topology (Chen Notation)")
    add_diagram_placeholder(s9, "Sơ đồ khái niệm thể hiện quan hệ thực thể cốt lõi (Schools, Users, Subscriptions, Payments, Simulations, Assignments).", "ERD Khái niệm (Conceptual ERD)")

    # ==========================================
    # SLIDE 10: B2B PLANS & AI QUOTAS
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    set_slide_background(s10, LIGHT_BG)
    add_header(s10, "07 • B2B Operations & Billing", "School Plans, VNPAY Gateway & Atomic Token Locking")

    plans = [
        ("STARTER PLAN", "30,000,000 VND / năm", ["500 Học sinh bản quyền", "100K Token AI / tháng", "Thanh toán VNPAY Sandbox", "Hỗ trợ kỹ thuật tiêu chuẩn"]),
        ("ADVANCED PLAN", "60,000,000 VND / năm", ["1,500 Học sinh bản quyền", "300K Token AI / tháng", "Thanh toán VNPAY Sandbox", "Ưu tiên phân luồng Reviewer"]),
        ("ENTERPRISE PLAN", "120,000,000 VND / năm", ["3,500 Học sinh bản quyền", "1,000K Token AI / tháng", "Thanh toán VNPAY Sandbox", "Hỗ trợ giáo án chuyên sâu"])
    ]
    for idx, (p_name, p_price, p_feats) in enumerate(plans):
        left = Inches(0.8 + idx * 3.95)
        card = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(1.8), Inches(3.8), Inches(4.9))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = p_name
        p.font.name = "Arial"
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_BLUE
        pp = tf.add_paragraph()
        pp.text = p_price
        pp.font.name = "Arial"
        pp.font.size = Pt(13)
        pp.font.bold = True
        pp.font.color.rgb = DARK_TEXT
        for f in p_feats:
            pf = tf.add_paragraph()
            pf.text = f"✓ {f}"
            pf.font.name = "Arial"
            pf.font.size = Pt(11)
            pf.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 11: LIVE DEMO 4 CORE WORKFLOWS
    # ==========================================
    s11 = prs.slides.add_slide(blank_layout)
    set_slide_background(s11, LIGHT_BG)
    add_header(s11, "08 • Live Demonstration", "Live Demo Across 4 Core Workflows Assigned to 4 Team Members")

    flows = [
        ("FLOW 01 • VIETNHB (LEADER)", "Tạo Mô phỏng & Kiểm định RK4", "Giáo viên tải ảnh đề bài, AI trích xuất tham số SI, bộ giải số RK4 kiểm định cơ năng và AI tự sửa lỗi."),
        ("FLOW 02 • HUNGNT (BA/QA LEAD)", "Quản trị B2B, VNPAY & Quota AI", "Trường đăng ký gói cước, webhook VNPAY kích hoạt tự động, khóa nguyên tử token AI và phân luồng khiếu nại."),
        ("FLOW 03 • MINHTB (FULLSTACK)", "Duyệt Giáo án & Báo lỗi Mô phỏng", "Manager phân luồng tiền trạm chuyển Reviewer, Reviewer kiểm định hiện tượng Vật lý và giải quyết khiếu nại."),
        ("FLOW 04 • KIETVTT (FULLSTACK)", "Lớp học Tương tác & Bài tập POE", "Giáo viên giao bài tập với seed ngẫu nhiên chống gian lận, học sinh chạy mô phỏng 60 FPS, nộp giải thích.")
    ]
    for idx, (fl_title, fl_sub, fl_desc) in enumerate(flows):
        left = Inches(0.8 + (idx % 2) * 5.95)
        top = Inches(1.8 + (idx // 2) * 2.5)
        card = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.75), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = fl_title
        p.font.name = "Arial"
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_BLUE
        p2 = tf.add_paragraph()
        p2.text = fl_sub
        p2.font.name = "Arial"
        p2.font.size = Pt(12)
        p2.font.bold = True
        p2.font.color.rgb = DARK_TEXT
        p3 = tf.add_paragraph()
        p3.text = fl_desc
        p3.font.name = "Arial"
        p3.font.size = Pt(11)
        p3.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 12: CORE FLOW 1 (VIETNHB) - Simulation Lifecycle
    # ==========================================
    s12 = prs.slides.add_slide(blank_layout)
    set_slide_background(s12, LIGHT_BG)
    add_header(s12, "09 • Core Flow 1 (VietNHB)", "Simulation Creation, RK4 Verification & AI Correction Lifecycle")
    add_diagram_placeholder(s12, "Vòng đời mô phỏng: DRAFT ➔ VERIFYING ➔ FLAGGED / VERIFIED ➔ PRIVATE ➔ SHARED ➔ PUBLIC.", "State Diagram: Vòng đời mô phỏng")

    # ==========================================
    # SLIDE 13: CORE FLOW 2 (HUNGNT) - Subscription & Quota
    # ==========================================
    s13 = prs.slides.add_slide(blank_layout)
    set_slide_background(s13, LIGHT_BG)
    add_header(s13, "10 • Core Flow 2 (HungNT)", "B2B School Subscription, VNPAY Webhook & AI Quota Metering")
    add_diagram_placeholder(s13, "Vòng đời thuê bao: REGISTERED ➔ PENDING_PAYMENT ➔ ACTIVE ➔ NEAR_EXPIRY ➔ SUSPENDED_READ_ONLY.", "State Diagram: Thuê bao & Hạn mức Token")

    # ==========================================
    # SLIDE 14: CORE FLOW 3 (MINHTB) - Moderation & Complaints
    # ==========================================
    s14 = prs.slides.add_slide(blank_layout)
    set_slide_background(s14, LIGHT_BG)
    add_header(s14, "11 • Core Flow 3 (MinhTB)", "Community Moderation & Multi-Tier Complaint Resolution")
    add_diagram_placeholder(s14, "Vòng đời duyệt & xử lý khiếu nại: OPEN ➔ TRIAGE_READ ➔ REFER_REVIEWER ➔ RESOLVED / REJECTED.", "State Diagram: Duyệt giáo án & Khiếu nại")

    # ==========================================
    # SLIDE 15: CORE FLOW 4 (KIETVTT) - Assignment & Student POE
    # ==========================================
    s15 = prs.slides.add_slide(blank_layout)
    set_slide_background(s15, LIGHT_BG)
    add_header(s15, "12 • Core Flow 4 (KietVTT)", "Classroom Assignment, Anti-Cheat Seeding & POE Assessment")
    add_diagram_placeholder(s15, "Vòng đời bài tập & học sinh: DRAFT ➔ PUBLISHED ➔ PREDICTING ➔ OBSERVING ➔ EXPLAINING ➔ GRADED.", "State Diagram: Bài tập & Học sinh POE")

    # ==========================================
    # SLIDE 16: SCIENTIFIC BENCHMARK (RQ1-RQ3)
    # ==========================================
    s16 = prs.slides.add_slide(blank_layout)
    set_slide_background(s16, LIGHT_BG)
    add_header(s16, "13 • Scientific Benchmark (100 GDPT Problems)", "Mutation Testing & Research Questions (RQ1–RQ3)")

    rqs = [
        ("RQ1: Physics Violation Detection", "99.2% vs 45.8%", "PhysLive RK4 Solver vs Euler Baseline", "Bộ giải số RK4 với kỹ thuật chia nhỏ bước tích phân (sub-stepping) phát hiện chính xác 99.2% vi phạm định luật bảo toàn cơ năng, hoàn toàn vượt trội so với Euler cơ bản (chỉ đạt 45.8% do dồn tích sai số năng lượng giả tạo)."),
        ("RQ2: Numerical Solver Latency", "< 15 ms / sim", "Average Execution Time per Simulation Run", "Thời gian giải số trung bình chỉ mất 8ms – 12ms trên CPU tiêu chuẩn, hoàn toàn đáp ứng trọn vẹn ngân sách dựng hình 16.6ms cho trải nghiệm mô phỏng 60 FPS mượt mà trên Pixi.js."),
        ("RQ3: AI Self-Correction Rate", "88.5% Converged", "Automated Parameter Correction within 1-2 Iterations", "Khi bộ kiểm định phát hiện sai lệch năng lượng và thứ nguyên SI, cơ chế phản hồi tự động giúp trợ lý AI tự sửa đúng công thức và tham số, hội tụ về trạng thái VERIFIED_BY_LAWS chỉ sau 1-2 lần lặp.")
    ]
    for idx, (rq_name, rq_stat, rq_sub, rq_desc) in enumerate(rqs):
        top = Inches(1.8 + idx * 1.65)
        card = s16.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), top, Inches(11.733), Inches(1.5))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = f"{rq_name}  ➔  {rq_stat}"
        p.font.name = "Arial"
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_BLUE
        p2 = tf.add_paragraph()
        p2.text = f"Tiêu chí: {rq_sub}"
        p2.font.name = "Arial"
        p2.font.size = Pt(11)
        p2.font.bold = True
        p2.font.color.rgb = DARK_TEXT
        p3 = tf.add_paragraph()
        p3.text = rq_desc
        p3.font.name = "Arial"
        p3.font.size = Pt(10)
        p3.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 17: QUALITY ASSURANCE (QA RIGOR)
    # ==========================================
    s17 = prs.slides.add_slide(blank_layout)
    set_slide_background(s17, LIGHT_BG)
    add_header(s17, "14 • Quality Assurance (QA Rigor)", "Automated Multi-Layer Testing & Verification Metrics")

    qa_metrics = [
        ("69", "Unit Test Cases", "JUnit 5 & Mockito at 100% Pass rate.", "Kiểm thử tự động 6 domain cốt lõi: RBAC Security, Payment Analytics, RK4 Solver, Law Invariant Validator, PRNG Anti-cheat, và AI Quota Meter."),
        ("82%", "JaCoCo Coverage", "Covers core solver & quota services.", "Độ bao phủ dòng lệnh trung bình 82% trên 320 compiled Java classes; các package phân quyền và kiểm định đạt branch coverage > 92.5%."),
        ("1.21.4", "Testcontainers", "PostgreSQL Docker verifies school RLS.", "Docker PostgreSQL độc lập nạp schema sạch từ Flyway để kiểm tra cách ly dữ liệu trường học (Row-Level Security) hoàn toàn tự động."),
        ("1.64.1", "Playwright E2E", "Browser tests on Chromium, Firefox, WebKit.", "Bộ kiểm thử tự động đa trình duyệt bao phủ toàn diện 7 luồng người dùng, đảm bảo canvas đồ họa 2D chạy mượt mà không lỗi giao diện.")
    ]
    for idx, (m_val, m_title, m_sub, m_desc) in enumerate(qa_metrics):
        left = Inches(0.8 + idx * 2.95)
        card = s17.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(1.8), Inches(2.85), Inches(4.9))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = m_val
        p.font.name = "Arial"
        p.font.size = Pt(36)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_BLUE
        p2 = tf.add_paragraph()
        p2.text = m_title
        p2.font.name = "Arial"
        p2.font.size = Pt(13)
        p2.font.bold = True
        p2.font.color.rgb = DARK_TEXT
        p3 = tf.add_paragraph()
        p3.text = m_sub
        p3.font.name = "Arial"
        p3.font.size = Pt(11)
        p3.font.bold = True
        p3.font.color.rgb = ACCENT_GREEN
        p4 = tf.add_paragraph()
        p4.text = f"\n{m_desc}"
        p4.font.name = "Arial"
        p4.font.size = Pt(10)
        p4.font.color.rgb = MUTED_TEXT

    # ==========================================
    # SLIDE 18: THANK YOU & Q&A (Dark Theme)
    # ==========================================
    s18 = prs.slides.add_slide(blank_layout)
    set_slide_background(s18, DARK_BG)

    tb = s18.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.3), Inches(0.4))
    p = tb.text_frame.paragraphs[0]
    p.text = "SEP490 REVIEW 2 • TEAM FA26SE309"
    p.font.name = "Arial"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = RGBColor(96, 165, 250)

    tb = s18.shapes.add_textbox(Inches(1.0), Inches(2.1), Inches(11.3), Inches(1.2))
    p = tb.text_frame.paragraphs[0]
    p.text = "THANK YOU & Q&A"
    p.font.name = "Arial"
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = RGBColor(255, 255, 255)

    tb = s18.shapes.add_textbox(Inches(1.0), Inches(3.6), Inches(11.3), Inches(1.2))
    p = tb.text_frame.paragraphs[0]
    p.text = "Team FA26SE309 sincerely thanks M.Sc. Nguyen Tan Phuc and the Review Committee!"
    p.font.name = "Arial"
    p.font.size = Pt(18)
    p.font.color.rgb = RGBColor(226, 232, 240)
    p2 = tb.text_frame.add_paragraph()
    p2.text = "We welcome your questions, evaluations, and guidance."
    p2.font.name = "Arial"
    p2.font.size = Pt(14)
    p2.font.color.rgb = RGBColor(148, 163, 184)

    prs.save(output_path)
    print(f"Presentation saved successfully with {len(prs.slides)} slides to {output_path}")

if __name__ == '__main__':
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'test_output.pptx'
    create_presentation(out_path)

