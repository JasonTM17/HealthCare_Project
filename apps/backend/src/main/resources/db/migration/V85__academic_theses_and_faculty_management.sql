-- ==============================================================================
-- V85: Academic Theses & Faculty Management Subsystem
-- HealthCare Project: Academic Medical Center (Viện - Trường)
-- ==============================================================================

-- 1. Create faculty_lecturers table (1-1 relationship with doctors)
CREATE TABLE IF NOT EXISTS faculty_lecturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL UNIQUE REFERENCES doctors(id) ON DELETE CASCADE,
    academic_rank VARCHAR(20) NOT NULL DEFAULT 'ThS', -- 'GS', 'PGS', 'TS', 'ThS', 'BS.CKII', 'BS.CKI'
    academic_title VARCHAR(120),                       -- 'Giảng viên cao cấp', 'Trưởng Bộ môn'
    department VARCHAR(160) NOT NULL,                  -- 'Bộ môn Nội Tim mạch', 'Bộ môn Sản Phụ khoa'
    max_theses INT NOT NULL DEFAULT 5,
    current_theses_count INT NOT NULL DEFAULT 0,
    biography TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_faculty_lecturers_doctor_id ON faculty_lecturers(doctor_id);
CREATE INDEX IF NOT EXISTS idx_faculty_lecturers_dept ON faculty_lecturers(department);

-- 2. Create academic_theses table
CREATE TABLE IF NOT EXISTS academic_theses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_code VARCHAR(60) NOT NULL UNIQUE,
    title VARCHAR(300) NOT NULL,
    abstract_text TEXT,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    training_level VARCHAR(40) NOT NULL, -- 'GRADUATION_THESIS', 'RESIDENCY_DISSERTATION', 'MASTER_THESIS'
    specialty_id UUID REFERENCES specialties(id) ON DELETE SET NULL,
    primary_supervisor_id UUID NOT NULL REFERENCES faculty_lecturers(id) ON DELETE RESTRICT,
    student_name VARCHAR(160) NOT NULL,
    student_code VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PROPOSED', -- 'PROPOSED', 'APPROVED', 'IN_PROGRESS', 'DEFENSE_SCHEDULED', 'DEFENDED', 'REJECTED'
    defense_score NUMERIC(4, 2),
    defense_date TIMESTAMP WITH TIME ZONE,
    defense_location VARCHAR(200),
    thesis_document_url VARCHAR(500),
    submission_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_theses_training_level CHECK (training_level IN ('GRADUATION_THESIS', 'RESIDENCY_DISSERTATION', 'MASTER_THESIS')),
    CONSTRAINT chk_theses_status CHECK (status IN ('PROPOSED', 'APPROVED', 'IN_PROGRESS', 'DEFENSE_SCHEDULED', 'DEFENDED', 'REJECTED')),
    CONSTRAINT chk_theses_score CHECK (defense_score IS NULL OR (defense_score >= 0.00 AND defense_score <= 10.00))
);

CREATE INDEX IF NOT EXISTS idx_academic_theses_supervisor ON academic_theses(primary_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_academic_theses_status ON academic_theses(status);
CREATE INDEX IF NOT EXISTS idx_academic_theses_year ON academic_theses(academic_year);
CREATE INDEX IF NOT EXISTS idx_academic_theses_code ON academic_theses(topic_code);

-- 3. Create defense_committee_members table (3-5 members independent review)
CREATE TABLE IF NOT EXISTS defense_committee_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thesis_id UUID NOT NULL REFERENCES academic_theses(id) ON DELETE CASCADE,
    lecturer_id UUID NOT NULL REFERENCES faculty_lecturers(id) ON DELETE RESTRICT,
    committee_role VARCHAR(30) NOT NULL, -- 'CHAIR', 'SECRETARY', 'REVIEWER', 'MEMBER'
    score NUMERIC(4, 2),
    evaluation_notes TEXT,
    evaluated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_committee_role CHECK (committee_role IN ('CHAIR', 'SECRETARY', 'REVIEWER', 'MEMBER')),
    CONSTRAINT chk_committee_score CHECK (score IS NULL OR (score >= 0.00 AND score <= 10.00)),
    CONSTRAINT uq_committee_thesis_lecturer UNIQUE (thesis_id, lecturer_id)
);

CREATE INDEX IF NOT EXISTS idx_defense_committee_thesis ON defense_committee_members(thesis_id);
CREATE INDEX IF NOT EXISTS idx_defense_committee_lecturer ON defense_committee_members(lecturer_id);

-- 4. Seed faculty lecturers for canonical doctors
DO $$
DECLARE
    v_khoi_id UUID := '30000000-0000-0000-0000-000000000001';
    v_mai_id UUID  := '30000000-0000-0000-0000-000000000002';
    v_duc_id UUID  := '30000000-0000-0000-0000-000000000003';
    v_yen_id UUID  := '30000000-0000-0000-0000-000000000004';
    v_doc_record RECORD;
    v_khoi_fac_id UUID := '40000000-0000-0000-0000-000000000001';
    v_mai_fac_id  UUID := '40000000-0000-0000-0000-000000000002';
    v_duc_fac_id  UUID := '40000000-0000-0000-0000-000000000003';
    v_yen_fac_id  UUID := '40000000-0000-0000-0000-000000000004';

    v_spec_tim_mach UUID;
    v_spec_san_phu UUID;
    v_spec_tieu_hoa UUID;
    v_spec_nhi UUID;

    v_thesis_1 UUID := '50000000-0000-0000-0000-000000000001';
    v_thesis_2 UUID := '50000000-0000-0000-0000-000000000002';
    v_thesis_3 UUID := '50000000-0000-0000-0000-000000000003';
    v_thesis_4 UUID := '50000000-0000-0000-0000-000000000004';
    v_thesis_5 UUID := '50000000-0000-0000-0000-000000000005';
BEGIN
    -- Seed canonical 4 faculty lecturers if doctors exist
    IF EXISTS (SELECT 1 FROM doctors WHERE id = v_khoi_id) THEN
        INSERT INTO faculty_lecturers (id, doctor_id, academic_rank, academic_title, department, max_theses, current_theses_count, biography)
        VALUES (
            v_khoi_fac_id, v_khoi_id, 'TS', 'Giảng viên cao cấp - Trưởng Bộ môn', 'Bộ môn Nội Tim mạch', 6, 2,
            'Tiến sĩ Y khoa, Giảng viên chính chuyên ngành Tim mạch can thiệp, hướng dẫn nhiều luận án bác sĩ nội trú và khóa luận tốt nghiệp loại xuất sắc.'
        ) ON CONFLICT (doctor_id) DO UPDATE SET
            academic_rank = EXCLUDED.academic_rank,
            academic_title = EXCLUDED.academic_title,
            department = EXCLUDED.department;
    END IF;

    IF EXISTS (SELECT 1 FROM doctors WHERE id = v_mai_id) THEN
        INSERT INTO faculty_lecturers (id, doctor_id, academic_rank, academic_title, department, max_theses, current_theses_count, biography)
        VALUES (
            v_mai_fac_id, v_mai_id, 'BS.CKII', 'Giảng viên chính - Phó Trưởng Bộ môn', 'Bộ môn Sản Phụ khoa', 6, 1,
            'Bác sĩ Chuyên khoa II, giảng viên phụ trách đào tạo sau đại học và hướng dẫn nghiên cứu sàng lọc trước sinh, hỗ trợ sinh sản.'
        ) ON CONFLICT (doctor_id) DO UPDATE SET
            academic_rank = EXCLUDED.academic_rank,
            academic_title = EXCLUDED.academic_title,
            department = EXCLUDED.department;
    END IF;

    IF EXISTS (SELECT 1 FROM doctors WHERE id = v_duc_id) THEN
        INSERT INTO faculty_lecturers (id, doctor_id, academic_rank, academic_title, department, max_theses, current_theses_count, biography)
        VALUES (
            v_duc_fac_id, v_duc_id, 'BS.CKI', 'Giảng viên thực hành lâm sàng', 'Bộ môn Nội Tiêu hóa - Gan mật', 4, 1,
            'Chuyên gia nội soi can thiệp đường tiêu hóa, hướng dẫn các đề tài kỹ thuật cắt tách niêm mạc ESD và tầm soát tổn thương tiền ung thư.'
        ) ON CONFLICT (doctor_id) DO UPDATE SET
            academic_rank = EXCLUDED.academic_rank,
            academic_title = EXCLUDED.academic_title,
            department = EXCLUDED.department;
    END IF;

    IF EXISTS (SELECT 1 FROM doctors WHERE id = v_yen_id) THEN
        INSERT INTO faculty_lecturers (id, doctor_id, academic_rank, academic_title, department, max_theses, current_theses_count, biography)
        VALUES (
            v_yen_fac_id, v_yen_id, 'ThS', 'Giảng viên Bộ môn Nhi', 'Bộ môn Nhi khoa & Hồi sức Cấp cứu Nhi', 4, 1,
            'Thạc sĩ Y học chuyên ngành Nhi khoa, chuyên gia hồi sức nhi, hướng dẫn nghiên cứu bệnh lý hô hấp và dịch tễ học nhiễm khuẩn trẻ em.'
        ) ON CONFLICT (doctor_id) DO UPDATE SET
            academic_rank = EXCLUDED.academic_rank,
            academic_title = EXCLUDED.academic_title,
            department = EXCLUDED.department;
    END IF;

    -- Also seed any other doctor as a faculty lecturer with default department
    FOR v_doc_record IN SELECT id, full_name FROM doctors WHERE id NOT IN (v_khoi_id, v_mai_id, v_duc_id, v_yen_id) LIMIT 20 LOOP
        INSERT INTO faculty_lecturers (doctor_id, academic_rank, academic_title, department, max_theses, current_theses_count)
        VALUES (
            v_doc_record.id,
            CASE WHEN v_doc_record.full_name LIKE 'TS%' OR v_doc_record.full_name LIKE 'PGS%' THEN 'TS'
                 WHEN v_doc_record.full_name LIKE 'BS.CKII%' THEN 'BS.CKII'
                 WHEN v_doc_record.full_name LIKE 'ThS%' THEN 'ThS'
                 ELSE 'BS.CKI' END,
            'Giảng viên Bộ môn Lâm sàng',
            'Bộ môn Y học Lâm sàng Đa khoa',
            5,
            0
        ) ON CONFLICT (doctor_id) DO NOTHING;
    END LOOP;

    -- Retrieve Specialty IDs
    SELECT id INTO v_spec_tim_mach FROM specialties WHERE slug = 'tim-mach' LIMIT 1;
    SELECT id INTO v_spec_san_phu FROM specialties WHERE slug = 'san-phu-khoa' OR slug LIKE '%san%' LIMIT 1;
    SELECT id INTO v_spec_tieu_hoa FROM specialties WHERE slug = 'noi-tieu-hoa' OR slug LIKE '%tieu-hoa%' LIMIT 1;
    SELECT id INTO v_spec_nhi FROM specialties WHERE slug = 'nhi-khoa' OR slug LIKE '%nhi%' LIMIT 1;

    -- 5. Seed sample academic theses
    IF EXISTS (SELECT 1 FROM faculty_lecturers WHERE id = v_khoi_fac_id) THEN
        -- Thesis 1: Defended Graduation Thesis (Cardiology)
        INSERT INTO academic_theses (
            id, topic_code, title, abstract_text, academic_year, training_level,
            specialty_id, primary_supervisor_id, student_name, student_code,
            status, defense_score, defense_date, defense_location, thesis_document_url, submission_notes
        ) VALUES (
            v_thesis_1,
            'KL-2026-TM-01',
            'Đánh giá hiệu quả can thiệp mạch vành qua da ở bệnh nhân nhồi máu cơ tim cấp có đái tháo đường Type 2',
            'Nghiên cứu tiến cứu trên 120 bệnh nhân nhồi máu cơ tim cấp kèm đái tháo đường Type 2 được can thiệp mạch vành qua da (PCI) tại Bệnh viện HealthCare trong giai đoạn 2024-2025. Kết quả ghi nhận tỷ lệ thành công về mặt thủ thuật đạt 95.8%, cải thiện phân suất tống máu thất trái (LVEF) sau 6 tháng theo dõi, đồng thời phân tích các yếu tố tiên lượng biến cố tim mạch chính (MACE).',
            '2025-2026',
            'GRADUATION_THESIS',
            v_spec_tim_mach,
            v_khoi_fac_id,
            'BS. Trần Văn Hùng',
            'Y2020-0042',
            'DEFENDED',
            9.35,
            CURRENT_TIMESTAMP - INTERVAL '14 days',
            'Hội trường A - Đại giảng đường Viện Đào tạo Y khoa',
            '/documents/theses/KL-2026-TM-01-final.pdf',
            'Đã bảo vệ thành công trước Hội đồng chấm khóa luận tốt nghiệp loại Xuất sắc. Hội đồng đề xuất khen thưởng đề tài xuất sắc cấp Trường.'
        ) ON CONFLICT (topic_code) DO NOTHING;

        -- Thesis 2: In-Progress Residency Dissertation (Cardiology)
        INSERT INTO academic_theses (
            id, topic_code, title, abstract_text, academic_year, training_level,
            specialty_id, primary_supervisor_id, student_name, student_code,
            status, defense_score, defense_date, defense_location, thesis_document_url, submission_notes
        ) VALUES (
            v_thesis_2,
            'LVNT-2026-TM-02',
            'Tối ưu hóa phác đồ điều trị suy tim phân suất tống máu giảm (HFrEF) có sử dụng ức chế SGLT2 tại Bệnh viện HealthCare',
            'Đề tài nghiên cứu ứng dụng thực tế nhóm thuốc ức chế SGLT2 kết hợp phác đồ 4 trụ cột kinh điển trong quản lý bệnh nhân suy tim phân suất tống máu giảm. Đánh giá tỷ lệ tái nhập viện vì suy tim đợt cấp, chức năng thận và chất lượng cuộc sống theo thang điểm KCCQ sau 3 tháng và 6 tháng điều trị.',
            '2025-2026',
            'RESIDENCY_DISSERTATION',
            v_spec_tim_mach,
            v_khoi_fac_id,
            'BSNT. Lê Hoàng Long',
            'NT2023-TM-08',
            'IN_PROGRESS',
            NULL,
            NULL,
            NULL,
            '/documents/theses/LVNT-2026-TM-02-proposal.pdf',
            'Đề cương đã được thông qua Hội đồng đạo đức y sinh. Đang tiến hành thu thập số liệu lâm sàng đợt 2 (đã đạt 85/100 ca).'
        ) ON CONFLICT (topic_code) DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM faculty_lecturers WHERE id = v_mai_fac_id) THEN
        -- Thesis 3: Approved Graduation Thesis (Obstetrics & Gynecology)
        INSERT INTO academic_theses (
            id, topic_code, title, abstract_text, academic_year, training_level,
            specialty_id, primary_supervisor_id, student_name, student_code,
            status, defense_score, defense_date, defense_location, thesis_document_url, submission_notes
        ) VALUES (
            v_thesis_3,
            'KL-2026-SP-01',
            'Giá trị của sàng lọc trước sinh không xâm lấn (NIPT) trong phát hiện sớm lệch bội nhiễm sắc thể ở thai phụ nguy cơ cao',
            'Khảo sát giá trị chẩn đoán của xét nghiệm NIPT phát hiện trisomy 21, 18, 13 trên nhóm thai phụ có kết quả Double test / Triple test nguy cơ cao hoặc tuổi mẹ trên 35. So sánh đối chiếu với kết quả chọc ối sinh thiết gai nhau làm karyotype tiêu chuẩn vàng.',
            '2025-2026',
            'GRADUATION_THESIS',
            v_spec_san_phu,
            v_mai_fac_id,
            'BS. Đỗ Thị Thu Trang',
            'Y2020-0118',
            'APPROVED',
            NULL,
            NULL,
            NULL,
            '/documents/theses/KL-2026-SP-01-outline.pdf',
            'Đề cương nghiên cứu chi tiết đã được Trưởng Bộ môn phê duyệt ngày 15/01/2026.'
        ) ON CONFLICT (topic_code) DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM faculty_lecturers WHERE id = v_duc_fac_id) THEN
        -- Thesis 4: Defense Scheduled Residency Dissertation (Gastroenterology)
        INSERT INTO academic_theses (
            id, topic_code, title, abstract_text, academic_year, training_level,
            specialty_id, primary_supervisor_id, student_name, student_code,
            status, defense_score, defense_date, defense_location, thesis_document_url, submission_notes
        ) VALUES (
            v_thesis_4,
            'LVNT-2026-TH-03',
            'Hiệu quả và độ an toàn của kỹ thuật cắt tách dưới niêm mạc qua nội soi (ESD) trong điều trị tổn thương tiền ung thư biểu mô dạ dày',
            'Nghiên cứu mô tả cắt ngang có theo dõi dọc đánh giá tỷ lệ cắt bỏ trọn khối (en-bloc resection), tỷ lệ cắt sạch biên R0 và các biến chứng thủng, chảy máu khi thực hiện ESD điều trị loạn sản nặng và ung thư biểu mô dạ dày giai đoạn sớm (T1a).',
            '2025-2026',
            'RESIDENCY_DISSERTATION',
            v_spec_tieu_hoa,
            v_duc_fac_id,
            'BSNT. Phạm Minh Tuấn',
            'NT2023-TH-03',
            'DEFENSE_SCHEDULED',
            NULL,
            CURRENT_TIMESTAMP + INTERVAL '7 days',
            'Phòng Hội chẩn Chuyên khoa - Khu Khám Cấp cao',
            '/documents/theses/LVNT-2026-TH-03-full.pdf',
            'Đã hoàn tất phản biện độc lập vòng 1. Lịch bảo vệ chính thức được ấn định vào 09h00 sáng ngày 25/09/2026.'
        ) ON CONFLICT (topic_code) DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM faculty_lecturers WHERE id = v_yen_fac_id) THEN
        -- Thesis 5: Proposed Master Thesis (Pediatrics)
        INSERT INTO academic_theses (
            id, topic_code, title, abstract_text, academic_year, training_level,
            specialty_id, primary_supervisor_id, student_name, student_code,
            status, defense_score, defense_date, defense_location, thesis_document_url, submission_notes
        ) VALUES (
            v_thesis_5,
            'LVT-2026-NK-05',
            'Khảo sát đặc điểm lâm sàng, căn nguyên vi sinh và tính nhạy cảm kháng sinh của vi khuẩn gây viêm phổi cộng đồng nặng ở trẻ dưới 5 tuổi',
            'Phân tích đặc điểm dịch tễ học phân lập vi khuẩn (Streptococcus pneumoniae, Haemophilus influenzae) và mức độ kháng thuốc của các chủng phân lập được tại Khoa Hồi sức Nhi Bệnh viện HealthCare nhằm cập nhật phác đồ kháng sinh kinh nghiệm.',
            '2025-2026',
            'MASTER_THESIS',
            v_spec_nhi,
            v_yen_fac_id,
            'BS. Nguyễn Thị Kim Oanh',
            'CH2024-NK-12',
            'PROPOSED',
            NULL,
            NULL,
            NULL,
            NULL,
            'Học viên vừa nộp phiếu đăng ký tên đề tài và đề cương tóm tắt để Giảng viên hướng dẫn xem xét.'
        ) ON CONFLICT (topic_code) DO NOTHING;
    END IF;

    -- 6. Seed defense committee members for Thesis 1 (3-5 independent committee members)
    IF EXISTS (SELECT 1 FROM academic_theses WHERE id = v_thesis_1) THEN
        INSERT INTO defense_committee_members (thesis_id, lecturer_id, committee_role, score, evaluation_notes, evaluated_at)
        VALUES
        (
            v_thesis_1,
            v_khoi_fac_id,
            'CHAIR',
            9.50,
            'Học viên nắm vững phương pháp nghiên cứu, số liệu minh bạch, trả lời lưu loát các câu hỏi phản biện của hội đồng.',
            CURRENT_TIMESTAMP - INTERVAL '14 days'
        ),
        (
            v_thesis_1,
            v_mai_fac_id,
            'REVIEWER',
            9.25,
            'Đề tài có tính thực tiễn cao trong ứng dụng lâm sàng tim mạch can thiệp, phần bàn luận sâu sắc và chặt chẽ.',
            CURRENT_TIMESTAMP - INTERVAL '14 days'
        ),
        (
            v_thesis_1,
            v_duc_fac_id,
            'SECRETARY',
            9.30,
            'Hình thức luận văn trình bày đúng quy chuẩn đào tạo Viện - Trường, số liệu thống kê SPSS xử lý chuẩn xác.',
            CURRENT_TIMESTAMP - INTERVAL '14 days'
        )
        ON CONFLICT (thesis_id, lecturer_id) DO NOTHING;
    END IF;

    -- Seed defense committee members for Thesis 4 (Scheduled defense)
    IF EXISTS (SELECT 1 FROM academic_theses WHERE id = v_thesis_4) THEN
        INSERT INTO defense_committee_members (thesis_id, lecturer_id, committee_role, score, evaluation_notes, evaluated_at)
        VALUES
        (
            v_thesis_4,
            v_duc_fac_id,
            'CHAIR',
            NULL,
            'Đã phân công duyệt đề cương và phiếu nhận xét phản biện 1.',
            NULL
        ),
        (
            v_thesis_4,
            v_khoi_fac_id,
            'REVIEWER',
            NULL,
            'Đã nhận bản toàn văn luận văn để viết nhận xét phản biện độc lập.',
            NULL
        ),
        (
            v_thesis_4,
            v_yen_fac_id,
            'SECRETARY',
            NULL,
            'Chuẩn bị hồ sơ bảo vệ và biên bản chấm điểm cho phiên bảo vệ.',
            NULL
        )
        ON CONFLICT (thesis_id, lecturer_id) DO NOTHING;
    END IF;

    RAISE NOTICE 'V85 Academic Theses & Faculty Management Migration completed successfully!';
END $$;
