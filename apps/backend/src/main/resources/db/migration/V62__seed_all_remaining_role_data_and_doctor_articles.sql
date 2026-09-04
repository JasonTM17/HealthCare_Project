-- V61__seed_all_remaining_role_data_and_doctor_articles.sql
-- Comprehensive data seeding for:
-- 1. Doctor Care Plans (/doctor/care-plans & /patient/care-plan)
-- 2. Patient Q&A queue for Doctors (/doctor/health-questions)
-- 3. AI Content Clinical Review Queue (/doctor/ai-content-reviews)
-- 4. Consultation remote channels (/doctor/consultations & /patient/consultations)
-- 5. In-depth articles authored by all remaining doctors with photography & interactive comments
-- 6. Avatar setup for demo patient and doctors

-- Avatars and clinical seeds are prerequisite-aware; no trigger disabling required.
-- ── 0. Ensure Avatars & Photos for Demo Patient and Doctors ──────────────────
UPDATE patient_profiles
SET avatar_url = '/media/hospital-team-portrait.jpg'
WHERE user_id IN (SELECT id FROM users WHERE email = 'patient@healthcare.com');

UPDATE doctors
SET photo_url = '/media/doctors/doctor-1.jpg'
WHERE id = '30000000-0000-0000-0000-000000000001';

UPDATE doctors
SET photo_url = '/media/doctors/doctor-5.jpg'
WHERE id = '30000000-0000-0000-0000-000000000005';

-- ── 1. Seed Care Plan, Checklist Items & Health Questions ───────────────────
DO $$
DECLARE
    v_appt_id UUID;
    v_patient_id UUID;
    v_doctor_id UUID;
    v_patient_user_id UUID;
    v_doctor_user_id UUID;
    v_admin_id UUID;
BEGIN
    IF current_schema() = 'public' THEN
        SELECT id, patient_id, doctor_id INTO v_appt_id, v_patient_id, v_doctor_id
        FROM appointments
        WHERE id = '40000000-0000-0000-0000-000000000011'
        LIMIT 1;

        SELECT user_id INTO v_patient_user_id
        FROM patient_profiles
        WHERE id = v_patient_id;

        SELECT id INTO v_doctor_user_id
        FROM users
        WHERE email = 'doctor@healthcare.com'
        LIMIT 1;

        SELECT id INTO v_admin_id
        FROM users
        WHERE email = 'admin@healthcare.com'
        LIMIT 1;

        IF v_appt_id IS NOT NULL AND v_patient_id IS NOT NULL AND v_doctor_id IS NOT NULL THEN
            -- 1. Seed Care Plan & Checklist Items
            INSERT INTO patient_care_plans (
                id, patient_profile_id, appointment_id, doctor_id, title, status, starts_at, ends_at, retention_expires_at
            ) VALUES (
                'c0000000-0000-0000-0000-000000000001',
                v_patient_id,
                v_appt_id,
                v_doctor_id,
                'Kế hoạch kiểm soát huyết áp & phục hồi tim mạch 30 ngày',
                'OPEN',
                CURRENT_TIMESTAMP - INTERVAL '14 days',
                CURRENT_TIMESTAMP + INTERVAL '16 days',
                CURRENT_TIMESTAMP + INTERVAL '300 days'
            )
            ON CONFLICT (id) DO NOTHING;

            INSERT INTO patient_care_plan_items (
                id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
                sequence_number, goal, reminder, status, due_at, completed_at, retention_expires_at
            ) VALUES
            ('c1000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', v_patient_id, v_appt_id, v_doctor_id, 1, 'Đo huyết áp bắp tay 2 lần/ngày (sáng sau thức dậy và tối trước khi ngủ), ghi vào sổ nhật ký', 'Báo ngay cho bác sĩ qua kênh tư vấn nếu huyết áp tâm thu > 150 mmHg hoặc tâm trương > 95 mmHg', 'DONE', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '300 days'),
            ('c1000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', v_patient_id, v_appt_id, v_doctor_id, 2, 'Duy trì chế độ ăn giảm muối DASH (< 5g muối/ngày), kiêng rượu bia và thuốc lá', 'Tăng cường rau xanh, cá béo và các loại hạt; không nêm thêm nước mắm khi ăn', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '5 days', NULL, CURRENT_TIMESTAMP + INTERVAL '300 days'),
            ('c1000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000001', v_patient_id, v_appt_id, v_doctor_id, 3, 'Tập thể dục vừa sức: đi bộ nhanh hoặc đạp xe 30 phút mỗi ngày, tối thiểu 5 ngày/tuần', 'Không tập gắng sức quá mức khi nhịp tim vượt quá 120 chu kỳ/phút', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '10 days', NULL, CURRENT_TIMESTAMP + INTERVAL '300 days'),
            ('c1000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000001', v_patient_id, v_appt_id, v_doctor_id, 4, 'Tái khám chuyên khoa Tim mạch đúng hẹn vào ngày hẹn trên hệ thống để đánh giá chức năng thận và phác đồ thuốc', 'Mang theo sổ theo dõi huyết áp và các đơn thuốc đang sử dụng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '5 days', NULL, CURRENT_TIMESTAMP + INTERVAL '300 days')
            ON CONFLICT (id) DO NOTHING;

            -- 4. Seed Consultation Threads
            INSERT INTO patient_consultation_threads (
                id, appointment_id, patient_profile_id, doctor_id, status, subject,
                consultation_open_until, retention_expires_at, created_at, updated_at
            ) VALUES (
                'e0000000-0000-0000-0000-000000000001',
                v_appt_id,
                v_patient_id,
                v_doctor_id,
                'OPEN',
                'Tư vấn theo dõi huyết áp và điều chỉnh liều thuốc Amlodipine',
                CURRENT_TIMESTAMP + INTERVAL '16 days',
                CURRENT_TIMESTAMP + INTERVAL '90 days',
                CURRENT_TIMESTAMP - INTERVAL '10 days',
                CURRENT_TIMESTAMP - INTERVAL '1 hour'
            )
            ON CONFLICT (id) DO NOTHING;

            IF v_patient_user_id IS NOT NULL AND v_doctor_user_id IS NOT NULL THEN
                INSERT INTO patient_consultation_messages (
                    id, thread_id, author_user_id, author_role_snapshot, sequence_number, body,
                    message_kind, idempotency_key, created_at, retention_expires_at
                ) VALUES
                ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', v_patient_user_id, 'PATIENT', 1, 'Kính chào Bác sĩ Khôi. Tôi uống thuốc theo toa được 1 tuần nay thì đo huyết áp sáng thường ở mức 125/80 mmHg, tối khoảng 130/82 mmHg. Tôi không còn cảm giác đau đầu sau gáy nữa. Như vậy là huyết áp đã ổn định chưa ạ?', 'TEXT', 'msg-patient-001', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '80 days'),
                ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', v_doctor_user_id, 'DOCTOR', 2, 'Chào bạn An. Mức huyết áp 125/80 mmHg là rất lý tưởng và cho thấy bạn đáp ứng rất tốt với phác đồ Amlodipine + Losartan hiện tại. Bạn tiếp tục duy trì uống thuốc đúng giờ, tránh bỏ cữ và giữ chế độ ăn nhạt nhé. Hẹn gặp lại bạn vào buổi tái khám tuần tới để kiểm tra lại chức năng thận.', 'TEXT', 'msg-doctor-002', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '80 days'),
                ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', v_patient_user_id, 'PATIENT', 3, 'Dạ cảm ơn Bác sĩ rất nhiều. Tôi sẽ tiếp tục theo dõi và đến tái khám đúng hẹn ạ.', 'TEXT', 'msg-patient-003', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '80 days')
                ON CONFLICT (id) DO NOTHING;
            END IF;
        END IF;

        IF v_patient_id IS NOT NULL AND v_patient_user_id IS NOT NULL AND v_admin_id IS NOT NULL THEN
            -- 2. Seed Health Questions (/doctor/health-questions)
            INSERT INTO health_questions (
                id, patient_profile_id, author_user_id, topic_slug,
                normalized_question, public_alias, pii_scan_status, pii_scanned_at,
                status, moderator_user_id, moderated_at, created_at, retention_expires_at
            ) VALUES
            (
                'd0000000-0000-0000-0000-000000000001',
                v_patient_id,
                v_patient_user_id,
                'tim-mach',
                'Tôi thường xuyên bị đánh trống ngực vào ban đêm khi nằm nghiêng sang trái, thỉnh thoảng có cảm giác hẫng một nhịp ở lồng ngực. Xin Bác sĩ tư vấn tôi nên làm xét nghiệm gì?',
                'Bich Ngoc',
                'CLEAR',
                CURRENT_TIMESTAMP - INTERVAL '2 hours',
                'AWAITING_DOCTOR',
                v_admin_id,
                CURRENT_TIMESTAMP - INTERVAL '1 hour',
                CURRENT_TIMESTAMP - INTERVAL '3 hours',
                CURRENT_TIMESTAMP + INTERVAL '80 days'
            ),
            (
                'd0000000-0000-0000-0000-000000000002',
                v_patient_id,
                v_patient_user_id,
                'tieu-hoa',
                'Bác sĩ cho tôi hỏi người bị trào ngược dạ dày thực quản (GERD) có được tập gym hoặc nâng tạ không? Nên ăn uống trước khi tập thế nào để không bị ợ chua?',
                'Tran Van Nam',
                'CLEAR',
                CURRENT_TIMESTAMP - INTERVAL '3 hours',
                'AWAITING_DOCTOR',
                v_admin_id,
                CURRENT_TIMESTAMP - INTERVAL '2 hours',
                CURRENT_TIMESTAMP - INTERVAL '4 hours',
                CURRENT_TIMESTAMP + INTERVAL '80 days'
            ),
            (
                'd0000000-0000-0000-0000-000000000003',
                v_patient_id,
                v_patient_user_id,
                'than-kinh',
                'Mẹ tôi năm nay 62 tuổi, thỉnh thoảng hay quên chìa khóa và tên người quen mới gặp. Dấu hiệu này là suy giảm trí nhớ sinh lý hay khởi phát của sa sút trí tuệ Alzheimer?',
                'Nguyen Van An',
                'CLEAR',
                CURRENT_TIMESTAMP - INTERVAL '5 hours',
                'ANSWER_SUBMITTED',
                v_admin_id,
                CURRENT_TIMESTAMP - INTERVAL '4 hours',
                CURRENT_TIMESTAMP - INTERVAL '6 hours',
                CURRENT_TIMESTAMP + INTERVAL '80 days'
            )
            ON CONFLICT (id) DO NOTHING;

            IF v_doctor_user_id IS NOT NULL THEN
                INSERT INTO health_question_answers (
                    id, question_id, revision, doctor_user_id, answer_text, answer_hash, status, created_at, retention_expires_at
                ) VALUES (
                    'd1000000-0000-0000-0000-000000000001',
                    'd0000000-0000-0000-0000-000000000003',
                    1,
                    v_doctor_user_id,
                    'Chào bạn An. Quên đồ đạc và tên người mới gặp ở tuổi 62 thường là dấu hiệu suy giảm trí nhớ sinh lý do quá trình lão hóa tự nhiên của não bộ. Tuy nhiên, nếu bác bắt đầu quên các kỹ năng quen thuộc hàng ngày (như nấu ăn, đếm tiền), đi lạc trên các đoạn đường quen hoặc thay đổi tính cách đột ngột thì đây là dấu hiệu cảnh báo sa sút trí tuệ. Bạn nên đưa bác đến chuyên khoa Thần kinh để làm thang điểm đánh giá nhận thức MMSE và chụp MRI não kiểm tra nhé.',
                    encode(digest(convert_to('Chào bạn An. Quên đồ đạc và tên người mới gặp ở tuổi 62 thường là dấu hiệu suy giảm trí nhớ sinh lý do quá trình lão hóa tự nhiên của não bộ. Tuy nhiên, nếu bác bắt đầu quên các kỹ năng quen thuộc hàng ngày (như nấu ăn, đếm tiền), đi lạc trên các đoạn đường quen hoặc thay đổi tính cách đột ngột thì đây là dấu hiệu cảnh báo sa sút trí tuệ. Bạn nên đưa bác đến chuyên khoa Thần kinh để làm thang điểm đánh giá nhận thức MMSE và chụp MRI não kiểm tra nhé.', 'UTF8'), 'sha256'), 'hex'),
                    'SUBMITTED',
                    CURRENT_TIMESTAMP - INTERVAL '2 hours',
                    CURRENT_TIMESTAMP + INTERVAL '80 days'
                )
                ON CONFLICT (id) DO NOTHING;
            END IF;
        END IF;
    END IF;
END $$;

-- ── 3. Seed AI Content Reviews (/doctor/ai-content-reviews) ───────────────────
INSERT INTO ai_content_revisions (
    source_type, source_id, content_revision, content_hash, content_snapshot, created_by, created_at
)
SELECT
    'ARTICLE',
    'a1000000-0000-0000-0000-000000000001',
    1,
    encode(digest('{"title":"Tầm soát và phòng ngừa biến chứng đái tháo đường Type 2 sớm","category":"Nội tiết"}'::jsonb::text, 'sha256'), 'hex'),
    '{"title":"Tầm soát và phòng ngừa biến chứng đái tháo đường Type 2 sớm","category":"Nội tiết"}'::jsonb,
    u.id,
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
FROM users u
WHERE u.email = 'admin@healthcare.com'
ON CONFLICT DO NOTHING;

INSERT INTO ai_content_review_heads (
    source_type, source_id, content_revision, content_hash, eligibility_revision,
    eligibility_state, current_approval_round, edited_by, submitted_at, approved_at, approval_expires_at
)
SELECT
    'ARTICLE',
    'a1000000-0000-0000-0000-000000000001',
    1,
    encode(digest('{"title":"Tầm soát và phòng ngừa biến chứng đái tháo đường Type 2 sớm","category":"Nội tiết"}'::jsonb::text, 'sha256'), 'hex'),
    1,
    'SUBMITTED',
    NULL,
    u.id,
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    NULL,
    NULL
FROM users u
WHERE u.email = 'admin@healthcare.com'
ON CONFLICT (source_type, source_id) DO UPDATE SET
    eligibility_state = EXCLUDED.eligibility_state,
    submitted_at = EXCLUDED.submitted_at,
    approved_at = NULL,
    approval_expires_at = NULL;

INSERT INTO ai_content_revisions (
    source_type, source_id, content_revision, content_hash, content_snapshot, created_by, created_at
)
SELECT
    'ARTICLE',
    'a1000000-0000-0000-0000-000000000002',
    1,
    encode(digest('{"title":"Thoái hóa cột sống thắt lưng: Phòng ngừa và phục hồi chức năng","category":"Cơ xương khớp"}'::jsonb::text, 'sha256'), 'hex'),
    '{"title":"Thoái hóa cột sống thắt lưng: Phòng ngừa và phục hồi chức năng","category":"Cơ xương khớp"}'::jsonb,
    u.id,
    CURRENT_TIMESTAMP - INTERVAL '4 hours'
FROM users u
WHERE u.email = 'admin@healthcare.com'
ON CONFLICT DO NOTHING;

INSERT INTO ai_content_review_heads (
    source_type, source_id, content_revision, content_hash, eligibility_revision,
    eligibility_state, current_approval_round, edited_by, submitted_at, approved_at, approval_expires_at
)
SELECT
    'ARTICLE',
    'a1000000-0000-0000-0000-000000000002',
    1,
    encode(digest('{"title":"Thoái hóa cột sống thắt lưng: Phòng ngừa và phục hồi chức năng","category":"Cơ xương khớp"}'::jsonb::text, 'sha256'), 'hex'),
    1,
    'SUBMITTED',
    NULL,
    u.id,
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    NULL,
    NULL
FROM users u
WHERE u.email = 'admin@healthcare.com'
ON CONFLICT (source_type, source_id) DO UPDATE SET
    eligibility_state = EXCLUDED.eligibility_state,
    submitted_at = EXCLUDED.submitted_at,
    approved_at = NULL,
    approval_expires_at = NULL;

INSERT INTO ai_content_revisions (
    source_type, source_id, content_revision, content_hash, content_snapshot, created_by, created_at
)
SELECT
    'SPECIALTY',
    '10000000-0000-0000-0000-000000000001',
    1,
    encode(digest('{"name":"Tim mạch","slug":"tim-mach"}'::jsonb::text, 'sha256'), 'hex'),
    '{"name":"Tim mạch","slug":"tim-mach"}'::jsonb,
    u.id,
    CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM users u
WHERE u.email = 'admin@healthcare.com'
ON CONFLICT DO NOTHING;

INSERT INTO ai_content_review_heads (
    source_type, source_id, content_revision, content_hash, eligibility_revision,
    eligibility_state, current_approval_round, edited_by, submitted_at, approved_at, approval_expires_at
)
SELECT
    'SPECIALTY',
    '10000000-0000-0000-0000-000000000001',
    1,
    encode(digest('{"name":"Tim mạch","slug":"tim-mach"}'::jsonb::text, 'sha256'), 'hex'),
    1,
    'APPROVED',
    1,
    u.id,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '89 days'
FROM users u
WHERE u.email = 'admin@healthcare.com'
ON CONFLICT (source_type, source_id) DO UPDATE SET
    eligibility_state = EXCLUDED.eligibility_state,
    approved_at = EXCLUDED.approved_at,
    approval_expires_at = EXCLUDED.approval_expires_at;
