-- V79__seed_demo_patient_clinical_history.sql
-- Ensure comprehensive clinical records (appointments, medical records, prescriptions, diagnostic tests)
-- for demo patient Nguyễn Văn An (patient@healthcare.com) are permanently seeded and reliably linked.

DO $$
DECLARE
    v_patient_id UUID;
    v_doctor_id UUID;
    v_branch_id UUID;
    v_specialty_id UUID;
BEGIN
    SELECT id INTO v_patient_id
    FROM patient_profiles
    WHERE email = 'patient@healthcare.com'
       OR id = '90000000-0000-0000-0000-000000000022'
    LIMIT 1;

    SELECT id INTO v_doctor_id
    FROM doctors
    WHERE id = '30000000-0000-0000-0000-000000000001'
       OR id = '30000000-0000-0000-0000-000000000002'
    LIMIT 1;

    SELECT id INTO v_branch_id
    FROM branches
    WHERE slug = 'cs-1' OR id = '20000000-0000-0000-0000-000000000001'
    LIMIT 1;

    SELECT id INTO v_specialty_id
    FROM specialties
    WHERE slug = 'tim-mach' OR id = '10000000-0000-0000-0000-000000000001'
    LIMIT 1;

    IF v_patient_id IS NOT NULL
       AND v_doctor_id IS NOT NULL
       AND v_branch_id IS NOT NULL
       AND v_specialty_id IS NOT NULL THEN

        -- Appointments
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

        -- Medical Record
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

        -- Prescriptions
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

        -- Diagnostic Results
        INSERT INTO diagnostic_results (
            id, patient_id, doctor_id, test_name, result, file_url, test_date
        ) VALUES
        ('80000000-0000-0000-0000-000000000001', v_patient_id, v_doctor_id, 'Điện tâm đồ vi tính 12 chuyển đạo (ECG)', 'Nhịp xoang đều, tần số tim 74 chu kỳ/phút. Trục điện tim trung gian. Các sóng P, QRS, T bình thường. Không ghi nhận dấu hiệu phì đại thất trái hay thiếu máu cục bộ cơ tim.', '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_DATE - INTERVAL '14 days'),
        ('80000000-0000-0000-0000-000000000002', v_patient_id, v_doctor_id, 'Siêu âm tim Doppler màu qua thành ngực', 'Các buồng tim kích thước trong giới hạn bình thường. Chức năng tâm thu thất trái bảo tồn tốt (LVEF = 65%). Không có rối loạn vận động vùng thành tim. Van hai lá và van động mạch chủ thanh mảnh, đóng mở tốt, không hở van bệnh lý. Không tràn dịch màng ngoài tim.', '/media/articles/dinh-duong-tang-huyet-ap.jpg', CURRENT_DATE - INTERVAL '14 days'),
        ('80000000-0000-0000-0000-000000000003', v_patient_id, v_doctor_id, 'Xét nghiệm Sinh hóa máu toàn bộ (Bộ Mỡ & Đường Máu)', 'Glucose máu lúc đói: 5.2 mmol/L (Bình thường 3.9 - 6.4). HbA1c: 5.4%. Cholesterol toàn phần: 5.6 mmol/L (Tăng nhẹ). Triglyceride: 1.9 mmol/L (Mục tiêu < 1.7). HDL-Cholesterol: 1.3 mmol/L. LDL-Cholesterol: 3.4 mmol/L. Chức năng thận: Creatinine 78 umol/L, eGFR 98 mL/min/1.73m2 (Bình thường). Men gan: AST 24 U/L, ALT 28 U/L.', '/media/articles/tam-soat-tieu-duong.jpg', CURRENT_DATE - INTERVAL '14 days')
        ON CONFLICT (id) DO NOTHING;

    END IF;
END $$;
