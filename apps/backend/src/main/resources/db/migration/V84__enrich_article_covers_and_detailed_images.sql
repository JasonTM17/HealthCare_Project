-- V84__enrich_article_covers_and_detailed_images.sql
-- 1. Enrich article cover images across all medical specialties with localized clinical photography (>100KB).
-- 2. Eliminate 100% of external Unsplash URLs and non-article package URLs.
-- 3. Resolve serious clinical misalignments (stroke articles, pregnancy articles, eye dry eye articles).
-- 4. Embed high-resolution in-article clinical infographics (markdown ![alt](url)) into key public health articles.

-- ============================================================================
-- 1. UPDATE ARTICLE COVER IMAGES BY SPECIALTY & RESOLVE CLINICAL MISALIGNMENTS
-- ============================================================================

UPDATE articles
SET cover_image_url = CASE
    -- Clinical Correction 1: Acute Stroke & Neurological Emergencies
    WHEN slug ILIKE '%dot-quy%' OR slug ILIKE '%tai-bien%' OR title ILIKE '%đột quỵ%' OR title ILIKE '%tai biến%'
        THEN '/media/articles/than-kinh-dot-quy.jpg'

    -- Clinical Correction 2: Pregnancy, Prenatal Care, Ultrasound & Obstetrics
    WHEN related_specialty_slug = 'san-phu-khoa' 
      OR category ILIKE '%sản%' 
      OR category ILIKE '%phụ khoa%'
      OR slug ILIKE '%thai%' 
      OR title ILIKE '%thai%' 
      OR title ILIKE '%mẹ bầu%' 
      OR title ILIKE '%tiền sản%'
      OR title ILIKE '%siêu âm%'
        THEN '/media/articles/san-phu-khoa.jpg'

    -- Clinical Correction 3: Ophthalmology & Dry Eye Syndrome (no major surgery images)
    WHEN related_specialty_slug = 'mat' 
      OR category ILIKE '%mắt%' 
      OR slug ILIKE '%kho-mat%' 
      OR title ILIKE '%mắt%' 
      OR title ILIKE '%thị lực%' 
      OR title ILIKE '%giác mạc%'
        THEN '/media/articles/mat.jpg'

    -- Specialty: Hô hấp
    WHEN related_specialty_slug = 'ho-hap' OR category ILIKE '%hô hấp%' OR slug ILIKE '%ho-hap%' OR title ILIKE '%hô hấp%'
        THEN '/media/articles/ho-hap.jpg'

    -- Specialty: Tai mũi họng & Thính học
    WHEN related_specialty_slug IN ('tai-mui-hong', 'thinh-hoc') OR category ILIKE '%tai mũi%' OR category ILIKE '%thính học%'
        THEN '/media/articles/tai-mui-hong.jpg'

    -- Specialty: Da liễu & Da liễu thẩm mỹ
    WHEN related_specialty_slug IN ('da-lieu', 'da-lieu-tham-my') OR category ILIKE '%da liễu%' OR category ILIKE '%da%'
        THEN '/media/articles/da-lieu.jpg'

    -- Specialty: Ung bướu & Tầm soát ung thư
    WHEN related_specialty_slug = 'ung-buou' OR category ILIKE '%ung bướu%' OR title ILIKE '%ung thư%'
        THEN '/media/articles/ung-buou.jpg'

    -- Specialty: Thần kinh & Ngoại thần kinh
    WHEN related_specialty_slug IN ('than-kinh', 'ngoai-than-kinh') OR category ILIKE '%thần kinh%'
        THEN '/media/articles/than-kinh-dot-quy.jpg'

    -- Specialty: Cơ xương khớp & Chấn thương chỉnh hình
    WHEN related_specialty_slug IN ('co-xuong-khop', 'chan-thuong-chinh-hinh') OR category ILIKE '%khớp%' OR category ILIKE '%chấn thương%' OR title ILIKE '%cột sống%'
        THEN '/media/articles/co-xuong-khop.jpg'

    -- Specialty: Dinh dưỡng
    WHEN related_specialty_slug = 'dinh-duong' OR category ILIKE '%dinh dưỡng%'
        THEN '/media/articles/dinh-duong-lanh-manh.jpg'

    -- Specialty: Sơ cấp cứu
    WHEN related_specialty_slug = 'so-cap-cuu' OR category ILIKE '%cấp cứu%'
        THEN '/media/articles/cap-cuu.jpg'

    -- Specialty: Răng hàm mặt
    WHEN related_specialty_slug = 'rang-ham-mat' OR category ILIKE '%răng%'
        THEN '/media/articles/rang-ham-mat.jpg'

    -- Specialty: Nam khoa & Tiết niệu
    WHEN related_specialty_slug IN ('nam-khoa', 'tiet-nieu') OR category ILIKE '%nam khoa%' OR category ILIKE '%tiết niệu%'
        THEN '/media/articles/nam-khoa-tiet-nieu.jpg'

    -- Specialty: Y học cổ truyền
    WHEN related_specialty_slug = 'y-hoc-co-truyen' OR category ILIKE '%cổ truyền%'
        THEN '/media/articles/y-hoc-co-truyen.jpg'

    -- Specialty: Phục hồi chức năng
    WHEN related_specialty_slug = 'phuc-hoi-chuc-nang' OR category ILIKE '%phục hồi%'
        THEN '/media/articles/phuc-hoi-chuc-nang.jpg'

    -- Specialty: Huyết học, Miễn dịch dị ứng & Giải phẫu bệnh
    WHEN related_specialty_slug IN ('huyet-hoc', 'mien-dich-di-ung', 'giai-phau-benh') OR category ILIKE '%huyết học%' OR category ILIKE '%miễn dịch%'
        THEN '/media/articles/xet-nghiem-huyet-hoc.jpg'

    -- Specialty: Tim mạch & Nội mạch máu
    WHEN related_specialty_slug IN ('tim-mach', 'noi-mach-mau') OR category ILIKE '%tim%' OR category ILIKE '%mạch máu%'
        THEN '/media/articles/5-dau-hieu-tim-mach.jpg'

    -- Specialty: Tiêu hóa
    WHEN related_specialty_slug = 'tieu-hoa' OR category ILIKE '%tiêu hóa%'
        THEN '/media/articles/viem-loet-da-day.jpg'

    -- Specialty: Nhi khoa
    WHEN related_specialty_slug = 'nhi-khoa' OR category ILIKE '%nhi%'
        THEN '/media/articles/tre-bieng-an.jpg'

    -- Specialty: Nội tiết
    WHEN related_specialty_slug = 'noi-tiet' OR category ILIKE '%tiểu đường%' OR category ILIKE '%nội tiết%'
        THEN '/media/articles/tam-soat-tieu-duong.jpg'

    -- Default / Nội tổng hợp / Y tế công cộng / Ngoại khoa
    ELSE '/media/articles/cham-soc-suc-khoe-tong-quat.jpg'
END;

-- Clean up any residual Unsplash or Package URL references
UPDATE articles
SET cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg'
WHERE cover_image_url LIKE '%unsplash%' OR cover_image_url LIKE '%/images/packages/%';

-- ============================================================================
-- 2. EMBED DETAILED CLINICAL INFOGRAPHICS IN ARTICLE BODIES (MARKDOWN)
-- ============================================================================

-- Article 1: Phòng ngừa đột quỵ ở người trẻ và trung niên
UPDATE articles
SET body = replace(
    body,
    '2. Quy tắc FAST - Nhận diện nhanh dấu hiệu đột quỵ trong 1 phút:',
    E'2. Quy tắc FAST - Nhận diện nhanh dấu hiệu đột quỵ trong 1 phút:\r\n\r\n![Sơ đồ Quy tắc FAST nhận diện sớm Đột quỵ não cấp](/media/articles/illustrations/quy-tac-fast-dot-quy.png)\r\n'
)
WHERE slug = 'phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien'
  AND body NOT LIKE '%quy-tac-fast-dot-quy.png%';

-- Article 2: Đột quỵ não cấp: Nhận diện dấu hiệu FAST và quy tắc 4.5 giờ vàng tiêu sợi huyết
UPDATE articles
SET body = E'Đột quỵ não cấp (Tai biến mạch máu não) là tình trạng cấp cứu nội khoa tối khẩn cấp xảy ra khi dòng máu lên nuôi não bị ngưng trệ do tắc mạch máu (nhồi máu não) hoặc vỡ mạch máu (xuất huyết não).\r\n\r\n1. Quy tắc FAST - Nhận diện dấu hiệu đột quỵ trong 1 phút:\r\n- F (Face - Liệt mặt): Nụ cười méo xệch, rãnh mũi má mờ, nhân trung lệch sang một bên.\r\n- A (Arm - Yếu tay chân): Một bên tay hoặc chân không thể nâng lên hoặc rơi xuống nhanh.\r\n- S (Speech - Rối loạn ngôn ngữ): Nói đớ, nói ngọng, nói khó hiểu hoặc không thể diễn đạt được câu đơn giản.\r\n- T (Time - Thời gian vàng): Gọi ngay xe Cấp cứu 115 hoặc chuyển đến bệnh viện có đơn vị đột quỵ gần nhất.\r\n\r\n![Sơ đồ Quy tắc FAST nhận diện sớm Đột quỵ não cấp](/media/articles/illustrations/quy-tac-fast-dot-quy.png)\r\n\r\n2. Cửa sổ "4.5 Giờ Vàng" trong điều trị tiêu sợi huyết:\r\n- Thuốc tiêu sợi huyết rtPA đường tĩnh mạch đạt hiệu quả tối ưu khi được sử dụng trong vòng 4.5 giờ đầu kể từ thời điểm khởi phát triệu chứng đầu tiên.\r\n- Can thiệp lấy huyết khối cơ học bằng dụng cụ có thể mở rộng đến 6 giờ hoặc 24 giờ với sự hỗ trợ của chụp cộng hưởng từ MRI khuếch tán tưới máu não.\r\n- CẢNH BÁO LÂM SÀNG: Tuyệt đối không cạo gió, chích lể đầu ngón tay, vắt chanh hoặc cho uống thuốc hạ áp/An Cung Ngưu Hoàng trước khi có kết quả chụp cắt lớp vi tính hoặc MRI não.'
WHERE slug = 'dot-quy-nao-cap-nhan-dien-dau-hieu-fast-va-quy-tac-45-gio-vang-tieu-soi-huyet';

-- Article 3: Chế độ ăn DASH giảm muối: Lợi ích kiểm soát huyết áp và bảo vệ thành mạch
UPDATE articles
SET body = replace(
    body,
    '1. Tổng quan lâm sàng và nguyên nhân bệnh sinh',
    E'![Tháp dinh dưỡng cân đối cho người trưởng thành](/media/articles/illustrations/thap-dinh-duong-hop-ly.png)\r\n\r\n1. Tổng quan lâm sàng và nguyên nhân bệnh sinh'
)
WHERE slug = 'che-do-an-dash-giam-muoi-loi-ich-kiem-soat-huyet-ap-va-bao-ve-thanh-mach'
  AND body NOT LIKE '%thap-dinh-duong-hop-ly.png%';

-- Article 4: Tầm soát và phòng ngừa biến chứng đái tháo đường Type 2 sớm
UPDATE articles
SET body = replace(
    body,
    '2. Các xét nghiệm chẩn đoán tiêu chuẩn:',
    E'2. Các xét nghiệm chẩn đoán tiêu chuẩn:\r\n\r\n![Bảng chỉ số đường huyết và hướng dẫn theo dõi tại nhà](/media/articles/illustrations/huong-dan-do-duong-huyet.png)\r\n'
)
WHERE slug = 'tam-soat-va-phong-ngua-tieu-duong-type-2'
  AND body NOT LIKE '%huong-dan-do-duong-huyet.png%';

-- Article 5: Đái tháo đường thai kỳ: Nghiệm pháp dung nạp 75g glucose và phác đồ điều hòa đường huyết
UPDATE articles
SET body = E'Đái tháo đường thai kỳ (Gestational Diabetes Mellitus - GDM) là tình trạng rối loạn dung nạp glucose ở bất kỳ mức độ nào, khởi phát hoặc được phát hiện lần đầu tiên trong thời kỳ mang thai.\r\n\r\n1. Nghiệm pháp dung nạp 75g Glucose (OGTT) ở tuần 24 - 28:\r\n- Thai phụ nhịn đói từ 8 - 12 giờ trước khi làm xét nghiệm.\r\n- Lấy mẫu máu tĩnh mạch lúc đói, sau đó uống dung dịch chứa 75g glucose trong vòng 5 phút.\r\n- Tiếp tục lấy máu tĩnh mạch tại thời điểm sau 1 giờ và sau 2 giờ.\r\n- Tiêu chuẩn chẩn đoán (Bộ Y tế): Lúc đói >= 5.1 mmol/L (92 mg/dL), sau 1 giờ >= 10.0 mmol/L (180 mg/dL), sau 2 giờ >= 8.5 mmol/L (153 mg/dL). Chỉ cần 1 trong 3 chỉ số vượt ngưỡng là xác định đái tháo đường thai kỳ.\r\n\r\n![Lịch trình khám thai và các mốc siêu âm quan trọng qua 3 tam cá nguyệt](/media/articles/illustrations/cham-soc-thai-ky-3-thang.png)\r\n\r\n2. Phác đồ kiểm soát đường huyết và dinh dưỡng cho mẹ bầu:\r\n- Mục tiêu đường huyết mao mạch: Lúc đói <= 5.3 mmol/L (95 mg/dL), sau ăn 1 giờ <= 7.8 mmol/L (140 mg/dL), sau ăn 2 giờ <= 6.7 mmol/L (120 mg/dL).\r\n- Chia nhỏ khẩu phần thành 3 bữa chính và 2-3 bữa phụ để tránh đỉnh tăng đường huyết sau ăn.\r\n- Ưu tiên tinh bột hấp thu chậm (gạo lứt, yến mạch), tăng cường chất xơ từ rau xanh, bổ sung đạm nạc và chất béo không bão hòa.'
WHERE slug = 'dai-thao-duong-thai-ky-nghiem-phap-dung-nap-75g-glucose-va-phac-do-dieu-hoa-duong-huyet';

-- Article 6: Siêu âm thai 4D hình thái học tuần 12 tuần 22 tuần 32: Tầm soát dị tật cấu trúc thai nhi
UPDATE articles
SET body = E'Siêu âm hình thái học thai nhi là phương pháp chẩn đoán hình ảnh không xâm lấn then chốt giúp bác sĩ sản khoa đánh giá sự phát triển toàn diện của thai nhi và tầm soát sớm các dị tật bẩm sinh.\r\n\r\n1. Ba mốc siêu âm vàng không thể bỏ qua trong thai kỳ:\r\n- Tuần 11 - 13 tuần 6 ngày: Đo độ mờ da gáy (Nuchal Translucency - NT), quan sát xương mũi, tầm soát hội chứng Down, Edwards, Patau kết hợp xét nghiệm Double Test hoặc NIPT.\r\n- Tuần 18 - 22: Khảo sát chi tiết cấu trúc giải phẫu hình thái 4D từng cơ quan: Hộp sọ, não thất, tim 4 buồng, cột sống, dạ dày, thận, bàng quang, thành bụng, bàn tay, bàn chân và vòm họng (phát hiện sứt môi hở hàm ếch).\r\n- Tuần 30 - 32: Đánh giá sự tăng trưởng của thai nhi, tuần hoàn rau thai qua Doppler động mạch rốn và động mạch não giữa, phát hiện thai chậm phát triển trong tử cung (IUGR).\r\n\r\n![Lịch trình khám thai và các mốc siêu âm quan trọng qua 3 tam cá nguyệt](/media/articles/illustrations/cham-soc-thai-ky-3-thang.png)\r\n\r\n2. Hướng dẫn chuẩn bị trước khi siêu âm thai:\r\n- Siêu âm 3 tháng đầu (trước 12 tuần): Uống khoảng 500ml nước trước khi siêu âm 30 phút để bàng quang căng đẩy tử cung lên giúp quan sát rõ hơn.\r\n- Siêu âm hình thái 4D (tuần 18-22 và 30-32): Không cần nhịn tiểu, mẹ bầu nên ăn nhẹ trước buổi khám để em bé thức và cử động linh hoạt.'
WHERE slug = 'sieu-am-thai-4d-hinh-thai-hoc-tuan-12-tuan-22-tuan-32-tam-soat-di-tat-cau-truc-thai-nhi';

-- Article 7: Dinh dưỡng thai kỳ theo từng tam cá nguyệt: Bổ sung axit folic, sắt canxi và DHA hợp lý
UPDATE articles
SET body = replace(
    body,
    '1. Tổng quan lâm sàng và nguyên nhân bệnh sinh',
    E'![Lịch trình khám thai và các mốc siêu âm quan trọng qua 3 tam cá nguyệt](/media/articles/illustrations/cham-soc-thai-ky-3-thang.png)\r\n\r\n1. Tổng quan lâm sàng và nguyên nhân bệnh sinh'
)
WHERE slug = 'dinh-duong-thai-ky-theo-tung-tam-ca-nguyet-bo-sung-axit-folic-sat-canxi-va-dha-hop-ly'
  AND body NOT LIKE '%cham-soc-thai-ky-3-thang.png%';

-- Article 8: Tầm soát phát hiện sớm tăng huyết áp và đái tháo đường tại y tế cơ sở
UPDATE articles
SET body = replace(
    body,
    '1. Tổng quan lâm sàng và nguyên nhân bệnh sinh',
    E'![Quy trình đo huyết áp đúng chuẩn lâm sàng tại nhà](/media/articles/illustrations/ky-thuat-do-huyet-ap.png)\r\n\r\n1. Tổng quan lâm sàng và nguyên nhân bệnh sinh'
)
WHERE slug = 'tam-soat-phat-hien-som-tang-huyet-ap-va-dai-thao-duong-tai-y-te-co-so-quan-ly-benh-khong-lay-nhiem'
  AND body NOT LIKE '%ky-thuat-do-huyet-ap.png%';

-- Article 9: Test hơi thở C13 chẩn đoán vi khuẩn Helicobacter Pylori không xâm lấn
UPDATE articles
SET body = replace(
    body,
    '1. Tổng quan lâm sàng và nguyên nhân bệnh sinh',
    E'![Cơ chế bệnh sinh trào ngược dạ dày thực quản GERD và viêm loét dạ dày tá tràng](/media/articles/illustrations/so-do-gerd-da-day.png)\r\n\r\n1. Tổng quan lâm sàng và nguyên nhân bệnh sinh'
)
WHERE slug = 'test-hoi-tho-c13-chan-doan-vi-khuan-helicobacter-pylori-khong-xam-lan'
  AND body NOT LIKE '%so-do-gerd-da-day.png%';

-- Article 10: Mesotherapy vi điểm: Cung cấp HA, vitamin và peptide nuôi dưỡng làn da
UPDATE articles
SET body = replace(
    body,
    '1. Tổng quan lâm sàng và nguyên nhân bệnh sinh',
    E'![Phác đồ 4 bước chăm sóc và phục hồi hàng rào bảo vệ da](/media/articles/illustrations/cham-soc-viem-da-co-dia.png)\r\n\r\n1. Tổng quan lâm sàng và nguyên nhân bệnh sinh'
)
WHERE slug = 'mesotherapy-vi-diem-cung-cap-ha-vitamin-va-peptide-nuoi-duong-lan-da-cang-bong-min-mang'
  AND body NOT LIKE '%cham-soc-viem-da-co-dia.png%';

-- Article 11: Hội chứng khô mắt văn phòng: Nguyên nhân chớp mắt ít trước máy tính
UPDATE articles
SET body = E'Hội chứng khô mắt văn phòng (Office Dry Eye Syndrome) là một trong những rối loạn bề mặt nhãn cầu phổ biến nhất hiện nay, xảy ra khi màng phim nước mắt mất ổn định do giảm tần số chớp mắt trong quá trình tập trung làm việc với màn hình máy tính.\r\n\r\n1. Cơ chế và nguyên nhân gây khô mắt:\r\n- Giảm tần số chớp mắt: Khi tập trung cao độ vào màn hình, phản xạ chớp mắt tự nhiên giảm từ 15-20 lần/phút xuống chỉ còn 4-6 lần/phút, khiến bề mặt giác mạc bị bốc hơi nước mắt quá mức.\r\n- Môi trường máy lạnh điều hòa: Độ ẩm thấp trong phòng làm việc khép kín làm tăng tốc độ bay hơi của lớp nước mắt bề mặt.\r\n- Ánh sáng xanh nhân tạo: Tiếp xúc kéo dài với ánh sáng xanh phát ra từ màn hình kỹ thuật số gây mỏi cơ mi và rối loạn điều tiết mắt.\r\n\r\n![Quy tắc 20-20-20 và hướng dẫn chống khô mắt văn phòng](/media/articles/illustrations/quy-trinh-kham-mat-khau-thi-luc.png)\r\n\r\n2. Phác đồ chăm sóc & Bảo vệ mắt theo khuyến cáo bác sĩ nhãn khoa:\r\n- Áp dụng nghiêm ngặt quy tắc 20-20-20: Cứ 20 phút nhìn vào màn hình, cho mắt nhìn ra xa 20 feet (6 mét) trong 20 giây để các cơ điều tiết được thả lỏng hoàn toàn.\r\n- Sử dụng nước mắt nhân tạo không chất bảo quản: Ưu tiên các loại dung dịch nhỏ mắt chứa Natri Hyaluronate 0.1% - 0.18% dạng tép đơn liều để bôi trơn nhãn cầu, nhỏ 4 - 6 lần mỗi ngày.\r\n- Điều chỉnh vị trí màn hình: Đặt màn hình máy tính cách mắt 50 - 60cm và cạnh trên màn hình thấp hơn tầm mắt 15 - 20 độ để giảm diện tích mở của khe mi.'
WHERE slug = 'hoi-chung-kho-mat-van-phong-nguyen-nhan-chop-mat-it-truoc-may-tinh-va-bo-sung-nuoc-mat-nhan-tao';

-- ============================================================================
-- 3. INVARIANT CHECK CONSTRAINTS & VALIDATION ASSERTIONS
-- ============================================================================

DO $$
DECLARE
    v_unsplash_count integer;
    v_package_url_count integer;
    v_null_covers integer;
    v_illustrated_count integer;
BEGIN
    SELECT count(*) INTO v_unsplash_count FROM articles WHERE cover_image_url LIKE '%unsplash%';
    IF v_unsplash_count > 0 THEN
        RAISE EXCEPTION 'V84 migration assertion failed: % articles still have Unsplash URLs', v_unsplash_count;
    END IF;

    SELECT count(*) INTO v_package_url_count FROM articles WHERE cover_image_url LIKE '%/images/packages/%';
    IF v_package_url_count > 0 THEN
        RAISE EXCEPTION 'V84 migration assertion failed: % articles still have package URLs', v_package_url_count;
    END IF;

    SELECT count(*) INTO v_null_covers FROM articles WHERE cover_image_url IS NULL OR btrim(cover_image_url) = '';
    IF v_null_covers > 0 THEN
        RAISE EXCEPTION 'V84 migration assertion failed: % articles have empty or NULL cover_image_url', v_null_covers;
    END IF;

    SELECT count(*) INTO v_illustrated_count FROM articles WHERE body LIKE '%/media/articles/illustrations/%';
    IF (SELECT count(*) FROM articles) >= 8 AND v_illustrated_count < 8 THEN
        RAISE EXCEPTION 'V84 migration assertion failed: expected >= 8 illustrated articles, found %', v_illustrated_count;
    END IF;

    RAISE NOTICE 'V84 Migration completed successfully! 0 Unsplash URLs, 0 Package URLs, % illustrated articles.', v_illustrated_count;
END $$;
