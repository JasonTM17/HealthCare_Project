-- Local career fixtures. Run only after V22__careers_and_job_applications.sql.
-- Kept separate from the V15-compatible content seed so migration tests can
-- exercise older schemas without referencing tables that do not exist yet.

INSERT INTO job_positions (
    id, slug, title, department, location, employment_type, summary,
    responsibilities, requirements, benefits, featured, active
) VALUES
(
    '90000000-0000-0000-0000-000000000001', 'dieu-duong-da-khoa', 'Điều dưỡng đa khoa',
    'Khối Điều dưỡng', 'Bệnh viện An Tâm Trung tâm', 'FULL_TIME',
    'Phối hợp cùng bác sĩ và đội ngũ chăm sóc để hỗ trợ người bệnh trong suốt quá trình thăm khám, điều trị.',
    E'Tiếp nhận, theo dõi và thực hiện chăm sóc người bệnh theo phân công\nThực hiện đúng quy trình an toàn người bệnh và kiểm soát nhiễm khuẩn\nGhi nhận thông tin chăm sóc đầy đủ, phối hợp bàn giao giữa các ca',
    E'Tốt nghiệp Cao đẳng hoặc Đại học chuyên ngành Điều dưỡng\nCó giấy phép hành nghề phù hợp theo quy định hiện hành\nGiao tiếp rõ ràng, tôn trọng người bệnh và phối hợp nhóm tốt',
    E'Quy trình hội nhập và hướng dẫn công việc rõ ràng\nTham gia đào tạo chuyên môn theo kế hoạch của bệnh viện\nChế độ làm việc và phúc lợi theo chính sách hiện hành',
    true, true
),
(
    '90000000-0000-0000-0000-000000000002', 'ky-thuat-vien-xet-nghiem', 'Kỹ thuật viên xét nghiệm',
    'Khối Cận lâm sàng', 'Bệnh viện An Tâm Trung tâm', 'FULL_TIME',
    'Thực hiện các bước tiếp nhận và xử lý mẫu xét nghiệm, góp phần bảo đảm kết quả chính xác và đúng thời gian.',
    E'Tiếp nhận, kiểm tra và xử lý mẫu theo quy trình chuyên môn\nVận hành thiết bị trong phạm vi được phân công và ghi nhận kiểm soát chất lượng\nPhối hợp trả kết quả và báo cáo các tình huống cần lưu ý',
    E'Tốt nghiệp chuyên ngành Kỹ thuật xét nghiệm y học\nCẩn trọng, có khả năng làm việc theo quy trình và theo ca\nƯu tiên ứng viên có giấy phép hành nghề phù hợp',
    E'Được hướng dẫn quy trình và hệ thống chất lượng khi nhận việc\nCơ hội học hỏi trong môi trường phối hợp đa chuyên khoa\nChế độ làm việc và phúc lợi theo chính sách hiện hành',
    false, true
),
(
    '90000000-0000-0000-0000-000000000003', 'chuyen-vien-cham-soc-khach-hang', 'Chuyên viên chăm sóc khách hàng',
    'Trải nghiệm người bệnh', 'Phòng khám An Tâm Thảo Điền', 'FULL_TIME',
    'Hướng dẫn người bệnh và thân nhân tiếp cận đúng dịch vụ, lịch khám và kênh hỗ trợ tại cơ sở.',
    E'Tiếp nhận nhu cầu, hướng dẫn thủ tục và điều phối thông tin tại quầy\nGiải đáp trong phạm vi được phân công, chuyển tiếp đúng bộ phận khi cần\nGhi nhận phản hồi để cải thiện trải nghiệm người bệnh',
    E'Tốt nghiệp Trung cấp, Cao đẳng hoặc Đại học\nGiọng nói rõ ràng, giao tiếp điềm tĩnh và chủ động\nCó thể sử dụng các công cụ văn phòng cơ bản',
    E'Được đào tạo về quy trình tiếp đón và bảo mật thông tin\nMôi trường làm việc phối hợp và tôn trọng\nChế độ làm việc và phúc lợi theo chính sách hiện hành',
    false, true
),
(
    '90000000-0000-0000-0000-000000000004', 'thuc-tap-sinh-hanh-chinh-nhan-su', 'Thực tập sinh Hành chính – Nhân sự',
    'Hành chính – Nhân sự', 'Văn phòng An Tâm Trung tâm', 'INTERNSHIP',
    'Hỗ trợ các công việc hành chính, lưu trữ và trải nghiệm nhân viên dưới sự hướng dẫn của phụ trách bộ phận.',
    E'Hỗ trợ chuẩn bị hồ sơ, biểu mẫu và sắp xếp tài liệu\nPhối hợp tổ chức hoạt động nội bộ theo kế hoạch\nCập nhật tiến độ công việc và bảo mật thông tin được tiếp cận',
    E'Sinh viên năm cuối các ngành Quản trị nhân lực, Hành chính hoặc ngành liên quan\nCẩn thận, đúng hẹn và sẵn sàng học hỏi\nSử dụng được các công cụ văn phòng cơ bản',
    E'Có người hướng dẫn trong thời gian thực tập\nĐược tiếp cận quy trình vận hành trong môi trường bệnh viện\nXác nhận thực tập theo quy định khi hoàn thành',
    false, true
)
ON CONFLICT (slug) DO NOTHING;
