-- ==============================================================================
-- V53: Update doctor portraits and detailed clinical biographies
-- ==============================================================================

-- 1. Ensure 6 canonical doctors exist with real portraits and deep biographies
INSERT INTO doctors (id, full_name, slug, bio, photo_url, active)
VALUES
(
    '30000000-0000-0000-0000-000000000001',
    'TS.BS Nguyễn Minh Khôi',
    'nguyen-minh-khoi',
    'Tiến sĩ, Bác sĩ Nguyễn Minh Khôi là chuyên gia tim mạch can thiệp hàng đầu với hơn 18 năm cống hiến trong công tác khám, tầm soát và điều trị các bệnh lý tim mạch phức tạp. Tốt nghiệp Bác sĩ Đa khoa và Bác sĩ Nội trú loại xuất sắc tại Đại học Y Dược TP.HCM, bác sĩ Khôi tiếp tục hoàn thành chương trình Tiến sĩ Y khoa chuyên ngành Tim mạch và tu nghiệp chuyên sâu về Tim mạch can thiệp tại Viện Tim mạch Quốc gia Singapore (NHCS) và Bệnh viện Đa khoa Massachusetts (Hoa Kỳ). Bác sĩ từng giữ vai trò bác sĩ điều trị chính tại Trung tâm Tim mạch Bệnh viện Chợ Rẫy, đã thực hiện thành công hơn 4.500 ca can thiệp mạch vành qua da (PCI), đặt stent mạch vành phức tạp, cấy máy tạo nhịp tim và can thiệp cấu trúc tim. Bên cạnh kỹ thuật can thiệp điêu luyện, TS.BS Nguyễn Minh Khôi đặc biệt chú trọng đến quản lý huyết áp, rối loạn lipid máu và phòng ngừa biến cố tim mạch nguyên phát - thứ phát cho người bệnh đái tháo đường, người cao tuổi. Với quan niệm y đức ''Trái tim người bệnh là mệnh lệnh của người thầy thuốc'', bác sĩ luôn dành thời gian lắng nghe từng cơn đau thắt ngực, giải thích tường minh kế hoạch điều trị và cùng bệnh nhân thiết lập lối sống khỏe mạnh, bền vững.',
    '/media/doctors/doctor-1.jpg',
    true
),
(
    '30000000-0000-0000-0000-000000000002',
    'BS.CKII Võ Thị Mai',
    'vo-thi-mai',
    'Bác sĩ Chuyên khoa II Võ Thị Mai là chuyên gia giàu kinh nghiệm với hơn 20 năm đồng hành cùng sức khỏe phụ nữ và hàng ngàn gia đình trên hành trình đón con yêu. Tốt nghiệp Bác sĩ Đa khoa và Bác sĩ Chuyên khoa I Sản Phụ khoa tại Đại học Y Dược TP.HCM, sau đó bảo vệ xuất sắc luận án Bác sĩ Chuyên khoa II tại Đại học Y Hà Nội, bác sĩ Mai còn tham gia các khóa đào tạo chuyên sâu về Hỗ trợ sinh sản (ART) và Phẫu thuật nội soi phụ khoa nâng cao tại Pháp và Trung tâm Sinh sản Quốc tế Singapore. Từng là Trưởng khoa Khám Sản Phụ khoa và bác sĩ phẫu thuật chủ chốt tại Bệnh viện Từ Dũ, BS.CKII Võ Thị Mai sở hữu thế mạnh vượt trội trong quản lý thai kỳ nguy cơ cao, sàng lọc dị tật trước sinh, điều trị vô sinh - hiếm muộn, phẫu thuật nội soi u xơ tử cung, u nang buồng trứng và tầm soát sớm ung thư cổ tử cung. Với phong cách thăm khám ân cần, thấu cảm và tinh tế, bác sĩ Mai xem mỗi bệnh nhân như người thân trong gia đình, giúp các sản phụ xua tan âu lo thai kỳ và mang lại niềm hy vọng trọn vẹn cho các cặp vợ chồng hiếm muộn.',
    '/media/doctors/doctor-2.jpg',
    true
),
(
    '30000000-0000-0000-0000-000000000003',
    'BS.CKI Lê Văn Đức',
    'le-van-duc',
    'Bác sĩ Chuyên khoa I Lê Văn Đức có hơn 15 năm kinh nghiệm chuyên sâu trong lĩnh vực Nội tiêu hóa – Gan mật và Nội soi can thiệp đường tiêu hóa. Tốt nghiệp Đại học Y Dược TP.HCM và hoàn thành chương trình Bác sĩ Chuyên khoa I Nội Tiêu hóa, bác sĩ Đức từng tu nghiệp nội soi tiêu hóa phóng đại NBI và kỹ thuật cắt tách dưới niêm mạc (ESD/EMR) tầm soát ung thư sớm tại Bệnh viện Đại học Quốc gia Seoul (Hàn Quốc). Trước khi gia nhập HealthCare, bác sĩ từng công tác tại Khoa Tiêu hóa Bệnh viện Nhân dân Gia Định và Bệnh viện Đại học Y Dược TP.HCM, đã thực hiện an toàn trên 12.000 ca nội soi tiêu hóa không đau, chẩn đoán và loại bỏ hàng ngàn tổn thương tiền ung thư, điều trị hiệu quả các bệnh lý viêm loét dạ dày - tá tràng nhiễm HP kháng thuốc, trào ngược dạ dày thực quản (GERD), viêm gan virus B - C mạn tính và hội chứng ruột kích thích (IBS). Bác sĩ Đức nổi tiếng với sự cẩn trọng, tỉ mỉ trong từng thao tác nội soi, luôn nhấn mạnh tầm quan trọng của việc cá thể hóa phác đồ điều trị kết hợp điều chỉnh chế độ ăn uống khoa học nhằm bảo vệ hệ tiêu hóa khỏe mạnh dài lâu.',
    '/media/doctors/doctor-3.jpg',
    true
),
(
    '30000000-0000-0000-0000-000000000004',
    'ThS.BS Phạm Hoàng Yến',
    'pham-hoang-yen',
    'Thạc sĩ, Bác sĩ Phạm Hoàng Yến là chuyên gia Nhi khoa tận tâm với hơn 10 năm kinh nghiệm chăm sóc sức khỏe toàn diện cho trẻ sơ sinh và trẻ nhỏ. Bác sĩ tốt nghiệp Bác sĩ Đa khoa loại Giỏi và nhận bằng Thạc sĩ Nhi khoa tại Đại học Y Dược TP.HCM, đồng thời đạt chứng chỉ chỉ đạo Cấp cứu Nhi nâng cao (PALS) từ Hiệp hội Tim mạch Hoa Kỳ và chứng chỉ Dinh dưỡng Nhi khoa lâm sàng từ Viện Dinh dưỡng Quốc gia. Bác sĩ từng công tác tại Khoa Hô hấp và Khoa Cấp cứu Bệnh viện Nhi Đồng 1, có chuyên môn sâu trong điều trị các bệnh lý hô hấp trẻ em (viêm phế quản, hen suyễn, viêm phổi), các bệnh truyền nhiễm mùa (sốt xuất huyết, tay chân miệng, cúm), rối loạn tiêu hóa và tư vấn dinh dưỡng - tăng trưởng theo từng mốc phát triển của trẻ. Với nụ cười dịu dàng, sự kiên nhẫn vô tận và khả năng thấu hiểu tâm lý trẻ nhỏ, ThS.BS Phạm Hoàng Yến giúp các bé cảm thấy nhẹ nhàng, không sợ hãi khi đi khám, đồng thời luôn đồng hành hướng dẫn cặn kẽ phụ huynh cách theo dõi triệu chứng và chăm sóc bé an toàn tại nhà, hạn chế tối đa việc lạm dụng kháng sinh.',
    '/media/doctors/doctor-4.jpg',
    true
),
(
    '30000000-0000-0000-0000-000000000005',
    'ThS.BS Trần Thu Hà',
    'tran-thu-ha',
    'Thạc sĩ, Bác sĩ Trần Thu Hà là chuyên gia Nội Thần kinh với hơn 12 năm kinh nghiệm trong chẩn đoán và điều trị các bệnh lý hệ thần kinh trung ương và ngoại biên. Bác sĩ tốt nghiệp Đại học Y Hà Nội, hoàn thành văn bằng Thạc sĩ Nội Thần kinh và hoàn thành các khóa đào tạo chuyên sâu về Điện cơ (EMG), Điện não đồ (EEG) và Đột quỵ não tại Bệnh viện Bạch Mai và Trung tâm Y tế Đại học Chulalongkorn (Thái Lan). Bác sĩ có thế mạnh lâm sàng đặc biệt trong điều trị đau nửa đầu (Migraine), đau đầu căng thẳng mạn tính, mất ngủ kéo dài, chóng mặt tiền đình, hội chứng Parkinson, đau dây thần kinh tọa và phục hồi chức năng sau tai biến mạch máu não. Trong công tác khám chữa bệnh, ThS.BS Trần Thu Hà luôn kiên trì lắng nghe những biểu hiện tâm lý và thần kinh tinh tế nhất của người bệnh, tìm ra căn nguyên thực sự của các cơn đau mạn tính, kết hợp phác đồ dùng thuốc chuẩn mực quốc tế với liệu pháp điều hòa lối sống, mang lại sự thanh thản và chất lượng sống tốt nhất cho bệnh nhân.',
    '/media/doctors/doctor-5.jpg',
    true
),
(
    '30000000-0000-0000-0000-000000000006',
    'ThS.BS Đỗ Quang Huy',
    'do-quang-huy',
    'Thạc sĩ, Bác sĩ Đỗ Quang Huy là chuyên gia Chấn thương chỉnh hình và Cơ xương khớp với hơn 11 năm kinh nghiệm điều trị các bệnh lý thoái hóa khớp, cột sống cổ - thắt lưng, thoát vị đĩa đệm, viêm quanh khớp vai, tổn thương sụn khớp và chấn thương thể thao. Bác sĩ tốt nghiệp Bác sĩ Đa khoa và Thạc sĩ Ngoại Chấn thương Chỉnh hình tại Đại học Y Dược TP.HCM, sau đó tu nghiệp về Phẫu thuật nội soi khớp và Thay khớp nhân tạo ít xâm lấn tại Bệnh viện Đa khoa Singapore (SGH) và Bệnh viện Chấn thương Chỉnh hình TP.HCM. Bác sĩ Huy đã điều trị thành công cho hàng ngàn ca thoái hóa khớp gối, thoái hóa cột sống, tiêm chất nhờn sinh học dưới hướng dẫn siêu âm kết hợp vật lý trị liệu phục hồi chức năng, giúp người bệnh giảm đau nhanh chóng và vận động linh hoạt mà chưa cần phẫu thuật. Bác sĩ Huy là người tiên phong ứng dụng các liệu pháp bảo tồn tiên tiến như tiêm huyết tương giàu tiểu cầu (PRP). Bác sĩ Huy được đông đảo bệnh nhân tin tưởng bởi sự nhiệt huyết, giải thích cặn kẽ hình ảnh X-quang/MRI và luôn đặt mục tiêu bảo tồn tối đa cấu trúc xương khớp tự nhiên lên hàng đầu.',
    '/media/doctors/doctor-6.jpg',
    true
)
ON CONFLICT (slug) DO UPDATE
SET full_name = EXCLUDED.full_name,
    bio = EXCLUDED.bio,
    photo_url = EXCLUDED.photo_url,
    active = EXCLUDED.active;

-- 2. Link each primary doctor to their respective specialty
INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d
CROSS JOIN specialties s
WHERE (d.slug = 'nguyen-minh-khoi' AND s.slug = 'tim-mach')
   OR (d.slug = 'vo-thi-mai' AND s.slug = 'san-phu-khoa')
   OR (d.slug = 'le-van-duc' AND s.slug = 'tieu-hoa')
   OR (d.slug = 'pham-hoang-yen' AND s.slug = 'nhi-khoa')
   OR (d.slug = 'tran-thu-ha' AND s.slug = 'than-kinh')
   OR (d.slug = 'do-quang-huy' AND s.slug = 'co-xuong-khop')
ON CONFLICT (doctor_id, specialty_id) DO NOTHING;

-- 3. Link each primary doctor to the first available branch
INSERT INTO doctor_branches (id, doctor_id, branch_id)
SELECT gen_random_uuid(), d.id, b.id
FROM doctors d
CROSS JOIN (SELECT id FROM branches ORDER BY id LIMIT 1) b
WHERE d.slug IN ('nguyen-minh-khoi', 'vo-thi-mai', 'le-van-duc', 'pham-hoang-yen', 'tran-thu-ha', 'do-quang-huy')
ON CONFLICT (doctor_id, branch_id) DO NOTHING;

-- 4. Fill in missing photos for any remaining doctors
UPDATE doctors
SET photo_url = '/media/doctors/doctor-' || (1 + (abs(hashtext(id::text)) % 6)) || '.jpg'
WHERE photo_url IS NULL OR photo_url = '';
