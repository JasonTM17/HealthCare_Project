-- V59__seed_rich_patient_clinical_data_and_community_articles.sql
-- Seed comprehensive clinical records (appointments, medical record, prescription, diagnostic tests, notifications)
-- for patient@healthcare.com and rich medical community articles with real image photography.

DO $$
DECLARE
    v_patient_id UUID;
    v_doctor_id UUID := '30000000-0000-0000-0000-000000000001';
    v_branch_id UUID := '20000000-0000-0000-0000-000000000001';
    v_specialty_id UUID := '10000000-0000-0000-0000-000000000001';
BEGIN
    -- Only seed dependent clinical records in public schema if parent doctor, branch, specialty and patient profile exist
    IF current_schema() = 'public' THEN
        SELECT id INTO v_patient_id
        FROM patient_profiles
        WHERE id = '90000000-0000-0000-0000-000000000022'
           OR email = 'patient@healthcare.com'
        LIMIT 1;

        IF v_patient_id IS NOT NULL
           AND EXISTS (SELECT 1 FROM doctors WHERE id = v_doctor_id)
           AND EXISTS (SELECT 1 FROM branches WHERE id = v_branch_id)
           AND EXISTS (SELECT 1 FROM specialties WHERE id = v_specialty_id) THEN
        -- 2. Seed Appointments for patient@healthcare.com
        INSERT INTO appointments (
            id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
            appointment_date, start_time, end_time, appointment_time,
            status, payment_status, reason_for_visit, notes, has_insurance, synthetic_fixture
        ) VALUES
        (
            '40000000-0000-0000-0000-000000000011',
            'APT-2026-HC01',
            v_patient_id,
            v_doctor_id,
            v_branch_id,
            v_specialty_id,
            CURRENT_DATE - INTERVAL '14 days',
            '08:30:00', '09:00:00',
            (CURRENT_DATE - INTERVAL '14 days' + TIME '08:30:00')::timestamptz,
            'COMPLETED', 'PAID',
            'Khám sức khỏe tổng quát và kiểm tra huyết áp định kỳ',
            'Người bệnh đã hoàn tất buổi khám, đã có kết quả xét nghiệm và đơn thuốc điện tử.',
            true, false
        ),
        (
            '40000000-0000-0000-0000-000000000012',
            'APT-2026-HC02',
            v_patient_id,
            v_doctor_id,
            v_branch_id,
            v_specialty_id,
            CURRENT_DATE + INTERVAL '5 days',
            '09:00:00', '09:30:00',
            (CURRENT_DATE + INTERVAL '5 days' + TIME '09:00:00')::timestamptz,
            'CONFIRMED', 'PAID',
            'Tái khám đánh giá đáp ứng phác đồ thuốc huyết áp và mỡ máu',
            'Lịch tái khám hẹn trước theo chỉ định của Bác sĩ Khôi.',
            true, false
        )
        ON CONFLICT (id) DO NOTHING;

        -- 3. Seed Medical Record
        INSERT INTO medical_records (
            id, appointment_id, patient_id, doctor_id,
            icd10_code, icd10_name, diagnosis, symptoms_summary,
            blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight_kg, height_cm,
            treatment_plan, doctor_notes, follow_up_date
        ) VALUES (
            '60000000-0000-0000-0000-000000000011',
            '40000000-0000-0000-0000-000000000011',
            v_patient_id,
            v_doctor_id,
            'I10',
            'Bệnh tăng huyết áp vô căn (nguyên phát)',
            'Tăng huyết áp vô căn độ 1 (JNC 7) - Rối loạn chuyển hóa lipid máu hỗn hợp mức độ nhẹ',
            'Bệnh nhân thỉnh thoảng có cảm giác hồi hộp, tim đập nhanh khi leo cầu thang hoặc căng thẳng công việc. Buổi sáng hơi căng tức vùng sau gáy. Không đau thắt ngực, không khó thở khi nằm.',
            138, 88, 76, 36.6, 68.5, 172.0,
            'Khởi đầu phác đồ ức chế thụ thể kết hợp chẹn kênh canxi liều thấp. Tái khám sau 2 tuần để kiểm tra huyết áp mục tiêu (< 130/80 mmHg). Hướng dẫn thực hiện chế độ dinh dưỡng giảm muối DASH và tập thể dục vừa sức 30 phút mỗi ngày.',
            'Bệnh nhân tuân thủ và hiểu rõ lời dặn. Đã cấp máy đo huyết áp bắp tay và dặn ghi nhật ký huyết áp sáng - tối.',
            CURRENT_DATE + INTERVAL '5 days'
        )
        ON CONFLICT (id) DO NOTHING;

        -- 4. Seed Prescription and Prescription Items
        INSERT INTO prescriptions (
            id, medical_record_id, prescription_code, patient_id, doctor_id,
            diagnosis_summary, general_advice, status
        ) VALUES (
            '70000000-0000-0000-0000-000000000011',
            '60000000-0000-0000-0000-000000000011',
            'RX-2026-08892',
            v_patient_id,
            v_doctor_id,
            'Tăng huyết áp độ 1 - Rối loạn lipid máu',
            'Uống thuốc đúng giờ sau bữa ăn sáng. Giảm ăn mặn (dưới 5g muối/ngày), kiêng rượu bia và thuốc lá. Uống đủ 2 lít nước mỗi ngày.',
            'ACTIVE'
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO prescription_items (
            id, prescription_id, medication_name, active_ingredient, dosage, unit, frequency, duration_days, total_quantity, usage_note
        ) VALUES
        ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000011', 'Amlodipine 5mg', 'Amlodipine besylate', '1 viên', 'Viên nén', '1 lần/ngày (Sáng)', 14, 14, 'Uống 1 viên vào 08:00 sáng sau ăn no'),
        ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000011', 'Losartan Potassium 50mg', 'Losartan', '1 viên', 'Viên bao phim', '1 lần/ngày (Sáng)', 14, 14, 'Uống kèm với Amlodipine vào buổi sáng'),
        ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000011', 'Atorvastatin 10mg', 'Atorvastatin calcium', '1 viên', 'Viên nén', '1 lần/ngày (Tối)', 14, 14, 'Uống 1 viên trước khi đi ngủ lúc 21:00'),
        ('71000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000011', 'Magne-B6 Corbière', 'Magnesi lactat + Pyridoxin', '1 viên', 'Viên bao', '2 lần/ngày (Sáng - Chiều)', 14, 28, 'Uống sau ăn no, hỗ trợ giảm căng thẳng thần kinh')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO diagnostic_results (
            id, patient_id, doctor_id, test_name, result, file_url, test_date
        ) VALUES
        ('80000000-0000-0000-0000-000000000001', v_patient_id, v_doctor_id, 'Điện tâm đồ vi tính 12 chuyển đạo (ECG)', 'Nhịp xoang đều, tần số tim 74 chu kỳ/phút. Trục điện tim trung gian. Các sóng P, QRS, T bình thường. Không ghi nhận dấu hiệu phì đại thất trái hay thiếu máu cục bộ cơ tim.', '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_DATE - INTERVAL '14 days'),
        ('80000000-0000-0000-0000-000000000002', v_patient_id, v_doctor_id, 'Siêu âm tim Doppler màu qua thành ngực', 'Các buồng tim kích thước trong giới hạn bình thường. Chức năng tâm thu thất trái bảo tồn tốt (LVEF = 65%). Không có rối loạn vận động vùng thành tim. Van hai lá và van động mạch chủ thanh mảnh, đóng mở tốt, không hở van bệnh lý. Không tràn dịch màng ngoài tim.', '/media/articles/dinh-duong-tang-huyet-ap.jpg', CURRENT_DATE - INTERVAL '14 days'),
        ('80000000-0000-0000-0000-000000000003', v_patient_id, v_doctor_id, 'Xét nghiệm Sinh hóa máu toàn bộ (Bộ Mỡ & Đường Máu)', 'Glucose máu lúc đói: 5.2 mmol/L (Bình thường 3.9 - 6.4). HbA1c: 5.4%. Cholesterol toàn phần: 5.6 mmol/L (Tăng nhẹ). Triglyceride: 1.9 mmol/L (Mục tiêu < 1.7). HDL-Cholesterol: 1.3 mmol/L. LDL-Cholesterol: 3.4 mmol/L. Chức năng thận: Creatinine 78 umol/L, eGFR 98 mL/min/1.73m2 (Bình thường). Men gan: AST 24 U/L, ALT 28 U/L.', '/media/articles/tam-soat-tieu-duong.jpg', CURRENT_DATE - INTERVAL '14 days')
        ON CONFLICT (id) DO NOTHING;

    END IF;
    END IF;
END $$;
-- 6. Seed System Notifications
INSERT INTO notifications (
    id, user_id, event_type, title, message, is_read, created_at
) VALUES
(
    '85000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000021',
    'APPOINTMENT_CONFIRMED',
    'Lịch hẹn khám đã được xác nhận thành công',
    'Lịch tái khám chuyên khoa Tim mạch cùng TS.BS Nguyễn Minh Khôi lúc 09:00 tại Bệnh viện Đa khoa Sài Gòn Xanh đã được hệ thống xác nhận.',
    false,
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    '85000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000021',
    'DIAGNOSTIC_READY',
    'Đã có kết quả cận lâm sàng mới',
    'Kết quả Điện tâm đồ 12 chuyển đạo và Siêu âm tim Doppler màu của bạn đã được Bác sĩ ký số hoàn tất và đồng bộ vào hồ sơ bệnh án.',
    false,
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    '85000000-0000-0000-0000-000000000003',
    '90000000-0000-0000-0000-000000000021',
    'PRESCRIPTION_ISSUED',
    'Đơn thuốc điện tử mới được phát hành',
    'Bác sĩ Nguyễn Minh Khôi đã phát hành toa thuốc điện tử mã RX-2026-08892. Vui lòng kiểm tra hướng dẫn liều dùng và thời gian uống.',
    true,
    CURRENT_TIMESTAMP - INTERVAL '3 days'
),
(
    '85000000-0000-0000-0000-000000000004',
    '90000000-0000-0000-0000-000000000021',
    'TIER_UPGRADE',
    'Chúc mừng bạn đã đạt Hạng Hội Viên Vàng',
    'Hồ sơ sức khỏe của bạn đã được nâng hạng lên Hạng Vàng (Gold Privilege) với 85 lượt Trợ lý Y khoa AI và dịch vụ ưu tiên điều phối khám.',
    true,
    CURRENT_TIMESTAMP - INTERVAL '7 days'
)
ON CONFLICT (id) DO NOTHING;

-- 7. Update Existing Articles & Insert Rich Medical Journal Articles with Real Photography
UPDATE articles
SET cover_image_url = '/media/articles/tre-bieng-an.jpg'
WHERE slug = 'tre-bieng-an';

UPDATE articles
SET cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg'
WHERE slug = 'che-do-dinh-duong-cho-nguoi-tang-huyet-ap';

UPDATE articles
SET cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg'
WHERE slug = '5-dau-hieu-canh-bao-benh-tim-mach';

-- Insert New Rich In-Depth Articles
INSERT INTO articles (
    id, title, slug, summary, body, published_at, active, category,
    author_name, reading_minutes, related_specialty_slug, cover_image_url,
    content_language, content_kind, audience, sections, tags, topic_tags,
    key_takeaways, warning_signs, prevention_tips, source_references, clinical_metadata
) VALUES
(
    'a1000000-0000-0000-0000-000000000001',
    'Tầm soát và phòng ngừa biến chứng đái tháo đường Type 2 sớm',
    'tam-soat-va-phong-ngua-tieu-duong-type-2',
    'Đái tháo đường Type 2 thường diễn tiến âm thầm trong nhiều năm mà không có triệu chứng rõ rệt. Phát hiện sớm bằng xét nghiệm đường huyết và chỉ số HbA1c giúp ngăn ngừa 80% nguy cơ biến chứng tim mạch, suy thận và tổn thương võng mạc.',
    'Đái tháo đường Type 2 là bệnh lý rối loạn chuyển hóa mạn tính đặc trưng bởi tình trạng tăng đường huyết do kháng insulin hoặc thiếu hụt insulin tương đối. Theo số liệu dịch tễ học của Liên đoàn Đái tháo đường Quốc tế (IDF), hiện có hơn 50% người mắc đái tháo đường tại Việt Nam chưa được chẩn đoán.

1. Những đối tượng có nguy cơ cao cần tầm soát sớm:
- Người từ 35 tuổi trở lên, đặc biệt là người thừa cân hoặc béo phì (BMI > 23 theo chuẩn người châu Á).
- Người có người thân thế hệ thứ nhất (cha, mẹ, anh chị em ruột) mắc đái tháo đường.
- Phụ nữ từng có tiền sử đái tháo đường thai kỳ hoặc sinh con nặng trên 4kg.
- Người có lối sống tĩnh tại, ít vận động thể lực dưới 150 phút mỗi tuần.
- Người có tiền sử tăng huyết áp (> 140/90 mmHg) hoặc rối loạn lipid máu (HDL < 0.9 mmol/L, Triglyceride > 2.8 mmol/L).

2. Các xét nghiệm chẩn đoán tiêu chuẩn:
- Đường huyết tương lúc đói (FPG): Thực hiện sau khi nhịn ăn ít nhất 8 giờ. Giá trị bình thường từ 3.9 đến 5.5 mmol/L. Ngưỡng chẩn đoán đái tháo đường là >= 7.0 mmol/L trong hai lần xét nghiệm độc lập.
- Chỉ số HbA1c: Đo lường tỷ lệ hemoglobin gắn đường trong hồng cầu, phản ánh mức đường huyết trung bình trong 2 - 3 tháng gần nhất. Giá trị HbA1c >= 6.5% xác định chẩn đoán đái tháo đường.
- Nghiệm pháp dung nạp glucose đường uống (OGTT): Thường áp dụng để tầm soát đái tháo đường thai kỳ hoặc khi nghi ngờ tiền đái tháo đường.

3. Kế hoạch phòng ngừa và thay đổi lối sống:
- Giảm 5 - 7% trọng lượng cơ thể nếu đang thừa cân giúp cải thiện độ nhạy insulin lên đến 58%.
- Tăng cường chất xơ hòa tan từ rau xanh, yến mạch, đậu nành và gạo lứt; hạn chế tối đa các loại đồ uống có đường, trà sữa và bánh ngọt.
- Duy trì vận động thể chất: Đi bộ nhanh, đạp xe hoặc bơi lội ít nhất 30 phút mỗi ngày, 5 ngày mỗi tuần.',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    true,
    'Nội tiết & Chuyển hóa',
    'BS.CKII Võ Thị Mai',
    6,
    'noi-tong-hop',
    '/media/articles/tam-soat-tieu-duong.jpg',
    'vi', 'GENERAL', 'PATIENT',
    '[]'::jsonb, '["tiểu đường", "hba1c", "tầm soát"]'::jsonb, '["đái tháo đường", "nội tiết"]'::jsonb,
    '["Tầm soát định kỳ bằng xét nghiệm HbA1c và đường huyết lúc đói", "Giảm 5-7% cân nặng giúp hạ 58% nguy cơ mắc bệnh", "Tập thể dục ít nhất 150 phút/tuần"]'::jsonb,
    '["Khát nước nhiều, uống nhiều nhưng vẫn khát", "Đi tiểu đêm nhiều lần không rõ nguyên nhân", "Sụt cân không giải thích được dù ăn uống bình thường", "Vết thương hoặc vết trầy xước lâu lành"]'::jsonb,
    '["Kiểm tra đường huyết định kỳ 6 tháng một lần", "Hạn chế carbohydrate tinh chế và nước ngọt có ga", "Duy trì chỉ số khối cơ thể BMI từ 18.5 - 22.9"]'::jsonb,
    '["Hướng dẫn chẩn đoán và điều trị đái tháo đường Type 2 - Bộ Y tế Việt Nam", "American Diabetes Association (ADA) Standards of Care in Diabetes - 2026"]'::jsonb,
    '{}'::jsonb
),
(
    'a1000000-0000-0000-0000-000000000002',
    'Thoái hóa cột sống thắt lưng: Phòng ngừa và phục hồi chức năng không phẫu thuật',
    'thoai-hoa-cot-song-that-lung-phong-ngua',
    'Đau lưng dưới âm ỉ, cứng khớp buổi sáng và cảm giác tê bì lan xuống mông là những dấu hiệu cảnh báo thoái hóa cột sống thắt lưng sớm. Hơn 90% trường hợp có thể cải thiện tốt nhờ phác đồ bảo tồn kết hợp vật lý trị liệu đúng cách.',
    'Thoái hóa cột sống thắt lưng (Lumbar Spondylosis) là quá trình lão hóa tự nhiên của sụn khớp, đĩa đệm và các đốt sống vùng thắt lưng (thường gặp nhất ở đoạn L4-L5 và L5-S1). Đây là nguyên nhân hàng đầu gây đau lưng cơ năng và giảm khả năng lao động ở người trưởng thành và cao tuổi.

1. Nguyên nhân và yếu tố nguy cơ thường gặp:
- Tuổi tác: Quá trình mất nước của đĩa đệm bắt đầu diễn ra từ sau tuổi 30, làm giảm khả năng chịu tải và giảm độ đàn hồi cột sống.
- Tư thế sinh hoạt và làm việc sai: Ngồi làm việc trước máy tính liên tục trên 6 - 8 giờ mà không đổi tư thế, cúi gập người khi nâng vác vật nặng thay vì gập gối.
- Thừa cân, béo phì: Làm tăng trọng lượng tỳ đè liên tục lên cột sống thắt lưng.
- Ít vận động: Khiến hệ cơ vùng thắt lưng và cơ bụng suy yếu, không hỗ trợ nâng đỡ cột sống hiệu quả.

2. Phác đồ điều trị bảo tồn không dùng phẫu thuật:
- Điều trị nội khoa giảm đau và chống viêm: Trong giai đoạn đau cấp tính, bác sĩ có thể chỉ định các thuốc kháng viêm không steroid (NSAID), thuốc giãn cơ và bổ sung dưỡng chất nuôi sụn khớp (Glucosamine, Chondroitin, Collagen Type 2).
- Vật lý trị liệu và phục hồi chức năng:
  + Kéo giãn cột sống bằng máy vi tính: Giúp giải tỏa áp lực nội đĩa đệm, tạo điều kiện cho đĩa đệm tái hấp thu nước và chất dinh dưỡng.
  + Sóng siêu âm trị liệu và điện xung kích thích thần kinh qua da (TENS): Giảm co thắt cơ thắt lưng và tăng cường tuần hoàn nuôi dưỡng tại chỗ.
  + Các bài tập ổn định cơ cốt lõi (Core Stability Exercises): Tăng cường sức mạnh cơ bụng và cơ dựng sống thắt lưng.

3. Lời khuyên công thái học (Ergonomics) trong công việc hàng ngày:
- Sử dụng ghế làm việc có tựa lưng nâng đỡ đường cong sinh lý thắt lưng (thắt lưng chạm nhẹ vào đệm tựa).
- Màn hình máy tính đặt ngang tầm mắt để cổ không bị cúi gập quá 15 độ.
- Cứ sau 45 - 60 phút làm việc, đứng dậy đi lại và thực hiện các động tác vươn vai nhẹ nhàng trong 2 - 3 phút.',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    true,
    'Cơ xương khớp & PHCN',
    'ThS.BS Phạm Hoàng Yến',
    5,
    'co-xuong-khop',
    '/media/articles/thoai-hoa-cot-song.jpg',
    'vi', 'GENERAL', 'PATIENT',
    '[]'::jsonb, '["cột sống", "đau lưng", "thoái hóa"]'::jsonb, '["cơ xương khớp", "vật lý trị liệu"]'::jsonb,
    '["90% bệnh nhân cải thiện tốt với điều trị bảo tồn mà không cần phẫu thuật", "Các bài tập tăng cường cơ lõi bụng và lưng giúp giảm đau bền vững", "Thay đổi tư thế ngồi và làm việc sau mỗi 60 phút"]'::jsonb,
    '["Đau lưng dữ dội không thuyên giảm khi nghỉ ngơi", "Tê bì, yếu chân hoặc mất cảm giác mu bàn chân", "Rối loạn tiểu tiện hoặc đại tiện (Hội chứng chùm đuôi ngựa - Cần cấp cứu y tế)"]'::jsonb,
    '["Tập thói quen nâng vật nặng bằng chân, giữ lưng thẳng", "Tập bơi lội hoặc yoga nhẹ nhàng 3 lần mỗi tuần", "Duy trì cân nặng hợp lý để tránh tạo áp lực lên cột sống"]'::jsonb,
    '["North American Spine Society (NASS) Evidence-Based Clinical Guidelines", "Khuyến cáo điều trị đau thắt lưng cơ năng - Hội Thấp khớp học Việt Nam"]'::jsonb,
    '{}'::jsonb
),
(
    'a1000000-0000-0000-0000-000000000003',
    'Viêm loét dạ dày - tá tràng do vi khuẩn HP: Cơ chế lây truyền và phác đồ tiệt trừ',
    'viem-loet-da-day-hp-va-nhung-dieu-can-biet',
    'Vi khuẩn Helicobacter pylori (HP) là nguyên nhân của hơn 80% trường hợp viêm loét dạ dày tá tràng và là yếu tố nguy cơ nhóm 1 gây ung thư biểu mô dạ dày. Hiểu đúng con đường lây truyền và tuân thủ phác đồ điều trị 14 ngày là chìa khóa tiệt trừ dứt điểm.',
    'Helicobacter pylori (H. pylori) là một loại vi khuẩn gram âm hình xoắn khuẩn có khả năng tồn tại và phát triển trong môi trường acid đậm đặc của dịch dạ dày nhờ tiết ra enzyme urease trung hòa acid tại chỗ.

1. Con đường lây truyền trong cộng đồng:
- Đường miệng - miệng: Là con đường lây truyền phổ biến nhất tại Việt Nam thông qua thói quen ăn uống chung bát nước chấm, gắp thức ăn cho nhau, dùng chung thìa đũa hoặc mẹ mớm cơm cho con.
- Đường phân - miệng: Vi khuẩn đào thải qua phân người bệnh và lây nhiễm vào nguồn nước sinh hoạt hoặc rau sống không được rửa sạch đúng quy trình.
- Lây nhiễm chéo qua thiết bị y tế: Dụng cụ nội soi dạ dày không được khử khuẩn mức độ cao đúng chuẩn.

2. Các phương pháp xét nghiệm chẩn đoán HP chính xác:
- Test hơi thở C13 hoặc C14 (Urea Breath Test): Là tiêu chuẩn vàng không xâm lấn, độ nhạy và độ đặc hiệu đạt trên 95%. Rất thích hợp để kiểm tra sau khi hoàn tất đợt điều trị tiệt trừ.
- Nội soi dạ dày bấm sinh thiết làm xét nghiệm Clo-test (Rapid Urease Test): Thường được thực hiện khi bệnh nhân có chỉ định nội soi để quan sát trực tiếp mức độ tổn thương niêm mạc dạ dày và loại trừ polyp hoặc khối u.
- Xét nghiệm kháng nguyên HP trong phân: Độ chính xác cao, thích hợp cho trẻ em hoặc người không thể làm test hơi thở.
Lưu ý quan trọng: Trước khi xét nghiệm HP ít nhất 2 tuần, người bệnh phải ngừng sử dụng thuốc ức chế tiết acid dạ dày (PPI), và ngừng kháng sinh ít nhất 4 tuần để tránh kết quả âm tính giả.

3. Phác đồ điều trị tiệt trừ HP chuẩn 2026:
- Phác đồ 4 thuốc có Bismuth kéo dài 14 ngày là phác đồ đầu tay được khuyến cáo tại Việt Nam do tình trạng vi khuẩn kháng Clarithromycin tăng cao.
- Thành phần phác đồ:
  + Thuốc ức chế bơm proton (PPI) liều cao: Esomeprazole 40mg x 2 lần/ngày.
  + Bismuth subcitrate: 2 lần/ngày (trước ăn).
  + Metronidazole hoặc Tinidazole: 500mg x 2 lần/ngày (sau ăn).
  + Tetracycline: 500mg x 4 lần/ngày (sau ăn).
- Yêu cầu tuân thủ: Người bệnh bắt buộc phải uống đúng giờ, đủ liều và không được tự ý ngừng thuốc khi thấy triệu chứng thuyên giảm.',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    true,
    'Tiêu hóa & Gan mật',
    'BS.CKI Lê Văn Đức',
    7,
    'tieu-hoa',
    '/media/articles/viem-loet-da-day.jpg',
    'vi', 'GENERAL', 'PATIENT',
    '[]'::jsonb, '["dạ dày", "vi khuẩn hp", "tiêu hóa"]'::jsonb, '["tiêu hóa", "nội soi dạ dày"]'::jsonb,
    '["Test hơi thở C13 là tiêu chuẩn vàng không xâm lấn để kiểm tra vi khuẩn HP", "Phác đồ 4 thuốc có Bismuth trong 14 ngày đạt tỷ lệ tiệt trừ trên 90%", "Dừng thuốc PPI trước 2 tuần và kháng sinh trước 4 tuần để tránh âm tính giả"]'::jsonb,
    '["Nôn ra máu hoặc đi ngoài phân đen như bã cà phê", "Đau bụng vùng thượng vị dữ dội đột ngột (Nguy cơ thủng dạ dày)", "Nuốt nghẹn, sụt cân nhanh không rõ nguyên nhân", "Thiếu máu da xanh xao mệt mỏi kéo dài"]'::jsonb,
    '["Ăn chín, uống sôi, không dùng chung thìa đũa và bát nước chấm", "Rửa tay bằng xà phòng trước khi ăn và sau khi đi vệ sinh", "Hạn chế đồ ăn cay nóng, thực phẩm ngâm muối chua và rượu bia"]'::jsonb,
    '["Maastricht VI/Florence Consensus Report on Helicobacter pylori management", "Đồng thuận chẩn đoán và điều trị nhiễm Helicobacter pylori tại Việt Nam"]'::jsonb,
    '{}'::jsonb
),
(
    'a1000000-0000-0000-0000-000000000004',
    'Phòng ngừa đột quỵ ở người trẻ và trung niên: Nhận diện sớm dấu hiệu FAST',
    'phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien',
    'Tỷ lệ đột quỵ não ở người dưới 45 tuổi đang có xu hướng gia tăng đáng báo động do áp lực công việc, thói quen thức khuya, lạm dụng rượu bia và các bệnh lý mạn tính không được kiểm soát. Mỗi phút não thiếu máu, 2 triệu tế bào thần kinh sẽ chết đi vĩnh viễn.',
    'Đột quỵ não (Tai biến mạch máu não) xảy ra khi dòng máu cung cấp cho một phần của não bộ bị gián đoạn đột ngột do tắc mạch máu não (Đột quỵ nhồi máu não - chiếm khoảng 85%) hoặc vỡ mạch máu não (Đột quỵ xuất huyết não - chiếm khoảng 15%).

1. Vì sao đột quỵ ngày càng trẻ hóa?
- Tăng huyết áp không được phát hiện sớm: Người trẻ thường chủ quan, ít khi đo huyết áp định kỳ nên không biết mình bị huyết áp cao âm thầm tàn phá mạch máu não.
- Lối sống tĩnh tại và căng thẳng mãn tính: Áp lực công việc, thức khuya thường xuyên làm tăng tiết hormone cortisol và adrenaline, gây co thắt mạch máu và tăng nguy cơ hình thành cục máu đông.
- Thói quen hút thuốc lá và sử dụng chất kích thích: Nicotine làm xơ cứng thành động mạch và tăng độ nhớt của máu lên gấp 3 lần.
- Rối loạn lipid máu và đái tháo đường khởi phát sớm do chế độ ăn nhiều chất béo bão hòa và thức ăn nhanh.

2. Quy tắc FAST - Nhận diện nhanh dấu hiệu đột quỵ trong 1 phút:
- F (Face - Mặt): Một bên mặt bị xệ xuống, nụ cười méo mó, nhân trung lệch sang một bên khi cười hoặc nhe răng.
- A (Arm - Tay): Một bên tay hoặc chân bị yếu liệt, không thể nâng đều cả hai tay lên cao cùng lúc.
- S (Speech - Lời nói): Nói ngọng, phát âm khó khăn, giọng nói biến đổi hoặc không nói được câu đơn giản hoàn chỉnh.
- T (Time - Thời gian): Khi xuất hiện bất kỳ dấu hiệu nào ở trên, cần gọi ngay xe cấp cứu 115 hoặc đưa người bệnh đến bệnh viện có đơn vị đột quỵ gần nhất ngay lập tức.

3. "Thời gian vàng" trong cấp cứu đột quỵ não:
- Cửa sổ thời gian vàng để dùng thuốc tiêu sợi huyết đường tĩnh mạch (rtPA) làm tan cục máu đông là trong vòng 4.5 giờ đầu kể từ khi khởi phát triệu chứng.
- Can thiệp lấy huyết khối bằng dụng cụ cơ học qua đường ống thông có thể thực hiện trong vòng 6 giờ đầu (hoặc mở rộng đến 24 giờ với các kỹ thuật chụp hình ảnh học tưới máu não hiện đại).
CẢNH BÁO QUAN TRỌNG: Tuyệt đối không cạo gió, không chích lể đầu ngón tay, không vắt chanh vào miệng hoặc cho uống thuốc An Cung Ngưu Hoàng Hoàn khi chưa có chẩn đoán loại trừ xuất huyết não từ bác sĩ vì có thể gây sặc tắc đường thở và tử vong.',
    CURRENT_TIMESTAMP,
    true,
    'Thần kinh & Đột quỵ',
    'ThS.BS Trần Thu Hà',
    8,
    'than-kinh',
    '/media/articles/phong-ngua-dot-quy.jpg',
    'vi', 'GENERAL', 'PATIENT',
    '[]'::jsonb, '["đột quỵ", "fast", "thần kinh", "cấp cứu"]'::jsonb, '["thần kinh", "tim mạch"]'::jsonb,
    '["Nhớ kỹ quy tắc FAST: Mặt méo, Tay yếu, Lời nói khó, Thời gian cấp cứu", "Cửa sổ thời gian vàng cấp cứu nhồi máu não là 4.5 giờ đầu tiên", "Tuyệt đối không chích lể hay cho uống thuốc dân gian khi nghi ngờ đột quỵ"]'::jsonb,
    '["Méo miệng, tê bì hoặc liệt nửa người đột ngột", "Mất thị lực một mắt hoặc nhìn đôi đột ngột", "Đau đầu dữ dội đột ngột không rõ nguyên nhân (đau như sét đánh)", "Chóng mặt mất thăng bằng, đi đứng lảo đảo"]'::jsonb,
    '["Đo và kiểm soát huyết áp dưới mức 130/80 mmHg", "Bỏ hoàn toàn thuốc lá và thuốc lá điện tử", "Ngủ đủ 7-8 tiếng mỗi đêm, hạn chế thức khuya sau 23h"]'::jsonb,
    '["American Heart Association / American Stroke Association (AHA/ASA) Guidelines - 2026", "Khuyến cáo chẩn đoán và xử trí đột quỵ não cấp - Hội Đột quỵ Việt Nam"]'::jsonb,
    '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    body = EXCLUDED.body,
    cover_image_url = EXCLUDED.cover_image_url,
    category = EXCLUDED.category,
    author_name = EXCLUDED.author_name;

-- 8. Seed Discussion Comments from Patients and Verified Doctors
DO $$
BEGIN
    IF current_schema() = 'public' THEN
        INSERT INTO article_comments (
            id, article_slug, author_user_id, author_name, author_role, content, created_at
        )
        SELECT
            c.id::uuid,
            c.article_slug,
            u.id,
            c.author_name,
            c.author_role,
            c.content,
            c.created_at
        FROM (VALUES
            (
                'c1000000-0000-0000-0000-000000000001',
                'phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien',
                '90000000-0000-0000-0000-000000000021',
                'Lê Thị Bích Ngọc',
                'PATIENT',
                'Chào Bác sĩ, tôi năm nay 34 tuổi, dạo gần đây hay bị đau nhức nửa đầu bên phải kèm hoa mắt khi thức dậy. Đây có phải là dấu hiệu báo trước của đột quỵ không ạ?',
                CURRENT_TIMESTAMP - INTERVAL '18 hours'
            ),
            (
                'c1000000-0000-0000-0000-000000000002',
                'phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien',
                '90000000-0000-0000-0000-000000000023',
                'ThS.BS Trần Thu Hà',
                'DOCTOR',
                'Chào bạn Bích Ngọc. Triệu chứng đau nửa đầu kèm hoa mắt có thể do chứng đau nửa đầu Migraine, rối loạn tiền đình hoặc co thắt mạch máu não do căng thẳng. Tuy nhiên nếu triệu chứng xuất hiện đột ngột và dữ dội, bạn nên đến chuyên khoa Thần kinh để đo huyết áp, đo lưu huyết não và chụp cộng hưởng từ MRI sọ não nhằm loại trừ các dị dạng mạch máu não tiềm ẩn nhé.',
                CURRENT_TIMESTAMP - INTERVAL '15 hours'
            ),
            (
                'c1000000-0000-0000-0000-000000000003',
                'viem-loet-da-day-hp-va-nhung-dieu-can-biet',
                '90000000-0000-0000-0000-000000000021',
                'Trần Văn Nam',
                'PATIENT',
                'Thưa Bác sĩ, tôi vừa điều trị xong phác đồ 14 ngày tiệt trừ HP. Bao lâu sau tôi có thể làm test hơi thở để kiểm tra vi khuẩn đã hết chưa ạ?',
                CURRENT_TIMESTAMP - INTERVAL '1 day'
            ),
            (
                'c1000000-0000-0000-0000-000000000004',
                'viem-loet-da-day-hp-va-nhung-dieu-can-biet',
                '90000000-0000-0000-0000-000000000023',
                'BS.CKI Lê Văn Đức',
                'DOCTOR',
                'Chào bạn Nam. Bạn cần đợi ít nhất 4 tuần sau khi kết thúc viên kháng sinh cuối cùng, và ngừng thuốc giảm tiết acid (PPI) ít nhất 2 tuần trước khi làm test hơi thở C13 để đảm bảo kết quả chính xác nhất, tránh âm tính giả bạn nhé.',
                CURRENT_TIMESTAMP - INTERVAL '22 hours'
            ),
            (
                'c1000000-0000-0000-0000-000000000005',
                'tam-soat-va-phong-ngua-tieu-duong-type-2',
                '90000000-0000-0000-0000-000000000021',
                'Nguyễn Văn An',
                'PATIENT',
                'Bài viết rất hữu ích cho người bệnh. Tôi có bố bị tiểu đường, xét nghiệm HbA1c gần nhất của tôi là 5.4% thì đã an tâm chưa Bác sĩ?',
                CURRENT_TIMESTAMP - INTERVAL '2 days'
            ),
            (
                'c1000000-0000-0000-0000-000000000006',
                'tam-soat-va-phong-ngua-tieu-duong-type-2',
                '90000000-0000-0000-0000-000000000023',
                'BS.CKII Võ Thị Mai',
                'DOCTOR',
                'Chào bạn An. Chỉ số HbA1c 5.4% là hoàn toàn bình thường (ngưỡng an toàn là dưới 5.7%). Do có yếu tố gia đình, bạn nên duy trì chế độ ăn lành mạnh ít tinh bột nhanh và tái xét nghiệm định kỳ mỗi 6 tháng đến 1 năm nhé.',
                CURRENT_TIMESTAMP - INTERVAL '1 day'
            )
        ) AS c(id, article_slug, author_user_id, author_name, author_role, content, created_at)
        JOIN users u ON u.id = c.author_user_id::uuid
        JOIN articles a ON a.slug = c.article_slug
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
