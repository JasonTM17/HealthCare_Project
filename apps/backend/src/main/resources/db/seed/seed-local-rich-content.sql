-- ============================================================================
-- Rich local content overlay for the Stitch detail screens.
-- Requires Flyway migration V15. It only fills the new fields when they are
-- still empty, so re-running local seed does not overwrite admin edits.
-- ============================================================================

UPDATE specialties
SET common_symptoms = CASE slug
        WHEN 'tim-mach' THEN '["Đau tức ngực khi gắng sức","Khó thở","Hồi hộp, đánh trống ngực"]'::jsonb
        WHEN 'than-kinh' THEN '["Đau đầu kéo dài","Chóng mặt","Rối loạn giấc ngủ"]'::jsonb
        WHEN 'tieu-hoa' THEN '["Đau bụng tái diễn","Đầy hơi, khó tiêu","Thay đổi thói quen đại tiện"]'::jsonb
        WHEN 'noi-tong-hop' THEN '["Mệt mỏi kéo dài","Khát nước nhiều","Chỉ số đường huyết bất thường"]'::jsonb
        WHEN 'nhi-khoa' THEN '["Sốt hoặc ho kéo dài","Biếng ăn, sụt cân","Thay đổi giấc ngủ"]'::jsonb
        WHEN 'san-phu-khoa' THEN '["Đau bụng dưới bất thường","Rối loạn chu kỳ","Ra huyết bất thường"]'::jsonb
        WHEN 'co-xuong-khop' THEN '["Đau hoặc cứng khớp","Hạn chế vận động","Đau tăng khi thay đổi thời tiết"]'::jsonb
        WHEN 'tai-mui-hong' THEN '["Nghẹt mũi hoặc đau họng","Ù tai","Chóng mặt khi thay đổi tư thế"]'::jsonb
    END,
    preparation_steps = CASE slug
        WHEN 'tim-mach' THEN '["Mang theo kết quả đo huyết áp gần đây","Liệt kê thuốc đang sử dụng","Không tự ý ngừng thuốc trước khi khám"]'::jsonb
        WHEN 'than-kinh' THEN '["Ghi lại thời điểm và mức độ triệu chứng","Mang theo phim hoặc kết quả khám cũ","Nghỉ ngơi trước buổi khám"]'::jsonb
        WHEN 'tieu-hoa' THEN '["Ghi lại thực phẩm gây khó chịu","Hỏi trước nếu cần nhịn ăn","Mang theo đơn thuốc và kết quả nội soi"]'::jsonb
        WHEN 'noi-tong-hop' THEN '["Nhịn ăn theo hướng dẫn nếu có xét nghiệm","Mang sổ theo dõi chỉ số tại nhà","Chuẩn bị danh sách bệnh nền"]'::jsonb
        WHEN 'nhi-khoa' THEN '["Mang sổ tiêm chủng và cân nặng gần đây","Ghi lại thuốc đã dùng","Cho trẻ mặc trang phục dễ kiểm tra"]'::jsonb
        WHEN 'san-phu-khoa' THEN '["Ghi lại ngày đầu kỳ kinh gần nhất","Mang theo kết quả siêu âm cũ","Trao đổi trước nếu đang mang thai"]'::jsonb
        WHEN 'co-xuong-khop' THEN '["Mặc trang phục thuận tiện vận động","Mang phim X-quang hoặc MRI nếu có","Ghi lại các thuốc giảm đau đã dùng"]'::jsonb
        WHEN 'tai-mui-hong' THEN '["Ghi lại thời gian khởi phát","Mang theo thuốc xịt hoặc thuốc đang dùng","Hạn chế hút thuốc trước khi khám"]'::jsonb
    END,
    care_pathway = CASE slug
        WHEN 'tim-mach' THEN 'Tiếp nhận → khám chuyên khoa → xét nghiệm hoặc chẩn đoán hình ảnh → tư vấn kế hoạch theo dõi.'
        WHEN 'than-kinh' THEN 'Khai thác triệu chứng → khám thần kinh → chỉ định cận lâm sàng khi cần → hẹn theo dõi.'
        WHEN 'tieu-hoa' THEN 'Khám lâm sàng → xét nghiệm hoặc nội soi → đọc kết quả → hướng dẫn dinh dưỡng và điều trị.'
        WHEN 'noi-tong-hop' THEN 'Đánh giá nguy cơ → xét nghiệm cơ bản → phân tầng bệnh → lập kế hoạch chăm sóc chủ động.'
        WHEN 'nhi-khoa' THEN 'Tiếp nhận trẻ → đánh giá tăng trưởng → khám nhi → tư vấn chăm sóc và lịch tái khám.'
        WHEN 'san-phu-khoa' THEN 'Tư vấn ban đầu → khám và siêu âm khi cần → đọc kết quả → lịch theo dõi phù hợp.'
        WHEN 'co-xuong-khop' THEN 'Đánh giá vận động → chẩn đoán hình ảnh khi cần → phục hồi chức năng → theo dõi tiến triển.'
        WHEN 'tai-mui-hong' THEN 'Khám tai mũi họng → nội soi hoặc đo chức năng khi cần → hướng dẫn điều trị và vệ sinh.'
    END
WHERE slug IN ('tim-mach','than-kinh','tieu-hoa','noi-tong-hop','nhi-khoa','san-phu-khoa','co-xuong-khop','tai-mui-hong')
  AND common_symptoms = '[]'::jsonb
  AND preparation_steps = '[]'::jsonb
  AND care_pathway IS NULL;

UPDATE branches
SET working_hours = CASE slug
        WHEN 'benh-vien-sai-gon-xanh' THEN '06:30–20:00, tất cả các ngày'
        WHEN 'phong-kham-thao-dien' THEN '07:00–19:00, thứ Hai–Chủ nhật'
    END,
    emergency_hotline = CASE slug
        WHEN 'benh-vien-sai-gon-xanh' THEN '028 3838 1155'
        WHEN 'phong-kham-thao-dien' THEN '028 3744 2200'
    END,
    map_url = CASE slug
        WHEN 'benh-vien-sai-gon-xanh' THEN 'https://maps.google.com/?q=HealthCare+Sai+Gon+Xanh'
        WHEN 'phong-kham-thao-dien' THEN 'https://maps.google.com/?q=HealthCare+Thao+Dien'
    END,
    amenities = CASE slug
        WHEN 'benh-vien-sai-gon-xanh' THEN '["Khu tiếp đón 24/7","Nhà thuốc","Bãi đỗ xe","Wi-Fi miễn phí"]'::jsonb
        WHEN 'phong-kham-thao-dien' THEN '["Quầy tiếp đón","Khu lấy mẫu","Tư vấn bảo hiểm","Wi-Fi miễn phí"]'::jsonb
    END
WHERE slug IN ('benh-vien-sai-gon-xanh','phong-kham-thao-dien')
  AND working_hours IS NULL
  AND emergency_hotline IS NULL
  AND map_url IS NULL
  AND amenities = '[]'::jsonb;

UPDATE packages
SET target_audience = CASE slug
        WHEN 'goi-kham-co-ban' THEN 'Người trưởng thành cần kiểm tra sức khỏe định kỳ'
        WHEN 'goi-kham-tim-mach' THEN 'Người có yếu tố nguy cơ tim mạch hoặc tiền sử gia đình'
        WHEN 'goi-tam-soat-tieu-duong' THEN 'Người thừa cân, có tiền sử gia đình hoặc chỉ số đường huyết cao'
        WHEN 'goi-kham-tre-em' THEN 'Trẻ em cần theo dõi tăng trưởng và sức khỏe định kỳ'
    END,
    duration_days = 1,
    checklist = CASE slug
        WHEN 'goi-kham-co-ban' THEN '["Khám nội tổng quát","Xét nghiệm máu cơ bản","Siêu âm ổ bụng","Điện tâm đồ"]'::jsonb
        WHEN 'goi-kham-tim-mach' THEN '["Khám tim mạch","Điện tâm đồ","Siêu âm tim","Xét nghiệm mỡ máu"]'::jsonb
        WHEN 'goi-tam-soat-tieu-duong' THEN '["Đường huyết đói","HbA1c","Chức năng thận","Tư vấn dinh dưỡng"]'::jsonb
        WHEN 'goi-kham-tre-em' THEN '["Khám nhi tổng quát","Đánh giá chiều cao và cân nặng","Tư vấn dinh dưỡng","Rà soát lịch tiêm chủng"]'::jsonb
    END,
    preparation_steps = CASE slug
        WHEN 'goi-kham-co-ban' THEN '["Nhịn ăn 8 giờ nếu có xét nghiệm mỡ máu","Mang theo giấy tờ tùy thân","Đến trước giờ hẹn 15 phút"]'::jsonb
        WHEN 'goi-kham-tim-mach' THEN '["Mang sổ theo dõi huyết áp","Liệt kê thuốc đang dùng","Tránh vận động gắng sức trước khi đo"]'::jsonb
        WHEN 'goi-tam-soat-tieu-duong' THEN '["Nhịn ăn qua đêm theo hướng dẫn","Uống nước lọc vừa đủ","Không tự ý đổi thuốc trước buổi khám"]'::jsonb
        WHEN 'goi-kham-tre-em' THEN '["Mang sổ tiêm chủng","Ghi lại triệu chứng và thuốc đã dùng","Cho trẻ mặc trang phục thoải mái"]'::jsonb
    END
WHERE slug IN ('goi-kham-co-ban','goi-kham-tim-mach','goi-tam-soat-tieu-duong','goi-kham-tre-em')
  AND target_audience IS NULL
  AND duration_days IS NULL
  AND checklist = '[]'::jsonb
  AND preparation_steps = '[]'::jsonb;

UPDATE articles
SET category = CASE slug
        WHEN 'dau-hieu-canh-bao-benh-tim-mach' THEN 'Phòng bệnh chủ động'
        WHEN 'dinh-duong-hop-ly-nguoi-tang-huyet-ap' THEN 'Dinh dưỡng'
        WHEN 'tre-bieng-an-hieu-dung-de-cham-dung' THEN 'Sức khỏe gia đình'
    END,
    author_name = CASE slug
        WHEN 'dau-hieu-canh-bao-benh-tim-mach' THEN 'Đội ngũ chuyên môn'
        WHEN 'dinh-duong-hop-ly-nguoi-tang-huyet-ap' THEN 'Đội ngũ dinh dưỡng'
        WHEN 'tre-bieng-an-hieu-dung-de-cham-dung' THEN 'Đội ngũ nhi khoa'
    END,
    reading_minutes = CASE slug
        WHEN 'dau-hieu-canh-bao-benh-tim-mach' THEN 5
        WHEN 'dinh-duong-hop-ly-nguoi-tang-huyet-ap' THEN 4
        WHEN 'tre-bieng-an-hieu-dung-de-cham-dung' THEN 4
    END,
    related_specialty_slug = CASE slug
        WHEN 'dau-hieu-canh-bao-benh-tim-mach' THEN 'tim-mach'
        WHEN 'dinh-duong-hop-ly-nguoi-tang-huyet-ap' THEN 'tim-mach'
        WHEN 'tre-bieng-an-hieu-dung-de-cham-dung' THEN 'nhi-khoa'
    END,
    sections = CASE slug
        WHEN 'dau-hieu-canh-bao-benh-tim-mach' THEN '[{"heading":"Nhận biết sớm","body":"Đau tức ngực, khó thở và mệt mỏi bất thường cần được đánh giá trong bối cảnh cụ thể, đặc biệt khi triệu chứng xuất hiện khi gắng sức."},{"heading":"Khi nào nên đi khám","body":"Nếu triệu chứng tăng nhanh, kéo dài hoặc đi kèm vã mồ hôi, choáng, hãy tìm hỗ trợ y tế ngay."}]'::jsonb
        WHEN 'dinh-duong-hop-ly-nguoi-tang-huyet-ap' THEN '[{"heading":"Giảm muối từ thói quen nhỏ","body":"Ưu tiên thực phẩm tươi, đọc nhãn dinh dưỡng và nêm nếm vừa phải giúp kiểm soát lượng muối mỗi ngày."},{"heading":"Theo dõi đều đặn","body":"Kết hợp chế độ ăn với vận động phù hợp và ghi lại huyết áp theo hướng dẫn của nhân viên y tế."}]'::jsonb
        WHEN 'tre-bieng-an-hieu-dung-de-cham-dung' THEN '[{"heading":"Tìm nguyên nhân","body":"Biếng ăn có thể liên quan đến giai đoạn phát triển, bệnh lý hoặc thói quen sinh hoạt; nên quan sát cả tăng trưởng và tinh thần của trẻ."},{"heading":"Khi cần tư vấn","body":"Đưa trẻ đi khám nếu biếng ăn kéo dài, sụt cân hoặc xuất hiện triệu chứng bất thường khác."}]'::jsonb
    END
WHERE slug IN ('dau-hieu-canh-bao-benh-tim-mach','dinh-duong-hop-ly-nguoi-tang-huyet-ap','tre-bieng-an-hieu-dung-de-cham-dung')
  AND category IS NULL
  AND author_name IS NULL
  AND reading_minutes IS NULL
  AND related_specialty_slug IS NULL
  AND sections = '[]'::jsonb;
