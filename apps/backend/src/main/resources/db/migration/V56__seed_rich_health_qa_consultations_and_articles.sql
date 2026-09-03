-- ==============================================================================
-- V56: Seed rich medical data for Health Q&A, Consultations, Articles & AI Credits
-- Safe and idempotent: uses ON CONFLICT DO NOTHING / UPDATE
-- ==============================================================================

-- 1. Ensure Demo Users and Additional Patients exist
INSERT INTO users (id, email, password_hash, display_name, status) VALUES
    ('90000000-0000-0000-0000-000000000001', 'admin@healthcare.local', '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa', 'Quản trị viên Local', 'ACTIVE'),
    ('90000000-0000-0000-0000-000000000002', 'doctor@healthcare.local', '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa', 'Bác sĩ Local', 'ACTIVE'),
    ('90000000-0000-0000-0000-000000000003', 'patient@healthcare.local', '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa', 'Bệnh nhân An Tâm', 'ACTIVE'),
    ('90000000-0000-0000-0000-000000000011', 'tranvannam@gmail.com', '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa', 'Trần Văn Nam', 'ACTIVE'),
    ('90000000-0000-0000-0000-000000000012', 'bichngoc.le@gmail.com', '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa', 'Lê Thị Bích Ngọc', 'ACTIVE')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (VALUES
    ('admin@healthcare.local', 'ADMIN'),
    ('doctor@healthcare.local', 'DOCTOR'),
    ('patient@healthcare.local', 'PATIENT'),
    ('tranvannam@gmail.com', 'PATIENT'),
    ('bichngoc.le@gmail.com', 'PATIENT')
) AS accounts(email, role_code)
JOIN users u ON u.email = accounts.email
JOIN roles r ON r.code = accounts.role_code
ON CONFLICT DO NOTHING;

INSERT INTO patient_profiles (id, full_name, phone, email, user_id, date_of_birth, gender, address, patient_tier, ai_credits) VALUES
    ('90000000-0000-0000-0000-000000000004', 'Bệnh nhân An Tâm', '0900000001', 'patient@healthcare.local', '90000000-0000-0000-0000-000000000003', '1990-01-01', 'MALE', 'Quận 1, TP. Hồ Chí Minh', 'GOLD', 85),
    ('90000000-0000-0000-0000-000000000013', 'Trần Văn Nam', '0912345678', 'tranvannam@gmail.com', '90000000-0000-0000-0000-000000000011', '1985-06-15', 'MALE', 'Quận 7, TP. Hồ Chí Minh', 'SILVER', 45),
    ('90000000-0000-0000-0000-000000000014', 'Lê Thị Bích Ngọc', '0987654321', 'bichngoc.le@gmail.com', '90000000-0000-0000-0000-000000000012', '1992-11-20', 'FEMALE', 'Bình Thạnh, TP. Hồ Chí Minh', 'VIP', 280)
ON CONFLICT (id) DO UPDATE SET
    patient_tier = EXCLUDED.patient_tier,
    ai_credits = EXCLUDED.ai_credits;

-- Bind primary doctor to demo doctor account
UPDATE doctors
SET user_id = '90000000-0000-0000-0000-000000000002'
WHERE id = '30000000-0000-0000-0000-000000000001' AND (user_id IS NULL OR user_id = '90000000-0000-0000-0000-000000000002');

UPDATE doctors SET ai_credits = 150 WHERE ai_credits IS NULL OR ai_credits < 150;

-- 2. Confirmed & Completed appointments for consultations (all tied to doctor 30000000-0000-0000-0000-000000000001)
INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, created_at
) VALUES
(
    'a1000000-0000-0000-0000-000000000001', 'BK-260901-TM01',
    '90000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000001', NULL, NULL,
    CURRENT_DATE, '08:30:00', '09:00:00', CURRENT_TIMESTAMP,
    'COMPLETED', 'PAID', 'Tái khám định kỳ sau can thiệp đặt stent mạch vành, kiểm tra huyết áp', CURRENT_TIMESTAMP - INTERVAL '1 days'
),
(
    'a1000000-0000-0000-0000-000000000002', 'BK-260902-TH02',
    '90000000-0000-0000-0000-000000000013',
    '30000000-0000-0000-0000-000000000001', NULL, NULL,
    CURRENT_DATE, '09:00:00', '09:30:00', CURRENT_TIMESTAMP,
    'COMPLETED', 'PAID', 'Đau tức vùng thượng vị sau ăn, ợ chua và đầy bụng kéo dài', CURRENT_TIMESTAMP - INTERVAL '1 days'
),
(
    'a1000000-0000-0000-0000-000000000003', 'BK-260903-TK03',
    '90000000-0000-0000-0000-000000000014',
    '30000000-0000-0000-0000-000000000001', NULL, NULL,
    CURRENT_DATE, '10:00:00', '10:30:00', CURRENT_TIMESTAMP,
    'CONFIRMED', 'PAID', 'Đau nửa đầu Migraine tái phát kèm hoa mắt, mất ngủ nhiều đêm', CURRENT_TIMESTAMP - INTERVAL '1 days'
),
(
    'a1000000-0000-0000-0000-000000000004', 'BK-260904-NK04',
    '90000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000001', NULL, NULL,
    CURRENT_DATE, '14:00:00', '14:30:00', CURRENT_TIMESTAMP,
    'CONFIRMED', 'PAID', 'Tư vấn dinh dưỡng và chăm sóc bé 18 tháng tuổi sốt mọc răng', CURRENT_TIMESTAMP - INTERVAL '1 days'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Patient Consultation Threads (disable triggers temporarily for schema-isolated test runners)
ALTER TABLE patient_consultation_threads DISABLE TRIGGER trg_patient_consultation_thread_window_guard;
ALTER TABLE patient_consultation_participants DISABLE TRIGGER trg_patient_consultation_participant_guard;
ALTER TABLE health_questions DISABLE TRIGGER trg_health_question_owner_guard;
ALTER TABLE health_question_answers DISABLE TRIGGER trg_health_question_answer_guard;

INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id,
    subject, status, consent_version, consented_at,
    first_response_due_at, first_responded_at,
    consultation_open_until, retention_expires_at,
    version, created_at, updated_at
) VALUES
(
    'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000001',
    'Tư vấn điều chỉnh thuốc huyết áp và chế độ ăn sau can thiệp',
    'OPEN', 'v1.0', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP + INTERVAL '1 hours',
    CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days',
    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
    'c1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000013',
    '30000000-0000-0000-0000-000000000001',
    'Đau thượng vị sau ăn và kết quả nội soi dạ dày HP (+)',
    'WAITING_FOR_PATIENT', 'v1.0', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP + INTERVAL '2 hours',
    CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days',
    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
    'c1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000003',
    '90000000-0000-0000-0000-000000000014',
    '30000000-0000-0000-0000-000000000001',
    'Theo dõi cơn đau nửa đầu Migraine và triệu chứng mất ngủ',
    'WAITING_FOR_DOCTOR', 'v1.0', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '24 hours', NULL,
    CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days',
    0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
    'c1000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000004',
    '90000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000001',
    'Tư vấn chăm sóc trẻ sốt mọc răng và phân lỏng',
    'OPEN', 'v1.0', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP + INTERVAL '1 hours',
    CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days',
    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

-- 4. Consultation Participants
INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, joined_at, retention_expires_at
) VALUES
-- Thread 1
('cf000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 'PATIENT', NULL, 'METADATA_ONLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'),
('cf000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'),
-- Thread 2
('cf000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000011', 'PATIENT', NULL, 'METADATA_ONLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'),
('cf000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'),
-- Thread 3
('cf000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000012', 'PATIENT', NULL, 'METADATA_ONLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'),
('cf000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'),
-- Thread 4
('cf000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', 'PATIENT', NULL, 'METADATA_ONLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'),
('cf000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days')
ON CONFLICT (id) DO NOTHING;

-- 5. Consultation Messages
INSERT INTO patient_consultation_messages (
    id, thread_id, author_user_id, author_role_snapshot, sequence_number,
    body, message_kind, idempotency_key, created_at, retention_expires_at
) VALUES
-- Thread 1
(
    'ce000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000003',
    'PATIENT', 1,
    'Chào Bác sĩ Khôi, sáng nay tôi đo huyết áp tại nhà thấy 135/85 mmHg, nhịp tim 72. Tôi có cảm giác hơi nặng ngực nhẹ khi đi bộ cầu thang thì có cần tăng liều thuốc không bác sĩ?',
    'TEXT', 'msg-th1-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
),
(
    'ce000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000002',
    'DOCTOR', 2,
    'Chào bạn. Chỉ số huyết áp 135/85 mmHg là ở ngưỡng chấp nhận được sau can thiệp stent. Bạn duy trì đúng liều thuốc hạ áp và chống đông theo đơn xuất viện. Về cảm giác nặng ngực: tạm thời hạn chế leo cầu thang nhanh, chia nhỏ các lần vận động. Nếu cảm giác nặng ngực kéo dài trên 10 phút hoặc lan ra cánh tay trái, hãy liên hệ ngay hotline cấp cứu 028 3838 1155 để được hỗ trợ tức thì.',
    'TEXT', 'msg-th1-02', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
),
(
    'ce000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000003',
    'PATIENT', 3,
    'Dạ cảm ơn Bác sĩ rất nhiều. Tôi đã ghi chép lại huyết áp 2 lần/ngày và uống thuốc đúng giờ như bác dặn ạ.',
    'TEXT', 'msg-th1-03', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
),
-- Thread 2
(
    'ce000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000011',
    'PATIENT', 1,
    'Chào Bác sĩ Đức, tôi vừa nhận kết quả xét nghiệm vi khuẩn HP dương tính. Uống kháng sinh phác đồ 14 ngày có gây mệt và đi ngoài không bác sĩ?',
    'TEXT', 'msg-th2-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
),
(
    'ce000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000002',
    'DOCTOR', 2,
    'Chào anh Nam. Phác đồ diệt HP 14 ngày kết hợp 2 loại kháng sinh và thuốc ức chế tiết axit có thể gây đắng miệng, phân sẫm màu hoặc rối loạn tiêu hóa nhẹ. Đây là phản ứng thường gặp. Anh nhớ uống thuốc sau bữa ăn 30 phút, kiêng rượu bia tuyệt đối và uống nhiều nước ấm. Nếu có phát ban hoặc tiêu chảy nhiều lần thì báo lại tôi ngay nhé.',
    'TEXT', 'msg-th2-02', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Health Questions & Answers (Hỏi đáp sức khỏe)
INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status, pii_scanned_at,
    status, moderator_user_id, moderated_at, created_at, updated_at, retention_expires_at
) VALUES
(
    'cd000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000004',
    '90000000-0000-0000-0000-000000000003',
    'tim-mach',
    'Tôi hay bị nhói ngực trái từng cơn khoảng vài giây kèm cảm giác hồi hộp đánh trống ngực khi thức khuya làm việc. Xin hỏi bác sĩ đây có phải là dấu hiệu của bệnh thiếu máu cơ tim không?',
    'Thanh T',
    'CLEAR', CURRENT_TIMESTAMP,
    'PUBLISHED', '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
),
(
    'cd000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000013',
    '90000000-0000-0000-0000-000000000011',
    'tieu-hoa',
    'Vi khuẩn Helicobacter pylori (HP) trong dạ dày có lây qua đường ăn uống chung mâm bát không? Nếu cả gia đình có người bị thì các thành viên khác có cần xét nghiệm tầm soát không?',
    'Nam V',
    'CLEAR', CURRENT_TIMESTAMP,
    'PUBLISHED', '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
),
(
    'cd000000-0000-0000-0000-000000000003',
    '90000000-0000-0000-0000-000000000014',
    '90000000-0000-0000-0000-000000000012',
    'than-kinh',
    'Tôi thường xuyên bị đau nhói một bên đầu vùng thái dương, mỗi lần đau đều cảm thấy buồn nôn và rất sợ ánh sáng chói. Đây có phải đau nửa đầu Migraine mạn tính không?',
    'Bich N',
    'CLEAR', CURRENT_TIMESTAMP,
    'PUBLISHED', '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
),
(
    'cd000000-0000-0000-0000-000000000004',
    '90000000-0000-0000-0000-000000000004',
    '90000000-0000-0000-0000-000000000003',
    'nhi-khoa',
    'Bé nhà em 18 tháng tuổi bị sốt liên tục 3 ngày 38.5 - 39 độ, đến ngày thứ 4 thì hạ sốt nhưng người nổi ban đỏ li ti khắp ngực và lưng. Xin hỏi bác sĩ có nguy hiểm không và chăm sóc ra sao?',
    'Me Be Bong',
    'CLEAR', CURRENT_TIMESTAMP,
    'PUBLISHED', '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
),
(
    'cd000000-0000-0000-0000-000000000005',
    '90000000-0000-0000-0000-000000000013',
    '90000000-0000-0000-0000-000000000011',
    'co-xuong-khop',
    'Tôi làm văn phòng ngồi máy tính nhiều, gần đây hay bị đau thắt lưng lan dọc xuống mông và mặt sau đùi phải, tê bì ngón chân cái. Xin bác sĩ tư vấn đây có phải dấu hiệu thoát vị đĩa đệm chèn ép dây thần kinh tọa không?',
    'Minh H',
    'CLEAR', CURRENT_TIMESTAMP,
    'PUBLISHED', '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
)
ON CONFLICT (id) DO NOTHING;

-- 7. Health Question Answers by Hospital Specialists
INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text, answer_hash, status, created_at, retention_expires_at
)
SELECT
    x.id, x.question_id, x.revision, x.doctor_user_id, x.answer_text,
    encode(digest(convert_to(x.answer_text, 'UTF8'), 'sha256'), 'hex'),
    'SUBMITTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '85 days'
FROM (VALUES
(
    'cc000000-0000-0000-0000-000000000001'::uuid,
    'cd000000-0000-0000-0000-000000000001'::uuid,
    1, '90000000-0000-0000-0000-000000000002'::uuid,
    'Chào bạn Thanh T., nhói ngực trái thoáng qua vài giây khi thức khuya kèm hồi hộp thường liên quan đến rối loạn thần kinh tim hoặc ngoại tâm thu kích phát do căng thẳng, thiếu ngủ hoặc lạm dụng caffein. Tuy nhiên, nếu cơn đau ngực có tính chất đè ép, siết chặt kéo dài trên 5 phút, lan lên hàm hoặc xuống cánh tay trái, bạn cần đến khám chuyên khoa Tim mạch ngay để đo điện tâm đồ và siêu âm Doppler tim nhằm loại trừ bệnh mạch vành tiềm ẩn.'
),
(
    'cc000000-0000-0000-0000-000000000002'::uuid,
    'cd000000-0000-0000-0000-000000000002'::uuid,
    1, '90000000-0000-0000-0000-000000000002'::uuid,
    'Chào bạn Nam V., vi khuẩn HP lây truyền chủ yếu qua đường miệng - miệng (nước bọt, dùng chung bát đũa, cốc uống nước) và đường phân - miệng. Khi trong gia đình có người nhiễm HP kèm viêm loét dạ dày tá tràng, các thành viên khác nên dùng đũa/thìa riêng khi gắp thức ăn, khử trùng bát đũa bằng nước nóng. Nếu người thân có triệu chứng đau dạ dày, khó tiêu hoặc gia đình có tiền sử ung thư dạ dày thì rất nên xét nghiệm hơi thở (C13/C14) để tầm soát sớm.'
),
(
    'cc000000-0000-0000-0000-000000000003'::uuid,
    'cd000000-0000-0000-0000-000000000003'::uuid,
    1, '90000000-0000-0000-0000-000000000002'::uuid,
    'Chào bạn Bích N., các triệu chứng đau nửa đầu một bên theo nhịp đập, kèm buồn nôn và nhạy cảm với ánh sáng/tiếng ồn là biểu hiện kinh điển của đau nửa đầu Migraine. Bạn nên ghi nhật ký đau đầu (ghi lại thực phẩm, giờ giấc ngủ, chu kỳ kinh nguyệt), nghỉ ngơi trong phòng tối yên tĩnh khi cơn đau xuất hiện. Bạn nên đặt lịch khám Nội Thần kinh để được bác sĩ chỉ định thuốc cắt cơn an toàn và phác đồ dự phòng giảm tần suất cơn đau.'
),
(
    'cc000000-0000-0000-0000-000000000004'::uuid,
    'cd000000-0000-0000-0000-000000000004'::uuid,
    1, '90000000-0000-0000-0000-000000000002'::uuid,
    'Chào mẹ bé, biểu hiện sốt cao 3 ngày rồi hạ sốt và bắt đầu phát ban hồng li ti là đặc trưng của sốt phát ban (Roseola Infantum) do virus. Thông thường khi ban đã mọc ra là bệnh đang bước vào giai đoạn lui và hồi phục. Mẹ tiếp tục cho bé uống nhiều nước, sữa, ăn cháo loãng, tắm nước ấm nhanh trong phòng kín gió. Nếu bé vẫn chơi ngoan và ăn uống tốt thì ban sẽ tự bay sau 3 - 5 ngày không để lại sẹo. Cần đi khám ngay nếu bé lừ đừ, bỏ bú hoặc nôn ói nhiều.'
),
(
    'cc000000-0000-0000-0000-000000000005'::uuid,
    'cd000000-0000-0000-0000-000000000005'::uuid,
    1, '90000000-0000-0000-0000-000000000002'::uuid,
    'Chào bạn Minh H., triệu chứng đau thắt lưng lan dọc mông, đùi xuống ngón chân cái kèm tê bì là dấu hiệu rõ ràng của chèn ép rễ thần kinh tọa L5-S1, nguyên nhân hàng đầu là thoái hóa hoặc thoát vị đĩa đệm cột sống thắt lưng. Bạn nên tránh ngồi liên tục quá 45 phút, không cúi gập người mang vật nặng. Bạn cần đi chụp cộng hưởng từ (MRI) cột sống thắt lưng để xác định chính xác vị trí và mức độ chèn ép, từ đó có phác đồ vật lý trị liệu phục hồi chức năng kịp thời.'
)
) AS x(id, question_id, revision, doctor_user_id, answer_text)
ON CONFLICT (id) DO NOTHING;

-- Re-enable triggers after deterministic seeding
ALTER TABLE patient_consultation_threads ENABLE TRIGGER trg_patient_consultation_thread_window_guard;
ALTER TABLE patient_consultation_participants ENABLE TRIGGER trg_patient_consultation_participant_guard;
ALTER TABLE health_questions ENABLE TRIGGER trg_health_question_owner_guard;
ALTER TABLE health_question_answers ENABLE TRIGGER trg_health_question_answer_guard;

-- 8. Seed Community Comments on Articles (Bác sĩ & Bệnh nhân thảo luận y khoa)
INSERT INTO article_comments (
    id, article_slug, author_user_id, author_name, author_role, content, created_at
)
SELECT
    'cb000000-0000-0000-0000-000000000001',
    a.slug,
    '90000000-0000-0000-0000-000000000003',
    'Nguyễn Văn An (Bệnh nhân)',
    'PATIENT',
    'Bài viết rất chi tiết và dễ hiểu thưa Bác sĩ. Tôi muốn hỏi thêm là người trên 50 tuổi có tiền sử mỡ máu cao thì nên thực hiện gói tầm soát tim mạch này bao lâu một lần là tốt nhất?',
    CURRENT_TIMESTAMP
FROM articles a
WHERE a.slug LIKE '%tim-mach%' OR a.slug LIKE '%kham%'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO article_comments (
    id, article_slug, author_user_id, author_name, author_role, content, parent_comment_id, created_at
)
SELECT
    'cb000000-0000-0000-0000-000000000002',
    ac.article_slug,
    '90000000-0000-0000-0000-000000000002',
    'TS.BS Nguyễn Minh Khôi - Khoa Tim mạch',
    'DOCTOR',
    'Chào anh An. Với người trên 50 tuổi có tiền sử rối loạn lipid máu, bác sĩ khuyến nghị nên tầm soát tim mạch định kỳ mỗi 6 tháng đến 1 năm một lần, bao gồm xét nghiệm mỡ máu toàn phần, đo điện tâm đồ và siêu âm tim để phát hiện sớm các mảng xơ vữa động mạch.',
    'cb000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP
FROM article_comments ac
WHERE ac.id = 'cb000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

-- 9. Initial AI Credit Transactions
INSERT INTO ai_credit_transactions (
    id, user_id, target_role, amount, balance_after, transaction_type, description, created_at
) VALUES
(
    'ca000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000003',
    'PATIENT', 100, 100, 'TIER_UPGRADE',
    'Nâng hạng thẻ thành viên Hạng Vàng (GOLD) tặng 100 lượt hỏi AI y khoa',
    CURRENT_TIMESTAMP
),
(
    'ca000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000003',
    'PATIENT', -15, 85, 'AI_CHAT_USAGE',
    'Đã sử dụng 15 lượt tư vấn triệu chứng sức khỏe cùng Trợ lý AI',
    CURRENT_TIMESTAMP
),
(
    'ca000000-0000-0000-0000-000000000003',
    '90000000-0000-0000-0000-000000000002',
    'DOCTOR', 150, 150, 'MONTHLY_REFILL',
    'Hạn mức AI Hỗ trợ chẩn đoán lâm sàng định kỳ cho Bác sĩ',
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
