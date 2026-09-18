-- ==========================================================================
-- V82__reconcile_doctor_specialties_and_clean_data.sql
-- Reconcile doctor specialties, eliminate 'Phan X' clones, purge Unsplash photos
-- ==========================================================================

-- 1. Reconcile doctor_specialties table to match clinical biography exactly
DELETE FROM doctor_specialties;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d, specialties s
WHERE d.slug = 'nguyen-minh-khoi' AND s.slug = 'tim-mach'
ON CONFLICT DO NOTHING;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d, specialties s
WHERE d.slug = 'vo-thi-mai' AND s.slug = 'san-phu-khoa'
ON CONFLICT DO NOTHING;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d, specialties s
WHERE d.slug = 'le-van-duc' AND s.slug = 'tieu-hoa'
ON CONFLICT DO NOTHING;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d, specialties s
WHERE d.slug = 'pham-hoang-yen' AND s.slug = 'nhi-khoa'
ON CONFLICT DO NOTHING;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d, specialties s
WHERE d.slug = 'tran-thu-ha' AND s.slug = 'than-kinh'
ON CONFLICT DO NOTHING;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d, specialties s
WHERE d.slug = 'do-quang-huy' AND s.slug = 'co-xuong-khop'
ON CONFLICT DO NOTHING;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d
JOIN specialties s ON d.bio ILIKE '%trong lĩnh vực ' || s.name || '.%'
WHERE d.slug NOT IN ('nguyen-minh-khoi', 'vo-thi-mai', 'le-van-duc', 'pham-hoang-yen', 'tran-thu-ha', 'do-quang-huy')
ON CONFLICT DO NOTHING;

-- 2. Purge raw Unsplash URLs in doctors to enforce genuine portrait governance
UPDATE doctors SET photo_url = NULL WHERE photo_url LIKE '%unsplash%';

-- 3. Update articles to authentic disease topics without 'Phan X' clones

UPDATE articles
SET title = 'Rối loạn cương dương ED: Tìm hiểu nguyên nhân mạch máu thần kinh tâm lý và phác đồ PDE5i',
    slug = 'roi-loan-cuong-duong-ed-tim-hieu-nguyen-nhan-mach-mau-than-kinh-tam-ly-va-phac-do-pde5i',
    summary = 'Bài viết chuyên sâu về rối loạn cương dương ed: tìm hiểu nguyên nhân mạch máu thần kinh tâm lý và phác đồ pde5i được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '005ebde2-9f20-84ae-4bef-29d25d6d1d3c';

UPDATE articles
SET title = 'Xuất tinh sớm: Phân loại nguyên phát thứ phát và liệu pháp hành vi kết hợp thuốc kéo dài',
    slug = 'xuat-tinh-som-phan-loai-nguyen-phat-thu-phat-va-lieu-phap-hanh-vi-ket-hop-thuoc-keo-dai',
    summary = 'Bài viết chuyên sâu về xuất tinh sớm: phân loại nguyên phát thứ phát và liệu pháp hành vi kết hợp thuốc kéo dài được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '0b5f93d7-9d84-6ac4-71f1-3d0f39461293';

UPDATE articles
SET title = 'Vô sinh nam do tinh trùng yếu ít dị dạng: Xét nghiệm tinh dịch đồ chuẩn WHO và điều trị',
    slug = 'vo-sinh-nam-do-tinh-trung-yeu-it-di-dang-xet-nghiem-tinh-dich-do-chuan-who-va-dieu-tri',
    summary = 'Bài viết chuyên sâu về vô sinh nam do tinh trùng yếu ít dị dạng: xét nghiệm tinh dịch đồ chuẩn who và điều trị được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '10ffb18f-3998-6c90-8517-238a9045101e';

UPDATE articles
SET title = 'Giãn tĩnh mạch thừng tinh Varicocele: Dấu hiệu đau tức bìu khi đứng lâu và phẫu thuật vi phẫu',
    slug = 'gian-tinh-mach-thung-tinh-varicocele-dau-hieu-dau-tuc-biu-khi-dung-lau-va-phau-thuat-vi-phau',
    summary = 'Bài viết chuyên sâu về giãn tĩnh mạch thừng tinh varicocele: dấu hiệu đau tức bìu khi đứng lâu và phẫu thuật vi phẫu được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '1130d2d4-0189-8604-218c-d01756f73e21';

UPDATE articles
SET title = 'Suy giảm Testosterone mãn dục nam: Dấu hiệu giảm ham muốn mệt mỏi và liệu pháp bổ sung',
    slug = 'suy-giam-testosterone-man-duc-nam-dau-hieu-giam-ham-muon-met-moi-va-lieu-phap-bo-sung',
    summary = 'Bài viết chuyên sâu về suy giảm testosterone mãn dục nam: dấu hiệu giảm ham muốn mệt mỏi và liệu pháp bổ sung được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '237f1b33-eaa4-d17e-89d7-27e07c99ba35';

UPDATE articles
SET title = 'Viêm mào tinh hoàn và viêm tinh hoàn cấp: Nhận diện sưng đau bìu đột ngột sốt và kháng sinh',
    slug = 'viem-mao-tinh-hoan-va-viem-tinh-hoan-cap-nhan-dien-sung-dau-biu-dot-ngot-sot-va-khang-sinh',
    summary = 'Bài viết chuyên sâu về viêm mào tinh hoàn và viêm tinh hoàn cấp: nhận diện sưng đau bìu đột ngột sốt và kháng sinh được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '42bb6b2a-a7fa-dc2f-af3c-7de22475d2f5';

UPDATE articles
SET title = 'Xoắn tinh hoàn cấp tính: Cơn đau dữ dội vùng bìu cấp cứu khẩn cấp trong 6 giờ vàng bảo tồn',
    slug = 'xoan-tinh-hoan-cap-tinh-con-dau-du-doi-vung-biu-cap-cuu-khan-cap-trong-6-gio-vang-bao-ton',
    summary = 'Bài viết chuyên sâu về xoắn tinh hoàn cấp tính: cơn đau dữ dội vùng bìu cấp cứu khẩn cấp trong 6 giờ vàng bảo tồn được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '4f999d95-fc64-1b7d-9004-df189b8fcd95';

UPDATE articles
SET title = 'Hẹp bao quy đầu và nghẹt bao quy đầu Paraphimosis: Tiểu phẫu cắt bao quy đầu máy Stapler',
    slug = 'hep-bao-quy-dau-va-nghet-bao-quy-dau-paraphimosis-tieu-phau-cat-bao-quy-dau-may-stapler',
    summary = 'Bài viết chuyên sâu về hẹp bao quy đầu và nghẹt bao quy đầu paraphimosis: tiểu phẫu cắt bao quy đầu máy stapler được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '6830b6e7-ea3d-f16f-52e1-f859e4fb3fbb';

UPDATE articles
SET title = 'Cong dương vật bệnh Peyronie: Dấu hiệu mảng xơ cứng gây đau khi cương và phẫu thuật chỉnh thẳng',
    slug = 'cong-duong-vat-benh-peyronie-dau-hieu-mang-xo-cung-gay-dau-khi-cuong-va-phau-thuat-chinh-thang',
    summary = 'Bài viết chuyên sâu về cong dương vật bệnh peyronie: dấu hiệu mảng xơ cứng gây đau khi cương và phẫu thuật chỉnh thẳng được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '8607800d-c92d-f6c2-5516-0a600a957227';

UPDATE articles
SET title = 'Gãy dương vật rách thể hang khi quan hệ: Dấu hiệu nghe tiếng kêu kèm biến dạng bìu bầm tím',
    slug = 'gay-duong-vat-rach-the-hang-khi-quan-he-dau-hieu-nghe-tieng-keu-kem-bien-dang-biu-bam-tim',
    summary = 'Bài viết chuyên sâu về gãy dương vật rách thể hang khi quan hệ: dấu hiệu nghe tiếng kêu kèm biến dạng bìu bầm tím được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '8a8372e2-ad36-322a-ec68-e27177999033';

UPDATE articles
SET title = 'Hội chứng đau vùng chậu mạn tính ở nam giới: Liệu pháp giãn cơ sàn chậu và kiểm soát căng thẳng',
    slug = 'hoi-chung-dau-vung-chau-man-tinh-o-nam-gioi-lieu-phap-gian-co-san-chau-va-kiem-soat-cang-thang',
    summary = 'Bài viết chuyên sâu về hội chứng đau vùng chậu mạn tính ở nam giới: liệu pháp giãn cơ sàn chậu và kiểm soát căng thẳng được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = '949c3cc8-b3e1-f8b0-f13a-59ad7c082c03';

UPDATE articles
SET title = 'Nhiễm khuẩn lây truyền qua đường tình dục STI: Nhận biết dấu hiệu lậu chlamydia sùi mào gà',
    slug = 'nhiem-khuan-lay-truyen-qua-duong-tinh-duc-sti-nhan-biet-dau-hieu-lau-chlamydia-sui-mao-ga',
    summary = 'Bài viết chuyên sâu về nhiễm khuẩn lây truyền qua đường tình dục sti: nhận biết dấu hiệu lậu chlamydia sùi mào gà được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = 'b2feff20-fde5-47f6-51f5-8b2623508e2f';

UPDATE articles
SET title = 'Viêm bao quy đầu do nấm vi khuẩn: Vệ sinh đúng cách và phác đồ bôi thuốc chống nhiễm trùng',
    slug = 'viem-bao-quy-dau-do-nam-vi-khuan-ve-sinh-dung-cach-va-phac-do-boi-thuoc-chong-nhiem-trung',
    summary = 'Bài viết chuyên sâu về viêm bao quy đầu do nấm vi khuẩn: vệ sinh đúng cách và phác đồ bôi thuốc chống nhiễm trùng được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = 'bd9d34b0-8579-26cd-296f-16a8c73ed654';

UPDATE articles
SET title = 'Xuất tinh ra máu: Tìm hiểu căn nguyên viêm túi tinh nang túi tinh và siêu âm qua trực tràng',
    slug = 'xuat-tinh-ra-mau-tim-hieu-can-nguyen-viem-tui-tinh-nang-tui-tinh-va-sieu-am-qua-truc-trang',
    summary = 'Bài viết chuyên sâu về xuất tinh ra máu: tìm hiểu căn nguyên viêm túi tinh nang túi tinh và siêu âm qua trực tràng được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = 'd0f8e950-8b9a-3c27-b38f-0eec68b04077';

UPDATE articles
SET title = 'Trữ đông tinh trùng: Giải pháp bảo tồn khả năng sinh sản trước khi điều trị ung bướu hóa chất',
    slug = 'tru-dong-tinh-trung-giai-phap-bao-ton-kha-nang-sinh-san-truoc-khi-dieu-tri-ung-buou-hoa-chat',
    summary = 'Bài viết chuyên sâu về trữ đông tinh trùng: giải pháp bảo tồn khả năng sinh sản trước khi điều trị ung bướu hóa chất được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = 'e9c38dda-dcd2-9f0e-5057-81c86a0a72fe';

UPDATE articles
SET title = 'Ảnh hưởng của rượu bia thuốc lá và lối sống tĩnh tại đến chất lượng tinh trùng nam giới',
    slug = 'anh-huong-cua-ruou-bia-thuoc-la-va-loi-song-tinh-tai-den-chat-luong-tinh-trung-nam-gioi',
    summary = 'Bài viết chuyên sâu về ảnh hưởng của rượu bia thuốc lá và lối sống tĩnh tại đến chất lượng tinh trùng nam giới được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = 'ece09e03-6560-4e9b-ef9a-34455d1edde2';

UPDATE articles
SET title = 'Thắt ống dẫn tinh triệt sản nam: Thủ thuật can thiệp tối thiểu an toàn không ảnh hưởng sinh lý',
    slug = 'that-ong-dan-tinh-triet-san-nam-thu-thuat-can-thiep-toi-thieu-an-toan-khong-anh-huong-sinh-ly',
    summary = 'Bài viết chuyên sâu về thắt ống dẫn tinh triệt sản nam: thủ thuật can thiệp tối thiểu an toàn không ảnh hưởng sinh lý được tham vấn y khoa bởi các chuyên gia Nam khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nam khoa'
WHERE id = 'fecaf70f-6e3b-d02d-f94d-0e7a9c8b24d0';

UPDATE articles
SET title = 'Phục hồi chức năng sau tai biến mạch máu não: Phác đồ tập vận động sớm chống teo cơ cứng khớp',
    slug = 'phuc-hoi-chuc-nang-sau-tai-bien-mach-mau-nao-phac-do-tap-van-dong-som-chong-teo-co-cung-khop',
    summary = 'Bài viết chuyên sâu về phục hồi chức năng sau tai biến mạch máu não: phác đồ tập vận động sớm chống teo cơ cứng khớp được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '013bfb56-f374-24e5-1512-6501478b981c';

UPDATE articles
SET title = 'Tập vật lý trị liệu sau phẫu thuật tái tạo dây chằng chéo trước ACL: Các giai đoạn phục hồi cơ gối',
    slug = 'tap-vat-ly-tri-lieu-sau-phau-thuat-tai-tao-day-chang-cheo-truoc-acl-cac-giai-doan-phuc-hoi-co-goi',
    summary = 'Bài viết chuyên sâu về tập vật lý trị liệu sau phẫu thuật tái tạo dây chằng chéo trước acl: các giai đoạn phục hồi cơ gối được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '047a38a5-0d85-14ac-2e71-da73750ac966';

UPDATE articles
SET title = 'Phục hồi chức năng hô hấp cho người bệnh COPD và sau viêm phổi nặng: Kỹ thuật thở chúm môi',
    slug = 'phuc-hoi-chuc-nang-ho-hap-cho-nguoi-benh-copd-va-sau-viem-phoi-nang-ky-thuat-tho-chum-moi',
    summary = 'Bài viết chuyên sâu về phục hồi chức năng hô hấp cho người bệnh copd và sau viêm phổi nặng: kỹ thuật thở chúm môi được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '12380325-0d7d-0d5c-72c9-314609f905dc';

UPDATE articles
SET title = 'Vật lý trị liệu đau thắt lưng mạn tính: Bài tập củng cố nhóm cơ lõi Core Stability bảo vệ cột sống',
    slug = 'vat-ly-tri-lieu-dau-that-lung-man-tinh-bai-tap-cung-co-nhom-co-loi-core-stability-bao-ve-cot-song',
    summary = 'Bài viết chuyên sâu về vật lý trị liệu đau thắt lưng mạn tính: bài tập củng cố nhóm cơ lõi core stability bảo vệ cột sống được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '1b5f85a5-f925-16a2-0fce-ce0985b51874';

UPDATE articles
SET title = 'Phục hồi tầm vận động khớp vai trong viêm dính khớp vai đông cứng: Bài tập ròng rọc và gậy tập',
    slug = 'phuc-hoi-tam-van-dong-khop-vai-trong-viem-dinh-khop-vai-dong-cung-bai-tap-rong-roc-va-gay-tap',
    summary = 'Bài viết chuyên sâu về phục hồi tầm vận động khớp vai trong viêm dính khớp vai đông cứng: bài tập ròng rọc và gậy tập được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '242aa9ff-0a79-2406-f842-f5aa050cee1e';

UPDATE articles
SET title = 'Phục hồi chức năng bàn tay sau chấn thương đứt gân: Kỹ thuật vận động thụ động và chủ động sớm',
    slug = 'phuc-hoi-chuc-nang-ban-tay-sau-chan-thuong-dut-gan-ky-thuat-van-dong-thu-dong-va-chu-dong-som',
    summary = 'Bài viết chuyên sâu về phục hồi chức năng bàn tay sau chấn thương đứt gân: kỹ thuật vận động thụ động và chủ động sớm được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '3432dc32-a404-7f72-23e4-98bc1eef9733';

UPDATE articles
SET title = 'Điều trị đau bằng sóng ngắn và siêu âm trị liệu: Tác dụng sinh nhiệt sâu giảm đau chống viêm mô',
    slug = 'dieu-tri-dau-bang-song-ngan-va-sieu-am-tri-lieu-tac-dung-sinh-nhiet-sau-giam-dau-chong-viem-mo',
    summary = 'Bài viết chuyên sâu về điều trị đau bằng sóng ngắn và siêu âm trị liệu: tác dụng sinh nhiệt sâu giảm đau chống viêm mô được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '41e25eea-0102-1339-8589-341118a101a8';

UPDATE articles
SET title = 'Kéo giãn cột sống bằng máy tự động: Cơ chế giảm áp lực nội đĩa đệm giải phóng chèn ép rễ thần kinh',
    slug = 'keo-gian-cot-song-bang-may-tu-dong-co-che-giam-ap-luc-noi-dia-dem-giai-phong-chen-ep-re-than-kinh',
    summary = 'Bài viết chuyên sâu về kéo giãn cột sống bằng máy tự động: cơ chế giảm áp lực nội đĩa đệm giải phóng chèn ép rễ thần kinh được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '82fc9227-c5b7-7ea9-8c01-652c2fe02bc3';

UPDATE articles
SET title = 'Hoạt động trị liệu Occupational Therapy: Rèn luyện kỹ năng tự phục vụ hàng ngày cho người khuyết tật',
    slug = 'hoat-dong-tri-lieu-occupational-therapy-ren-luyen-ky-nang-tu-phuc-vu-hang-ngay-cho-nguoi-khuyet-tat',
    summary = 'Bài viết chuyên sâu về hoạt động trị liệu occupational therapy: rèn luyện kỹ năng tự phục vụ hàng ngày cho người khuyết tật được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '8ae692e4-625a-9878-d8d1-1f049be80a68';

UPDATE articles
SET title = 'Âm ngữ trị liệu Speech Therapy: Phục hồi khả năng nuốt và phát âm sau đột quỵ não hoặc chấn thương đầu',
    slug = 'am-ngu-tri-lieu-speech-therapy-phuc-hoi-kha-nang-nuot-va-phat-am-sau-dot-quy-nao-hoac-chan-thuong-dau',
    summary = 'Bài viết chuyên sâu về âm ngữ trị liệu speech therapy: phục hồi khả năng nuốt và phát âm sau đột quỵ não hoặc chấn thương đầu được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = '98707e0e-6f72-0fb2-faee-d96efb8179f2';

UPDATE articles
SET title = 'Phục hồi chức năng trẻ bại não: Kỹ thuật kích thích vận động thô và kiểm soát đầu cổ theo mốc phát triển',
    slug = 'phuc-hoi-chuc-nang-tre-bai-nao-ky-thuat-kich-thich-van-dong-tho-va-kiem-soat-dau-co-theo-moc-phat-trien',
    summary = 'Bài viết chuyên sâu về phục hồi chức năng trẻ bại não: kỹ thuật kích thích vận động thô và kiểm soát đầu cổ theo mốc phát triển được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = 'b5ae03e0-a1dc-e3bf-d03e-06aeb0c8acca';

UPDATE articles
SET title = 'Chăm sóc phòng ngừa loét tỳ đè ở bệnh nhân nằm bất động: Kỹ thuật đổi tư thế 2 giờ một lần',
    slug = 'cham-soc-phong-ngua-loet-ty-de-o-benh-nhan-nam-bat-dong-ky-thuat-doi-tu-the-2-gio-mot-lan',
    summary = 'Bài viết chuyên sâu về chăm sóc phòng ngừa loét tỳ đè ở bệnh nhân nằm bất động: kỹ thuật đổi tư thế 2 giờ một lần được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = 'c2c4ca4f-9ba7-fa67-31d7-d17eaa83aa87';

UPDATE articles
SET title = 'Tập thăng bằng và dáng đi chống té ngã cho người cao tuổi: Ứng dụng thanh song song và thảm thăng bằng',
    slug = 'tap-thang-bang-va-dang-di-chong-te-nga-cho-nguoi-cao-tuoi-ung-dung-thanh-song-song-va-tham-thang-bang',
    summary = 'Bài viết chuyên sâu về tập thăng bằng và dáng đi chống té ngã cho người cao tuổi: ứng dụng thanh song song và thảm thăng bằng được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = 'cd601952-7eaf-f5ab-fb38-faf4f5f3b346';

UPDATE articles
SET title = 'Phục hồi chức năng sàn chậu: Khắc phục són tiểu tiểu không tự chủ ở phụ nữ sau sinh và người lớn tuổi',
    slug = 'phuc-hoi-chuc-nang-san-chau-khac-phuc-son-tieu-tieu-khong-tu-chu-o-phu-nu-sau-sinh-va-nguoi-lon-tuoi',
    summary = 'Bài viết chuyên sâu về phục hồi chức năng sàn chậu: khắc phục són tiểu tiểu không tự chủ ở phụ nữ sau sinh và người lớn tuổi được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = 'da7351df-d233-c2a7-6843-57acaaa66fa0';

UPDATE articles
SET title = 'Sử dụng dụng cụ trợ giúp nạng gậy khung tập đi: Hướng dẫn kỹ thuật đi lại an toàn tránh té ngã',
    slug = 'su-dung-dung-cu-tro-giup-nang-gay-khung-tap-di-huong-dan-ky-thuat-di-lai-an-toan-tranh-te-nga',
    summary = 'Bài viết chuyên sâu về sử dụng dụng cụ trợ giúp nạng gậy khung tập đi: hướng dẫn kỹ thuật đi lại an toàn tránh té ngã được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = 'ec93c790-1ff7-d4ce-02e6-70003c5ac223';

UPDATE articles
SET title = 'Vật lý trị liệu sau gãy xương chi dưới: Thời điểm chịu lực một phần và chịu lực hoàn toàn',
    slug = 'vat-ly-tri-lieu-sau-gay-xuong-chi-duoi-thoi-diem-chiu-luc-mot-phan-va-chiu-luc-hoan-toan',
    summary = 'Bài viết chuyên sâu về vật lý trị liệu sau gãy xương chi dưới: thời điểm chịu lực một phần và chịu lực hoàn toàn được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = 'f07d0555-3665-1375-8198-e2517f08c2b4';

UPDATE articles
SET title = 'Điện xung kích thích thần kinh cơ TENS: Cơ chế kiểm soát cơn đau cấp và mạn tính không dùng thuốc',
    slug = 'dien-xung-kich-thich-than-kinh-co-tens-co-che-kiem-soat-con-dau-cap-va-man-tinh-khong-dung-thuoc',
    summary = 'Bài viết chuyên sâu về điện xung kích thích thần kinh cơ tens: cơ chế kiểm soát cơn đau cấp và mạn tính không dùng thuốc được tham vấn y khoa bởi các chuyên gia Phục hồi chức năng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Phục hồi chức năng'
WHERE id = 'fdbddadc-3d51-9ddc-c827-b5886243c658';

UPDATE articles
SET title = 'Dị ứng thuốc kháng sinh và thuốc giảm đau: Cơ chế phản ứng quá mẫn và xét nghiệm dị nguyên',
    slug = 'di-ung-thuoc-khang-sinh-va-thuoc-giam-dau-co-che-phan-ung-qua-man-va-xet-nghiem-di-nguyen',
    summary = 'Bài viết chuyên sâu về dị ứng thuốc kháng sinh và thuốc giảm đau: cơ chế phản ứng quá mẫn và xét nghiệm dị nguyên được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '02125fd6-0767-8b3a-b371-2154ca8a9283';

UPDATE articles
SET title = 'Sốc phản vệ: Phân độ lâm sàng từ nhẹ đến nguy kịch và quy trình cấp cứu tiêm bắp Adrenaline',
    slug = 'soc-phan-ve-phan-do-lam-sang-tu-nhe-den-nguy-kich-va-quy-trinh-cap-cuu-tiem-bap-adrenaline',
    summary = 'Bài viết chuyên sâu về sốc phản vệ: phân độ lâm sàng từ nhẹ đến nguy kịch và quy trình cấp cứu tiêm bắp adrenaline được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '0d397711-b0a5-6398-6e4b-a9525511b260';

UPDATE articles
SET title = 'Viêm mũi dị ứng mạn tính: Phân biệt với cảm lạnh thông thường và phác đồ xịt mũi chống dị ứng',
    slug = 'viem-mui-di-ung-man-tinh-phan-biet-voi-cam-lanh-thong-thuong-va-phac-do-xit-mui-chong-di-ung',
    summary = 'Bài viết chuyên sâu về viêm mũi dị ứng mạn tính: phân biệt với cảm lạnh thông thường và phác đồ xịt mũi chống dị ứng được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '1a19fe35-77af-b8da-a59c-2facc2f82296';

UPDATE articles
SET title = 'Bệnh Lupus ban đỏ hệ thống SLE: Dấu hiệu ban cánh bướm đau khớp rụng tóc và điều hòa miễn dịch',
    slug = 'benh-lupus-ban-do-he-thong-sle-dau-hieu-ban-canh-buom-dau-khop-rung-toc-va-dieu-hoa-mien-dich',
    summary = 'Bài viết chuyên sâu về bệnh lupus ban đỏ hệ thống sle: dấu hiệu ban cánh bướm đau khớp rụng tóc và điều hòa miễn dịch được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '1ff5157c-01a6-53aa-54d5-80eb1abc16c4';

UPDATE articles
SET title = 'Hội chứng Stevens-Johnson dị ứng thuốc nặng: Dấu hiệu loét niêm mạc mắt miệng bỏng rộp da cấp cứu',
    slug = 'hoi-chung-stevens-johnson-di-ung-thuoc-nang-dau-hieu-loet-niem-mac-mat-mieng-bong-rop-da-cap-cuu',
    summary = 'Bài viết chuyên sâu về hội chứng stevens-johnson dị ứng thuốc nặng: dấu hiệu loét niêm mạc mắt miệng bỏng rộp da cấp cứu được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '314b0090-08e4-d7fc-e076-6697ffb05d1e';

UPDATE articles
SET title = 'Dị ứng thức ăn hải sản đậu phộng trứng sữa: Nhận diện mẩn ngứa khó thở và mang theo bút tiêm EpiPen',
    slug = 'di-ung-thuc-an-hai-san-dau-phong-trung-sua-nhan-dien-man-ngua-kho-tho-va-mang-theo-but-tiem-epipen',
    summary = 'Bài viết chuyên sâu về dị ứng thức ăn hải sản đậu phộng trứng sữa: nhận diện mẩn ngứa khó thở và mang theo bút tiêm epipen được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '32bcfd97-f1f7-f13f-44b9-c0c472afc4cf';

UPDATE articles
SET title = 'Mề đay phù mạch Quincke: Nguy cơ phù nề thanh quản chèn ép đường thở và xử trí khẩn cấp',
    slug = 'me-day-phu-mach-quincke-nguy-co-phu-ne-thanh-quan-chen-ep-duong-tho-va-xu-tri-khan-cap',
    summary = 'Bài viết chuyên sâu về mề đay phù mạch quincke: nguy cơ phù nề thanh quản chèn ép đường thở và xử trí khẩn cấp được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '4982f082-4af5-dbc3-14fa-997ec1b6a8f3';

UPDATE articles
SET title = 'Bệnh xơ cứng bì hệ thống Scleroderma: Dấu hiệu da xơ cứng dày bì hội chứng Raynaud và nội tạng',
    slug = 'benh-xo-cung-bi-he-thong-scleroderma-dau-hieu-da-xo-cung-day-bi-hoi-chung-raynaud-va-noi-tang',
    summary = 'Bài viết chuyên sâu về bệnh xơ cứng bì hệ thống scleroderma: dấu hiệu da xơ cứng dày bì hội chứng raynaud và nội tạng được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '507cafe9-92b6-9e1f-3e9f-50ef60fa62dd';

UPDATE articles
SET title = 'Viêm da tiếp xúc dị ứng mỹ phẩm kim loại: Test áp bì Patch Test xác định chính xác dị nguyên tiếp xúc',
    slug = 'viem-da-tiep-xuc-di-ung-my-pham-kim-loai-test-ap-bi-patch-test-xac-dinh-chinh-xac-di-nguyen-tiep-xuc',
    summary = 'Bài viết chuyên sâu về viêm da tiếp xúc dị ứng mỹ phẩm kim loại: test áp bì patch test xác định chính xác dị nguyên tiếp xúc được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '6915d6e6-43ef-a573-26eb-e83cb1a138e4';

UPDATE articles
SET title = 'Hội chứng Sjogren khô mắt khô miệng tự miễn: Cách bảo vệ giác mạc niêm mạc miệng và bù dịch',
    slug = 'hoi-chung-sjogren-kho-mat-kho-mieng-tu-mien-cach-bao-ve-giac-mac-niem-mac-mieng-va-bu-dich',
    summary = 'Bài viết chuyên sâu về hội chứng sjogren khô mắt khô miệng tự miễn: cách bảo vệ giác mạc niêm mạc miệng và bù dịch được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '7f4776d0-e835-a36e-9974-a7c0fa7ff3b1';

UPDATE articles
SET title = 'Hen phế quản dị ứng: Xét nghiệm IgE đặc hiệu tìm dị nguyên đường hô hấp mạt bụi phấn hoa',
    slug = 'hen-phe-quan-di-ung-xet-nghiem-ige-dac-hieu-tim-di-nguyen-duong-ho-hap-mat-bui-phan-hoa',
    summary = 'Bài viết chuyên sâu về hen phế quản dị ứng: xét nghiệm ige đặc hiệu tìm dị nguyên đường hô hấp mạt bụi phấn hoa được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '85f2b98b-d1c6-4e46-20e2-4cc95e84f1b0';

UPDATE articles
SET title = 'Viêm mạch tự miễn Henoch-Schonlein: Dấu hiệu ban xuất huyết dạng nốt sưng khớp đau bụng ở trẻ em',
    slug = 'viem-mach-tu-mien-henoch-schonlein-dau-hieu-ban-xuat-huyet-dang-not-sung-khop-dau-bung-o-tre-em',
    summary = 'Bài viết chuyên sâu về viêm mạch tự miễn henoch-schonlein: dấu hiệu ban xuất huyết dạng nốt sưng khớp đau bụng ở trẻ em được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '8a88ac48-8c39-e8f7-bfd9-436092d3b9ea';

UPDATE articles
SET title = 'Hội chứng kháng phospholipid APS: Nguy cơ huyết khối tắc mạch sảy thai liên tiếp và thuốc chống đông',
    slug = 'hoi-chung-khang-phospholipid-aps-nguy-co-huyet-khoi-tac-mach-say-thai-lien-tiep-va-thuoc-chong-dong',
    summary = 'Bài viết chuyên sâu về hội chứng kháng phospholipid aps: nguy cơ huyết khối tắc mạch sảy thai liên tiếp và thuốc chống đông được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = '98488e6d-95a2-3647-f579-137cc409a94e';

UPDATE articles
SET title = 'Liệu pháp giải mẫn cảm đặc hiệu AIT: Điều trị căn nguyên dị ứng phấn hoa bọ nhà lâu dài',
    slug = 'lieu-phap-giai-man-cam-dac-hieu-ait-dieu-tri-can-nguyen-di-ung-phan-hoa-bo-nha-lau-dai',
    summary = 'Bài viết chuyên sâu về liệu pháp giải mẫn cảm đặc hiệu ait: điều trị căn nguyên dị ứng phấn hoa bọ nhà lâu dài được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = 'a2bf3349-dfcf-41d6-61a8-325e424cbe14';

UPDATE articles
SET title = 'Bệnh lý suy giảm miễn dịch nguyên phát: Dấu hiệu nhiễm trùng tái diễn nhiều lần trong năm',
    slug = 'benh-ly-suy-giam-mien-dich-nguyen-phat-dau-hieu-nhiem-trung-tai-dien-nhieu-lan-trong-nam',
    summary = 'Bài viết chuyên sâu về bệnh lý suy giảm miễn dịch nguyên phát: dấu hiệu nhiễm trùng tái diễn nhiều lần trong năm được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = 'a811012a-935d-f8f2-fce5-b82dc6d76ea2';

UPDATE articles
SET title = 'Tự miễn dịch và chế độ sinh hoạt: Giảm stress ngủ đủ giấc dinh dưỡng chống viêm bảo vệ hệ miễn dịch',
    slug = 'tu-mien-dich-va-che-do-sinh-hoat-giam-stress-ngu-du-giac-dinh-duong-chong-viem-bao-ve-he-mien-dich',
    summary = 'Bài viết chuyên sâu về tự miễn dịch và chế độ sinh hoạt: giảm stress ngủ đủ giấc dinh dưỡng chống viêm bảo vệ hệ miễn dịch được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = 'afa83884-bc94-c8ec-de3c-a49889a12947';

UPDATE articles
SET title = 'Xét nghiệm kháng thể kháng nhân ANA: Ý nghĩa trong tầm soát chẩn đoán các bệnh lý mô liên kết tự miễn',
    slug = 'xet-nghiem-khang-the-khang-nhan-ana-y-nghia-trong-tam-soat-chan-doan-cac-benh-ly-mo-lien-ket-tu-mien',
    summary = 'Bài viết chuyên sâu về xét nghiệm kháng thể kháng nhân ana: ý nghĩa trong tầm soát chẩn đoán các bệnh lý mô liên kết tự miễn được tham vấn y khoa bởi các chuyên gia Miễn dịch dị ứng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Miễn dịch dị ứng'
WHERE id = 'fcc3bb47-e6aa-ce3d-481a-a2361a68fadb';

UPDATE articles
SET title = 'Đột quỵ não cấp: Nhận diện dấu hiệu FAST và quy tắc 4.5 giờ vàng tiêu sợi huyết',
    slug = 'dot-quy-nao-cap-nhan-dien-dau-hieu-fast-va-quy-tac-45-gio-vang-tieu-soi-huyet',
    summary = 'Bài viết chuyên sâu về đột quỵ não cấp: nhận diện dấu hiệu fast và quy tắc 4.5 giờ vàng tiêu sợi huyết được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '02f7efcf-9b4d-4b2f-2e93-0f2cd07ab44f';

UPDATE articles
SET title = 'Rối loạn tiền đình: Phân biệt chóng mặt tư thế lành tính BPPV với chóng mặt trung ương',
    slug = 'roi-loan-tien-dinh-phan-biet-chong-mat-tu-the-lanh-tinh-bppv-voi-chong-mat-trung-uong',
    summary = 'Bài viết chuyên sâu về rối loạn tiền đình: phân biệt chóng mặt tư thế lành tính bppv với chóng mặt trung ương được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '09993f27-f519-9412-b889-4d49d815bb96';

UPDATE articles
SET title = 'Đau nửa đầu Migraine: Cơ chế đau đầu vận mạch và các liệu pháp cắt cơn hiệu quả',
    slug = 'dau-nua-dau-migraine-co-che-dau-dau-van-mach-va-cac-lieu-phap-cat-con-hieu-qua',
    summary = 'Bài viết chuyên sâu về đau nửa đầu migraine: cơ chế đau đầu vận mạch và các liệu pháp cắt cơn hiệu quả được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '0feea896-e24d-a858-9c38-d39cff0ff573';

UPDATE articles
SET title = 'Đau đầu căng thẳng do áp lực công việc: Liệu pháp thư giãn cơ và phục hồi giấc ngủ',
    slug = 'dau-dau-cang-thang-do-ap-luc-cong-viec-lieu-phap-thu-gian-co-va-phuc-hoi-giac-ngu',
    summary = 'Bài viết chuyên sâu về đau đầu căng thẳng do áp lực công việc: liệu pháp thư giãn cơ và phục hồi giấc ngủ được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '18658dbb-ba80-5983-a2c7-6b23bc186e88';

UPDATE articles
SET title = 'Mất ngủ mạn tính kéo dài: Thiết lập vệ sinh giấc ngủ khoa học và hạn chế lạm dụng an thần',
    slug = 'mat-ngu-man-tinh-keo-dai-thiet-lap-ve-sinh-giac-ngu-khoa-hoc-va-han-che-lam-dung-an-than',
    summary = 'Bài viết chuyên sâu về mất ngủ mạn tính kéo dài: thiết lập vệ sinh giấc ngủ khoa học và hạn chế lạm dụng an thần được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '1d40c0aa-758b-0b72-169e-93424670d476';

UPDATE articles
SET title = 'Bệnh Parkinson: Dấu hiệu run tay khi nghỉ, cứng đờ vận động và phác đồ Levodopa',
    slug = 'benh-parkinson-dau-hieu-run-tay-khi-nghi-cung-do-van-dong-va-phac-do-levodopa',
    summary = 'Bài viết chuyên sâu về bệnh parkinson: dấu hiệu run tay khi nghỉ, cứng đờ vận động và phác đồ levodopa được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '28259f10-e48e-8eb2-b7f8-2320e596ee30';

UPDATE articles
SET title = 'Đau dây thần kinh số V: Biểu hiện đau nhói như điện giật vùng mặt và can thiệp nội khoa',
    slug = 'dau-day-than-kinh-so-v-bieu-hien-dau-nhoi-nhu-dien-giat-vung-mat-va-can-thiep-noi-khoa',
    summary = 'Bài viết chuyên sâu về đau dây thần kinh số v: biểu hiện đau nhói như điện giật vùng mặt và can thiệp nội khoa được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '2f173a34-8440-e8df-d037-3cbfa29e87fc';

UPDATE articles
SET title = 'Liệt dây thần kinh số VII ngoại biên méo miệng: Phác đồ corticoid sớm và tập cơ mặt',
    slug = 'liet-day-than-kinh-so-vii-ngoai-bien-meo-mieng-phac-do-corticoid-som-va-tap-co-mat',
    summary = 'Bài viết chuyên sâu về liệt dây thần kinh số vii ngoại biên méo miệng: phác đồ corticoid sớm và tập cơ mặt được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '4dbf61c8-e55f-ab6e-be99-cb8700191b95';

UPDATE articles
SET title = 'Cơn co giật và bệnh động kinh: Hướng dẫn sơ cứu an toàn tránh tổn thương cho người bệnh',
    slug = 'con-co-giat-va-benh-dong-kinh-huong-dan-so-cuu-an-toan-tranh-ton-thuong-cho-nguoi-benh',
    summary = 'Bài viết chuyên sâu về cơn co giật và bệnh động kinh: hướng dẫn sơ cứu an toàn tránh tổn thương cho người bệnh được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '662021b5-d6a6-155b-891e-6a8e5f27409e';

UPDATE articles
SET title = 'Suy giảm trí nhớ sa sút trí tuệ Alzheimer: Nhận diện dấu hiệu sớm và chăm sóc người cao tuổi',
    slug = 'suy-giam-tri-nho-sa-sut-tri-tue-alzheimer-nhan-dien-dau-hieu-som-va-cham-soc-nguoi-cao-tuoi',
    summary = 'Bài viết chuyên sâu về suy giảm trí nhớ sa sút trí tuệ alzheimer: nhận diện dấu hiệu sớm và chăm sóc người cao tuổi được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = '89a5c82e-bfb5-e684-d6c8-45cdb8b5917f';

UPDATE articles
SET title = 'Bệnh xơ cứng rải rác MS: Triệu chứng rối loạn cảm giác và liệu pháp điều hòa miễn dịch',
    slug = 'benh-xo-cung-rai-rac-ms-trieu-chung-roi-loan-cam-giac-va-lieu-phap-dieu-hoa-mien-dich',
    summary = 'Bài viết chuyên sâu về bệnh xơ cứng rải rác ms: triệu chứng rối loạn cảm giác và liệu pháp điều hòa miễn dịch được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = 'a4cdeb34-7d21-d692-7755-4044bc1adad0';

UPDATE articles
SET title = 'Rối loạn lo âu lan tỏa và cơn hoảng sợ kịch phát: Hướng dẫn kỹ thuật điều hòa nhịp thở',
    slug = 'roi-loan-lo-au-lan-toa-va-con-hoang-so-kich-phat-huong-dan-ky-thuat-dieu-hoa-nhip-tho',
    summary = 'Bài viết chuyên sâu về rối loạn lo âu lan tỏa và cơn hoảng sợ kịch phát: hướng dẫn kỹ thuật điều hòa nhịp thở được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = 'b50e9a46-e107-c771-431f-664374d5bffe';

UPDATE articles
SET title = 'Đo điện não đồ vi tính EEG: Giá trị chẩn đoán ổ sóng động kinh và rối loạn giấc ngủ',
    slug = 'do-dien-nao-do-vi-tinh-eeg-gia-tri-chan-doan-o-song-dong-kinh-va-roi-loan-giac-ngu',
    summary = 'Bài viết chuyên sâu về đo điện não đồ vi tính eeg: giá trị chẩn đoán ổ sóng động kinh và rối loạn giấc ngủ được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = 'bb578b39-bb8e-09fe-be20-64ee728ce46b';

UPDATE articles
SET title = 'Đo điện cơ và dẫn truyền thần kinh EMG: Chẩn đoán tổn thương rễ và dây thần kinh ngoại biên',
    slug = 'do-dien-co-va-dan-truyen-than-kinh-emg-chan-doan-ton-thuong-re-va-day-than-kinh-ngoai-bien',
    summary = 'Bài viết chuyên sâu về đo điện cơ và dẫn truyền thần kinh emg: chẩn đoán tổn thương rễ và dây thần kinh ngoại biên được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = 'df08c8d3-ac1b-68aa-6a46-c73af6172c81';

UPDATE articles
SET title = 'Viêm màng não nhiễm khuẩn: Dấu hiệu sốt cao, cứng gáy, sợ ánh sáng cần cấp cứu ngay',
    slug = 'viem-mang-nao-nhiem-khuan-dau-hieu-sot-cao-cung-gay-so-anh-sang-can-cap-cuu-ngay',
    summary = 'Bài viết chuyên sâu về viêm màng não nhiễm khuẩn: dấu hiệu sốt cao, cứng gáy, sợ ánh sáng cần cấp cứu ngay được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = 'f884c160-9c6f-5a6c-24c1-1a5828cbe1e5';

UPDATE articles
SET title = 'Đau dây thần kinh sau zona: Phác đồ giảm đau thần kinh chuyên biệt và bảo vệ thụ cảm thể',
    slug = 'dau-day-than-kinh-sau-zona-phac-do-giam-dau-than-kinh-chuyen-biet-va-bao-ve-thu-cam-the',
    summary = 'Bài viết chuyên sâu về đau dây thần kinh sau zona: phác đồ giảm đau thần kinh chuyên biệt và bảo vệ thụ cảm thể được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = 'f9b8674a-8e9f-e6a3-9175-cf05b634e28e';

UPDATE articles
SET title = 'Hội chứng chân không yên RLS: Cảm giác bồn chồn khó chịu về đêm và bổ sung vi chất',
    slug = 'hoi-chung-chan-khong-yen-rls-cam-giac-bon-chon-kho-chiu-ve-dem-va-bo-sung-vi-chat',
    summary = 'Bài viết chuyên sâu về hội chứng chân không yên rls: cảm giác bồn chồn khó chịu về đêm và bổ sung vi chất được tham vấn y khoa bởi các chuyên gia Thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Thần kinh'
WHERE id = 'f9d76813-36a8-0553-6b02-0e21352aa20a';

UPDATE articles
SET title = 'Thoái hóa khớp gối: Các giai đoạn bệnh, bài tập mạnh cơ tứ đầu đùi và tiêm acid hyaluronic',
    slug = 'thoai-hoa-khop-goi-cac-giai-doan-benh-bai-tap-manh-co-tu-dau-dui-va-tiem-acid-hyaluronic',
    summary = 'Bài viết chuyên sâu về thoái hóa khớp gối: các giai đoạn bệnh, bài tập mạnh cơ tứ đầu đùi và tiêm acid hyaluronic được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '0309c678-f28a-2c7a-0c22-11be74af4e99';

UPDATE articles
SET title = 'Thoát vị đĩa đệm cột sống thắt lưng: Chỉ định điều trị bảo tồn vật lý trị liệu và phẫu thuật',
    slug = 'thoat-vi-dia-dem-cot-song-that-lung-chi-dinh-dieu-tri-bao-ton-vat-ly-tri-lieu-va-phau-thuat',
    summary = 'Bài viết chuyên sâu về thoát vị đĩa đệm cột sống thắt lưng: chỉ định điều trị bảo tồn vật lý trị liệu và phẫu thuật được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '16515f48-8184-97ca-fced-aa83aca330e6';

UPDATE articles
SET title = 'Thoát vị đĩa đệm cột sống cổ: Dấu hiệu đau mỏi vai gáy lan cánh tay và bài tập kéo giãn',
    slug = 'thoat-vi-dia-dem-cot-song-co-dau-hieu-dau-moi-vai-gay-lan-canh-tay-va-bai-tap-keo-gian',
    summary = 'Bài viết chuyên sâu về thoát vị đĩa đệm cột sống cổ: dấu hiệu đau mỏi vai gáy lan cánh tay và bài tập kéo giãn được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '23950458-7ba0-2d04-9238-93fbebfc864f';

UPDATE articles
SET title = 'Cơn gút cấp tính sưng ngón chân cái: Phác đồ hạ acid uric máu và chế độ ăn kiêng purin',
    slug = 'con-gut-cap-tinh-sung-ngon-chan-cai-phac-do-ha-acid-uric-mau-va-che-do-an-kieng-purin',
    summary = 'Bài viết chuyên sâu về cơn gút cấp tính sưng ngón chân cái: phác đồ hạ acid uric máu và chế độ ăn kiêng purin được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '2a7e6af1-d7d0-5cd0-2a17-ab35f717e3d0';

UPDATE articles
SET title = 'Viêm khớp dạng thấp: Dấu hiệu cứng khớp buổi sáng, sưng khớp đối xứng và thuốc sinh học',
    slug = 'viem-khop-dang-thap-dau-hieu-cung-khop-buoi-sang-sung-khop-doi-xung-va-thuoc-sinh-hoc',
    summary = 'Bài viết chuyên sâu về viêm khớp dạng thấp: dấu hiệu cứng khớp buổi sáng, sưng khớp đối xứng và thuốc sinh học được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '479df3fc-c01a-7229-f437-a705d72595f8';

UPDATE articles
SET title = 'Loãng xương ở người lớn tuổi: Đo mật độ xương DXA và bổ sung canxi vitamin D3 khoa học',
    slug = 'loang-xuong-o-nguoi-lon-tuoi-do-mat-do-xuong-dxa-va-bo-sung-canxi-vitamin-d3-khoa-hoc',
    summary = 'Bài viết chuyên sâu về loãng xương ở người lớn tuổi: đo mật độ xương dxa và bổ sung canxi vitamin d3 khoa học được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '54782f31-bad1-8800-6dfb-8c96c35eb758';

UPDATE articles
SET title = 'Viêm quanh khớp vai đông cứng: Các giai đoạn đau co rút và phục hồi tầm vận động khớp',
    slug = 'viem-quanh-khop-vai-dong-cung-cac-giai-doan-dau-co-rut-va-phuc-hoi-tam-van-dong-khop',
    summary = 'Bài viết chuyên sâu về viêm quanh khớp vai đông cứng: các giai đoạn đau co rút và phục hồi tầm vận động khớp được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '60ff4581-b2bf-39f0-4233-2af200f31d67';

UPDATE articles
SET title = 'Hội chứng ống cổ tay: Dấu hiệu tê bì ngón tay khi đi xe máy và phẫu thuật giải ép vi phẫu',
    slug = 'hoi-chung-ong-co-tay-dau-hieu-te-bi-ngon-tay-khi-di-xe-may-va-phau-thuat-giai-ep-vi-phau',
    summary = 'Bài viết chuyên sâu về hội chứng ống cổ tay: dấu hiệu tê bì ngón tay khi đi xe máy và phẫu thuật giải ép vi phẫu được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '7bc10a85-9077-502d-958f-99f86e899b87';

UPDATE articles
SET title = 'Viêm gân gót chân Achilles: Nguyên nhân vận động quá tải và nguyên tắc sơ cứu RICE',
    slug = 'viem-gan-got-chan-achilles-nguyen-nhan-van-dong-qua-tai-va-nguyen-tac-so-cuu-rice',
    summary = 'Bài viết chuyên sâu về viêm gân gót chân achilles: nguyên nhân vận động quá tải và nguyên tắc sơ cứu rice được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '94c891a1-72ad-fa68-fbf0-8591266aff84';

UPDATE articles
SET title = 'Tràn dịch khớp gối mạn tính: Kỹ thuật chọc hút dịch khớp vô khuẩn và tiêm thuốc kháng viêm',
    slug = 'tran-dich-khop-goi-man-tinh-ky-thuat-choc-hut-dich-khop-vo-khuan-va-tiem-thuoc-khang-viem',
    summary = 'Bài viết chuyên sâu về tràn dịch khớp gối mạn tính: kỹ thuật chọc hút dịch khớp vô khuẩn và tiêm thuốc kháng viêm được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = '954aa04a-58c7-9c67-c4d9-63c73c72090a';

UPDATE articles
SET title = 'Viêm cột sống dính khớp: Dấu hiệu đau thắt lưng mạn ở người trẻ và xét nghiệm HLA-B27',
    slug = 'viem-cot-song-dinh-khop-dau-hieu-dau-that-lung-man-o-nguoi-tre-va-xet-nghiem-hla-b27',
    summary = 'Bài viết chuyên sâu về viêm cột sống dính khớp: dấu hiệu đau thắt lưng mạn ở người trẻ và xét nghiệm hla-b27 được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = 'b3e3beee-b6f9-35fd-d819-b73b9aec30a3';

UPDATE articles
SET title = 'Tiêm huyết tương giàu tiểu cầu PRP: Ứng dụng tự thân kích thích tái tạo sụn và mô mềm',
    slug = 'tiem-huyet-tuong-giau-tieu-cau-prp-ung-dung-tu-than-kich-thich-tai-tao-sun-va-mo-mem',
    summary = 'Bài viết chuyên sâu về tiêm huyết tương giàu tiểu cầu prp: ứng dụng tự thân kích thích tái tạo sụn và mô mềm được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = 'b92a3cfd-58e0-ee97-af99-f73f90d85e0b';

UPDATE articles
SET title = 'Rách sụn chêm và đứt dây chằng chéo trước ACL: Phẫu thuật nội soi tái tạo dây chằng',
    slug = 'rach-sun-chem-va-dut-day-chang-cheo-truoc-acl-phau-thuat-noi-soi-tai-tao-day-chang',
    summary = 'Bài viết chuyên sâu về rách sụn chêm và đứt dây chằng chéo trước acl: phẫu thuật nội soi tái tạo dây chằng được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = 'd8a43e2d-c183-7f1d-fbbf-75382112210a';

UPDATE articles
SET title = 'Hội chứng bàn chân bẹt: Tác động biến dạng trục chân và phương pháp đế chỉnh hình y khoa',
    slug = 'hoi-chung-ban-chan-bet-tac-dong-bien-dang-truc-chan-va-phuong-phap-de-chinh-hinh-y-khoa',
    summary = 'Bài viết chuyên sâu về hội chứng bàn chân bẹt: tác động biến dạng trục chân và phương pháp đế chỉnh hình y khoa được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = 'dc2ab85a-c651-67a8-6a67-34e4f70e24c7';

UPDATE articles
SET title = 'Đau xơ cơ toàn thân Fibromyalgia: Nhận diện điểm đau kích hoạt và liệu pháp tập luyện nhẹ',
    slug = 'dau-xo-co-toan-than-fibromyalgia-nhan-dien-diem-dau-kich-hoat-va-lieu-phap-tap-luyen-nhe',
    summary = 'Bài viết chuyên sâu về đau xơ cơ toàn thân fibromyalgia: nhận diện điểm đau kích hoạt và liệu pháp tập luyện nhẹ được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = 'dd15565c-5080-2b52-9c34-d0a857b891cd';

UPDATE articles
SET title = 'Ngón tay lò xo ngón tay bật: Triệu chứng kẹt ngón khi gập và tiêm bao gân chống dính',
    slug = 'ngon-tay-lo-xo-ngon-tay-bat-trieu-chung-ket-ngon-khi-gap-va-tiem-bao-gan-chong-dinh',
    summary = 'Bài viết chuyên sâu về ngón tay lò xo ngón tay bật: triệu chứng kẹt ngón khi gập và tiêm bao gân chống dính được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = 'e4554793-b56c-4cd2-cabe-5e182bbe0111';

UPDATE articles
SET title = 'Vật lý trị liệu phục hồi chức năng sau mổ thay khớp háng nhân tạo: Phác đồ đi lại sớm',
    slug = 'vat-ly-tri-lieu-phuc-hoi-chuc-nang-sau-mo-thay-khop-hang-nhan-tao-phac-do-di-lai-som',
    summary = 'Bài viết chuyên sâu về vật lý trị liệu phục hồi chức năng sau mổ thay khớp háng nhân tạo: phác đồ đi lại sớm được tham vấn y khoa bởi các chuyên gia Cơ xương khớp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Cơ xương khớp'
WHERE id = 'eadf2078-f307-1412-12ee-044da2ed9d0c';

UPDATE articles
SET title = 'Trẻ hóa da bằng laser vi điểm Fractional CO2: Cải thiện cấu trúc sẹo rỗ và lỗ chân lông to',
    slug = 'tre-hoa-da-bang-laser-vi-diem-fractional-co2-cai-thien-cau-truc-seo-ro-va-lo-chan-long-to',
    summary = 'Bài viết chuyên sâu về trẻ hóa da bằng laser vi điểm fractional co2: cải thiện cấu trúc sẹo rỗ và lỗ chân lông to được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '0456c690-cc89-55b5-2ede-2149a0df377f';

UPDATE articles
SET title = 'Ứng dụng tiêm Botox xóa nếp nhăn động: Vùng trán, vết chân chim và an toàn giải phẫu khuôn mặt',
    slug = 'ung-dung-tiem-botox-xoa-nep-nhan-dong-vung-tran-vet-chan-chim-va-an-toan-giai-phau-khuon-mat',
    summary = 'Bài viết chuyên sâu về ứng dụng tiêm botox xóa nếp nhăn động: vùng trán, vết chân chim và an toàn giải phẫu khuôn mặt được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '216e8004-20fe-04c8-5211-2372297fb052';

UPDATE articles
SET title = 'Tiêm chất làm đầy Filler Hyaluronic Acid: Tạo hình cằm môi và nguyên tắc phòng ngừa tắc mạch',
    slug = 'tiem-chat-lam-day-filler-hyaluronic-acid-tao-hinh-cam-moi-va-nguyen-tac-phong-ngua-tac-mach',
    summary = 'Bài viết chuyên sâu về tiêm chất làm đầy filler hyaluronic acid: tạo hình cằm môi và nguyên tắc phòng ngừa tắc mạch được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '2552a9d1-c489-22b3-c8a6-10d21f5fc209';

UPDATE articles
SET title = 'Điều trị nám da Melasma: Phối hợp laser Q-Switched, Tranexamic Acid và chống nắng đa tầng',
    slug = 'dieu-tri-nam-da-melasma-phoi-hop-laser-q-switched-tranexamic-acid-va-chong-nang-da-tang',
    summary = 'Bài viết chuyên sâu về điều trị nám da melasma: phối hợp laser q-switched, tranexamic acid và chống nắng đa tầng được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '26703841-6bc1-345b-b1d7-27bb69613707';

UPDATE articles
SET title = 'Peel da hóa học Chemical Peel: Nồng độ AHA BHA trong tái tạo bề mặt và giảm bít tắc dầu thừa',
    slug = 'peel-da-hoa-hoc-chemical-peel-nong-do-aha-bha-trong-tai-tao-be-mat-va-giam-bit-tac-dau-thua',
    summary = 'Bài viết chuyên sâu về peel da hóa học chemical peel: nồng độ aha bha trong tái tạo bề mặt và giảm bít tắc dầu thừa được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '46846fd9-ef22-6245-1471-88454de70348';

UPDATE articles
SET title = 'Công nghệ nâng cơ trẻ hóa HIFU: Kích thích tăng sinh collagen tầng sâu không xâm lấn',
    slug = 'cong-nghe-nang-co-tre-hoa-hifu-kich-thich-tang-sinh-collagen-tang-sau-khong-xam-lan',
    summary = 'Bài viết chuyên sâu về công nghệ nâng cơ trẻ hóa hifu: kích thích tăng sinh collagen tầng sâu không xâm lấn được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '53bbfb30-77b4-08ad-1a8b-ce1ce7fab367';

UPDATE articles
SET title = 'Công nghệ sóng vô tuyến RF vi kim: Thu nhỏ lỗ chân lông và làm săn chắc da chùng nhão',
    slug = 'cong-nghe-song-vo-tuyen-rf-vi-kim-thu-nho-lo-chan-long-va-lam-san-chac-da-chung-nhao',
    summary = 'Bài viết chuyên sâu về công nghệ sóng vô tuyến rf vi kim: thu nhỏ lỗ chân lông và làm săn chắc da chùng nhão được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '65af9dca-3a0f-3695-ae89-76f36423b329';

UPDATE articles
SET title = 'Điều trị tàn nhang và đồi mồi bằng laser bước sóng chọn lọc: Xóa tan hắc sắc tố nông',
    slug = 'dieu-tri-tan-nhang-va-doi-moi-bang-laser-buoc-song-chon-loc-xoa-tan-hac-sac-to-nong',
    summary = 'Bài viết chuyên sâu về điều trị tàn nhang và đồi mồi bằng laser bước sóng chọn lọc: xóa tan hắc sắc tố nông được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '6bee8713-fceb-1975-57bb-4e1a9931d204';

UPDATE articles
SET title = 'Mesotherapy vi điểm: Cung cấp HA, vitamin và peptide nuôi dưỡng làn da căng bóng mịn màng',
    slug = 'mesotherapy-vi-diem-cung-cap-ha-vitamin-va-peptide-nuoi-duong-lan-da-cang-bong-min-mang',
    summary = 'Bài viết chuyên sâu về mesotherapy vi điểm: cung cấp ha, vitamin và peptide nuôi dưỡng làn da căng bóng mịn màng được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '747d074f-a160-cacd-a6fc-7c2aa9baba74';

UPDATE articles
SET title = 'Chăm sóc da sau thủ thuật laser: Quy tắc làm dịu, chống nắng tuyệt đối và kem phục hồi biểu bì',
    slug = 'cham-soc-da-sau-thu-thuat-laser-quy-tac-lam-diu-chong-nang-tuyet-doi-va-kem-phuc-hoi-bieu-bi',
    summary = 'Bài viết chuyên sâu về chăm sóc da sau thủ thuật laser: quy tắc làm dịu, chống nắng tuyệt đối và kem phục hồi biểu bì được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '789480b8-81a7-e029-a477-5d461ee2789b';

UPDATE articles
SET title = 'Xóa sẹo mụn lâu năm: Phối hợp bóc tách đáy sẹo Subcision và tiêm tế bào gốc PRP',
    slug = 'xoa-seo-mun-lau-nam-phoi-hop-boc-tach-day-seo-subcision-va-tiem-te-bao-goc-prp',
    summary = 'Bài viết chuyên sâu về xóa sẹo mụn lâu năm: phối hợp bóc tách đáy sẹo subcision và tiêm tế bào gốc prp được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '7ce71042-c300-dcdc-3d60-6fb9bb6b4ab2';

UPDATE articles
SET title = 'Căng chỉ sinh học tự tiêu: Nâng đỡ cơ mặt chảy xệ và định hình đường viền hàm thanh tú',
    slug = 'cang-chi-sinh-hoc-tu-tieu-nang-do-co-mat-chay-xe-va-dinh-hinh-duong-vien-ham-thanh-tu',
    summary = 'Bài viết chuyên sâu về căng chỉ sinh học tự tiêu: nâng đỡ cơ mặt chảy xệ và định hình đường viền hàm thanh tú được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = '91d18d36-a3d9-a94a-0fc7-5b7c7dbefe5a';

UPDATE articles
SET title = 'Điều trị rạn da sau sinh: Hiệu quả của laser vi điểm kết hợp lăn kim phục hồi sợi đàn hồi',
    slug = 'dieu-tri-ran-da-sau-sinh-hieu-qua-cua-laser-vi-diem-ket-hop-lan-kim-phuc-hoi-soi-dan-hoi',
    summary = 'Bài viết chuyên sâu về điều trị rạn da sau sinh: hiệu quả của laser vi điểm kết hợp lăn kim phục hồi sợi đàn hồi được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = 'aa2d5241-b296-9c54-3d67-92ab475e835f';

UPDATE articles
SET title = 'Trị thâm sau mụn PIH: Cơ chế tăng sắc tố sau viêm và các hoạt chất làm sáng da an toàn',
    slug = 'tri-tham-sau-mun-pih-co-che-tang-sac-to-sau-viem-va-cac-hoat-chat-lam-sang-da-an-toan',
    summary = 'Bài viết chuyên sâu về trị thâm sau mụn pih: cơ chế tăng sắc tố sau viêm và các hoạt chất làm sáng da an toàn được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = 'daf613b4-057c-5543-38ab-1d1dff6f5174';

UPDATE articles
SET title = 'Triệt lông công nghệ ánh sáng IPL diode: Chu kỳ nang lông và số buổi điều trị chuẩn',
    slug = 'triet-long-cong-nghe-anh-sang-ipl-diode-chu-ky-nang-long-va-so-buoi-dieu-tri-chuan',
    summary = 'Bài viết chuyên sâu về triệt lông công nghệ ánh sáng ipl diode: chu kỳ nang lông và số buổi điều trị chuẩn được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = 'f1be19ed-87d3-c8e8-ea9b-22291f8cc951';

UPDATE articles
SET title = 'Bảo vệ làn da trước ánh sáng xanh HEV từ màn hình điện tử và tia cực tím UVA1',
    slug = 'bao-ve-lan-da-truoc-anh-sang-xanh-hev-tu-man-hinh-dien-tu-va-tia-cuc-tim-uva1',
    summary = 'Bài viết chuyên sâu về bảo vệ làn da trước ánh sáng xanh hev từ màn hình điện tử và tia cực tím uva1 được tham vấn y khoa bởi các chuyên gia Da liễu thẩm mỹ Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu thẩm mỹ'
WHERE id = 'f77ef708-87a5-35a1-63d1-8cdb70dbe966';

UPDATE articles
SET title = 'Thiếu máu thiếu sắt: Triệu chứng da xanh xao mệt mỏi hoa mắt và bổ sung sắt uống đúng cách',
    slug = 'thieu-mau-thieu-sat-trieu-chung-da-xanh-xao-met-moi-hoa-mat-va-bo-sung-sat-uong-dung-cach',
    summary = 'Bài viết chuyên sâu về thiếu máu thiếu sắt: triệu chứng da xanh xao mệt mỏi hoa mắt và bổ sung sắt uống đúng cách được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '05260768-b9b3-e51b-853e-27ad9acad31d';

UPDATE articles
SET title = 'Bệnh tan máu bẩm sinh Thalassemia: Di truyền gen lặn, truyền máu định kỳ và thải sắt quá tải',
    slug = 'benh-tan-mau-bam-sinh-thalassemia-di-truyen-gen-lan-truyen-mau-dinh-ky-va-thai-sat-qua-tai',
    summary = 'Bài viết chuyên sâu về bệnh tan máu bẩm sinh thalassemia: di truyền gen lặn, truyền máu định kỳ và thải sắt quá tải được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '089f6e9b-3d13-a21a-278a-146c70f60647';

UPDATE articles
SET title = 'Xuất huyết giảm tiểu cầu miễn dịch ITP: Dấu hiệu chấm xuất huyết dưới da bầm tím chảy máu chân răng',
    slug = 'xuat-huyet-giam-tieu-cau-mien-dich-itp-dau-hieu-cham-xuat-huyet-duoi-da-bam-tim-chay-mau-chan-rang',
    summary = 'Bài viết chuyên sâu về xuất huyết giảm tiểu cầu miễn dịch itp: dấu hiệu chấm xuất huyết dưới da bầm tím chảy máu chân răng được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '0d804ca1-efe7-acbd-a155-30c1bfe4d4a6';

UPDATE articles
SET title = 'Đông máu rải rác trong lòng mạch DIC: Biến chứng rối loạn đông máu phức tạp trong cấp cứu hồi sức',
    slug = 'dong-mau-rai-rac-trong-long-mach-dic-bien-chung-roi-loan-dong-mau-phuc-tap-trong-cap-cuu-hoi-suc',
    summary = 'Bài viết chuyên sâu về đông máu rải rác trong lòng mạch dic: biến chứng rối loạn đông máu phức tạp trong cấp cứu hồi sức được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '117edff6-5c9e-a1fa-2c3f-7db598f6b7f6';

UPDATE articles
SET title = 'Huyết khối tĩnh mạch sâu chi dưới DVT: Dấu hiệu sưng nóng đỏ một bên bắp chân và thuốc chống đông',
    slug = 'huyet-khoi-tinh-mach-sau-chi-duoi-dvt-dau-hieu-sung-nong-do-mot-ben-bap-chan-va-thuoc-chong-dong',
    summary = 'Bài viết chuyên sâu về huyết khối tĩnh mạch sâu chi dưới dvt: dấu hiệu sưng nóng đỏ một bên bắp chân và thuốc chống đông được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '1514e08d-8150-a3fb-bf44-5bbe4f4da351';

UPDATE articles
SET title = 'Thuyên tắc phổi PE do huyết khối di chuyển: Cơn khó thở đột ngột đau ngực trụy mạch cấp cứu',
    slug = 'thuyen-tac-phoi-pe-do-huyet-khoi-di-chuyen-con-kho-tho-dot-ngot-dau-nguc-truy-mach-cap-cuu',
    summary = 'Bài viết chuyên sâu về thuyên tắc phổi pe do huyết khối di chuyển: cơn khó thở đột ngột đau ngực trụy mạch cấp cứu được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '21300ca9-7c5f-e6f1-9389-44aeae191e53';

UPDATE articles
SET title = 'Bệnh bạch cầu cấp Ung thư máu Leukemia: Nhận biết dấu hiệu sốt kéo dài thiếu máu bầm tím diện rộng',
    slug = 'benh-bach-cau-cap-ung-thu-mau-leukemia-nhan-biet-dau-hieu-sot-keo-dai-thieu-mau-bam-tim-dien-rong',
    summary = 'Bài viết chuyên sâu về bệnh bạch cầu cấp ung thư máu leukemia: nhận biết dấu hiệu sốt kéo dài thiếu máu bầm tím diện rộng được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '27c3dc55-d5cb-8a94-3656-9e9bef0919d5';

UPDATE articles
SET title = 'Đa u tủy xương Multiple Myeloma: Dấu hiệu đau xương sống mạn tính suy thận và điện di protein máu',
    slug = 'da-u-tuy-xuong-multiple-myeloma-dau-hieu-dau-xuong-song-man-tinh-suy-than-va-dien-di-protein-mau',
    summary = 'Bài viết chuyên sâu về đa u tủy xương multiple myeloma: dấu hiệu đau xương sống mạn tính suy thận và điện di protein máu được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '385135e0-a643-525b-dc9f-52f278f19ae0';

UPDATE articles
SET title = 'Hemophilia bệnh máu khó đông: Di truyền liên kết giới tính và truyền yếu tố VIII yếu tố IX định kỳ',
    slug = 'hemophilia-benh-mau-kho-dong-di-truyen-lien-ket-gioi-tinh-va-truyen-yeu-to-viii-yeu-to-ix-dinh-ky',
    summary = 'Bài viết chuyên sâu về hemophilia bệnh máu khó đông: di truyền liên kết giới tính và truyền yếu tố viii yếu tố ix định kỳ được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '3beb604c-0e68-6108-9b84-2cb15626302b';

UPDATE articles
SET title = 'Bệnh đa hồng cầu Polycythemia Vera: Dấu hiệu đỏ bừng mặt đau đầu ngứa sau tắm nước ấm',
    slug = 'benh-da-hong-cau-polycythemia-vera-dau-hieu-do-bung-mat-dau-dau-ngua-sau-tam-nuoc-am',
    summary = 'Bài viết chuyên sâu về bệnh đa hồng cầu polycythemia vera: dấu hiệu đỏ bừng mặt đau đầu ngứa sau tắm nước ấm được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '4b32a531-dae9-093c-5e71-b4760da6f585';

UPDATE articles
SET title = 'Xét nghiệm tổng phân tích tế bào máu ngoại vi CBC: Ý nghĩa các chỉ số hồng cầu bạch cầu tiểu cầu',
    slug = 'xet-nghiem-tong-phan-tich-te-bao-mau-ngoai-vi-cbc-y-nghia-cac-chi-so-hong-cau-bach-cau-tieu-cau',
    summary = 'Bài viết chuyên sâu về xét nghiệm tổng phân tích tế bào máu ngoại vi cbc: ý nghĩa các chỉ số hồng cầu bạch cầu tiểu cầu được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '5b6641db-de31-8d59-c1b6-e73b4b118bee';

UPDATE articles
SET title = 'Xét nghiệm đông máu cơ bản PT APTT Fibrinogen: Đánh giá nguy cơ chảy máu trước phẫu thuật',
    slug = 'xet-nghiem-dong-mau-co-ban-pt-aptt-fibrinogen-danh-gia-nguy-co-chay-mau-truoc-phau-thuat',
    summary = 'Bài viết chuyên sâu về xét nghiệm đông máu cơ bản pt aptt fibrinogen: đánh giá nguy cơ chảy máu trước phẫu thuật được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '5bc1f950-1c9b-3cc1-c4f4-e99d0080d745';

UPDATE articles
SET title = 'Truyền máu an toàn lâm sàng: Quy tắc hòa hợp nhóm máu ABO Rh và theo dõi phản ứng truyền máu',
    slug = 'truyen-mau-an-toan-lam-sang-quy-tac-hoa-hop-nhom-mau-abo-rh-va-theo-doi-phan-ung-truyen-mau',
    summary = 'Bài viết chuyên sâu về truyền máu an toàn lâm sàng: quy tắc hòa hợp nhóm máu abo rh và theo dõi phản ứng truyền máu được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '625588ec-519d-dda0-0050-c58e92ebf90c';

UPDATE articles
SET title = 'Suy tủy xương: Tình trạng giảm 3 dòng tế bào máu và chỉ định ghép tế bào gốc tạo máu',
    slug = 'suy-tuy-xuong-tinh-trang-giam-3-dong-te-bao-mau-va-chi-dinh-ghep-te-bao-goc-tao-mau',
    summary = 'Bài viết chuyên sâu về suy tủy xương: tình trạng giảm 3 dòng tế bào máu và chỉ định ghép tế bào gốc tạo máu được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = '8e312321-6c4d-a200-d992-d9038f27d785';

UPDATE articles
SET title = 'Hội chứng tăng bạch cầu ái toan: Nguyên nhân nhiễm ký sinh trùng giun sán hoặc bệnh lý dị ứng',
    slug = 'hoi-chung-tang-bach-cau-ai-toan-nguyen-nhan-nhiem-ky-sinh-trung-giun-san-hoac-benh-ly-di-ung',
    summary = 'Bài viết chuyên sâu về hội chứng tăng bạch cầu ái toan: nguyên nhân nhiễm ký sinh trùng giun sán hoặc bệnh lý dị ứng được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = 'c015c1c6-df1c-a293-bc18-2afdd79aa45a';

UPDATE articles
SET title = 'Hạch to bất thường ở cổ nách bẹn: Khi nào cần sinh thiết hạch chẩn đoán U lympho',
    slug = 'hach-to-bat-thuong-o-co-nach-ben-khi-nao-can-sinh-thiet-hach-chan-doan-u-lympho',
    summary = 'Bài viết chuyên sâu về hạch to bất thường ở cổ nách bẹn: khi nào cần sinh thiết hạch chẩn đoán u lympho được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = 'c1bd379a-b1d9-5542-1aa7-c764f92ae274';

UPDATE articles
SET title = 'Theo dõi bệnh nhân sử dụng thuốc kháng vitamin K Sintrom Warfarin: Chỉ định xét nghiệm INR mục tiêu',
    slug = 'theo-doi-benh-nhan-su-dung-thuoc-khang-vitamin-k-sintrom-warfarin-chi-dinh-xet-nghiem-inr-muc-tieu',
    summary = 'Bài viết chuyên sâu về theo dõi bệnh nhân sử dụng thuốc kháng vitamin k sintrom warfarin: chỉ định xét nghiệm inr mục tiêu được tham vấn y khoa bởi các chuyên gia Huyết học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Huyết học'
WHERE id = 'c80bcba7-c4bc-d5fd-6a7d-63683d9adff6';

UPDATE articles
SET title = 'Xử trí sốt cao co giật ở trẻ nhỏ: Các bước sơ cứu tại nhà chuẩn y khoa tránh biến chứng',
    slug = 'xu-tri-sot-cao-co-giat-o-tre-nho-cac-buoc-so-cuu-tai-nha-chuan-y-khoa-tranh-bien-chung',
    summary = 'Bài viết chuyên sâu về xử trí sốt cao co giật ở trẻ nhỏ: các bước sơ cứu tại nhà chuẩn y khoa tránh biến chứng được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '056bb28e-cd93-64d2-f78d-eb6fdae65119';

UPDATE articles
SET title = 'Viêm tiểu phế quản ở trẻ nhũ nhi: Dấu hiệu thở nhanh rút lõm ngực cần đưa đi khám ngay',
    slug = 'viem-tieu-phe-quan-o-tre-nhu-nhi-dau-hieu-tho-nhanh-rut-lom-nguc-can-dua-di-kham-ngay',
    summary = 'Bài viết chuyên sâu về viêm tiểu phế quản ở trẻ nhũ nhi: dấu hiệu thở nhanh rút lõm ngực cần đưa đi khám ngay được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '0f201575-3a1a-8901-01de-991508d64568';

UPDATE articles
SET title = 'Tiêu chảy cấp mất nước ở trẻ em: Hướng dẫn bù nước bằng dung dịch Oresol đúng nồng độ',
    slug = 'tieu-chay-cap-mat-nuoc-o-tre-em-huong-dan-bu-nuoc-bang-dung-dich-oresol-dung-nong-do',
    summary = 'Bài viết chuyên sâu về tiêu chảy cấp mất nước ở trẻ em: hướng dẫn bù nước bằng dung dịch oresol đúng nồng độ được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '113d7869-2125-4f61-87f5-978d089e213a';

UPDATE articles
SET title = 'Trẻ biếng ăn chậm tăng cân: Đánh giá thiếu hụt vi chất kẽm sắt và tháp dinh dưỡng chuẩn',
    slug = 'tre-bieng-an-cham-tang-can-danh-gia-thieu-hut-vi-chat-kem-sat-va-thap-dinh-duong-chuan',
    summary = 'Bài viết chuyên sâu về trẻ biếng ăn chậm tăng cân: đánh giá thiếu hụt vi chất kẽm sắt và tháp dinh dưỡng chuẩn được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '13afa0f0-e039-1ca9-831a-54a8f4fa231f';

UPDATE articles
SET title = 'Hen phế quản ở trẻ em: Hướng dẫn sử dụng bình xịt định liều MDI và buồng đệm',
    slug = 'hen-phe-quan-o-tre-em-huong-dan-su-dung-binh-xit-dinh-lieu-mdi-va-buong-dem',
    summary = 'Bài viết chuyên sâu về hen phế quản ở trẻ em: hướng dẫn sử dụng bình xịt định liều mdi và buồng đệm được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '3319bfdc-f6c0-67eb-22a2-34c3de5f662a';

UPDATE articles
SET title = 'Bệnh tay chân miệng: Phân độ lâm sàng, dấu hiệu giật mình chới với cảnh báo biến chứng não',
    slug = 'benh-tay-chan-mieng-phan-do-lam-sang-dau-hieu-giat-minh-choi-voi-canh-bao-bien-chung-nao',
    summary = 'Bài viết chuyên sâu về bệnh tay chân miệng: phân độ lâm sàng, dấu hiệu giật mình chới với cảnh báo biến chứng não được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '4c369ab7-d94f-6594-f7e5-cfbc02721bc2';

UPDATE articles
SET title = 'Sốt xuất huyết Dengue ở trẻ nhỏ: Theo dõi sát giai đoạn nguy hiểm ngày thứ 4 đến ngày thứ 7',
    slug = 'sot-xuat-huyet-dengue-o-tre-nho-theo-doi-sat-giai-doan-nguy-hiem-ngay-thu-4-den-ngay-thu-7',
    summary = 'Bài viết chuyên sâu về sốt xuất huyết dengue ở trẻ nhỏ: theo dõi sát giai đoạn nguy hiểm ngày thứ 4 đến ngày thứ 7 được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '52eda853-b325-f9ea-b8f2-a209c6e3c9c9';

UPDATE articles
SET title = 'Nhiễm khuẩn đường hô hấp trên tái diễn ở trẻ mầm non: Giải pháp tăng cường miễn dịch tự nhiên',
    slug = 'nhiem-khuan-duong-ho-hap-tren-tai-dien-o-tre-mam-non-giai-phap-tang-cuong-mien-dich-tu-nhien',
    summary = 'Bài viết chuyên sâu về nhiễm khuẩn đường hô hấp trên tái diễn ở trẻ mầm non: giải pháp tăng cường miễn dịch tự nhiên được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '55d8ea38-ceba-8652-c26c-68897d90a394';

UPDATE articles
SET title = 'Dị ứng đạm sữa bò ở trẻ sơ sinh: Dấu hiệu đi ngoài phân nhầy máu và đổi sữa thủy phân toàn phần',
    slug = 'di-ung-dam-sua-bo-o-tre-so-sinh-dau-hieu-di-ngoai-phan-nhay-mau-va-doi-sua-thuy-phan-toan-phan',
    summary = 'Bài viết chuyên sâu về dị ứng đạm sữa bò ở trẻ sơ sinh: dấu hiệu đi ngoài phân nhầy máu và đổi sữa thủy phân toàn phần được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '5ec0b912-b6a6-5147-9e5a-52b60fa9fecb';

UPDATE articles
SET title = 'Vàng da sơ sinh: Phân biệt vàng da sinh lý với vàng da bệnh lý và chỉ định chiếu đèn',
    slug = 'vang-da-so-sinh-phan-biet-vang-da-sinh-ly-voi-vang-da-benh-ly-va-chi-dinh-chieu-den',
    summary = 'Bài viết chuyên sâu về vàng da sơ sinh: phân biệt vàng da sinh lý với vàng da bệnh lý và chỉ định chiếu đèn được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '60a891f2-8423-4199-ecad-6fd309b23b8a';

UPDATE articles
SET title = 'Còi xương do thiếu vitamin D: Dấu hiệu rụng tóc vành khăn, thóp rộng và liều bổ sung chuẩn',
    slug = 'coi-xuong-do-thieu-vitamin-d-dau-hieu-rung-toc-vanh-khan-thop-rong-va-lieu-bo-sung-chuan',
    summary = 'Bài viết chuyên sâu về còi xương do thiếu vitamin d: dấu hiệu rụng tóc vành khăn, thóp rộng và liều bổ sung chuẩn được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '743b87c7-8155-f696-72a1-5376e7f031ea';

UPDATE articles
SET title = 'Viêm tai giữa cấp ở trẻ nhỏ: Nhận diện dấu hiệu quấy khóc kéo tai sau đợt viêm mũi họng',
    slug = 'viem-tai-giua-cap-o-tre-nho-nhan-dien-dau-hieu-quay-khoc-keo-tai-sau-dot-viem-mui-hong',
    summary = 'Bài viết chuyên sâu về viêm tai giữa cấp ở trẻ nhỏ: nhận diện dấu hiệu quấy khóc kéo tai sau đợt viêm mũi họng được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '88d5c464-fb85-44eb-a6e4-b0971ff432d8';

UPDATE articles
SET title = 'Trào ngược dạ dày sơ sinh nôn trớ: Tư thế bú đúng cách và biện pháp vỗ ợ hơi cho trẻ',
    slug = 'trao-nguoc-da-day-so-sinh-non-tro-tu-the-bu-dung-cach-va-bien-phap-vo-o-hoi-cho-tre',
    summary = 'Bài viết chuyên sâu về trào ngược dạ dày sơ sinh nôn trớ: tư thế bú đúng cách và biện pháp vỗ ợ hơi cho trẻ được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = '927f723b-1165-6d27-a359-3150678f3e5d';

UPDATE articles
SET title = 'Bệnh sởi và thủy đậu: Lịch tiêm phòng vắc xin đúng lịch và hướng dẫn cách ly chăm sóc da',
    slug = 'benh-soi-va-thuy-dau-lich-tiem-phong-vac-xin-dung-lich-va-huong-dan-cach-ly-cham-soc-da',
    summary = 'Bài viết chuyên sâu về bệnh sởi và thủy đậu: lịch tiêm phòng vắc xin đúng lịch và hướng dẫn cách ly chăm sóc da được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = 'aa099257-ec79-4569-4fd3-3767cde091b1';

UPDATE articles
SET title = 'Táo bón chức năng ở trẻ em: Biện pháp làm mềm phân và tập phản xạ ngồi bô hàng ngày',
    slug = 'tao-bon-chuc-nang-o-tre-em-bien-phap-lam-mem-phan-va-tap-phan-xa-ngoi-bo-hang-ngay',
    summary = 'Bài viết chuyên sâu về táo bón chức năng ở trẻ em: biện pháp làm mềm phân và tập phản xạ ngồi bô hàng ngày được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = 'edf7e684-2f64-7496-3f75-43e4dd62abcd';

UPDATE articles
SET title = 'Chăm sóc rốn trẻ sơ sinh: Dấu hiệu rốn rỉ dịch mủ mùi hôi cần thăm khám chuyên khoa',
    slug = 'cham-soc-ron-tre-so-sinh-dau-hieu-ron-ri-dich-mu-mui-hoi-can-tham-kham-chuyen-khoa',
    summary = 'Bài viết chuyên sâu về chăm sóc rốn trẻ sơ sinh: dấu hiệu rốn rỉ dịch mủ mùi hôi cần thăm khám chuyên khoa được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = 'efc8d9b8-c767-bed6-3fa9-c1b65e3bdc27';

UPDATE articles
SET title = 'Thừa cân béo phì ở học đường: Điều chỉnh khẩu phần ăn giảm ngọt và khuyến khích thể thao',
    slug = 'thua-can-beo-phi-o-hoc-duong-dieu-chinh-khau-phan-an-giam-ngot-va-khuyen-khich-the-thao',
    summary = 'Bài viết chuyên sâu về thừa cân béo phì ở học đường: điều chỉnh khẩu phần ăn giảm ngọt và khuyến khích thể thao được tham vấn y khoa bởi các chuyên gia Nhi khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tre-bieng-an.jpg',
    category = 'Nhi khoa'
WHERE id = 'f8ad9a10-2964-ee78-0665-2305caaa5044';

UPDATE articles
SET title = 'Tiêm chủng mở rộng phòng bệnh truyền nhiễm: Lịch tiêm các loại vắc xin thiết yếu cho trẻ nhỏ',
    slug = 'tiem-chung-mo-rong-phong-benh-truyen-nhiem-lich-tiem-cac-loai-vac-xin-thiet-yeu-cho-tre-nho',
    summary = 'Bài viết chuyên sâu về tiêm chủng mở rộng phòng bệnh truyền nhiễm: lịch tiêm các loại vắc xin thiết yếu cho trẻ nhỏ được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '06d4739d-fd6c-5dc3-b857-35fa5c6ff2e5';

UPDATE articles
SET title = 'Phòng chống dịch sốt xuất huyết Dengue tại cộng đồng: Diệt lăng quăng bọ gậy và phòng muỗi đốt',
    slug = 'phong-chong-dich-sot-xuat-huyet-dengue-tai-cong-dong-diet-lang-quang-bo-gay-va-phong-muoi-dot',
    summary = 'Bài viết chuyên sâu về phòng chống dịch sốt xuất huyết dengue tại cộng đồng: diệt lăng quăng bọ gậy và phòng muỗi đốt được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '0fce4200-ead5-4b2c-aacd-2a3774fa0d8d';

UPDATE articles
SET title = 'An toàn vệ sinh thực phẩm: Quy tắc 5 chìa khóa vàng phòng ngừa ngộ độc thực phẩm tập thể',
    slug = 'an-toan-ve-sinh-thuc-pham-quy-tac-5-chia-khoa-vang-phong-ngua-ngo-doc-thuc-pham-tap-the',
    summary = 'Bài viết chuyên sâu về an toàn vệ sinh thực phẩm: quy tắc 5 chìa khóa vàng phòng ngừa ngộ độc thực phẩm tập thể được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '3b0683b0-86c0-32af-52c4-bbb012a2a470';

UPDATE articles
SET title = 'Kiểm soát ô nhiễm không khí bụi mịn PM2.5: Tác động hô hấp tim mạch và các biện pháp bảo vệ cá nhân',
    slug = 'kiem-soat-o-nhiem-khong-khi-bui-min-pm25-tac-dong-ho-hap-tim-mach-va-cac-bien-phap-bao-ve-ca-nhan',
    summary = 'Bài viết chuyên sâu về kiểm soát ô nhiễm không khí bụi mịn pm2.5: tác động hô hấp tim mạch và các biện pháp bảo vệ cá nhân được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '45b5e0a2-717d-13f1-e8dd-f0db0ac16bd3';

UPDATE articles
SET title = 'Nguồn nước sạch và vệ sinh môi trường: Phòng chống các bệnh tiêu chảy tả lỵ ký sinh trùng đường ruột',
    slug = 'nguon-nuoc-sach-va-ve-sinh-moi-truong-phong-chong-cac-benh-tieu-chay-ta-ly-ky-sinh-trung-duong-ruot',
    summary = 'Bài viết chuyên sâu về nguồn nước sạch và vệ sinh môi trường: phòng chống các bệnh tiêu chảy tả lỵ ký sinh trùng đường ruột được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '46f566db-94c2-f4af-51e6-11dac4602efe';

UPDATE articles
SET title = 'Phòng chống tác hại của thuốc lá và thuốc lá điện tử: Bảo vệ thanh thiếu niên khỏi nghiện chất',
    slug = 'phong-chong-tac-hai-cua-thuoc-la-va-thuoc-la-dien-tu-bao-ve-thanh-thieu-nien-khoi-nghien-chat',
    summary = 'Bài viết chuyên sâu về phòng chống tác hại của thuốc lá và thuốc lá điện tử: bảo vệ thanh thiếu niên khỏi nghiện chất được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '6e98a1a6-8ef1-b06e-102e-9fb6029cf511';

UPDATE articles
SET title = 'Tầm soát phát hiện sớm tăng huyết áp và đái tháo đường tại y tế cơ sở: Quản lý bệnh không lây nhiễm',
    slug = 'tam-soat-phat-hien-som-tang-huyet-ap-va-dai-thao-duong-tai-y-te-co-so-quan-ly-benh-khong-lay-nhiem',
    summary = 'Bài viết chuyên sâu về tầm soát phát hiện sớm tăng huyết áp và đái tháo đường tại y tế cơ sở: quản lý bệnh không lây nhiễm được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '70d39705-14a1-58b9-99ce-9a07d15f90b5';

UPDATE articles
SET title = 'Dinh dưỡng học đường: Xây dựng bữa ăn cân đối hạn chế nước ngọt có ga phòng chống béo phì',
    slug = 'dinh-duong-hoc-duong-xay-dung-bua-an-can-doi-han-che-nuoc-ngot-co-ga-phong-chong-beo-phi',
    summary = 'Bài viết chuyên sâu về dinh dưỡng học đường: xây dựng bữa ăn cân đối hạn chế nước ngọt có ga phòng chống béo phì được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '71c5b19b-7808-0cb9-76ff-8b42ea2f4f4a';

UPDATE articles
SET title = 'Sức khỏe tâm thần trong cộng đồng: Xóa bỏ định kiến hỗ trợ người trầm cảm lo âu tiếp cận y tế',
    slug = 'suc-khoe-tam-than-trong-cong-dong-xoa-bo-dinh-kien-ho-tro-nguoi-tram-cam-lo-au-tiep-can-y-te',
    summary = 'Bài viết chuyên sâu về sức khỏe tâm thần trong cộng đồng: xóa bỏ định kiến hỗ trợ người trầm cảm lo âu tiếp cận y tế được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '73873724-db17-74d6-32a7-a9163c6129cb';

UPDATE articles
SET title = 'Phòng chống các bệnh lây truyền qua đường tình dục HIV AIDS: Tuyên truyền tình dục an toàn bao cao su',
    slug = 'phong-chong-cac-benh-lay-truyen-qua-duong-tinh-duc-hiv-aids-tuyen-truyen-tinh-duc-an-toan-bao-cao-su',
    summary = 'Bài viết chuyên sâu về phòng chống các bệnh lây truyền qua đường tình dục hiv aids: tuyên truyền tình dục an toàn bao cao su được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = '89471272-c6fc-68c2-b471-d6a095237349';

UPDATE articles
SET title = 'Vệ sinh lao động và phòng chống bệnh nghề nghiệp: Khám sức khỏe định kỳ cho công nhân nhà máy',
    slug = 've-sinh-lao-dong-va-phong-chong-benh-nghe-nghiep-kham-suc-khoe-dinh-ky-cho-cong-nhan-nha-may',
    summary = 'Bài viết chuyên sâu về vệ sinh lao động và phòng chống bệnh nghề nghiệp: khám sức khỏe định kỳ cho công nhân nhà máy được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = 'aae9040e-77d4-880b-6124-5d41c38f89dd';

UPDATE articles
SET title = 'Chăm sóc sức khỏe người cao tuổi tại cộng đồng: Phòng chống té ngã suy dinh dưỡng và cô đơn',
    slug = 'cham-soc-suc-khoe-nguoi-cao-tuoi-tai-cong-dong-phong-chong-te-nga-suy-dinh-duong-va-co-don',
    summary = 'Bài viết chuyên sâu về chăm sóc sức khỏe người cao tuổi tại cộng đồng: phòng chống té ngã suy dinh dưỡng và cô đơn được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = 'ca244af2-6c19-fe1a-047c-748d1cef33f7';

UPDATE articles
SET title = 'Ứng phó y tế công cộng với các đợt bùng phát dịch bệnh truyền nhiễm mới nổi: Giám sát dịch tễ học',
    slug = 'ung-pho-y-te-cong-cong-voi-cac-dot-bung-phat-dich-benh-truyen-nhiem-moi-noi-giam-sat-dich-te-hoc',
    summary = 'Bài viết chuyên sâu về ứng phó y tế công cộng với các đợt bùng phát dịch bệnh truyền nhiễm mới nổi: giám sát dịch tễ học được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = 'cf63598c-9cb1-6cfa-c5ae-3c70940f7166';

UPDATE articles
SET title = 'Kháng thuốc kháng sinh nguy cơ toàn cầu: Sử dụng kháng sinh có trách nhiệm theo đúng chỉ định',
    slug = 'khang-thuoc-khang-sinh-nguy-co-toan-cau-su-dung-khang-sinh-co-trach-nhiem-theo-dung-chi-dinh',
    summary = 'Bài viết chuyên sâu về kháng thuốc kháng sinh nguy cơ toàn cầu: sử dụng kháng sinh có trách nhiệm theo đúng chỉ định được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = 'e92b967b-d855-56d2-06cd-0da6466c15cb';

UPDATE articles
SET title = 'Hoạt động thể lực trong nhịp sống đô thị: Khuyến nghị 150 phút vận động vừa phải mỗi tuần của WHO',
    slug = 'hoat-dong-the-luc-trong-nhip-song-do-thi-khuyen-nghi-150-phut-van-dong-vua-phai-moi-tuan-cua-who',
    summary = 'Bài viết chuyên sâu về hoạt động thể lực trong nhịp sống đô thị: khuyến nghị 150 phút vận động vừa phải mỗi tuần của who được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = 'f6226538-4c43-c2bd-4651-574cd20611d9';

UPDATE articles
SET title = 'Bảo vệ sức khỏe cộng đồng trước biến đổi khí hậu: Phòng chống sóng nhiệt nắng nóng cực đoan',
    slug = 'bao-ve-suc-khoe-cong-dong-truoc-bien-doi-khi-hau-phong-chong-song-nhiet-nang-nong-cuc-doan',
    summary = 'Bài viết chuyên sâu về bảo vệ sức khỏe cộng đồng trước biến đổi khí hậu: phòng chống sóng nhiệt nắng nóng cực đoan được tham vấn y khoa bởi các chuyên gia Y tế công cộng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y tế công cộng'
WHERE id = 'faa799a6-e792-2baf-833c-6d657c3f82d3';

UPDATE articles
SET title = 'Kiểm soát tăng huyết áp vô căn và dự phòng biến cố mạch vành cấp',
    slug = 'kiem-soat-tang-huyet-ap-vo-can-va-du-phong-bien-co-mach-vanh-cap',
    summary = 'Bài viết chuyên sâu về kiểm soát tăng huyết áp vô căn và dự phòng biến cố mạch vành cấp được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = '06f7be80-f489-231f-7611-927d5cd1f5cc';

UPDATE articles
SET title = 'Dấu hiệu cảnh báo sớm cơn nhồi máu cơ tim: Quy tắc cấp cứu 115',
    slug = 'dau-hieu-canh-bao-som-con-nhoi-mau-co-tim-quy-tac-cap-cuu-115',
    summary = 'Bài viết chuyên sâu về dấu hiệu cảnh báo sớm cơn nhồi máu cơ tim: quy tắc cấp cứu 115 được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = '13c67a20-a914-afe7-9bbd-a76a12d7afa5';

UPDATE articles
SET title = 'Suy tim mạn tính: Phác đồ điều trị nội khoa và theo dõi cân nặng hàng ngày',
    slug = 'suy-tim-man-tinh-phac-do-dieu-tri-noi-khoa-va-theo-doi-can-nang-hang-ngay',
    summary = 'Bài viết chuyên sâu về suy tim mạn tính: phác đồ điều trị nội khoa và theo dõi cân nặng hàng ngày được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = '33f3f8f5-60ae-e4a0-0910-61fa96efb4e8';

UPDATE articles
SET title = 'Rung nhĩ và rối loạn nhịp tim: Nguy cơ hình thành huyết khối và triệt đốt sóng cao tần',
    slug = 'rung-nhi-va-roi-loan-nhip-tim-nguy-co-hinh-thanh-huyet-khoi-va-triet-dot-song-cao-tan',
    summary = 'Bài viết chuyên sâu về rung nhĩ và rối loạn nhịp tim: nguy cơ hình thành huyết khối và triệt đốt sóng cao tần được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = '360f4c80-038c-2a5d-fa65-cb6a59fa04b9';

UPDATE articles
SET title = 'Bệnh động mạch vành: Đánh giá mảng xơ vữa qua chụp cắt lớp vi tính MSCT',
    slug = 'benh-dong-mach-vanh-danh-gia-mang-xo-vua-qua-chup-cat-lop-vi-tinh-msct',
    summary = 'Bài viết chuyên sâu về bệnh động mạch vành: đánh giá mảng xơ vữa qua chụp cắt lớp vi tính msct được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = '365c12bd-4974-7b7f-dc24-b70dfad671e2';

UPDATE articles
SET title = 'Hở van hai lá và hẹp van động mạch chủ: Chỉ định phẫu thuật và can thiệp qua da',
    slug = 'ho-van-hai-la-va-hep-van-dong-mach-chu-chi-dinh-phau-thuat-va-can-thiep-qua-da',
    summary = 'Bài viết chuyên sâu về hở van hai lá và hẹp van động mạch chủ: chỉ định phẫu thuật và can thiệp qua da được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = '4ef17c2f-ca8d-a75c-1c74-4716603dc37b';

UPDATE articles
SET title = 'Rối loạn lipid máu: Kiểm soát chỉ số LDL-Cholesterol mục tiêu theo nguy cơ tim mạch',
    slug = 'roi-loan-lipid-mau-kiem-soat-chi-so-ldl-cholesterol-muc-tieu-theo-nguy-co-tim-mach',
    summary = 'Bài viết chuyên sâu về rối loạn lipid máu: kiểm soát chỉ số ldl-cholesterol mục tiêu theo nguy cơ tim mạch được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = '6321fea1-6b91-32ee-00d7-751add9a183b';

UPDATE articles
SET title = 'Cơn đau thắt ngực không ổn định: Phân biệt đau ngực tim mạch với trào ngược thực quản',
    slug = 'con-dau-that-nguc-khong-on-dinh-phan-biet-dau-nguc-tim-mach-voi-trao-nguoc-thuc-quan',
    summary = 'Bài viết chuyên sâu về cơn đau thắt ngực không ổn định: phân biệt đau ngực tim mạch với trào ngược thực quản được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = '884eede4-e89e-8d50-00a8-a9e7e007b40b';

UPDATE articles
SET title = 'Viêm cơ tim cấp sau nhiễm siêu vi: Dấu hiệu mệt lả, loạn nhịp và cách xử trí',
    slug = 'viem-co-tim-cap-sau-nhiem-sieu-vi-dau-hieu-met-la-loan-nhip-va-cach-xu-tri',
    summary = 'Bài viết chuyên sâu về viêm cơ tim cấp sau nhiễm siêu vi: dấu hiệu mệt lả, loạn nhịp và cách xử trí được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'a3340c6b-bd0f-c3e4-d2a9-950a191a62f5';

UPDATE articles
SET title = 'Tăng huyết áp kháng trị: Nguyên nhân thứ phát và chiến lược phối hợp thuốc',
    slug = 'tang-huyet-ap-khang-tri-nguyen-nhan-thu-phat-va-chien-luoc-phoi-hop-thuoc',
    summary = 'Bài viết chuyên sâu về tăng huyết áp kháng trị: nguyên nhân thứ phát và chiến lược phối hợp thuốc được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'b39e0fe8-d148-ca97-e59b-7bafeaf59006';

UPDATE articles
SET title = 'Phình động mạch chủ bụng: Tầm soát siêu âm mạch máu và can thiệp đặt Stent Graft',
    slug = 'phinh-dong-mach-chu-bung-tam-soat-sieu-am-mach-mau-va-can-thiep-dat-stent-graft',
    summary = 'Bài viết chuyên sâu về phình động mạch chủ bụng: tầm soát siêu âm mạch máu và can thiệp đặt stent graft được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'c884e495-c631-3181-1eb1-9cbd50359fd1';

UPDATE articles
SET title = 'Hạ huyết áp tư thế đứng: Nhận biết cơn choáng váng và biện pháp phòng ngừa té ngã',
    slug = 'ha-huyet-ap-tu-the-dung-nhan-biet-con-choang-vang-va-bien-phap-phong-ngua-te-nga',
    summary = 'Bài viết chuyên sâu về hạ huyết áp tư thế đứng: nhận biết cơn choáng váng và biện pháp phòng ngừa té ngã được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'd4b4b042-894a-18f5-a20d-355c5c5625ce';

UPDATE articles
SET title = 'Bệnh cơ tim phì đại: Tầm soát đột tử tim mạch ở thanh thiếu niên và vận động viên',
    slug = 'benh-co-tim-phi-dai-tam-soat-dot-tu-tim-mach-o-thanh-thieu-nien-va-van-dong-vien',
    summary = 'Bài viết chuyên sâu về bệnh cơ tim phì đại: tầm soát đột tử tim mạch ở thanh thiếu niên và vận động viên được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'de031c94-49c5-f673-8a21-4b1b4dd14b61';

UPDATE articles
SET title = 'Theo dõi huyết áp lưu động 24h Holter: Tiêu chuẩn chẩn đoán tăng huyết áp ẩn giấu',
    slug = 'theo-doi-huyet-ap-luu-dong-24h-holter-tieu-chuan-chan-doan-tang-huyet-ap-an-giau',
    summary = 'Bài viết chuyên sâu về theo dõi huyết áp lưu động 24h holter: tiêu chuẩn chẩn đoán tăng huyết áp ẩn giấu được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'de1f48e1-57d9-159f-8760-12c7cc1d760d';

UPDATE articles
SET title = 'Nghiệm pháp gắng sức thảm lăn: Đánh giá thiếu máu cơ tim thiếu máu cục bộ',
    slug = 'nghiem-phap-gang-suc-tham-lan-danh-gia-thieu-mau-co-tim-thieu-mau-cuc-bo',
    summary = 'Bài viết chuyên sâu về nghiệm pháp gắng sức thảm lăn: đánh giá thiếu máu cơ tim thiếu máu cục bộ được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'f13f85f7-d4ea-0fc1-cdaf-df5bee2e347d';

UPDATE articles
SET title = 'Chế độ ăn DASH giảm muối: Lợi ích kiểm soát huyết áp và bảo vệ thành mạch',
    slug = 'che-do-an-dash-giam-muoi-loi-ich-kiem-soat-huyet-ap-va-bao-ve-thanh-mach',
    summary = 'Bài viết chuyên sâu về chế độ ăn dash giảm muối: lợi ích kiểm soát huyết áp và bảo vệ thành mạch được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'f62c5d6a-1303-2d6f-d0f3-d7ff9f16f196';

UPDATE articles
SET title = 'Phục hồi chức năng tim mạch sau đặt stent mạch vành: Hướng dẫn tập luyện an toàn',
    slug = 'phuc-hoi-chuc-nang-tim-mach-sau-dat-stent-mach-vanh-huong-dan-tap-luyen-an-toan',
    summary = 'Bài viết chuyên sâu về phục hồi chức năng tim mạch sau đặt stent mạch vành: hướng dẫn tập luyện an toàn được tham vấn y khoa bởi các chuyên gia Tim mạch Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Tim mạch'
WHERE id = 'faa3bb7a-717f-a787-de2a-0ff57e6088b2';

UPDATE articles
SET title = 'Viêm xoang mũi mạn tính: Khi nào nên chỉ định phẫu thuật nội soi mũi xoang FESS',
    slug = 'viem-xoang-mui-man-tinh-khi-nao-nen-chi-dinh-phau-thuat-noi-soi-mui-xoang-fess',
    summary = 'Bài viết chuyên sâu về viêm xoang mũi mạn tính: khi nào nên chỉ định phẫu thuật nội soi mũi xoang fess được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '074e166c-b9bc-2e30-a27c-26a5ede59c7e';

UPDATE articles
SET title = 'Viêm amidan hốc mủ mạn tính: Chỉ định cắt amidan bằng công nghệ Plasma nhiệt độ thấp',
    slug = 'viem-amidan-hoc-mu-man-tinh-chi-dinh-cat-amidan-bang-cong-nghe-plasma-nhiet-do-thap',
    summary = 'Bài viết chuyên sâu về viêm amidan hốc mủ mạn tính: chỉ định cắt amidan bằng công nghệ plasma nhiệt độ thấp được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '2de0a1a3-1f9d-2d25-3e0b-c227494122f3';

UPDATE articles
SET title = 'Nạo VA quá phát ở trẻ nhỏ: Giải quyết tình trạng nghẹt mũi ngủ ngáy thở bằng miệng',
    slug = 'nao-va-qua-phat-o-tre-nho-giai-quyet-tinh-trang-nghet-mui-ngu-ngay-tho-bang-mieng',
    summary = 'Bài viết chuyên sâu về nạo va quá phát ở trẻ nhỏ: giải quyết tình trạng nghẹt mũi ngủ ngáy thở bằng miệng được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '358f8bb8-e021-da18-fae1-d1c3d02c0fc2';

UPDATE articles
SET title = 'Viêm tai giữa ứ dịch mạn tính: Kỹ thuật trích rạch màng nhĩ và đặt ống thông khí di động',
    slug = 'viem-tai-giua-u-dich-man-tinh-ky-thuat-trich-rach-mang-nhi-va-dat-ong-thong-khi-di-dong',
    summary = 'Bài viết chuyên sâu về viêm tai giữa ứ dịch mạn tính: kỹ thuật trích rạch màng nhĩ và đặt ống thông khí di động được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '4a205a78-01c8-e173-a821-4a46314b8f08';

UPDATE articles
SET title = 'Viêm thanh quản khàn tiếng kéo dài: Soi hạ họng phát hiện hạt xơ dây thanh và polyp dây thanh',
    slug = 'viem-thanh-quan-khan-tieng-keo-dai-soi-ha-hong-phat-hien-hat-xo-day-thanh-va-polyp-day-thanh',
    summary = 'Bài viết chuyên sâu về viêm thanh quản khàn tiếng kéo dài: soi hạ họng phát hiện hạt xơ dây thanh và polyp dây thanh được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '54851501-f432-d3e1-738b-a4051b0989e2';

UPDATE articles
SET title = 'Dị vật đường thở và thực quản: Cảnh báo hóc xương cá, hạt trái cây và kỹ thuật gắp dị vật cấp cứu',
    slug = 'di-vat-duong-tho-va-thuc-quan-canh-bao-hoc-xuong-ca-hat-trai-cay-va-ky-thuat-gap-di-vat-cap-cuu',
    summary = 'Bài viết chuyên sâu về dị vật đường thở và thực quản: cảnh báo hóc xương cá, hạt trái cây và kỹ thuật gắp dị vật cấp cứu được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '59015387-32f0-3aed-5fa3-4ed058c982bc';

UPDATE articles
SET title = 'Chảy máu cam (chảy máu mũi): Các bước sơ cứu ép cánh mũi cúi đầu chuẩn y tế',
    slug = 'chay-mau-cam-chay-mau-mui-cac-buoc-so-cuu-ep-canh-mui-cui-dau-chuan-y-te',
    summary = 'Bài viết chuyên sâu về chảy máu cam (chảy máu mũi): các bước sơ cứu ép cánh mũi cúi đầu chuẩn y tế được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '5b279896-c0cf-8c33-86b6-3d233ca4161d';

UPDATE articles
SET title = 'Viêm mũi dị ứng thời tiết: Kiểm soát triệu chứng hắt hơi nghẹt mũi bằng xịt mũi corticoid',
    slug = 'viem-mui-di-ung-thoi-tiet-kiem-soat-trieu-chung-hat-hoi-nghet-mui-bang-xit-mui-corticoid',
    summary = 'Bài viết chuyên sâu về viêm mũi dị ứng thời tiết: kiểm soát triệu chứng hắt hơi nghẹt mũi bằng xịt mũi corticoid được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '6126bd0e-6ba1-3850-970e-5ca1ea2ea81b';

UPDATE articles
SET title = 'Mất khứu giác sau nhiễm virus hô hấp: Liệu pháp tập ngửi phục hồi tế bào thần kinh khứu giác',
    slug = 'mat-khuu-giac-sau-nhiem-virus-ho-hap-lieu-phap-tap-ngui-phuc-hoi-te-bao-than-kinh-khuu-giac',
    summary = 'Bài viết chuyên sâu về mất khứu giác sau nhiễm virus hô hấp: liệu pháp tập ngửi phục hồi tế bào thần kinh khứu giác được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '70fd2824-2dce-2a93-5bb3-265549ce70c6';

UPDATE articles
SET title = 'Thủng màng nhĩ do chấn thương: Khi nào màng nhĩ tự liền, khi nào cần phẫu thuật vá nhĩ',
    slug = 'thung-mang-nhi-do-chan-thuong-khi-nao-mang-nhi-tu-lien-khi-nao-can-phau-thuat-va-nhi',
    summary = 'Bài viết chuyên sâu về thủng màng nhĩ do chấn thương: khi nào màng nhĩ tự liền, khi nào cần phẫu thuật vá nhĩ được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '74250e12-f165-3044-916e-a2bd6e861ff6';

UPDATE articles
SET title = 'Ù tai tiếng ve kêu: Khám nội soi tai, đo thính lực đồ tìm căn nguyên mạch máu thần kinh',
    slug = 'u-tai-tieng-ve-keu-kham-noi-soi-tai-do-thinh-luc-do-tim-can-nguyen-mach-mau-than-kinh',
    summary = 'Bài viết chuyên sâu về ù tai tiếng ve kêu: khám nội soi tai, đo thính lực đồ tìm căn nguyên mạch máu thần kinh được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = '76288f2c-e1cf-79d0-dc7f-b08ea3723aa8';

UPDATE articles
SET title = 'Vẹo vách ngăn mũi: Dấu hiệu nghẹt một bên mũi thường xuyên và phẫu thuật chỉnh hình vách ngăn',
    slug = 'veo-vach-ngan-mui-dau-hieu-nghet-mot-ben-mui-thuong-xuyen-va-phau-thuat-chinh-hinh-vach-ngan',
    summary = 'Bài viết chuyên sâu về vẹo vách ngăn mũi: dấu hiệu nghẹt một bên mũi thường xuyên và phẫu thuật chỉnh hình vách ngăn được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = 'b2e4bb89-1787-a18d-237c-d6c1d4c7cb1b';

UPDATE articles
SET title = 'Áp xe quanh amidan: Nhận biết dấu hiệu nuốt nghẹn sốt cao, há miệng khó cần trích rạch',
    slug = 'ap-xe-quanh-amidan-nhan-biet-dau-hieu-nuot-nghen-sot-cao-ha-mieng-kho-can-trich-rach',
    summary = 'Bài viết chuyên sâu về áp xe quanh amidan: nhận biết dấu hiệu nuốt nghẹn sốt cao, há miệng khó cần trích rạch được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = 'bb6b1ed0-60e4-cd9e-74ac-df23bbc5ec2d';

UPDATE articles
SET title = 'Nội soi tai mũi họng dải tần hẹp NBI: Tầm soát ung thư vòm họng và thanh quản giai đoạn sớm',
    slug = 'noi-soi-tai-mui-hong-dai-tan-hep-nbi-tam-soat-ung-thu-vom-hong-va-thanh-quan-giai-doan-som',
    summary = 'Bài viết chuyên sâu về nội soi tai mũi họng dải tần hẹp nbi: tầm soát ung thư vòm họng và thanh quản giai đoạn sớm được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = 'bc3bf6f7-a4b9-1009-0f85-60e9413edd1f';

UPDATE articles
SET title = 'Viêm tai ngoài do bơi lội: Giữ khô tai, tránh ngoáy tai bông tăm và nhỏ thuốc kháng viêm',
    slug = 'viem-tai-ngoai-do-boi-loi-giu-kho-tai-tranh-ngoay-tai-bong-tam-va-nho-thuoc-khang-viem',
    summary = 'Bài viết chuyên sâu về viêm tai ngoài do bơi lội: giữ khô tai, tránh ngoáy tai bông tăm và nhỏ thuốc kháng viêm được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = 'c27b5658-f61b-9b6d-33d6-420ca4b97519';

UPDATE articles
SET title = 'Trào ngược dạ dày họng thanh quản LPR: Nguyên nhân gây vướng đờm cổ họng và ho khan kéo dài',
    slug = 'trao-nguoc-da-day-hong-thanh-quan-lpr-nguyen-nhan-gay-vuong-dom-co-hong-va-ho-khan-keo-dai',
    summary = 'Bài viết chuyên sâu về trào ngược dạ dày họng thanh quản lpr: nguyên nhân gây vướng đờm cổ họng và ho khan kéo dài được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = 'cbddcc32-0cf9-b4c6-53c6-c74c0d1a3dea';

UPDATE articles
SET title = 'Xông khí dung mũi họng: Chỉ định đúng loại thuốc và thời gian xông tránh khô niêm mạc',
    slug = 'xong-khi-dung-mui-hong-chi-dinh-dung-loai-thuoc-va-thoi-gian-xong-tranh-kho-niem-mac',
    summary = 'Bài viết chuyên sâu về xông khí dung mũi họng: chỉ định đúng loại thuốc và thời gian xông tránh khô niêm mạc được tham vấn y khoa bởi các chuyên gia Tai mũi họng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Tai mũi họng'
WHERE id = 'd0c1dc0e-0e4e-35f1-b7c3-74d5fa468a75';

UPDATE articles
SET title = 'Kỹ thuật hồi sinh tim phổi CPR cơ bản: Ép tim ngoài lồng ngực và hô hấp nhân tạo chuẩn hội tim mạch',
    slug = 'ky-thuat-hoi-sinh-tim-phoi-cpr-co-ban-ep-tim-ngoai-long-nguc-va-ho-hap-nhan-tao-chuan-hoi-tim-mach',
    summary = 'Bài viết chuyên sâu về kỹ thuật hồi sinh tim phổi cpr cơ bản: ép tim ngoài lồng ngực và hô hấp nhân tạo chuẩn hội tim mạch được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '077542e4-06af-8a9f-a19d-43a2cb2a08f4';

UPDATE articles
SET title = 'Sử dụng máy khử rung tim tự động ngoài lồng ngực AED tại nơi công cộng cứu sống ngừng tim',
    slug = 'su-dung-may-khu-rung-tim-tu-dong-ngoai-long-nguc-aed-tai-noi-cong-cong-cuu-song-ngung-tim',
    summary = 'Bài viết chuyên sâu về sử dụng máy khử rung tim tự động ngoài lồng ngực aed tại nơi công cộng cứu sống ngừng tim được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '193fa0c9-1833-f6bc-ba25-f360695dec61';

UPDATE articles
SET title = 'Xử trí dị vật đường thở nghẹt thở hóc dị vật: Thủ thuật Heimlich cứu người lớn và vỗ lưng ấn ngực trẻ nhỏ',
    slug = 'xu-tri-di-vat-duong-tho-nghet-tho-hoc-di-vat-thu-thuat-heimlich-cuu-nguoi-lon-va-vo-lung-an-nguc-tre-nho',
    summary = 'Bài viết chuyên sâu về xử trí dị vật đường thở nghẹt thở hóc dị vật: thủ thuật heimlich cứu người lớn và vỗ lưng ấn ngực trẻ nhỏ được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '1bec11c1-0ae7-7218-7845-9656e8d0953f';

UPDATE articles
SET title = 'Sơ cứu người bị đuối nước ngạt nước: Các bước đưa lên bờ ép tim thổi ngạt không dốc ngược người nạn nhân',
    slug = 'so-cuu-nguoi-bi-duoi-nuoc-ngat-nuoc-cac-buoc-dua-len-bo-ep-tim-thoi-ngat-khong-doc-nguoc-nguoi-nan-nhan',
    summary = 'Bài viết chuyên sâu về sơ cứu người bị đuối nước ngạt nước: các bước đưa lên bờ ép tim thổi ngạt không dốc ngược người nạn nhân được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '1e6ff396-99a1-533f-0a6b-977b29c6c0c1';

UPDATE articles
SET title = 'Xử trí cấp cứu sốc phản vệ do thức ăn dị ứng thuốc: Nhận diện khó thở tụt huyết áp và tiêm Adrenaline bắp đùi',
    slug = 'xu-tri-cap-cuu-soc-phan-ve-do-thuc-an-di-ung-thuoc-nhan-dien-kho-tho-tut-huyet-ap-va-tiem-adrenaline-bap-dui',
    summary = 'Bài viết chuyên sâu về xử trí cấp cứu sốc phản vệ do thức ăn dị ứng thuốc: nhận diện khó thở tụt huyết áp và tiêm adrenaline bắp đùi được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '2f29a07e-8d26-3071-8db9-4c685b4c3131';

UPDATE articles
SET title = 'Sơ cứu cầm máu vết thương động mạch phun thành tia: Kỹ thuật băng ép chèn và đặt garo đúng nguyên tắc',
    slug = 'so-cuu-cam-mau-vet-thuong-dong-mach-phun-thanh-tia-ky-thuat-bang-ep-chen-va-dat-garo-dung-nguyen-tac',
    summary = 'Bài viết chuyên sâu về sơ cứu cầm máu vết thương động mạch phun thành tia: kỹ thuật băng ép chèn và đặt garo đúng nguyên tắc được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '3d57de5b-3bb2-ed9f-fa0f-9c3c2e5a0205';

UPDATE articles
SET title = 'Cố định tạm thời gãy xương chi: Sử dụng nẹp gỗ bìa cứng đúng cách tránh di lệch đầu xương gãy',
    slug = 'co-dinh-tam-thoi-gay-xuong-chi-su-dung-nep-go-bia-cung-dung-cach-tranh-di-lech-dau-xuong-gay',
    summary = 'Bài viết chuyên sâu về cố định tạm thời gãy xương chi: sử dụng nẹp gỗ bìa cứng đúng cách tránh di lệch đầu xương gãy được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '3e995c9f-5a6c-7466-0de4-69fa01fec8eb';

UPDATE articles
SET title = 'Xử trí sơ cứu người bị say nắng sốc nhiệt say nóng: Làm mát hạ nhiệt nhanh chóng và bù nước điện giải',
    slug = 'xu-tri-so-cuu-nguoi-bi-say-nang-soc-nhiet-say-nong-lam-mat-ha-nhiet-nhanh-chong-va-bu-nuoc-dien-giai',
    summary = 'Bài viết chuyên sâu về xử trí sơ cứu người bị say nắng sốc nhiệt say nóng: làm mát hạ nhiệt nhanh chóng và bù nước điện giải được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '41656d45-768f-0377-d882-0390ec42bfd3';

UPDATE articles
SET title = 'Sơ cứu bỏng nhiệt lửa nước sôi: Ngâm rửa vết bỏng dưới vòi nước mát sạch tuyệt đối không bôi kem đánh răng',
    slug = 'so-cuu-bong-nhiet-lua-nuoc-soi-ngam-rua-vet-bong-duoi-voi-nuoc-mat-sach-tuyet-doi-khong-boi-kem-danh-rang',
    summary = 'Bài viết chuyên sâu về sơ cứu bỏng nhiệt lửa nước sôi: ngâm rửa vết bỏng dưới vòi nước mát sạch tuyệt đối không bôi kem đánh răng được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '472848fe-18b3-b8cb-4856-dc7c670fbd1b';

UPDATE articles
SET title = 'Xử trí tai nạn điện giật: Ngắt cầu dao điện an toàn, tách nạn nhân bằng vật liệu cách điện và kiểm tra nhịp thở',
    slug = 'xu-tri-tai-nan-dien-giat-ngat-cau-dao-dien-an-toan-tach-nan-nhan-bang-vat-lieu-cach-dien-va-kiem-tra-nhip-tho',
    summary = 'Bài viết chuyên sâu về xử trí tai nạn điện giật: ngắt cầu dao điện an toàn, tách nạn nhân bằng vật liệu cách điện và kiểm tra nhịp thở được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '53a332c3-8c10-3cb2-8b7e-57fe72bf7ba4';

UPDATE articles
SET title = 'Sơ cứu người bị co giật động kinh: Giữ môi trường xung quanh an toàn, nghiêng đầu sang một bên không nhét vật vào miệng',
    slug = 'so-cuu-nguoi-bi-co-giat-dong-kinh-giu-moi-truong-xung-quanh-an-toan-nghieng-dau-sang-mot-ben-khong-nhet-vat-vao-mieng',
    summary = 'Bài viết chuyên sâu về sơ cứu người bị co giật động kinh: giữ môi trường xung quanh an toàn, nghiêng đầu sang một bên không nhét vật vào miệng được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '69657aee-884f-548b-b620-cf83f02d7d76';

UPDATE articles
SET title = 'Xử trí ngộ độc thực phẩm cấp tính: Dấu hiệu nôn ói tiêu chảy nhiều lần và biện pháp bù dịch Oresol',
    slug = 'xu-tri-ngo-doc-thuc-pham-cap-tinh-dau-hieu-non-oi-tieu-chay-nhieu-lan-va-bien-phap-bu-dich-oresol',
    summary = 'Bài viết chuyên sâu về xử trí ngộ độc thực phẩm cấp tính: dấu hiệu nôn ói tiêu chảy nhiều lần và biện pháp bù dịch oresol được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '6bc65ef2-3b39-b56b-9e65-65cc9503c9f5';

UPDATE articles
SET title = 'Sơ cứu rắn độc cắn: Bất động chi bị cắn thấp hơn tim, rửa sạch vết thương và khẩn trương chuyển viện',
    slug = 'so-cuu-ran-doc-can-bat-dong-chi-bi-can-thap-hon-tim-rua-sach-vet-thuong-va-khan-truong-chuyen-vien',
    summary = 'Bài viết chuyên sâu về sơ cứu rắn độc cắn: bất động chi bị cắn thấp hơn tim, rửa sạch vết thương và khẩn trương chuyển viện được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = '81683481-cb9a-a71e-5b79-e26be60304da';

UPDATE articles
SET title = 'Xử trí vết thương do động vật chó mèo cắn: Rửa xà phòng dưới vòi nước 15 phút và tiêm phòng dại uốn ván',
    slug = 'xu-tri-vet-thuong-do-dong-vat-cho-meo-can-rua-xa-phong-duoi-voi-nuoc-15-phut-va-tiem-phong-dai-uon-van',
    summary = 'Bài viết chuyên sâu về xử trí vết thương do động vật chó mèo cắn: rửa xà phòng dưới vòi nước 15 phút và tiêm phòng dại uốn ván được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = 'abdba4c1-8fe9-4f30-bdcf-82cc3bfab868';

UPDATE articles
SET title = 'Nhận diện dấu hiệu sốc giảm thể tích sốc nhiễm khuẩn: Mạch nhanh nhỏ huyết áp tụt vã mồ hôi lạnh',
    slug = 'nhan-dien-dau-hieu-soc-giam-the-tich-soc-nhiem-khuan-mach-nhanh-nho-huyet-ap-tut-va-mo-hoi-lanh',
    summary = 'Bài viết chuyên sâu về nhận diện dấu hiệu sốc giảm thể tích sốc nhiễm khuẩn: mạch nhanh nhỏ huyết áp tụt vã mồ hôi lạnh được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = 'c27689f5-55d5-357e-74bc-dd6f4d26249e';

UPDATE articles
SET title = 'Quy trình gọi tổng đài cấp cứu 115: Cung cấp thông tin địa chỉ chính xác, tình trạng người bệnh rõ ràng',
    slug = 'quy-trinh-goi-tong-dai-cap-cuu-115-cung-cap-thong-tin-dia-chi-chinh-xac-tinh-trang-nguoi-benh-ro-rang',
    summary = 'Bài viết chuyên sâu về quy trình gọi tổng đài cấp cứu 115: cung cấp thông tin địa chỉ chính xác, tình trạng người bệnh rõ ràng được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = 'c6cdfb68-ca66-6489-d029-3499e85d7c25';

UPDATE articles
SET title = 'Trang bị tủ thuốc sơ cấp cứu y tế tại gia đình: Các dụng cụ y tế và thuốc thiết yếu cần có',
    slug = 'trang-bi-tu-thuoc-so-cap-cuu-y-te-tai-gia-dinh-cac-dung-cu-y-te-va-thuoc-thiet-yeu-can-co',
    summary = 'Bài viết chuyên sâu về trang bị tủ thuốc sơ cấp cứu y tế tại gia đình: các dụng cụ y tế và thuốc thiết yếu cần có được tham vấn y khoa bởi các chuyên gia Sơ cấp cứu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Sơ cấp cứu'
WHERE id = 'de49200b-1b77-e988-2665-b3115425edf8';

UPDATE articles
SET title = 'Sỏi đường tiết niệu: Phân biệt sỏi thận sỏi niệu quản sỏi bàng quang và phương pháp tán sỏi',
    slug = 'soi-duong-tiet-nieu-phan-biet-soi-than-soi-nieu-quan-soi-bang-quang-va-phuong-phap-tan-soi',
    summary = 'Bài viết chuyên sâu về sỏi đường tiết niệu: phân biệt sỏi thận sỏi niệu quản sỏi bàng quang và phương pháp tán sỏi được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = '07f42851-b867-8a80-d553-911cc175c8e9';

UPDATE articles
SET title = 'Tán sỏi qua da đường hầm nhỏ Mini-PCNL: Kỹ thuật xâm lấn tối thiểu loại sạch sỏi san hô lớn',
    slug = 'tan-soi-qua-da-duong-ham-nho-mini-pcnl-ky-thuat-xam-lan-toi-thieu-loai-sach-soi-san-ho-lon',
    summary = 'Bài viết chuyên sâu về tán sỏi qua da đường hầm nhỏ mini-pcnl: kỹ thuật xâm lấn tối thiểu loại sạch sỏi san hô lớn được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = '0919d270-a822-8f56-f881-087a9e30eab4';

UPDATE articles
SET title = 'Tán sỏi ngược dòng bằng laser ống mềm: Giải pháp tán sỏi đài bể thận không có vết mổ',
    slug = 'tan-soi-nguoc-dong-bang-laser-ong-mem-giai-phap-tan-soi-dai-be-than-khong-co-vet-mo',
    summary = 'Bài viết chuyên sâu về tán sỏi ngược dòng bằng laser ống mềm: giải pháp tán sỏi đài bể thận không có vết mổ được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = '2de63093-c5d0-3abc-9de3-162d320cd8fc';

UPDATE articles
SET title = 'Phì đại lành tính tuyến tiền liệt BPH: Thang điểm IPSS đánh giá tiểu đêm tiểu khó và nội soi bóc nhân',
    slug = 'phi-dai-lanh-tinh-tuyen-tien-liet-bph-thang-diem-ipss-danh-gia-tieu-dem-tieu-kho-va-noi-soi-boc-nhan',
    summary = 'Bài viết chuyên sâu về phì đại lành tính tuyến tiền liệt bph: thang điểm ipss đánh giá tiểu đêm tiểu khó và nội soi bóc nhân được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = '2fdf7bfb-e744-1081-b702-f35462313848';

UPDATE articles
SET title = 'Nhiễm khuẩn đường tiết niệu UTI: Phân biệt viêm bàng quang cấp với viêm đài bể thận cấp',
    slug = 'nhiem-khuan-duong-tiet-nieu-uti-phan-biet-viem-bang-quang-cap-voi-viem-dai-be-than-cap',
    summary = 'Bài viết chuyên sâu về nhiễm khuẩn đường tiết niệu uti: phân biệt viêm bàng quang cấp với viêm đài bể thận cấp được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = '3a528875-c84d-3b33-2f3f-0b98fe1fea81';

UPDATE articles
SET title = 'Tiểu ra máu đại thể và vi thể: Dấu hiệu cảnh báo khối u bàng quang và soi bàng quang chẩn đoán',
    slug = 'tieu-ra-mau-dai-the-va-vi-the-dau-hieu-canh-bao-khoi-u-bang-quang-va-soi-bang-quang-chan-doan',
    summary = 'Bài viết chuyên sâu về tiểu ra máu đại thể và vi thể: dấu hiệu cảnh báo khối u bàng quang và soi bàng quang chẩn đoán được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = '62577cde-b3de-8617-17fe-99e2304a572e';

UPDATE articles
SET title = 'Hẹp niệu đạo sau chấn thương hoặc viêm nhiễm: Phẫu thuật nội soi xẻ hẹp hoặc tạo hình niệu đạo',
    slug = 'hep-nieu-dao-sau-chan-thuong-hoac-viem-nhiem-phau-thuat-noi-soi-xe-hep-hoac-tao-hinh-nieu-dao',
    summary = 'Bài viết chuyên sâu về hẹp niệu đạo sau chấn thương hoặc viêm nhiễm: phẫu thuật nội soi xẻ hẹp hoặc tạo hình niệu đạo được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = '62883f9f-7b06-1a1f-1d1b-6f47fa975f8b';

UPDATE articles
SET title = 'Thận ứ nước: Xác định nguyên nhân tắc nghẽn đường tiểu và đặt ống thông JJ niệu quản dẫn lưu',
    slug = 'than-u-nuoc-xac-dinh-nguyen-nhan-tac-nghen-duong-tieu-va-dat-ong-thong-jj-nieu-quan-dan-luu',
    summary = 'Bài viết chuyên sâu về thận ứ nước: xác định nguyên nhân tắc nghẽn đường tiểu và đặt ống thông jj niệu quản dẫn lưu được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = '9a52d094-3a3c-6f4e-615c-b372207bea23';

UPDATE articles
SET title = 'Bệnh nang thận đơn độc và thận đa nang di truyền: Theo dõi kích thước nang và huyết áp',
    slug = 'benh-nang-than-don-doc-va-than-da-nang-di-truyen-theo-doi-kich-thuoc-nang-va-huyet-ap',
    summary = 'Bài viết chuyên sâu về bệnh nang thận đơn độc và thận đa nang di truyền: theo dõi kích thước nang và huyết áp được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = 'a52b40cc-b682-c7c5-e41c-182b9ca2df0a';

UPDATE articles
SET title = 'Viêm tuyến tiền liệt cấp và mạn tính: Triệu chứng đau vùng tầng sinh môn và phác đồ kháng sinh',
    slug = 'viem-tuyen-tien-liet-cap-va-man-tinh-trieu-chung-dau-vung-tang-sinh-mon-va-phac-do-khang-sinh',
    summary = 'Bài viết chuyên sâu về viêm tuyến tiền liệt cấp và mạn tính: triệu chứng đau vùng tầng sinh môn và phác đồ kháng sinh được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = 'a5bad944-283b-3a89-2b1c-dca70b3f7e64';

UPDATE articles
SET title = 'Hội chứng bàng quang tăng hoạt OAB: Triệu chứng tiểu gấp són tiểu và bài tập cơ sàn chậu Kegel',
    slug = 'hoi-chung-bang-quang-tang-hoat-oab-trieu-chung-tieu-gap-son-tieu-va-bai-tap-co-san-chau-kegel',
    summary = 'Bài viết chuyên sâu về hội chứng bàng quang tăng hoạt oab: triệu chứng tiểu gấp són tiểu và bài tập cơ sàn chậu kegel được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = 'ad08e807-a879-2340-cf35-156ae921fa4d';

UPDATE articles
SET title = 'Sỏi bàng quang: Nguyên nhân do ứ đọng nước tiểu cổ bàng quang và kỹ thuật tán sỏi laser',
    slug = 'soi-bang-quang-nguyen-nhan-do-u-dong-nuoc-tieu-co-bang-quang-va-ky-thuat-tan-soi-laser',
    summary = 'Bài viết chuyên sâu về sỏi bàng quang: nguyên nhân do ứ đọng nước tiểu cổ bàng quang và kỹ thuật tán sỏi laser được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = 'bacbc3b8-aa36-6acf-b7fb-3f19789506aa';

UPDATE articles
SET title = 'Trào ngược bàng quang niệu quản ở trẻ nhỏ: Chụp bàng quang niệu đạo khi tiểu VCU chẩn đoán',
    slug = 'trao-nguoc-bang-quang-nieu-quan-o-tre-nho-chup-bang-quang-nieu-dao-khi-tieu-vcu-chan-doan',
    summary = 'Bài viết chuyên sâu về trào ngược bàng quang niệu quản ở trẻ nhỏ: chụp bàng quang niệu đạo khi tiểu vcu chẩn đoán được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = 'cb96bd23-bd74-537a-24c1-516cee606533';

UPDATE articles
SET title = 'Ung thư tuyến tiền liệt: Tầm soát chỉ số kháng nguyên PSA định kỳ cho nam giới trên 50 tuổi',
    slug = 'ung-thu-tuyen-tien-liet-tam-soat-chi-so-khang-nguyen-psa-dinh-ky-cho-nam-gioi-tren-50-tuoi',
    summary = 'Bài viết chuyên sâu về ung thư tuyến tiền liệt: tầm soát chỉ số kháng nguyên psa định kỳ cho nam giới trên 50 tuổi được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = 'd4dbae1d-18d6-7f9c-78b3-fd646c8971b5';

UPDATE articles
SET title = 'Suy thận mạn tính: Các giai đoạn bệnh lọc máu chu kỳ chạy thận nhân tạo và ghép thận',
    slug = 'suy-than-man-tinh-cac-giai-doan-benh-loc-mau-chu-ky-chay-than-nhan-tao-va-ghep-than',
    summary = 'Bài viết chuyên sâu về suy thận mạn tính: các giai đoạn bệnh lọc máu chu kỳ chạy thận nhân tạo và ghép thận được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = 'e67713ee-15bb-86fd-71aa-7e777a2c0a42';

UPDATE articles
SET title = 'U niệu mạc bàng quang nông: Phẫu thuật nội soi cắt u bàng quang qua ngả niệu đạo TURBT',
    slug = 'u-nieu-mac-bang-quang-nong-phau-thuat-noi-soi-cat-u-bang-quang-qua-nga-nieu-dao-turbt',
    summary = 'Bài viết chuyên sâu về u niệu mạc bàng quang nông: phẫu thuật nội soi cắt u bàng quang qua ngả niệu đạo turbt được tham vấn y khoa bởi các chuyên gia Tiết niệu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Tiết niệu'
WHERE id = 'ea7b42c2-1b9d-3475-3e85-5c315941079b';

UPDATE articles
SET title = 'Sinh thiết tức thì cắt lạnh trong mổ: Vai trò quyết định diện cắt ung thư âm tính ngay trên bàn mổ',
    slug = 'sinh-thiet-tuc-thi-cat-lanh-trong-mo-vai-tro-quyet-dinh-dien-cat-ung-thu-am-tinh-ngay-tren-ban-mo',
    summary = 'Bài viết chuyên sâu về sinh thiết tức thì cắt lạnh trong mổ: vai trò quyết định diện cắt ung thư âm tính ngay trên bàn mổ được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '081c9769-ab88-4bda-8731-a7c9008e3da3';

UPDATE articles
SET title = 'Nhuộm hóa mô miễn dịch IHC: Xác định nguồn gốc tế bào u và thụ thể đích HER2 ER PR Ki-67',
    slug = 'nhuom-hoa-mo-mien-dich-ihc-xac-dinh-nguon-goc-te-bao-u-va-thu-the-dich-her2-er-pr-ki-67',
    summary = 'Bài viết chuyên sâu về nhuộm hóa mô miễn dịch ihc: xác định nguồn gốc tế bào u và thụ thể đích her2 er pr ki-67 được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '204af866-58a5-f44f-9e93-c06ad7b392ff';

UPDATE articles
SET title = 'Xét nghiệm tế bào học chọc hút kim nhỏ FNAC: Chẩn đoán nhanh u tuyến giáp hạch cổ u tuyến vú',
    slug = 'xet-nghiem-te-bao-hoc-choc-hut-kim-nho-fnac-chan-doan-nhanh-u-tuyen-giap-hach-co-u-tuyen-vu',
    summary = 'Bài viết chuyên sâu về xét nghiệm tế bào học chọc hút kim nhỏ fnac: chẩn đoán nhanh u tuyến giáp hạch cổ u tuyến vú được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '2104f593-51be-82a2-653a-8c133fc08e3e';

UPDATE articles
SET title = 'Xét nghiệm phết tế bào cổ tử cung Pap smear và ThinPrep: Tầm soát tổn thương tiền ung thư gai',
    slug = 'xet-nghiem-phet-te-bao-co-tu-cung-pap-smear-va-thinprep-tam-soat-ton-thuong-tien-ung-thu-gai',
    summary = 'Bài viết chuyên sâu về xét nghiệm phết tế bào cổ tử cung pap smear và thinprep: tầm soát tổn thương tiền ung thư gai được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '45568f41-05fa-6cb3-09bc-115620adb648';

UPDATE articles
SET title = 'Sinh thiết lõi kim Core Biopsy u vú u gan u phổi: Lấy mẫu mô học tiêu chuẩn vàng chẩn đoán',
    slug = 'sinh-thiet-loi-kim-core-biopsy-u-vu-u-gan-u-phoi-lay-mau-mo-hoc-tieu-chuan-vang-chan-doan',
    summary = 'Bài viết chuyên sâu về sinh thiết lõi kim core biopsy u vú u gan u phổi: lấy mẫu mô học tiêu chuẩn vàng chẩn đoán được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '4a66a561-84cd-a9cd-b197-8f13f1f2bed2';

UPDATE articles
SET title = 'Đọc kết quả giải phẫu bệnh ung thư: Ý nghĩa của độ mô học Biệt hóa tốt Trung bình và Kém',
    slug = 'doc-ket-qua-giai-phau-benh-ung-thu-y-nghia-cua-do-mo-hoc-biet-hoa-tot-trung-binh-va-kem',
    summary = 'Bài viết chuyên sâu về đọc kết quả giải phẫu bệnh ung thư: ý nghĩa của độ mô học biệt hóa tốt trung bình và kém được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '58430b15-eab6-0d3b-5c53-243f34979691';

UPDATE articles
SET title = 'Đánh giá hạch gác Sentinel Lymph Node: Ý nghĩa tiên lượng giai đoạn di căn trong ung thư vú melanoma',
    slug = 'danh-gia-hach-gac-sentinel-lymph-node-y-nghia-tien-luong-giai-doan-di-can-trong-ung-thu-vu-melanoma',
    summary = 'Bài viết chuyên sâu về đánh giá hạch gác sentinel lymph node: ý nghĩa tiên lượng giai đoạn di căn trong ung thư vú melanoma được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '681cb053-9952-286f-33db-fd7c51c3040c';

UPDATE articles
SET title = 'Xét nghiệm đột biến gen khối u PCR NGS: Nền tảng của y học chính xác và liệu pháp nhắm trúng đích',
    slug = 'xet-nghiem-dot-bien-gen-khoi-u-pcr-ngs-nen-tang-cua-y-hoc-chinh-xac-va-lieu-phap-nham-trung-dich',
    summary = 'Bài viết chuyên sâu về xét nghiệm đột biến gen khối u pcr ngs: nền tảng của y học chính xác và liệu pháp nhắm trúng đích được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '84ed0fd5-ebf9-1add-b5ae-30bbd1d65a5d';

UPDATE articles
SET title = 'Xét nghiệm tế bào dịch màng phổi màng bụng: Tìm kiếm tế bào ác tính di căn thanh mạc',
    slug = 'xet-nghiem-te-bao-dich-mang-phoi-mang-bung-tim-kiem-te-bao-ac-tinh-di-can-thanh-mac',
    summary = 'Bài viết chuyên sâu về xét nghiệm tế bào dịch màng phổi màng bụng: tìm kiếm tế bào ác tính di căn thanh mạc được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = '89f2985b-41cd-fffc-e3ad-279b1ed7f228';

UPDATE articles
SET title = 'Quy trình xử lý mẫu bệnh phẩm giải phẫu bệnh: Cố định formol đúc khối nến và cắt lát vi thể',
    slug = 'quy-trinh-xu-ly-mau-benh-pham-giai-phau-benh-co-dinh-formol-duc-khoi-nen-va-cat-lat-vi-the',
    summary = 'Bài viết chuyên sâu về quy trình xử lý mẫu bệnh phẩm giải phẫu bệnh: cố định formol đúc khối nến và cắt lát vi thể được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = 'a89fb3b7-fa74-531f-e936-7e15bde23de6';

UPDATE articles
SET title = 'Phân loại mô bệnh học các loại Polyp đại trực tràng: Polyp tuyến ống nhánh và polyp răng cưa',
    slug = 'phan-loai-mo-benh-hoc-cac-loai-polyp-dai-truc-trang-polyp-tuyen-ong-nhanh-va-polyp-rang-cua',
    summary = 'Bài viết chuyên sâu về phân loại mô bệnh học các loại polyp đại trực tràng: polyp tuyến ống nhánh và polyp răng cưa được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = 'b179bafd-833b-36fc-ab5a-aaedf71c1bb7';

UPDATE articles
SET title = 'Sinh thiết dạ dày qua nội soi: Đánh giá viêm teo niêm mạc dị sản ruột và vi khuẩn HP',
    slug = 'sinh-thiet-da-day-qua-noi-soi-danh-gia-viem-teo-niem-mac-di-san-ruot-va-vi-khuan-hp',
    summary = 'Bài viết chuyên sâu về sinh thiết dạ dày qua nội soi: đánh giá viêm teo niêm mạc dị sản ruột và vi khuẩn hp được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = 'b6cc141b-90b9-77e6-90d5-6eebf463d6a6';

UPDATE articles
SET title = 'Sinh thiết da chẩn đoán các bệnh da tự miễn mạn tính: Lắng đọng miễn dịch huỳnh quang trực tiếp DIF',
    slug = 'sinh-thiet-da-chan-doan-cac-benh-da-tu-mien-man-tinh-lang-dong-mien-dich-huynh-quang-truc-tiep-dif',
    summary = 'Bài viết chuyên sâu về sinh thiết da chẩn đoán các bệnh da tự miễn mạn tính: lắng đọng miễn dịch huỳnh quang trực tiếp dif được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = 'bb3d6226-a80e-4626-130e-2d839823748f';

UPDATE articles
SET title = 'Đánh giá diện cắt phẫu thuật khối u: Đảm bảo bờ diện phẫu thuật không còn tế bào ung thư sót lại',
    slug = 'danh-gia-dien-cat-phau-thuat-khoi-u-dam-bao-bo-dien-phau-thuat-khong-con-te-bao-ung-thu-sot-lai',
    summary = 'Bài viết chuyên sâu về đánh giá diện cắt phẫu thuật khối u: đảm bảo bờ diện phẫu thuật không còn tế bào ung thư sót lại được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = 'c08ede98-da17-0d07-a8f9-e12383fae70a';

UPDATE articles
SET title = 'Sinh thiết tủy xương chẩn đoán các bệnh lý tủy: Đánh giá mật độ tế bào và xơ hóa tủy',
    slug = 'sinh-thiet-tuy-xuong-chan-doan-cac-benh-ly-tuy-danh-gia-mat-do-te-bao-va-xo-hoa-tuy',
    summary = 'Bài viết chuyên sâu về sinh thiết tủy xương chẩn đoán các bệnh lý tủy: đánh giá mật độ tế bào và xơ hóa tủy được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = 'cdb6c589-a27a-d163-3395-352e29093554';

UPDATE articles
SET title = 'Vai trò của giải phẫu bệnh trong hội chẩn đa chuyên khoa ung bướu Tumor Board',
    slug = 'vai-tro-cua-giai-phau-benh-trong-hoi-chan-da-chuyen-khoa-ung-buou-tumor-board',
    summary = 'Bài viết chuyên sâu về vai trò của giải phẫu bệnh trong hội chẩn đa chuyên khoa ung bướu tumor board được tham vấn y khoa bởi các chuyên gia Giải phẫu bệnh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Giải phẫu bệnh'
WHERE id = 'fdb9c3ae-1ea6-7d5c-001e-06ba2b4cf142';

UPDATE articles
SET title = 'Nghe kém giảm thính lực ở người cao tuổi: Cơ chế lão thính Presbycusis và giải pháp máy trợ thính',
    slug = 'nghe-kem-giam-thinh-luc-o-nguoi-cao-tuoi-co-che-lao-thinh-presbycusis-va-giai-phap-may-tro-thinh',
    summary = 'Bài viết chuyên sâu về nghe kém giảm thính lực ở người cao tuổi: cơ chế lão thính presbycusis và giải pháp máy trợ thính được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '0949bf86-8c1c-fcd0-d48c-4fc4648de226';

UPDATE articles
SET title = 'Điếc đột ngột thần kinh giác quan: Dấu hiệu mất thính lực một bên tai trong vài giờ cấp cứu corticoid',
    slug = 'diec-dot-ngot-than-kinh-giac-quan-dau-hieu-mat-thinh-luc-mot-ben-tai-trong-vai-gio-cap-cuu-corticoid',
    summary = 'Bài viết chuyên sâu về điếc đột ngột thần kinh giác quan: dấu hiệu mất thính lực một bên tai trong vài giờ cấp cứu corticoid được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '0a6a19df-742a-4c15-8be4-aa2cf69dfb78';

UPDATE articles
SET title = 'Ù tai chủ quan tiếng vo ve: Đánh giá bằng thính lực đồ và liệu pháp tái rèn luyện âm thanh TRT',
    slug = 'u-tai-chu-quan-tieng-vo-ve-danh-gia-bang-thinh-luc-do-va-lieu-phap-tai-ren-luyen-am-thanh-trt',
    summary = 'Bài viết chuyên sâu về ù tai chủ quan tiếng vo ve: đánh giá bằng thính lực đồ và liệu pháp tái rèn luyện âm thanh trt được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '0b102db5-c26b-1d89-c092-d4896034a79c';

UPDATE articles
SET title = 'Đo thính lực đơn âm đường khí đường xương: Biểu đồ thính lực PTA xác định mức độ điếc',
    slug = 'do-thinh-luc-don-am-duong-khi-duong-xuong-bieu-do-thinh-luc-pta-xac-dinh-muc-do-diec',
    summary = 'Bài viết chuyên sâu về đo thính lực đơn âm đường khí đường xương: biểu đồ thính lực pta xác định mức độ điếc được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '143776b0-f7fa-4889-f8bb-80b5ea2d151d';

UPDATE articles
SET title = 'Đo nhĩ lượng và phản xạ cơ bàn đạp: Đánh giá độ thông thoáng vòi tai và áp suất hòm nhĩ',
    slug = 'do-nhi-luong-va-phan-xa-co-ban-dap-danh-gia-do-thong-thoang-voi-tai-va-ap-suat-hom-nhi',
    summary = 'Bài viết chuyên sâu về đo nhĩ lượng và phản xạ cơ bàn đạp: đánh giá độ thông thoáng vòi tai và áp suất hòm nhĩ được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '15a26afc-4014-6820-9d76-edd43beb2238';

UPDATE articles
SET title = 'Sàng lọc thính lực sơ sinh bằng đo âm ốc tai OAE: Phát hiện sớm khiếm thính trước 3 tháng tuổi',
    slug = 'sang-loc-thinh-luc-so-sinh-bang-do-am-oc-tai-oae-phat-hien-som-khiem-thinh-truoc-3-thang-tuoi',
    summary = 'Bài viết chuyên sâu về sàng lọc thính lực sơ sinh bằng đo âm ốc tai oae: phát hiện sớm khiếm thính trước 3 tháng tuổi được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '1d37fbaa-0e69-51cc-51b1-6216925acc6b';

UPDATE articles
SET title = 'Đo điện thế gợi thính giác thân não ABR: Thăm dò đường dẫn truyền thần kinh thính giác trung ương',
    slug = 'do-dien-the-goi-thinh-giac-than-nao-abr-tham-do-duong-dan-truyen-than-kinh-thinh-giac-trung-uong',
    summary = 'Bài viết chuyên sâu về đo điện thế gợi thính giác thân não abr: thăm dò đường dẫn truyền thần kinh thính giác trung ương được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '31843f30-6c7e-9c20-8a1c-cf61bc8c41a5';

UPDATE articles
SET title = 'Cấy điện cực ốc tai Cochlear Implant: Giải pháp phục hồi âm thanh cho người điếc sâu hai tai',
    slug = 'cay-dien-cuc-oc-tai-cochlear-implant-giai-phap-phuc-hoi-am-thanh-cho-nguoi-diec-sau-hai-tai',
    summary = 'Bài viết chuyên sâu về cấy điện cực ốc tai cochlear implant: giải pháp phục hồi âm thanh cho người điếc sâu hai tai được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '3d9d677e-17fc-ab91-8798-8f00b9de464a';

UPDATE articles
SET title = 'Tác hại của ô nhiễm tiếng ồn và thói quen nghe nhạc tai nghe âm lượng lớn đến tế bào lông ốc tai',
    slug = 'tac-hai-cua-o-nhiem-tieng-on-va-thoi-quen-nghe-nhac-tai-nghe-am-luong-lon-den-te-bao-long-oc-tai',
    summary = 'Bài viết chuyên sâu về tác hại của ô nhiễm tiếng ồn và thói quen nghe nhạc tai nghe âm lượng lớn đến tế bào lông ốc tai được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '537f60e1-211c-76d8-0b6a-ae4c3c9cab46';

UPDATE articles
SET title = 'Chấn thương âm thanh cấp do tiếng nổ lớn: Cách bảo vệ màng nhĩ và tế bào ốc tai',
    slug = 'chan-thuong-am-thanh-cap-do-tieng-no-lon-cach-bao-ve-mang-nhi-va-te-bao-oc-tai',
    summary = 'Bài viết chuyên sâu về chấn thương âm thanh cấp do tiếng nổ lớn: cách bảo vệ màng nhĩ và tế bào ốc tai được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = '5a32f2ac-59fe-6449-e06f-602ae37e004f';

UPDATE articles
SET title = 'Nhiễm độc tai do thuốc kháng sinh nhóm Aminoglycosid: Theo dõi thính lực trong quá trình điều trị',
    slug = 'nhiem-doc-tai-do-thuoc-khang-sinh-nhom-aminoglycosid-theo-doi-thinh-luc-trong-qua-trinh-dieu-tri',
    summary = 'Bài viết chuyên sâu về nhiễm độc tai do thuốc kháng sinh nhóm aminoglycosid: theo dõi thính lực trong quá trình điều trị được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = 'a293751e-2fef-452a-7313-eb74ee8e8e76';

UPDATE articles
SET title = 'Điếc truyền dẫn do xơ cứng chuỗi xương con xơ xốp tai: Phẫu thuật thay xương bàn đạp phục hồi nghe',
    slug = 'diec-truyen-dan-do-xo-cung-chuoi-xuong-con-xo-xop-tai-phau-thuat-thay-xuong-ban-dap-phuc-hoi-nghe',
    summary = 'Bài viết chuyên sâu về điếc truyền dẫn do xơ cứng chuỗi xương con xơ xốp tai: phẫu thuật thay xương bàn đạp phục hồi nghe được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = 'a7b44f3f-ba87-c30d-a8dd-870cdd9b7c87';

UPDATE articles
SET title = 'Rối loạn xử lý thính giác trung ương APD: Khó khăn nghe hiểu trong môi trường ồn ào',
    slug = 'roi-loan-xu-ly-thinh-giac-trung-uong-apd-kho-khan-nghe-hieu-trong-moi-truong-on-ao',
    summary = 'Bài viết chuyên sâu về rối loạn xử lý thính giác trung ương apd: khó khăn nghe hiểu trong môi trường ồn ào được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = 'af4ca61a-fcd6-7bd1-6e2f-623bbd01df8e';

UPDATE articles
SET title = 'Bảo vệ thính giác cho công nhân lao động môi trường nhà máy: Nút tai chống ồn y tế',
    slug = 'bao-ve-thinh-giac-cho-cong-nhan-lao-dong-moi-truong-nha-may-nut-tai-chong-on-y-te',
    summary = 'Bài viết chuyên sâu về bảo vệ thính giác cho công nhân lao động môi trường nhà máy: nút tai chống ồn y tế được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = 'b1bab644-5438-2646-d98a-be7e790d63cb';

UPDATE articles
SET title = 'Tập luyện phục hồi chức năng nghe nói sau cấy ốc tai điện tử cho trẻ nhỏ khiếm thính bẩm sinh',
    slug = 'tap-luyen-phuc-hoi-chuc-nang-nghe-noi-sau-cay-oc-tai-dien-tu-cho-tre-nho-khiem-thinh-bam-sinh',
    summary = 'Bài viết chuyên sâu về tập luyện phục hồi chức năng nghe nói sau cấy ốc tai điện tử cho trẻ nhỏ khiếm thính bẩm sinh được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = 'e536a6b1-a325-e3b4-214e-e554a0d5e75f';

UPDATE articles
SET title = 'Bệnh Meniere ứ dịch nội dịch tai trong: Bộ ba triệu chứng chóng mặt ù tai nghe kém từng cơn',
    slug = 'benh-meniere-u-dich-noi-dich-tai-trong-bo-ba-trieu-chung-chong-mat-u-tai-nghe-kem-tung-con',
    summary = 'Bài viết chuyên sâu về bệnh meniere ứ dịch nội dịch tai trong: bộ ba triệu chứng chóng mặt ù tai nghe kém từng cơn được tham vấn y khoa bởi các chuyên gia Thính học Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Thính học'
WHERE id = 'eaec980f-0634-3644-f54c-69ce7cdccdd5';

UPDATE articles
SET title = 'Gãy xương đùi và gãy cổ xương đùi ở người cao tuổi: Phẫu thuật thay khớp háng bán phần sớm',
    slug = 'gay-xuong-dui-va-gay-co-xuong-dui-o-nguoi-cao-tuoi-phau-thuat-thay-khop-hang-ban-phan-som',
    summary = 'Bài viết chuyên sâu về gãy xương đùi và gãy cổ xương đùi ở người cao tuổi: phẫu thuật thay khớp háng bán phần sớm được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = '0c108660-4ce6-eee8-972e-7c1da3f6479b';

UPDATE articles
SET title = 'Gãy hai xương cẳng chân: Phẫu thuật đinh nội tủy có chốt và theo dõi liền xương trên X-quang',
    slug = 'gay-hai-xuong-cang-chan-phau-thuat-dinh-noi-tuy-co-chot-va-theo-doi-lien-xuong-tren-x-quang',
    summary = 'Bài viết chuyên sâu về gãy hai xương cẳng chân: phẫu thuật đinh nội tủy có chốt và theo dõi liền xương trên x-quang được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = '36083999-34df-07df-67d5-662409184184';

UPDATE articles
SET title = 'Rách dây chằng chéo trước ACL và chéo sau PCL: Quy trình phẫu thuật nội soi tái tạo dây chằng',
    slug = 'rach-day-chang-cheo-truoc-acl-va-cheo-sau-pcl-quy-trinh-phau-thuat-noi-soi-tai-tao-day-chang',
    summary = 'Bài viết chuyên sâu về rách dây chằng chéo trước acl và chéo sau pcl: quy trình phẫu thuật nội soi tái tạo dây chằng được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = '4058ae7d-9003-2ff3-19c6-0ef9b6ab22de';

UPDATE articles
SET title = 'Trật khớp vai tái diễn: Kỹ thuật phẫu thuật nội soi Bankart khâu phục hồi sụn viền',
    slug = 'trat-khop-vai-tai-dien-ky-thuat-phau-thuat-noi-soi-bankart-khau-phuc-hoi-sun-vien',
    summary = 'Bài viết chuyên sâu về trật khớp vai tái diễn: kỹ thuật phẫu thuật nội soi bankart khâu phục hồi sụn viền được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = '44b5a77e-1864-eb40-6be8-826849242e44';

UPDATE articles
SET title = 'Gãy đầu dưới xương quay gãy Colles cổ tay: Nắn chỉnh bó bột hay phẫu thuật kết hợp xương nẹp vít',
    slug = 'gay-dau-duoi-xuong-quay-gay-colles-co-tay-nan-chinh-bo-bot-hay-phau-thuat-ket-hop-xuong-nep-vit',
    summary = 'Bài viết chuyên sâu về gãy đầu dưới xương quay gãy colles cổ tay: nắn chỉnh bó bột hay phẫu thuật kết hợp xương nẹp vít được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = '4840c791-f9ef-80bf-68e3-4b1e86c25e40';

UPDATE articles
SET title = 'Chấn thương bong gân mắt cá chân: Phân biệt bong gân độ 1 2 3 với đứt dây chằng cổ chân',
    slug = 'chan-thuong-bong-gan-mat-ca-chan-phan-biet-bong-gan-do-1-2-3-voi-dut-day-chang-co-chan',
    summary = 'Bài viết chuyên sâu về chấn thương bong gân mắt cá chân: phân biệt bong gân độ 1 2 3 với đứt dây chằng cổ chân được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = '4c4bddc0-023e-f683-7870-383944a39982';

UPDATE articles
SET title = 'Hội chứng khoang sau chấn thương gãy xương: Cơn đau dữ dội căng cứng bắp chân cấp cứu rạch giải áp',
    slug = 'hoi-chung-khoang-sau-chan-thuong-gay-xuong-con-dau-du-doi-cang-cung-bap-chan-cap-cuu-rach-giai-ap',
    summary = 'Bài viết chuyên sâu về hội chứng khoang sau chấn thương gãy xương: cơn đau dữ dội căng cứng bắp chân cấp cứu rạch giải áp được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = '6fbdd2ab-f037-b586-8e96-307605eaea1c';

UPDATE articles
SET title = 'Viêm xương tủy xương mạn tính sau chấn thương: Phẫu thuật làm sạch ổ viêm và kháng sinh đồ',
    slug = 'viem-xuong-tuy-xuong-man-tinh-sau-chan-thuong-phau-thuat-lam-sach-o-viem-va-khang-sinh-do',
    summary = 'Bài viết chuyên sâu về viêm xương tủy xương mạn tính sau chấn thương: phẫu thuật làm sạch ổ viêm và kháng sinh đồ được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = '73288f94-1000-e977-c90b-adcfdcccac79';

UPDATE articles
SET title = 'Khớp giả chậm liền xương sau mổ gãy xương: Nguyên nhân thiếu máu nuôi và kỹ thuật ghép xương tự thân',
    slug = 'khop-gia-cham-lien-xuong-sau-mo-gay-xuong-nguyen-nhan-thieu-mau-nuoi-va-ky-thuat-ghep-xuong-tu-than',
    summary = 'Bài viết chuyên sâu về khớp giả chậm liền xương sau mổ gãy xương: nguyên nhân thiếu máu nuôi và kỹ thuật ghép xương tự thân được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = 'ac20c3e3-58b1-dd2c-232f-44bbbedc9537';

UPDATE articles
SET title = 'Chấn thương rách sụn chêm khớp gối: Khi nào khâu bảo tồn sụn chêm, khi nào cắt gọt tạo hình',
    slug = 'chan-thuong-rach-sun-chem-khop-goi-khi-nao-khau-bao-ton-sun-chem-khi-nao-cat-got-tao-hinh',
    summary = 'Bài viết chuyên sâu về chấn thương rách sụn chêm khớp gối: khi nào khâu bảo tồn sụn chêm, khi nào cắt gọt tạo hình được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = 'b15dd0a3-0c98-4d25-fa5b-60cb02872b3c';

UPDATE articles
SET title = 'Gãy xương đòn vai do ngã xe: Chỉ định điều trị bảo tồn băng số 8 và mổ nẹp vít thẩm mỹ',
    slug = 'gay-xuong-don-vai-do-nga-xe-chi-dinh-dieu-tri-bao-ton-bang-so-8-va-mo-nep-vit-tham-my',
    summary = 'Bài viết chuyên sâu về gãy xương đòn vai do ngã xe: chỉ định điều trị bảo tồn băng số 8 và mổ nẹp vít thẩm mỹ được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = 'b6c398e2-3096-00bc-bc77-24b0b81fe03e';

UPDATE articles
SET title = 'Biến dạng ngón chân cái vẹo ngoài Hallux Valgus: Phẫu thuật chỉnh trục xương bàn ngón chân',
    slug = 'bien-dang-ngon-chan-cai-veo-ngoai-hallux-valgus-phau-thuat-chinh-truc-xuong-ban-ngon-chan',
    summary = 'Bài viết chuyên sâu về biến dạng ngón chân cái vẹo ngoài hallux valgus: phẫu thuật chỉnh trục xương bàn ngón chân được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = 'b8f24dd0-3d36-5b00-c8b2-f4f58df88ff1';

UPDATE articles
SET title = 'Đứt gân gót chân Achilles trong thể thao: Phẫu thuật khâu nối gân ít xâm lấn và nẹp cố định',
    slug = 'dut-gan-got-chan-achilles-trong-the-thao-phau-thuat-khau-noi-gan-it-xam-lan-va-nep-co-dinh',
    summary = 'Bài viết chuyên sâu về đứt gân gót chân achilles trong thể thao: phẫu thuật khâu nối gân ít xâm lấn và nẹp cố định được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = 'ba99cb7a-39d8-96b5-c90b-6ba1557cb2b7';

UPDATE articles
SET title = 'Tổn thương chóp xoay khớp vai ở vận động viên: Kỹ thuật nội soi khâu gân cơ trên gai',
    slug = 'ton-thuong-chop-xoay-khop-vai-o-van-dong-vien-ky-thuat-noi-soi-khau-gan-co-tren-gai',
    summary = 'Bài viết chuyên sâu về tổn thương chóp xoay khớp vai ở vận động viên: kỹ thuật nội soi khâu gân cơ trên gai được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = 'dddcf921-9cec-1ba6-9347-d78d5602c67d';

UPDATE articles
SET title = 'Phòng ngừa chấn thương thể thao chạy bộ bóng đá: Tầm quan trọng của khởi động và giày chạy phù hợp',
    slug = 'phong-ngua-chan-thuong-the-thao-chay-bo-bong-da-tam-quan-trong-cua-khoi-dong-va-giay-chay-phu-hop',
    summary = 'Bài viết chuyên sâu về phòng ngừa chấn thương thể thao chạy bộ bóng đá: tầm quan trọng của khởi động và giày chạy phù hợp được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = 'ebdc8404-e9b1-6202-839f-b1b29799b8af';

UPDATE articles
SET title = 'Vật lý trị liệu phục hồi chức năng vận động khớp sau tháo bột bất động gãy xương',
    slug = 'vat-ly-tri-lieu-phuc-hoi-chuc-nang-van-dong-khop-sau-thao-bot-bat-dong-gay-xuong',
    summary = 'Bài viết chuyên sâu về vật lý trị liệu phục hồi chức năng vận động khớp sau tháo bột bất động gãy xương được tham vấn y khoa bởi các chuyên gia Chấn thương chỉnh hình Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg',
    category = 'Chấn thương chỉnh hình'
WHERE id = 'f5abcf2b-487d-857b-36eb-367cdf1255dc';

UPDATE articles
SET title = 'Đục thủy tinh thể cườm khô: Phương pháp phẫu thuật Phaco thay thấu kính nội nhãn hiện đại',
    slug = 'duc-thuy-tinh-the-cuom-kho-phuong-phap-phau-thuat-phaco-thay-thau-kinh-noi-nhan-hien-dai',
    summary = 'Bài viết chuyên sâu về đục thủy tinh thể cườm khô: phương pháp phẫu thuật phaco thay thấu kính nội nhãn hiện đại được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = '0c6a7ba8-d140-f4a9-1a64-af7587eb5206';

UPDATE articles
SET title = 'Tăng nhãn áp Glaucoma cườm nước: Căn bệnh đánh cắp thị lực thầm lặng và đo nhãn áp định kỳ',
    slug = 'tang-nhan-ap-glaucoma-cuom-nuoc-can-benh-danh-cap-thi-luc-tham-lang-va-do-nhan-ap-dinh-ky',
    summary = 'Bài viết chuyên sâu về tăng nhãn áp glaucoma cườm nước: căn bệnh đánh cắp thị lực thầm lặng và đo nhãn áp định kỳ được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = '1b4ccd35-3ea7-fba1-e3cd-34d17f01b1f4';

UPDATE articles
SET title = 'Tật khúc xạ cận thị học đường: Kiểm soát tăng độ cận bằng kính chuyên dụng Ortho-K ban đêm',
    slug = 'tat-khuc-xa-can-thi-hoc-duong-kiem-soat-tang-do-can-bang-kinh-chuyen-dung-ortho-k-ban-dem',
    summary = 'Bài viết chuyên sâu về tật khúc xạ cận thị học đường: kiểm soát tăng độ cận bằng kính chuyên dụng ortho-k ban đêm được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = '1f9b0d09-33c5-ece2-c055-d4f30863cfdf';

UPDATE articles
SET title = 'Hội chứng khô mắt văn phòng: Nguyên nhân chớp mắt ít trước máy tính và bổ sung nước mắt nhân tạo',
    slug = 'hoi-chung-kho-mat-van-phong-nguyen-nhan-chop-mat-it-truoc-may-tinh-va-bo-sung-nuoc-mat-nhan-tao',
    summary = 'Bài viết chuyên sâu về hội chứng khô mắt văn phòng: nguyên nhân chớp mắt ít trước máy tính và bổ sung nước mắt nhân tạo được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = '2ec313a2-a255-f82e-baf2-f17d0df7789f';

UPDATE articles
SET title = 'Bệnh võng mạc đái tháo đường: Khám đáy mắt tầm soát vi phình mạch và laser quang đông võng mạc',
    slug = 'benh-vong-mac-dai-thao-duong-kham-day-mat-tam-soat-vi-phinh-mach-va-laser-quang-dong-vong-mac',
    summary = 'Bài viết chuyên sâu về bệnh võng mạc đái tháo đường: khám đáy mắt tầm soát vi phình mạch và laser quang đông võng mạc được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = '56fd4854-e6fc-4986-b4b3-81ac1eb714b1';

UPDATE articles
SET title = 'Thoái hóa điểm vàng tuổi già AMD: Dấu hiệu nhìn hình biến dạng lượn sóng và tiêm thuốc kháng VEGF',
    slug = 'thoai-hoa-diem-vang-tuoi-gia-amd-dau-hieu-nhin-hinh-bien-dang-luon-song-va-tiem-thuoc-khang-vegf',
    summary = 'Bài viết chuyên sâu về thoái hóa điểm vàng tuổi già amd: dấu hiệu nhìn hình biến dạng lượn sóng và tiêm thuốc kháng vegf được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = '5d55204d-f31b-79c2-666e-487f78eae418';

UPDATE articles
SET title = 'Viêm kết mạc đau mắt đỏ: Cách phân biệt nhiễm khuẩn với virus và quy tắc phòng ngừa lây lan',
    slug = 'viem-ket-mac-dau-mat-do-cach-phan-biet-nhiem-khuan-voi-virus-va-quy-tac-phong-ngua-lay-lan',
    summary = 'Bài viết chuyên sâu về viêm kết mạc đau mắt đỏ: cách phân biệt nhiễm khuẩn với virus và quy tắc phòng ngừa lây lan được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = '612e6580-4cc3-df3a-26e6-0087ef76779e';

UPDATE articles
SET title = 'Bong võng mạc cấp tính: Dấu hiệu thấy chớp sáng ruồi bay kèm bóng đen che khuất tầm nhìn cấp cứu',
    slug = 'bong-vong-mac-cap-tinh-dau-hieu-thay-chop-sang-ruoi-bay-kem-bong-den-che-khuat-tam-nhin-cap-cuu',
    summary = 'Bài viết chuyên sâu về bong võng mạc cấp tính: dấu hiệu thấy chớp sáng ruồi bay kèm bóng đen che khuất tầm nhìn cấp cứu được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = '77799ea8-feb6-9b9f-5600-9ee538cc010e';

UPDATE articles
SET title = 'Mộng thịt và mộng mỡ mắt: Chỉ định phẫu thuật ghép mộng kết mạc tự thân ngừa tái phát',
    slug = 'mong-thit-va-mong-mo-mat-chi-dinh-phau-thuat-ghep-mong-ket-mac-tu-than-ngua-tai-phat',
    summary = 'Bài viết chuyên sâu về mộng thịt và mộng mỡ mắt: chỉ định phẫu thuật ghép mộng kết mạc tự thân ngừa tái phát được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'a3b80587-f392-0f76-1845-2558b3e4f71b';

UPDATE articles
SET title = 'Viêm loét giác mạc do kính áp tròng: Quy tắc vệ sinh lens vô trùng và dấu hiệu đau nhức chảy nước mắt',
    slug = 'viem-loet-giac-mac-do-kinh-ap-trong-quy-tac-ve-sinh-lens-vo-trung-va-dau-hieu-dau-nhuc-chay-nuoc-mat',
    summary = 'Bài viết chuyên sâu về viêm loét giác mạc do kính áp tròng: quy tắc vệ sinh lens vô trùng và dấu hiệu đau nhức chảy nước mắt được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'a3dd352d-371a-ada7-bdc7-1bb04f137752';

UPDATE articles
SET title = 'Xuất huyết dưới kết mạc vỡ mạch máu mắt: Phân biệt đốm đỏ lành tính với chấn thương nhãn cầu',
    slug = 'xuat-huyet-duoi-ket-mac-vo-mach-mau-mat-phan-biet-dom-do-lanh-tinh-voi-chan-thuong-nhan-cau',
    summary = 'Bài viết chuyên sâu về xuất huyết dưới kết mạc vỡ mạch máu mắt: phân biệt đốm đỏ lành tính với chấn thương nhãn cầu được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'afdfc664-1663-6aa7-535c-abab39805af0';

UPDATE articles
SET title = 'Tắc tĩnh mạch trung tâm võng mạc: Nguyên nhân gây mờ mắt đột ngột ở người tăng huyết áp',
    slug = 'tac-tinh-mach-trung-tam-vong-mac-nguyen-nhan-gay-mo-mat-dot-ngot-o-nguoi-tang-huyet-ap',
    summary = 'Bài viết chuyên sâu về tắc tĩnh mạch trung tâm võng mạc: nguyên nhân gây mờ mắt đột ngột ở người tăng huyết áp được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'b1241d4c-7989-8c03-9ee1-dafd1e0ca647';

UPDATE articles
SET title = 'Nhược thị ở trẻ em: Phát hiện mắt lác lé, chênh lệch độ khúc xạ và cơ hội điều trị vàng trước 7 tuổi',
    slug = 'nhuoc-thi-o-tre-em-phat-hien-mat-lac-le-chenh-lech-do-khuc-xa-va-co-hoi-dieu-tri-vang-truoc-7-tuoi',
    summary = 'Bài viết chuyên sâu về nhược thị ở trẻ em: phát hiện mắt lác lé, chênh lệch độ khúc xạ và cơ hội điều trị vàng trước 7 tuổi được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'c83f720a-d83c-cc95-d915-ca8304737647';

UPDATE articles
SET title = 'Chắp và lẹo mắt: Cách chườm ấm làm thông tắc tuyến bã Meibomius và tiểu phẫu rạch lẹo',
    slug = 'chap-va-leo-mat-cach-chuom-am-lam-thong-tac-tuyen-ba-meibomius-va-tieu-phau-rach-leo',
    summary = 'Bài viết chuyên sâu về chắp và lẹo mắt: cách chườm ấm làm thông tắc tuyến bã meibomius và tiểu phẫu rạch lẹo được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'cfc81196-7aea-d184-5ac2-2d40dd99af19';

UPDATE articles
SET title = 'Phẫu thuật khúc xạ mổ cận SMILE Femto-Lasik: Tiêu chí giác mạc đủ điều kiện phẫu thuật an toàn',
    slug = 'phau-thuat-khuc-xa-mo-can-smile-femto-lasik-tieu-chi-giac-mac-du-dieu-kien-phau-thuat-an-toan',
    summary = 'Bài viết chuyên sâu về phẫu thuật khúc xạ mổ cận smile femto-lasik: tiêu chí giác mạc đủ điều kiện phẫu thuật an toàn được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'dc4416cd-4c81-502d-4f0e-db846ab0e276';

UPDATE articles
SET title = 'Đo thị trường và chụp cắt lớp OCT bán phần sau nhãn cầu: Đánh giá lớp sợi thần kinh thị giác',
    slug = 'do-thi-truong-va-chup-cat-lop-oct-ban-phan-sau-nhan-cau-danh-gia-lop-soi-than-kinh-thi-giac',
    summary = 'Bài viết chuyên sâu về đo thị trường và chụp cắt lớp oct bán phần sau nhãn cầu: đánh giá lớp sợi thần kinh thị giác được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'f533b108-f188-00d7-90b4-b6e0e023feef';

UPDATE articles
SET title = 'Bảo vệ mắt trước tác hại của tia cực tím UV và quy tắc 20-20-20 khi làm việc với màn hình',
    slug = 'bao-ve-mat-truoc-tac-hai-cua-tia-cuc-tim-uv-va-quy-tac-20-20-20-khi-lam-viec-voi-man-hinh',
    summary = 'Bài viết chuyên sâu về bảo vệ mắt trước tác hại của tia cực tím uv và quy tắc 20-20-20 khi làm việc với màn hình được tham vấn y khoa bởi các chuyên gia Mắt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85',
    category = 'Mắt'
WHERE id = 'fa7c4966-af50-d411-b28f-0ee7a3fec6e2';

UPDATE articles
SET title = 'Tầm soát ung thư định kỳ: Danh mục gói khám phát hiện sớm các bệnh ung thư phổ biến nhất',
    slug = 'tam-soat-ung-thu-dinh-ky-danh-muc-goi-kham-phat-hien-som-cac-benh-ung-thu-pho-bien-nhat',
    summary = 'Bài viết chuyên sâu về tầm soát ung thư định kỳ: danh mục gói khám phát hiện sớm các bệnh ung thư phổ biến nhất được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = '11a321cb-ec7f-dcc9-b98d-f64da9d378ae';

UPDATE articles
SET title = 'Ung thư vú: Tự khám vú hàng tháng, chụp X-quang tuyến vú Mammography và sinh thiết lõi kim',
    slug = 'ung-thu-vu-tu-kham-vu-hang-thang-chup-x-quang-tuyen-vu-mammography-va-sinh-thiet-loi-kim',
    summary = 'Bài viết chuyên sâu về ung thư vú: tự khám vú hàng tháng, chụp x-quang tuyến vú mammography và sinh thiết lõi kim được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = '1d625988-0cb3-4305-3ca4-309dbb83d7e6';

UPDATE articles
SET title = 'Ung thư phổi: Dấu hiệu ho khan sụt cân khó thở và phẫu thuật nội soi lồng ngực VATS cắt thùy',
    slug = 'ung-thu-phoi-dau-hieu-ho-khan-sut-can-kho-tho-va-phau-thuat-noi-soi-long-nguc-vats-cat-thuy',
    summary = 'Bài viết chuyên sâu về ung thư phổi: dấu hiệu ho khan sụt cân khó thở và phẫu thuật nội soi lồng ngực vats cắt thùy được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = '549feee9-772a-e0e0-c667-d6f7bf79f14d';

UPDATE articles
SET title = 'Ung thư gan nguyên phát HCC: Tầm soát định kỳ bằng siêu âm và xét nghiệm AFP ở người viêm gan B',
    slug = 'ung-thu-gan-nguyen-phat-hcc-tam-soat-dinh-ky-bang-sieu-am-va-xet-nghiem-afp-o-nguoi-viem-gan-b',
    summary = 'Bài viết chuyên sâu về ung thư gan nguyên phát hcc: tầm soát định kỳ bằng siêu âm và xét nghiệm afp ở người viêm gan b được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = '7e3f8352-49c6-4d93-bd25-6f3e9552c076';

UPDATE articles
SET title = 'Ung thư dạ dày đại trực tràng: Giá trị vàng của nội soi tiêu hóa phát hiện tổn thương sớm',
    slug = 'ung-thu-da-day-dai-truc-trang-gia-tri-vang-cua-noi-soi-tieu-hoa-phat-hien-ton-thuong-som',
    summary = 'Bài viết chuyên sâu về ung thư dạ dày đại trực tràng: giá trị vàng của nội soi tiêu hóa phát hiện tổn thương sớm được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = '8694950c-88f1-24a6-eab3-f646234ac716';

UPDATE articles
SET title = 'Ung thư tuyến giáp thể nhú: Tiên lượng điều trị khả quan và phẫu thuật cắt tuyến giáp vét hạch',
    slug = 'ung-thu-tuyen-giap-the-nhu-tien-luong-dieu-tri-kha-quan-va-phau-thuat-cat-tuyen-giap-vet-hach',
    summary = 'Bài viết chuyên sâu về ung thư tuyến giáp thể nhú: tiên lượng điều trị khả quan và phẫu thuật cắt tuyến giáp vét hạch được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = '9b231b00-1459-d4fa-b66a-2454ee28ba65';

UPDATE articles
SET title = 'Ung thư cổ tử cung: Phòng ngừa chủ động bằng tiêm vắc xin HPV và điều trị giai đoạn tiền xâm lấn',
    slug = 'ung-thu-co-tu-cung-phong-ngua-chu-dong-bang-tiem-vac-xin-hpv-va-dieu-tri-giai-doan-tien-xam-lan',
    summary = 'Bài viết chuyên sâu về ung thư cổ tử cung: phòng ngừa chủ động bằng tiêm vắc xin hpv và điều trị giai đoạn tiền xâm lấn được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'a4fececc-dd7c-b74c-1449-d15188609ec9';

UPDATE articles
SET title = 'Hóa trị liệu trong điều trị ung thư: Kiểm soát tác dụng phụ buồn nôn, rụng tóc và hạ bạch cầu',
    slug = 'hoa-tri-lieu-trong-dieu-tri-ung-thu-kiem-soat-tac-dung-phu-buon-non-rung-toc-va-ha-bach-cau',
    summary = 'Bài viết chuyên sâu về hóa trị liệu trong điều trị ung thư: kiểm soát tác dụng phụ buồn nôn, rụng tóc và hạ bạch cầu được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'c4113ec0-bac4-4928-fb72-3f40fe2e0930';

UPDATE articles
SET title = 'Xạ trị gia tốc tuyến tính kỹ thuật cao IMRT: Tiêu diệt khối u chính xác bảo vệ mô lành xung quanh',
    slug = 'xa-tri-gia-toc-tuyen-tinh-ky-thuat-cao-imrt-tieu-diet-khoi-u-chinh-xac-bao-ve-mo-lanh-xung-quanh',
    summary = 'Bài viết chuyên sâu về xạ trị gia tốc tuyến tính kỹ thuật cao imrt: tiêu diệt khối u chính xác bảo vệ mô lành xung quanh được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'cfdf7a34-7810-8fe1-63e8-462d090a1bb0';

UPDATE articles
SET title = 'Liệu pháp nhắm trúng đích Targeted Therapy: Điều trị dựa trên đột biến gen EGFR ALK KRAS',
    slug = 'lieu-phap-nham-trung-dich-targeted-therapy-dieu-tri-dua-tren-dot-bien-gen-egfr-alk-kras',
    summary = 'Bài viết chuyên sâu về liệu pháp nhắm trúng đích targeted therapy: điều trị dựa trên đột biến gen egfr alk kras được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'd6b15ad0-5851-acfc-04e0-cae41296b148';

UPDATE articles
SET title = 'Liệu pháp miễn dịch trong ung thư: Cơ chế ức chế chốt kiểm soát miễn dịch PD-1 PD-L1 hiện đại',
    slug = 'lieu-phap-mien-dich-trong-ung-thu-co-che-uc-che-chot-kiem-soat-mien-dich-pd-1-pd-l1-hien-dai',
    summary = 'Bài viết chuyên sâu về liệu pháp miễn dịch trong ung thư: cơ chế ức chế chốt kiểm soát miễn dịch pd-1 pd-l1 hiện đại được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'd85b73b1-2fa8-00a0-5d03-d715bdbba616';

UPDATE articles
SET title = 'Chăm sóc giảm nhẹ cho bệnh nhân ung thư giai đoạn tiến xa: Kiểm soát cơn đau bằng thuốc Opioid',
    slug = 'cham-soc-giam-nhe-cho-benh-nhan-ung-thu-giai-doan-tien-xa-kiem-soat-con-dau-bang-thuoc-opioid',
    summary = 'Bài viết chuyên sâu về chăm sóc giảm nhẹ cho bệnh nhân ung thư giai đoạn tiến xa: kiểm soát cơn đau bằng thuốc opioid được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'dba6b78f-04d7-450a-6ff8-d65d4becfbf1';

UPDATE articles
SET title = 'Dinh dưỡng chuyên biệt cho người bệnh ung thư: Chế độ ăn giàu năng lượng đạm chống suy mòn',
    slug = 'dinh-duong-chuyen-biet-cho-nguoi-benh-ung-thu-che-do-an-giau-nang-luong-dam-chong-suy-mon',
    summary = 'Bài viết chuyên sâu về dinh dưỡng chuyên biệt cho người bệnh ung thư: chế độ ăn giàu năng lượng đạm chống suy mòn được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'e6ba5dc8-2fdd-7854-270c-1f92f4111d9b';

UPDATE articles
SET title = 'Các dấu ấn ung thư Tumor Markers CEA CA19-9 CA125: Hiểu đúng về giá trị theo dõi điều trị',
    slug = 'cac-dau-an-ung-thu-tumor-markers-cea-ca19-9-ca125-hieu-dung-ve-gia-tri-theo-doi-dieu-tri',
    summary = 'Bài viết chuyên sâu về các dấu ấn ung thư tumor markers cea ca19-9 ca125: hiểu đúng về giá trị theo dõi điều trị được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'f536fb4b-ad0d-0e68-8f87-337620e62349';

UPDATE articles
SET title = 'Ung thư vòm họng: Nhận biết dấu hiệu nghẹt mũi một bên, khạc đờm nhầy máu và nổi hạch cổ',
    slug = 'ung-thu-vom-hong-nhan-biet-dau-hieu-nghet-mui-mot-ben-khac-dom-nhay-mau-va-noi-hach-co',
    summary = 'Bài viết chuyên sâu về ung thư vòm họng: nhận biết dấu hiệu nghẹt mũi một bên, khạc đờm nhầy máu và nổi hạch cổ được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'f62f1007-3383-3947-cbc9-d39e44592b5d';

UPDATE articles
SET title = 'Ung thư xương nguyên phát và di căn xương: Dấu hiệu đau nhức xương ban đêm và chụp xạ hình xương',
    slug = 'ung-thu-xuong-nguyen-phat-va-di-can-xuong-dau-hieu-dau-nhuc-xuong-ban-dem-va-chup-xa-hinh-xuong',
    summary = 'Bài viết chuyên sâu về ung thư xương nguyên phát và di căn xương: dấu hiệu đau nhức xương ban đêm và chụp xạ hình xương được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'fab1a71e-3e68-dd32-14f3-f36d11c45dd3';

UPDATE articles
SET title = 'Phục hồi chức năng tâm lý và thể chất cho người bệnh sau phẫu thuật điều trị ung thư vú',
    slug = 'phuc-hoi-chuc-nang-tam-ly-va-the-chat-cho-nguoi-benh-sau-phau-thuat-dieu-tri-ung-thu-vu',
    summary = 'Bài viết chuyên sâu về phục hồi chức năng tâm lý và thể chất cho người bệnh sau phẫu thuật điều trị ung thư vú được tham vấn y khoa bởi các chuyên gia Ung bướu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85',
    category = 'Ung bướu'
WHERE id = 'fc8c2735-2191-de30-bb1d-72fadf2b8ba5';

UPDATE articles
SET title = 'Trào ngược dạ dày thực quản GERD: Triệu chứng ợ chua và phác đồ giảm tiết axit',
    slug = 'trao-nguoc-da-day-thuc-quan-gerd-trieu-chung-o-chua-va-phac-do-giam-tiet-axit',
    summary = 'Bài viết chuyên sâu về trào ngược dạ dày thực quản gerd: triệu chứng ợ chua và phác đồ giảm tiết axit được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '1260b25a-b17f-73ff-558d-75907f09067c';

UPDATE articles
SET title = 'Viêm loét dạ dày tá tràng nhiễm khuẩn HP: Phác đồ tiệt trừ kháng sinh thế hệ mới',
    slug = 'viem-loet-da-day-ta-trang-nhiem-khuan-hp-phac-do-tiet-tru-khang-sinh-the-he-moi',
    summary = 'Bài viết chuyên sâu về viêm loét dạ dày tá tràng nhiễm khuẩn hp: phác đồ tiệt trừ kháng sinh thế hệ mới được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '2de95496-3ce2-e04a-7dae-8e948ced2172';

UPDATE articles
SET title = 'Nội soi tiêu hóa không đau: Ứng dụng công nghệ nhuộm màu NBI phát hiện tổn thương tiền ung thư',
    slug = 'noi-soi-tieu-hoa-khong-dau-ung-dung-cong-nghe-nhuom-mau-nbi-phat-hien-ton-thuong-tien-ung-thu',
    summary = 'Bài viết chuyên sâu về nội soi tiêu hóa không đau: ứng dụng công nghệ nhuộm màu nbi phát hiện tổn thương tiền ung thư được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '30ca45b2-e170-1269-7cc1-56d13a45c9d2';

UPDATE articles
SET title = 'Hội chứng ruột kích thích IBS: Phân biệt đau quặn bụng cơ năng và viêm ruột thực thể',
    slug = 'hoi-chung-ruot-kich-thich-ibs-phan-biet-dau-quan-bung-co-nang-va-viem-ruot-thuc-the',
    summary = 'Bài viết chuyên sâu về hội chứng ruột kích thích ibs: phân biệt đau quặn bụng cơ năng và viêm ruột thực thể được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '317df7f8-3dd1-3b2b-497d-8a08aac55852';

UPDATE articles
SET title = 'Polyp đại trực tràng: Tầm soát định kỳ và kỹ thuật cắt polyp qua nội soi mềm',
    slug = 'polyp-dai-truc-trang-tam-soat-dinh-ky-va-ky-thuat-cat-polyp-qua-noi-soi-mem',
    summary = 'Bài viết chuyên sâu về polyp đại trực tràng: tầm soát định kỳ và kỹ thuật cắt polyp qua nội soi mềm được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '34276045-5cd9-177f-ef87-4ac0ecd62e3b';

UPDATE articles
SET title = 'Gan nhiễm mỡ không do rượu NAFLD: Đánh giá độ xơ hóa gan qua kỹ thuật FibroScan',
    slug = 'gan-nhiem-mo-khong-do-ruou-nafld-danh-gia-do-xo-hoa-gan-qua-ky-thuat-fibroscan',
    summary = 'Bài viết chuyên sâu về gan nhiễm mỡ không do rượu nafld: đánh giá độ xơ hóa gan qua kỹ thuật fibroscan được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '56982e37-1f27-1943-e251-90af22307c8f';

UPDATE articles
SET title = 'Viêm gan virus B mạn tính: Chỉ định điều trị thuốc kháng virus và theo dõi tải lượng HBV',
    slug = 'viem-gan-virus-b-man-tinh-chi-dinh-dieu-tri-thuoc-khang-virus-va-theo-doi-tai-luong-hbv',
    summary = 'Bài viết chuyên sâu về viêm gan virus b mạn tính: chỉ định điều trị thuốc kháng virus và theo dõi tải lượng hbv được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '690ece73-2810-72e0-6311-d1b81ac447cc';

UPDATE articles
SET title = 'Viêm gan virus C: Phác đồ điều trị khỏi hoàn toàn bằng thuốc kháng virus tác động trực tiếp DAA',
    slug = 'viem-gan-virus-c-phac-do-dieu-tri-khoi-hoan-toan-bang-thuoc-khang-virus-tac-dong-truc-tiep-daa',
    summary = 'Bài viết chuyên sâu về viêm gan virus c: phác đồ điều trị khỏi hoàn toàn bằng thuốc kháng virus tác động trực tiếp daa được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '74c17f20-a92f-245e-9f08-b124ceb27765';

UPDATE articles
SET title = 'Sỏi túi mật và viêm túi mật cấp: Khi nào có chỉ định phẫu thuật nội soi cắt túi mật',
    slug = 'soi-tui-mat-va-viem-tui-mat-cap-khi-nao-co-chi-dinh-phau-thuat-noi-soi-cat-tui-mat',
    summary = 'Bài viết chuyên sâu về sỏi túi mật và viêm túi mật cấp: khi nào có chỉ định phẫu thuật nội soi cắt túi mật được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '771aad04-d218-b5e3-5d11-c5531732e3ab';

UPDATE articles
SET title = 'Viêm tụy cấp: Nguyên nhân do rượu bia, tăng triglycerid và phác đồ hồi sức dịch sớm',
    slug = 'viem-tuy-cap-nguyen-nhan-do-ruou-bia-tang-triglycerid-va-phac-do-hoi-suc-dich-som',
    summary = 'Bài viết chuyên sâu về viêm tụy cấp: nguyên nhân do rượu bia, tăng triglycerid và phác đồ hồi sức dịch sớm được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '7b98a5bb-db20-a8c0-645a-9d159f16449a';

UPDATE articles
SET title = 'Xuất huyết tiêu hóa trên: Nhận biết dấu hiệu nôn ra máu, đi ngoài phân đen cấp cứu',
    slug = 'xuat-huyet-tieu-hoa-tren-nhan-biet-dau-hieu-non-ra-mau-di-ngoai-phan-den-cap-cuu',
    summary = 'Bài viết chuyên sâu về xuất huyết tiêu hóa trên: nhận biết dấu hiệu nôn ra máu, đi ngoài phân đen cấp cứu được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '8d58dd8d-1508-ac83-d332-d676d6912bf6';

UPDATE articles
SET title = 'Viêm loét đại tràng chảy máu: Phác đồ kiểm soát đợt cấp và duy trì lui bệnh',
    slug = 'viem-loet-dai-trang-chay-mau-phac-do-kiem-soat-dot-cap-va-duy-tri-lui-benh',
    summary = 'Bài viết chuyên sâu về viêm loét đại tràng chảy máu: phác đồ kiểm soát đợt cấp và duy trì lui bệnh được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = '8e595f2d-3d4d-7a8a-479f-439abaebf602';

UPDATE articles
SET title = 'Táo bón mạn tính: Bổ sung chất xơ hòa tan và tập luyện phản xạ đại tiện sinh lý',
    slug = 'tao-bon-man-tinh-bo-sung-chat-xo-hoa-tan-va-tap-luyen-phan-xa-dai-tien-sinh-ly',
    summary = 'Bài viết chuyên sâu về táo bón mạn tính: bổ sung chất xơ hòa tan và tập luyện phản xạ đại tiện sinh lý được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = 'c3fd0a01-6bd2-518e-77cd-3e9a2c252fa3';

UPDATE articles
SET title = 'Đầy hơi chướng bụng khó tiêu chức năng: Vai trò của hệ vi sinh đường ruột và men tiêu hóa',
    slug = 'day-hoi-chuong-bung-kho-tieu-chuc-nang-vai-tro-cua-he-vi-sinh-duong-ruot-va-men-tieu-hoa',
    summary = 'Bài viết chuyên sâu về đầy hơi chướng bụng khó tiêu chức năng: vai trò của hệ vi sinh đường ruột và men tiêu hóa được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = 'c69948fd-9440-5b86-08c8-9e1bc0294cfb';

UPDATE articles
SET title = 'Test hơi thở C13 chẩn đoán vi khuẩn Helicobacter Pylori không xâm lấn',
    slug = 'test-hoi-tho-c13-chan-doan-vi-khuan-helicobacter-pylori-khong-xam-lan',
    summary = 'Bài viết chuyên sâu về test hơi thở c13 chẩn đoán vi khuẩn helicobacter pylori không xâm lấn được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = 'e86df505-7290-32c0-c722-fe3c636239c8';

UPDATE articles
SET title = 'Bóc tách dưới niêm mạc ESD qua nội soi: Điều trị ung thư đường tiêu hóa giai đoạn sớm',
    slug = 'boc-tach-duoi-niem-mac-esd-qua-noi-soi-dieu-tri-ung-thu-duong-tieu-hoa-giai-doan-som',
    summary = 'Bài viết chuyên sâu về bóc tách dưới niêm mạc esd qua nội soi: điều trị ung thư đường tiêu hóa giai đoạn sớm được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = 'ea0d840c-0149-62f7-680f-e5ce49e48a81';

UPDATE articles
SET title = 'Chế độ ăn Low-FODMAP: Giải pháp giảm khó chịu tiêu hóa cho người có đại tràng nhạy cảm',
    slug = 'che-do-an-low-fodmap-giai-phap-giam-kho-chiu-tieu-hoa-cho-nguoi-co-dai-trang-nhay-cam',
    summary = 'Bài viết chuyên sâu về chế độ ăn low-fodmap: giải pháp giảm khó chịu tiêu hóa cho người có đại tràng nhạy cảm được tham vấn y khoa bởi các chuyên gia Tiêu hóa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/viem-loet-da-day.jpg',
    category = 'Tiêu hóa'
WHERE id = 'f29c6aef-0dad-3028-acf2-df2075ac7d80';

UPDATE articles
SET title = 'Bệnh phổi tắc nghẽn mạn tính COPD: Triệu chứng khó thở khi gắng sức và đo chức năng thông khí',
    slug = 'benh-phoi-tac-nghen-man-tinh-copd-trieu-chung-kho-tho-khi-gang-suc-va-do-chuc-nang-thong-khi',
    summary = 'Bài viết chuyên sâu về bệnh phổi tắc nghẽn mạn tính copd: triệu chứng khó thở khi gắng sức và đo chức năng thông khí được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '1361ec3d-55bd-9d3e-4884-314195ee08c2';

UPDATE articles
SET title = 'Hen phế quản người lớn: Nhận biết yếu tố khởi phát cơn hen cấp và kiểm soát bằng ICS-LABA',
    slug = 'hen-phe-quan-nguoi-lon-nhan-biet-yeu-to-khoi-phat-con-hen-cap-va-kiem-soat-bang-ics-laba',
    summary = 'Bài viết chuyên sâu về hen phế quản người lớn: nhận biết yếu tố khởi phát cơn hen cấp và kiểm soát bằng ics-laba được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '150348f5-2f7e-538e-ddc4-627434bb2c0c';

UPDATE articles
SET title = 'Viêm phổi mắc phải cộng đồng: Dấu hiệu sốt cao, ho đờm đục, đau ngực kiểu màng phổi',
    slug = 'viem-phoi-mac-phai-cong-dong-dau-hieu-sot-cao-ho-dom-duc-dau-nguc-kieu-mang-phoi',
    summary = 'Bài viết chuyên sâu về viêm phổi mắc phải cộng đồng: dấu hiệu sốt cao, ho đờm đục, đau ngực kiểu màng phổi được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '245879e8-a5ca-95cb-2521-3b0548a0fee1';

UPDATE articles
SET title = 'Hội chứng ngừng thở khi ngủ do tắc nghẽn OSAS: Dấu hiệu ngủ ngáy to, mệt mỏi ban ngày và thở CPAP',
    slug = 'hoi-chung-ngung-tho-khi-ngu-do-tac-nghen-osas-dau-hieu-ngu-ngay-to-met-moi-ban-ngay-va-tho-cpap',
    summary = 'Bài viết chuyên sâu về hội chứng ngừng thở khi ngủ do tắc nghẽn osas: dấu hiệu ngủ ngáy to, mệt mỏi ban ngày và thở cpap được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '2cc3b0ec-0731-b5b2-13fc-9c4ba288551f';

UPDATE articles
SET title = 'Nội soi phế quản ống mềm: Giá trị sinh thiết u phế quản và hút rửa phế nang chẩn đoán',
    slug = 'noi-soi-phe-quan-ong-mem-gia-tri-sinh-thiet-u-phe-quan-va-hut-rua-phe-nang-chan-doan',
    summary = 'Bài viết chuyên sâu về nội soi phế quản ống mềm: giá trị sinh thiết u phế quản và hút rửa phế nang chẩn đoán được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '3be4d6c4-c024-d559-0978-098bd3dcfe21';

UPDATE articles
SET title = 'Tràn dịch màng phổi: Triệu chứng đau tức ngực hụt hơi và chọc hút dịch màng phổi xét nghiệm',
    slug = 'tran-dich-mang-phoi-trieu-chung-dau-tuc-nguc-hut-hoi-va-choc-hut-dich-mang-phoi-xet-nghiem',
    summary = 'Bài viết chuyên sâu về tràn dịch màng phổi: triệu chứng đau tức ngực hụt hơi và chọc hút dịch màng phổi xét nghiệm được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '4418de7f-0f76-08b5-0018-a8534ff32df8';

UPDATE articles
SET title = 'Xơ phổi vô căn IPF: Nhận diện tiếng ran nổ đáy phổi và chụp CT phổi liều thấp',
    slug = 'xo-phoi-vo-can-ipf-nhan-dien-tieng-ran-no-day-phoi-va-chup-ct-phoi-lieu-thap',
    summary = 'Bài viết chuyên sâu về xơ phổi vô căn ipf: nhận diện tiếng ran nổ đáy phổi và chụp ct phổi liều thấp được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '4907296f-79b5-ae7a-88c2-fd77877afc15';

UPDATE articles
SET title = 'Lao phổi: Dấu hiệu ho kéo dài trên 2 tuần, sốt nhẹ về chiều và xét nghiệm đờm tìm AFB GeneXpert',
    slug = 'lao-phoi-dau-hieu-ho-keo-dai-tren-2-tuan-sot-nhe-ve-chieu-va-xet-nghiem-dom-tim-afb-genexpert',
    summary = 'Bài viết chuyên sâu về lao phổi: dấu hiệu ho kéo dài trên 2 tuần, sốt nhẹ về chiều và xét nghiệm đờm tìm afb genexpert được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '577cf4ee-dbde-9079-b022-93acfcad899e';

UPDATE articles
SET title = 'Viêm phế quản cấp: Phân biệt ho do virus với nhiễm khuẩn và không lạm dụng kháng sinh',
    slug = 'viem-phe-quan-cap-phan-biet-ho-do-virus-voi-nhiem-khuan-va-khong-lam-dung-khang-sinh',
    summary = 'Bài viết chuyên sâu về viêm phế quản cấp: phân biệt ho do virus với nhiễm khuẩn và không lạm dụng kháng sinh được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '6f6e9f8e-779b-2d4b-0c4c-e6180a4b8e3b';

UPDATE articles
SET title = 'Tầm soát ung thư phổi: Giá trị của chụp cắt lớp vi tính lồng ngực liều thấp LDCT cho người hút thuốc',
    slug = 'tam-soat-ung-thu-phoi-gia-tri-cua-chup-cat-lop-vi-tinh-long-nguc-lieu-thap-ldct-cho-nguoi-hut-thuoc',
    summary = 'Bài viết chuyên sâu về tầm soát ung thư phổi: giá trị của chụp cắt lớp vi tính lồng ngực liều thấp ldct cho người hút thuốc được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '738fc532-cde7-0873-d45a-3c5a4f5de7d2';

UPDATE articles
SET title = 'Giãn phế quản: Triệu chứng ho khạc đờm nhiều mạn tính và kỹ thuật dẫn lưu tư thế vỗ rung',
    slug = 'gian-phe-quan-trieu-chung-ho-khac-dom-nhieu-man-tinh-va-ky-thuat-dan-luu-tu-the-vo-rung',
    summary = 'Bài viết chuyên sâu về giãn phế quản: triệu chứng ho khạc đờm nhiều mạn tính và kỹ thuật dẫn lưu tư thế vỗ rung được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '85a8fbcb-97ae-d573-b992-23e76e95029c';

UPDATE articles
SET title = 'Bệnh bụi phổi nghề nghiệp: Tác hại của hạt bụi than silic amiăng và biện pháp bảo hộ lao động',
    slug = 'benh-bui-phoi-nghe-nghiep-tac-hai-cua-hat-bui-than-silic-amiang-va-bien-phap-bao-ho-lao-dong',
    summary = 'Bài viết chuyên sâu về bệnh bụi phổi nghề nghiệp: tác hại của hạt bụi than silic amiăng và biện pháp bảo hộ lao động được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '958fe3c9-de7d-7508-4f54-088372d8e06c';

UPDATE articles
SET title = 'Ho mạn tính kéo dài: Tìm kiếm căn nguyên trào ngược dạ dày, viêm mũi xoang và hen dạng ho',
    slug = 'ho-man-tinh-keo-dai-tim-kiem-can-nguyen-trao-nguoc-da-day-viem-mui-xoang-va-hen-dang-ho',
    summary = 'Bài viết chuyên sâu về ho mạn tính kéo dài: tìm kiếm căn nguyên trào ngược dạ dày, viêm mũi xoang và hen dạng ho được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = '9f01caa9-2fdb-057e-b086-380feae218aa';

UPDATE articles
SET title = 'Đo chức năng hô hấp Spirometry: Hướng dẫn kỹ thuật hít sâu thổi mạnh kiểm tra thể tích phổi',
    slug = 'do-chuc-nang-ho-hap-spirometry-huong-dan-ky-thuat-hit-sau-thoi-manh-kiem-tra-the-tich-phoi',
    summary = 'Bài viết chuyên sâu về đo chức năng hô hấp spirometry: hướng dẫn kỹ thuật hít sâu thổi mạnh kiểm tra thể tích phổi được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = 'b2e7f5e1-49d3-699e-4f6d-6cc98d2652ad';

UPDATE articles
SET title = 'Nhiễm nấm phổi Aspergillus: Nhận diện triệu chứng ho ra máu ở người có hang lao cũ',
    slug = 'nhiem-nam-phoi-aspergillus-nhan-dien-trieu-chung-ho-ra-mau-o-nguoi-co-hang-lao-cu',
    summary = 'Bài viết chuyên sâu về nhiễm nấm phổi aspergillus: nhận diện triệu chứng ho ra máu ở người có hang lao cũ được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = 'b9a375e5-6cf8-96e1-42ba-26b21e65f6c6';

UPDATE articles
SET title = 'Tràn khí màng phổi tự phát: Cơn đau ngực đột ngột nhói buốt và đặt ống dẫn lưu màng phổi',
    slug = 'tran-khi-mang-phoi-tu-phat-con-dau-nguc-dot-ngot-nhoi-buot-va-dat-ong-dan-luu-mang-phoi',
    summary = 'Bài viết chuyên sâu về tràn khí màng phổi tự phát: cơn đau ngực đột ngột nhói buốt và đặt ống dẫn lưu màng phổi được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = 'bf0d822d-7323-f14a-a458-d8e24686cec6';

UPDATE articles
SET title = 'Tập thở cơ hoành và chúm môi: Bài tập thở hiệu quả tăng dung tích sống cho người bệnh hô hấp',
    slug = 'tap-tho-co-hoanh-va-chum-moi-bai-tap-tho-hieu-qua-tang-dung-tich-song-cho-nguoi-benh-ho-hap',
    summary = 'Bài viết chuyên sâu về tập thở cơ hoành và chúm môi: bài tập thở hiệu quả tăng dung tích sống cho người bệnh hô hấp được tham vấn y khoa bởi các chuyên gia Hô hấp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85',
    category = 'Hô hấp'
WHERE id = 'ed7c3faf-d75e-8d3a-4260-d8c094172058';

UPDATE articles
SET title = 'Mụn trứng cá tuổi dậy thì và người lớn: Phác đồ bôi Retinoid, kháng sinh và chăm sóc da dầu',
    slug = 'mun-trung-ca-tuoi-day-thi-va-nguoi-lon-phac-do-boi-retinoid-khang-sinh-va-cham-soc-da-dau',
    summary = 'Bài viết chuyên sâu về mụn trứng cá tuổi dậy thì và người lớn: phác đồ bôi retinoid, kháng sinh và chăm sóc da dầu được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = '14f4ed61-1864-d9a4-3e42-f6ddf35706fe';

UPDATE articles
SET title = 'Viêm da cơ địa dị ứng Eczema: Dưỡng ẩm phục hồi hàng rào bảo vệ da và kiểm soát ngứa',
    slug = 'viem-da-co-dia-di-ung-eczema-duong-am-phuc-hoi-hang-rao-bao-ve-da-va-kiem-soat-ngua',
    summary = 'Bài viết chuyên sâu về viêm da cơ địa dị ứng eczema: dưỡng ẩm phục hồi hàng rào bảo vệ da và kiểm soát ngứa được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = '2f246e75-5264-98eb-df1c-e2bb0a0df051';

UPDATE articles
SET title = 'Bệnh vảy nến Plaque Psoriasis: Cơ chế tự miễn sinh học và liệu pháp chiếu ánh sáng UVB',
    slug = 'benh-vay-nen-plaque-psoriasis-co-che-tu-mien-sinh-hoc-va-lieu-phap-chieu-anh-sang-uvb',
    summary = 'Bài viết chuyên sâu về bệnh vảy nến plaque psoriasis: cơ chế tự miễn sinh học và liệu pháp chiếu ánh sáng uvb được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = '36b9f51f-fb02-6c5b-8bda-520cee895165';

UPDATE articles
SET title = 'Nhiễm nấm da nấm móng: Nhận diện tổn thương tròn viền đỏ ngứa và phác đồ kháng nấm tại chỗ',
    slug = 'nhiem-nam-da-nam-mong-nhan-dien-ton-thuong-tron-vien-do-ngua-va-phac-do-khang-nam-tai-cho',
    summary = 'Bài viết chuyên sâu về nhiễm nấm da nấm móng: nhận diện tổn thương tròn viền đỏ ngứa và phác đồ kháng nấm tại chỗ được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = '3ab87fed-4056-a505-9cd1-59f03af860af';

UPDATE articles
SET title = 'Zona thần kinh Herpes Zoster: Dấu hiệu mụn nước mọc thành chùm một bên cơ thể và thuốc Acyclovir sớm',
    slug = 'zona-than-kinh-herpes-zoster-dau-hieu-mun-nuoc-moc-thanh-chum-mot-ben-co-the-va-thuoc-acyclovir-som',
    summary = 'Bài viết chuyên sâu về zona thần kinh herpes zoster: dấu hiệu mụn nước mọc thành chùm một bên cơ thể và thuốc acyclovir sớm được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = '43d86c50-d133-22f6-3dad-d50da8e79431';

UPDATE articles
SET title = 'Mề đay dị ứng mạn tính: Tìm kiếm căn nguyên dị nguyên và liệu trình kháng Histamin thế hệ 2',
    slug = 'me-day-di-ung-man-tinh-tim-kiem-can-nguyen-di-nguyen-va-lieu-trinh-khang-histamin-the-he-2',
    summary = 'Bài viết chuyên sâu về mề đay dị ứng mạn tính: tìm kiếm căn nguyên dị nguyên và liệu trình kháng histamin thế hệ 2 được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = '582cac3c-a4af-811e-a532-b912eb3fe686';

UPDATE articles
SET title = 'Viêm da tiếp xúc kích ứng: Cách ly hóa chất tẩy rửa, kim loại niken và bôi kem dịu da',
    slug = 'viem-da-tiep-xuc-kich-ung-cach-ly-hoa-chat-tay-rua-kim-loai-niken-va-boi-kem-diu-da',
    summary = 'Bài viết chuyên sâu về viêm da tiếp xúc kích ứng: cách ly hóa chất tẩy rửa, kim loại niken và bôi kem dịu da được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = '7aec12cf-f3b8-07b2-778f-7abb7c11bf7a';

UPDATE articles
SET title = 'Bệnh rụng tóc từng mảng Alopecia Areata: Liệu pháp tiêm Corticoid tại chỗ kích thích nang tóc',
    slug = 'benh-rung-toc-tung-mang-alopecia-areata-lieu-phap-tiem-corticoid-tai-cho-kich-thich-nang-toc',
    summary = 'Bài viết chuyên sâu về bệnh rụng tóc từng mảng alopecia areata: liệu pháp tiêm corticoid tại chỗ kích thích nang tóc được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = '8b5c2a9c-f560-df37-7071-4b67a6378084';

UPDATE articles
SET title = 'Tầm soát ung thư hắc tố da Melanoma: Quy tắc ABCDE kiểm tra các nốt ruồi bất thường',
    slug = 'tam-soat-ung-thu-hac-to-da-melanoma-quy-tac-abcde-kiem-tra-cac-not-ruoi-bat-thuong',
    summary = 'Bài viết chuyên sâu về tầm soát ung thư hắc tố da melanoma: quy tắc abcde kiểm tra các nốt ruồi bất thường được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'a6438164-c063-55f1-1181-dcf90b65751b';

UPDATE articles
SET title = 'Dày sừng ánh sáng và tổn thương tiền ung thư da: Phòng ngừa bằng kem chống nắng phổ rộng',
    slug = 'day-sung-anh-sang-va-ton-thuong-tien-ung-thu-da-phong-ngua-bang-kem-chong-nang-pho-rong',
    summary = 'Bài viết chuyên sâu về dày sừng ánh sáng và tổn thương tiền ung thư da: phòng ngừa bằng kem chống nắng phổ rộng được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'ace22ee4-2d49-b677-44b4-977331b5b14e';

UPDATE articles
SET title = 'Nhiễm ghẻ Scabies: Dấu hiệu ngứa dữ dội về đêm, rãnh ghẻ kẽ tay và điều trị đồng loạt gia đình',
    slug = 'nhiem-ghe-scabies-dau-hieu-ngua-du-doi-ve-dem-ranh-ghe-ke-tay-va-dieu-tri-dong-loat-gia-dinh',
    summary = 'Bài viết chuyên sâu về nhiễm ghẻ scabies: dấu hiệu ngứa dữ dội về đêm, rãnh ghẻ kẽ tay và điều trị đồng loạt gia đình được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'bc5a2d46-9038-3192-076d-0cb7b4f083d8';

UPDATE articles
SET title = 'Bệnh bạch biến Vitiligo: Cơ chế mất tế bào sắc tố melanocyte và liệu pháp quang học',
    slug = 'benh-bach-bien-vitiligo-co-che-mat-te-bao-sac-to-melanocyte-va-lieu-phap-quang-hoc',
    summary = 'Bài viết chuyên sâu về bệnh bạch biến vitiligo: cơ chế mất tế bào sắc tố melanocyte và liệu pháp quang học được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'c175f4bc-764a-0c93-046d-d5074248d2b6';

UPDATE articles
SET title = 'Viêm nang lông chân lông đốm đỏ: Vệ sinh da sau tập thể thao và hạn chế mặc quần áo bó sát',
    slug = 'viem-nang-long-chan-long-dom-do-ve-sinh-da-sau-tap-the-thao-va-han-che-mac-quan-ao-bo-sat',
    summary = 'Bài viết chuyên sâu về viêm nang lông chân lông đốm đỏ: vệ sinh da sau tập thể thao và hạn chế mặc quần áo bó sát được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'cb7053f6-316b-c153-b38a-e91e8cfcb0e2';

UPDATE articles
SET title = 'Lão hóa da do ánh nắng Photoaging: Vai trò của chất chống oxy hóa Vitamin C và chống nắng hàng ngày',
    slug = 'lao-hoa-da-do-anh-nang-photoaging-vai-tro-cua-chat-chong-oxy-hoa-vitamin-c-va-chong-nang-hang-ngay',
    summary = 'Bài viết chuyên sâu về lão hóa da do ánh nắng photoaging: vai trò của chất chống oxy hóa vitamin c và chống nắng hàng ngày được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'e4e2f981-9d01-beb0-f02a-22e54cdbc2fd';

UPDATE articles
SET title = 'Sẹo lồi sẹo phì đại: Kỹ thuật tiêm triamcinolone vi điểm làm phẳng mô sẹo',
    slug = 'seo-loi-seo-phi-dai-ky-thuat-tiem-triamcinolone-vi-diem-lam-phang-mo-seo',
    summary = 'Bài viết chuyên sâu về sẹo lồi sẹo phì đại: kỹ thuật tiêm triamcinolone vi điểm làm phẳng mô sẹo được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'e8c258b3-b6b6-463f-aa0c-0d5e7b5ccd1d';

UPDATE articles
SET title = 'Thủy đậu ở người trưởng thành: Cách phòng ngừa biến chứng viêm phổi và chăm sóc nốt đậu',
    slug = 'thuy-dau-o-nguoi-truong-thanh-cach-phong-ngua-bien-chung-viem-phoi-va-cham-soc-not-dau',
    summary = 'Bài viết chuyên sâu về thủy đậu ở người trưởng thành: cách phòng ngừa biến chứng viêm phổi và chăm sóc nốt đậu được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'e97dccd7-6cf6-2b7a-3969-92505cc812d0';

UPDATE articles
SET title = 'Viêm da dầu tiết bã: Dấu hiệu vảy vàng vùng rãnh mũi má, da đầu và dầu gội trị nấm',
    slug = 'viem-da-dau-tiet-ba-dau-hieu-vay-vang-vung-ranh-mui-ma-da-dau-va-dau-goi-tri-nam',
    summary = 'Bài viết chuyên sâu về viêm da dầu tiết bã: dấu hiệu vảy vàng vùng rãnh mũi má, da đầu và dầu gội trị nấm được tham vấn y khoa bởi các chuyên gia Da liễu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85',
    category = 'Da liễu'
WHERE id = 'ff2160da-2a21-5683-a512-c573a3977f2b';

UPDATE articles
SET title = 'Suy giãn tĩnh mạch chi dưới mạn tính: Dấu hiệu nặng chân nổi gân xanh và phương pháp laser nội mạch EVLA',
    slug = 'suy-gian-tinh-mach-chi-duoi-man-tinh-dau-hieu-nang-chan-noi-gan-xanh-va-phuong-phap-laser-noi-mach-evla',
    summary = 'Bài viết chuyên sâu về suy giãn tĩnh mạch chi dưới mạn tính: dấu hiệu nặng chân nổi gân xanh và phương pháp laser nội mạch evla được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '155eb7f7-d70d-ed56-0274-871d92614ebd';

UPDATE articles
SET title = 'Huyết khối tĩnh mạch sâu chi dưới DVT: Nguy cơ biến chứng thuyên tắc phổi và thuốc chống đông',
    slug = 'huyet-khoi-tinh-mach-sau-chi-duoi-dvt-nguy-co-bien-chung-thuyen-tac-phoi-va-thuoc-chong-dong',
    summary = 'Bài viết chuyên sâu về huyết khối tĩnh mạch sâu chi dưới dvt: nguy cơ biến chứng thuyên tắc phổi và thuốc chống đông được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '1823be69-d368-de75-2c1c-10a05d26011f';

UPDATE articles
SET title = 'Bệnh xơ vữa động mạch chi dưới: Dấu hiệu đi khập khiễng cách hồi đau buốt ngón chân và can thiệp nong mạch',
    slug = 'benh-xo-vua-dong-mach-chi-duoi-dau-hieu-di-khap-khieng-cach-hoi-dau-buot-ngon-chan-va-can-thiep-nong-mach',
    summary = 'Bài viết chuyên sâu về bệnh xơ vữa động mạch chi dưới: dấu hiệu đi khập khiễng cách hồi đau buốt ngón chân và can thiệp nong mạch được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '30bf770f-266b-322e-8629-997c02805198';

UPDATE articles
SET title = 'Phình động mạch chủ bụng AAA: Nguy cơ vỡ đột ngột và kỹ thuật can thiệp đặt Stent-Graft nội mạch EVAR',
    slug = 'phinh-dong-mach-chu-bung-aaa-nguy-co-vo-dot-ngot-va-ky-thuat-can-thiep-dat-stent-graft-noi-mach-evar',
    summary = 'Bài viết chuyên sâu về phình động mạch chủ bụng aaa: nguy cơ vỡ đột ngột và kỹ thuật can thiệp đặt stent-graft nội mạch evar được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '3dc0b0ea-ef59-13a5-6627-a0be3655425f';

UPDATE articles
SET title = 'Hẹp động mạch cảnh: Nguy cơ gây cơn thiếu máu não thoáng qua TIA và đặt stent động mạch cảnh',
    slug = 'hep-dong-mach-canh-nguy-co-gay-con-thieu-mau-nao-thoang-qua-tia-va-dat-stent-dong-mach-canh',
    summary = 'Bài viết chuyên sâu về hẹp động mạch cảnh: nguy cơ gây cơn thiếu máu não thoáng qua tia và đặt stent động mạch cảnh được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '423aa14d-b0a7-f8b0-5154-c083b8395bbb';

UPDATE articles
SET title = 'Viêm tắc động mạch đầu chi bệnh Buerger: Tác hại của khói thuốc lá gây hoại tử đầu ngón tay chân',
    slug = 'viem-tac-dong-mach-dau-chi-benh-buerger-tac-hai-cua-khoi-thuoc-la-gay-hoai-tu-dau-ngon-tay-chan',
    summary = 'Bài viết chuyên sâu về viêm tắc động mạch đầu chi bệnh buerger: tác hại của khói thuốc lá gây hoại tử đầu ngón tay chân được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '6aa4b76f-288e-b0de-22b1-47ef47282da9';

UPDATE articles
SET title = 'Hội chứng Raynaud co thắt mạch đầu chi: Dấu hiệu ngón tay tái trắng tím xanh khi gặp lạnh',
    slug = 'hoi-chung-raynaud-co-that-mach-dau-chi-dau-hieu-ngon-tay-tai-trang-tim-xanh-khi-gap-lanh',
    summary = 'Bài viết chuyên sâu về hội chứng raynaud co thắt mạch đầu chi: dấu hiệu ngón tay tái trắng tím xanh khi gặp lạnh được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '705d7ea8-0c3f-9d14-3978-0c99c4e56575';

UPDATE articles
SET title = 'Dị dạng mạch máu bẩm sinh u máu thể hang: Phác đồ nút mạch xơ hóa và theo dõi phát triển',
    slug = 'di-dang-mach-mau-bam-sinh-u-mau-the-hang-phac-do-nut-mach-xo-hoa-va-theo-doi-phat-trien',
    summary = 'Bài viết chuyên sâu về dị dạng mạch máu bẩm sinh u máu thể hang: phác đồ nút mạch xơ hóa và theo dõi phát triển được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '7a906ac9-c0ed-9326-8fed-b7eb59d50748';

UPDATE articles
SET title = 'Tắc động mạch chi cấp tính: Cơn đau nhức dữ dội mất mạch chi lạnh cấp cứu tái tưới máu trong 6 giờ',
    slug = 'tac-dong-mach-chi-cap-tinh-con-dau-nhuc-du-doi-mat-mach-chi-lanh-cap-cuu-tai-tuoi-mau-trong-6-gio',
    summary = 'Bài viết chuyên sâu về tắc động mạch chi cấp tính: cơn đau nhức dữ dội mất mạch chi lạnh cấp cứu tái tưới máu trong 6 giờ được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '7d96639c-9a08-02b8-08ff-b4f3e23f618a';

UPDATE articles
SET title = 'Suy van tĩnh mạch sâu chi dưới: Hướng dẫn mang vớ y khoa áp lực chuẩn và bài tập bơm tĩnh mạch',
    slug = 'suy-van-tinh-mach-sau-chi-duoi-huong-dan-mang-vo-y-khoa-ap-luc-chuan-va-bai-tap-bom-tinh-mach',
    summary = 'Bài viết chuyên sâu về suy van tĩnh mạch sâu chi dưới: hướng dẫn mang vớ y khoa áp lực chuẩn và bài tập bơm tĩnh mạch được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '8c5a778c-db67-82ec-87a3-4b1d8f763ada';

UPDATE articles
SET title = 'Tạo cầu nối thông động tĩnh mạch AVF cho bệnh nhân chạy thận nhân tạo: Chăm sóc bảo vệ đường mổ',
    slug = 'tao-cau-noi-thong-dong-tinh-mach-avf-cho-benh-nhan-chay-than-nhan-tao-cham-soc-bao-ve-duong-mo',
    summary = 'Bài viết chuyên sâu về tạo cầu nối thông động tĩnh mạch avf cho bệnh nhân chạy thận nhân tạo: chăm sóc bảo vệ đường mổ được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = '9955a7e4-b164-2a41-ab3c-385327fc4d1e';

UPDATE articles
SET title = 'Viêm động mạch Takayasu: Bệnh lý viêm tự miễn mạch máu lớn ở phụ nữ trẻ và thuốc ức chế miễn dịch',
    slug = 'viem-dong-mach-takayasu-benh-ly-viem-tu-mien-mach-mau-lon-o-phu-nu-tre-va-thuoc-uc-che-mien-dich',
    summary = 'Bài viết chuyên sâu về viêm động mạch takayasu: bệnh lý viêm tự miễn mạch máu lớn ở phụ nữ trẻ và thuốc ức chế miễn dịch được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = 'bd095926-910a-adde-4629-1997fdacd6fc';

UPDATE articles
SET title = 'Siêu âm Doppler màu mạch máu chi dưới: Tiêu chuẩn vàng đánh giá dòng chảy và huyết khối',
    slug = 'sieu-am-doppler-mau-mach-mau-chi-duoi-tieu-chuan-vang-danh-gia-dong-chay-va-huyet-khoi',
    summary = 'Bài viết chuyên sâu về siêu âm doppler màu mạch máu chi dưới: tiêu chuẩn vàng đánh giá dòng chảy và huyết khối được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = 'caa3c662-143f-9a0b-31ba-c2f98301a890';

UPDATE articles
SET title = 'Loét da do ứ trệ tĩnh mạch: Quy tắc băng ép điều trị phù nề và chăm sóc vết loét lâu liền',
    slug = 'loet-da-do-u-tre-tinh-mach-quy-tac-bang-ep-dieu-tri-phu-ne-va-cham-soc-vet-loet-lau-lien',
    summary = 'Bài viết chuyên sâu về loét da do ứ trệ tĩnh mạch: quy tắc băng ép điều trị phù nề và chăm sóc vết loét lâu liền được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = 'cd72b1db-3032-aecc-3311-9e124e47834b';

UPDATE articles
SET title = 'Bảo vệ sức khỏe mạch máu: Kiểm soát huyết áp mỡ máu và hạn chế thói quen ngồi đứng một chỗ lâu',
    slug = 'bao-ve-suc-khoe-mach-mau-kiem-soat-huyet-ap-mo-mau-va-han-che-thoi-quen-ngoi-dung-mot-cho-lau',
    summary = 'Bài viết chuyên sâu về bảo vệ sức khỏe mạch máu: kiểm soát huyết áp mỡ máu và hạn chế thói quen ngồi đứng một chỗ lâu được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = 'd63825ba-c79c-242d-c5be-088677ed815c';

UPDATE articles
SET title = 'Can thiệp nút mạch phình mạch tạng: Điều trị ít xâm lấn phình động mạch lách động mạch thận',
    slug = 'can-thiep-nut-mach-phinh-mach-tang-dieu-tri-it-xam-lan-phinh-dong-mach-lach-dong-mach-than',
    summary = 'Bài viết chuyên sâu về can thiệp nút mạch phình mạch tạng: điều trị ít xâm lấn phình động mạch lách động mạch thận được tham vấn y khoa bởi các chuyên gia Nội mạch máu Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg',
    category = 'Nội mạch máu'
WHERE id = 'd9ad7baf-5c90-3811-b81d-1e2d4c9d9524';

UPDATE articles
SET title = 'Phẫu thuật nội soi cắt ruột thừa viêm: Quy trình can thiệp ít xâm lấn và hồi phục sau mổ',
    slug = 'phau-thuat-noi-soi-cat-ruot-thua-viem-quy-trinh-can-thiep-it-xam-lan-va-hoi-phuc-sau-mo',
    summary = 'Bài viết chuyên sâu về phẫu thuật nội soi cắt ruột thừa viêm: quy trình can thiệp ít xâm lấn và hồi phục sau mổ được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '157c2c62-88ad-dfaa-7189-9cda22c08295';

UPDATE articles
SET title = 'Thoát vị bẹn ở nam giới: Phương pháp đặt lưới nhân tạo không căng ngừa tái phát',
    slug = 'thoat-vi-ben-o-nam-gioi-phuong-phap-dat-luoi-nhan-tao-khong-cang-ngua-tai-phat',
    summary = 'Bài viết chuyên sâu về thoát vị bẹn ở nam giới: phương pháp đặt lưới nhân tạo không căng ngừa tái phát được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '1a098312-770f-7f67-0562-b4d591fdb4e1';

UPDATE articles
SET title = 'Phẫu thuật cắt trĩ bằng phương pháp Longo: Giảm đau nhanh rút ngắn thời gian nằm viện',
    slug = 'phau-thuat-cat-tri-bang-phuong-phap-longo-giam-dau-nhanh-rut-ngan-thoi-gian-nam-vien',
    summary = 'Bài viết chuyên sâu về phẫu thuật cắt trĩ bằng phương pháp longo: giảm đau nhanh rút ngắn thời gian nằm viện được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '2571ddcf-124f-5349-9e0c-ef468234920d';

UPDATE articles
SET title = 'Rò hậu môn và áp xe quanh hậu môn: Kỹ thuật phẫu thuật mở đường rò và bảo tồn cơ thắt',
    slug = 'ro-hau-mon-va-ap-xe-quanh-hau-mon-ky-thuat-phau-thuat-mo-duong-ro-va-bao-ton-co-that',
    summary = 'Bài viết chuyên sâu về rò hậu môn và áp xe quanh hậu môn: kỹ thuật phẫu thuật mở đường rò và bảo tồn cơ thắt được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '41aff26f-7d17-de1a-6714-0bfd55787f6f';

UPDATE articles
SET title = 'Bỏng nhiệt và bỏng hóa chất: Sơ cứu làm mát vết bỏng dưới vòi nước sạch 20 phút đầu tiên',
    slug = 'bong-nhiet-va-bong-hoa-chat-so-cuu-lam-mat-vet-bong-duoi-voi-nuoc-sach-20-phut-dau-tien',
    summary = 'Bài viết chuyên sâu về bỏng nhiệt và bỏng hóa chất: sơ cứu làm mát vết bỏng dưới vòi nước sạch 20 phút đầu tiên được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '4d948be8-f5b0-d27e-375d-d30154f1e37c';

UPDATE articles
SET title = 'Chăm sóc vết thương hở và nhiễm trùng ngoại khoa: Quy trình thay băng rửa vết thương vô trùng',
    slug = 'cham-soc-vet-thuong-ho-va-nhiem-trung-ngoai-khoa-quy-trinh-thay-bang-rua-vet-thuong-vo-trung',
    summary = 'Bài viết chuyên sâu về chăm sóc vết thương hở và nhiễm trùng ngoại khoa: quy trình thay băng rửa vết thương vô trùng được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '52ea491f-1835-e7fa-ce90-970f9e34fd39';

UPDATE articles
SET title = 'Phẫu thuật nội soi u nang buồng trứng và u nang mạc treo: Kỹ thuật bóc tách an toàn',
    slug = 'phau-thuat-noi-soi-u-nang-buong-trung-va-u-nang-mac-treo-ky-thuat-boc-tach-an-toan',
    summary = 'Bài viết chuyên sâu về phẫu thuật nội soi u nang buồng trứng và u nang mạc treo: kỹ thuật bóc tách an toàn được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '7d60b595-87df-d0b6-73bc-ebba414da1be';

UPDATE articles
SET title = 'Khối u mô mềm dưới da u bã đậu u mỡ: Tiểu phẫu cắt bỏ trọn bao chống tái phát',
    slug = 'khoi-u-mo-mem-duoi-da-u-ba-dau-u-mo-tieu-phau-cat-bo-tron-bao-chong-tai-phat',
    summary = 'Bài viết chuyên sâu về khối u mô mềm dưới da u bã đậu u mỡ: tiểu phẫu cắt bỏ trọn bao chống tái phát được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '85aeb15e-c083-b52d-bb29-31a584948e45';

UPDATE articles
SET title = 'Nhiễm trùng vết mổ sau phẫu thuật: Nhận biết dấu hiệu sưng nóng đỏ chảy dịch và cấy khuẩn',
    slug = 'nhiem-trung-vet-mo-sau-phau-thuat-nhan-biet-dau-hieu-sung-nong-do-chay-dich-va-cay-khuan',
    summary = 'Bài viết chuyên sâu về nhiễm trùng vết mổ sau phẫu thuật: nhận biết dấu hiệu sưng nóng đỏ chảy dịch và cấy khuẩn được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = '8c776edf-aecd-0f93-3243-e0006ee88c03';

UPDATE articles
SET title = 'Hẹp môn vị dạ dày do loét xơ chai: Dấu hiệu nôn ra thức ăn cũ và phẫu thuật nối vị tràng',
    slug = 'hep-mon-vi-da-day-do-loet-xo-chai-dau-hieu-non-ra-thuc-an-cu-va-phau-thuat-noi-vi-trang',
    summary = 'Bài viết chuyên sâu về hẹp môn vị dạ dày do loét xơ chai: dấu hiệu nôn ra thức ăn cũ và phẫu thuật nối vị tràng được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = 'a6da715d-3c55-ff7d-f400-e95a1470103c';

UPDATE articles
SET title = 'Tắc ruột cơ học: Nhận biết 4 triệu chứng kinh điển đau nôn bí chướng bụng cấp cứu ngoại khoa',
    slug = 'tac-ruot-co-hoc-nhan-biet-4-trieu-chung-kinh-dien-dau-non-bi-chuong-bung-cap-cuu-ngoai-khoa',
    summary = 'Bài viết chuyên sâu về tắc ruột cơ học: nhận biết 4 triệu chứng kinh điển đau nôn bí chướng bụng cấp cứu ngoại khoa được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = 'ac9df87c-d040-99ef-d1f9-4696a3febd60';

UPDATE articles
SET title = 'Chấn thương bụng kín dập lách vỡ gan: Theo dõi sát huyết động và chỉ định can thiệp nút mạch',
    slug = 'chan-thuong-bung-kin-dap-lach-vo-gan-theo-doi-sat-huyet-dong-va-chi-dinh-can-thiep-nut-mach',
    summary = 'Bài viết chuyên sâu về chấn thương bụng kín dập lách vỡ gan: theo dõi sát huyết động và chỉ định can thiệp nút mạch được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = 'd1438b05-efeb-efb7-07b5-3faf09f6bd42';

UPDATE articles
SET title = 'Thoát vị rốn và thoát vị vết mổ cũ: Kỹ thuật phục hồi thành bụng bằng lưới sinh học',
    slug = 'thoat-vi-ron-va-thoat-vi-vet-mo-cu-ky-thuat-phuc-hoi-thanh-bung-bang-luoi-sinh-hoc',
    summary = 'Bài viết chuyên sâu về thoát vị rốn và thoát vị vết mổ cũ: kỹ thuật phục hồi thành bụng bằng lưới sinh học được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = 'da08a028-4c18-1097-dfa2-27732fb30b6f';

UPDATE articles
SET title = 'Phẫu thuật lồng ngực nội soi điều trị tràn mồ hôi tay: Kỹ thuật đốt hạch giao cảm ngực an toàn',
    slug = 'phau-thuat-long-nguc-noi-soi-dieu-tri-tran-mo-hoi-tay-ky-thuat-dot-hach-giao-cam-nguc-an-toan',
    summary = 'Bài viết chuyên sâu về phẫu thuật lồng ngực nội soi điều trị tràn mồ hôi tay: kỹ thuật đốt hạch giao cảm ngực an toàn được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = 'daf2789e-915a-8516-6d0e-97ec685fe867';

UPDATE articles
SET title = 'Chuẩn bị bệnh nhân trước phẫu thuật: Quy tắc nhịn ăn uống gây mê và vệ sinh da vùng mổ',
    slug = 'chuan-bi-benh-nhan-truoc-phau-thuat-quy-tac-nhin-an-uong-gay-me-va-ve-sinh-da-vung-mo',
    summary = 'Bài viết chuyên sâu về chuẩn bị bệnh nhân trước phẫu thuật: quy tắc nhịn ăn uống gây mê và vệ sinh da vùng mổ được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = 'dd493f3c-7f09-a28d-2984-519cb8a3f840';

UPDATE articles
SET title = 'Giảm đau đa mô thức sau phẫu thuật: Kết hợp gây tê vùng và thuốc giảm đau kiểm soát êm dịu',
    slug = 'giam-dau-da-mo-thuc-sau-phau-thuat-ket-hop-gay-te-vung-va-thuoc-giam-dau-kiem-soat-em-diu',
    summary = 'Bài viết chuyên sâu về giảm đau đa mô thức sau phẫu thuật: kết hợp gây tê vùng và thuốc giảm đau kiểm soát êm dịu được tham vấn y khoa bởi các chuyên gia Ngoại khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Ngoại khoa'
WHERE id = 'edd83604-8648-cb5a-7088-02723dd773c6';

UPDATE articles
SET title = 'Sàng lọc trước sinh NIPT: Đánh giá dị tật nhiễm sắc thể Down Edwards Patau an toàn từ tuần 9',
    slug = 'sang-loc-truoc-sinh-nipt-danh-gia-di-tat-nhiem-sac-the-down-edwards-patau-an-toan-tu-tuan-9',
    summary = 'Bài viết chuyên sâu về sàng lọc trước sinh nipt: đánh giá dị tật nhiễm sắc thể down edwards patau an toàn từ tuần 9 được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '1b4559e0-aef4-ceea-8256-bc1b93d70c4f';

UPDATE articles
SET title = 'Đái tháo đường thai kỳ: Nghiệm pháp dung nạp 75g glucose và phác đồ điều hòa đường huyết',
    slug = 'dai-thao-duong-thai-ky-nghiem-phap-dung-nap-75g-glucose-va-phac-do-dieu-hoa-duong-huyet',
    summary = 'Bài viết chuyên sâu về đái tháo đường thai kỳ: nghiệm pháp dung nạp 75g glucose và phác đồ điều hòa đường huyết được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '2ee81716-60d2-8b55-e9ae-8a5896528f52';

UPDATE articles
SET title = 'Tiền sản giật và tăng huyết áp thai kỳ: Theo dõi chỉ số huyết áp, protein niệu và dấu hiệu phù',
    slug = 'tien-san-giat-va-tang-huyet-ap-thai-ky-theo-doi-chi-so-huyet-ap-protein-nieu-va-dau-hieu-phu',
    summary = 'Bài viết chuyên sâu về tiền sản giật và tăng huyết áp thai kỳ: theo dõi chỉ số huyết áp, protein niệu và dấu hiệu phù được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '339338ed-b028-041f-d67b-43484e4286ab';

UPDATE articles
SET title = 'Tầm soát ung thư cổ tử cung: Kết hợp xét nghiệm HPV DNA và phết tế bào cổ tử cung ThinPrep',
    slug = 'tam-soat-ung-thu-co-tu-cung-ket-hop-xet-nghiem-hpv-dna-va-phet-te-bao-co-tu-cung-thinprep',
    summary = 'Bài viết chuyên sâu về tầm soát ung thư cổ tử cung: kết hợp xét nghiệm hpv dna và phết tế bào cổ tử cung thinprep được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '4ebddf4f-49e2-61b2-fe49-1b4f39f0c57a';

UPDATE articles
SET title = 'U xơ tử cung: Phân loại kích thước vị trí và chỉ định can thiệp phẫu thuật bóc u xơ',
    slug = 'u-xo-tu-cung-phan-loai-kich-thuoc-vi-tri-va-chi-dinh-can-thiep-phau-thuat-boc-u-xo',
    summary = 'Bài viết chuyên sâu về u xơ tử cung: phân loại kích thước vị trí và chỉ định can thiệp phẫu thuật bóc u xơ được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '5409adba-e859-c11e-1117-80766430439c';

UPDATE articles
SET title = 'U nang buồng trứng thực thể và cơ năng: Phân biệt qua siêu âm Doppler phụ khoa',
    slug = 'u-nang-buong-trung-thuc-the-va-co-nang-phan-biet-qua-sieu-am-doppler-phu-khoa',
    summary = 'Bài viết chuyên sâu về u nang buồng trứng thực thể và cơ năng: phân biệt qua siêu âm doppler phụ khoa được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '63d743cc-29fa-dd63-ec82-86b45fc14639';

UPDATE articles
SET title = 'Hội chứng buồng trứng đa nang PCOS: Dấu hiệu kinh nguyệt thưa, rậm lông và tư vấn sinh sản',
    slug = 'hoi-chung-buong-trung-da-nang-pcos-dau-hieu-kinh-nguyet-thua-ram-long-va-tu-van-sinh-san',
    summary = 'Bài viết chuyên sâu về hội chứng buồng trứng đa nang pcos: dấu hiệu kinh nguyệt thưa, rậm lông và tư vấn sinh sản được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '667b77e6-a615-d6cc-5804-c33a0b3f578b';

UPDATE articles
SET title = 'Viêm âm đạo do nấm Candida: Dấu hiệu ngứa rát, khí hư vón cục và phác đồ đặt thuốc đúng liệu trình',
    slug = 'viem-am-dao-do-nam-candida-dau-hieu-ngua-rat-khi-hu-von-cuc-va-phac-do-dat-thuoc-dung-lieu-trinh',
    summary = 'Bài viết chuyên sâu về viêm âm đạo do nấm candida: dấu hiệu ngứa rát, khí hư vón cục và phác đồ đặt thuốc đúng liệu trình được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '67f8def6-8b68-e040-9a15-7625ad73f2cf';

UPDATE articles
SET title = 'Mang thai ngoài tử cung: Nhận diện cơn đau nhói hạ vị kèm trễ kinh ra máu nâu đen',
    slug = 'mang-thai-ngoai-tu-cung-nhan-dien-con-dau-nhoi-ha-vi-kem-tre-kinh-ra-mau-nau-den',
    summary = 'Bài viết chuyên sâu về mang thai ngoài tử cung: nhận diện cơn đau nhói hạ vị kèm trễ kinh ra máu nâu đen được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '72da17e1-b5cc-a25c-8b95-2529e15675a6';

UPDATE articles
SET title = 'Theo dõi chuyển dạ tự nhiên: Nhận biết cơn gò tử cung đều đặn và thời điểm nhập viện sinh',
    slug = 'theo-doi-chuyen-da-tu-nhien-nhan-biet-con-go-tu-cung-deu-dan-va-thoi-diem-nhap-vien-sinh',
    summary = 'Bài viết chuyên sâu về theo dõi chuyển dạ tự nhiên: nhận biết cơn gò tử cung đều đặn và thời điểm nhập viện sinh được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '7716d827-0f2a-d945-ea96-c5d40cae34fe';

UPDATE articles
SET title = 'Chăm sóc mẹ sau sinh mổ: Vệ sinh vết may mổ, phòng ngừa nhiễm trùng và tắc tia sữa',
    slug = 'cham-soc-me-sau-sinh-mo-ve-sinh-vet-may-mo-phong-ngua-nhiem-trung-va-tac-tia-sua',
    summary = 'Bài viết chuyên sâu về chăm sóc mẹ sau sinh mổ: vệ sinh vết may mổ, phòng ngừa nhiễm trùng và tắc tia sữa được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '78012ffd-9ad3-16f4-043a-340d86ed373d';

UPDATE articles
SET title = 'Tiền mãn kinh và mãn kinh: Liệu pháp bổ sung nội tiết thực vật và phòng ngừa loãng xương',
    slug = 'tien-man-kinh-va-man-kinh-lieu-phap-bo-sung-noi-tiet-thuc-vat-va-phong-ngua-loang-xuong',
    summary = 'Bài viết chuyên sâu về tiền mãn kinh và mãn kinh: liệu pháp bổ sung nội tiết thực vật và phòng ngừa loãng xương được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = '7eb34fb9-d920-fd0c-0da4-044bc56ae231';

UPDATE articles
SET title = 'Viêm lộ tuyến cổ tử cung: Khi nào cần điều trị nội khoa, khi nào có chỉ định đốt điện lạnh',
    slug = 'viem-lo-tuyen-co-tu-cung-khi-nao-can-dieu-tri-noi-khoa-khi-nao-co-chi-dinh-dot-dien-lanh',
    summary = 'Bài viết chuyên sâu về viêm lộ tuyến cổ tử cung: khi nào cần điều trị nội khoa, khi nào có chỉ định đốt điện lạnh được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = 'aef3a2a6-2719-2b80-4a67-74c04bdc833f';

UPDATE articles
SET title = 'Tắc vòi trứng và vô sinh hiếm muộn: Chụp tử cung vòi trứng HSG đánh giá độ thông thoáng',
    slug = 'tac-voi-trung-va-vo-sinh-hiem-muon-chup-tu-cung-voi-trung-hsg-danh-gia-do-thong-thoang',
    summary = 'Bài viết chuyên sâu về tắc vòi trứng và vô sinh hiếm muộn: chụp tử cung vòi trứng hsg đánh giá độ thông thoáng được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = 'b008f772-5038-4b5b-f934-e3a476b6a115';

UPDATE articles
SET title = 'Siêu âm thai 4D hình thái học tuần 12 tuần 22 tuần 32: Tầm soát dị tật cấu trúc thai nhi',
    slug = 'sieu-am-thai-4d-hinh-thai-hoc-tuan-12-tuan-22-tuan-32-tam-soat-di-tat-cau-truc-thai-nhi',
    summary = 'Bài viết chuyên sâu về siêu âm thai 4d hình thái học tuần 12 tuần 22 tuần 32: tầm soát dị tật cấu trúc thai nhi được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = 'ca82806a-b556-fd46-a7bc-ecd8d9b63ecd';

UPDATE articles
SET title = 'Sảy thai liên tiếp: Tìm hiểu nguyên nhân hội chứng kháng phospholipid và bất đồng nhóm máu',
    slug = 'say-thai-lien-tiep-tim-hieu-nguyen-nhan-hoi-chung-khang-phospholipid-va-bat-dong-nhom-mau',
    summary = 'Bài viết chuyên sâu về sảy thai liên tiếp: tìm hiểu nguyên nhân hội chứng kháng phospholipid và bất đồng nhóm máu được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = 'd1576dd1-4652-a37e-77df-f455bf9b2f0a';

UPDATE articles
SET title = 'Dinh dưỡng thai kỳ theo từng tam cá nguyệt: Bổ sung axit folic, sắt canxi và DHA hợp lý',
    slug = 'dinh-duong-thai-ky-theo-tung-tam-ca-nguyet-bo-sung-axit-folic-sat-canxi-va-dha-hop-ly',
    summary = 'Bài viết chuyên sâu về dinh dưỡng thai kỳ theo từng tam cá nguyệt: bổ sung axit folic, sắt canxi và dha hợp lý được tham vấn y khoa bởi các chuyên gia Sản phụ khoa Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/images/packages/womens-health.jpg',
    category = 'Sản phụ khoa'
WHERE id = 'd35d01ed-ae84-8e53-4f79-71c23b88e041';

UPDATE articles
SET title = 'Châm cứu và điện châm: Cơ chế giảm đau giãn cơ thông qua hệ thống kinh lạc huyệt đạo',
    slug = 'cham-cuu-va-dien-cham-co-che-giam-dau-gian-co-thong-qua-he-thong-kinh-lac-huyet-dao',
    summary = 'Bài viết chuyên sâu về châm cứu và điện châm: cơ chế giảm đau giãn cơ thông qua hệ thống kinh lạc huyệt đạo được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '1e357c95-1560-1414-6c75-a22e53637419';

UPDATE articles
SET title = 'Xoa bóp bấm huyệt điều trị thoái hóa cột sống cổ: Kỹ thuật tác động mô mềm giảm co cứng cơ',
    slug = 'xoa-bop-bam-huyet-dieu-tri-thoai-hoa-cot-song-co-ky-thuat-tac-dong-mo-mem-giam-co-cung-co',
    summary = 'Bài viết chuyên sâu về xoa bóp bấm huyệt điều trị thoái hóa cột sống cổ: kỹ thuật tác động mô mềm giảm co cứng cơ được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '2e3e3345-b2d5-748f-fbb8-15c56723bf29';

UPDATE articles
SET title = 'Cứu ngải và giác hơi: Tác dụng khu phong tán hàn trừ thấp trong các chứng đau nhức mùa lạnh',
    slug = 'cuu-ngai-va-giac-hoi-tac-dung-khu-phong-tan-han-tru-thap-trong-cac-chung-dau-nhuc-mua-lanh',
    summary = 'Bài viết chuyên sâu về cứu ngải và giác hơi: tác dụng khu phong tán hàn trừ thấp trong các chứng đau nhức mùa lạnh được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '32680053-9073-79b6-d99d-88a01ab23d29';

UPDATE articles
SET title = 'Cấy chỉ vào huyệt đạo: Phương pháp điều trị đau thần kinh tọa và hen phế quản kéo dài hiệu quả',
    slug = 'cay-chi-vao-huyet-dao-phuong-phap-dieu-tri-dau-than-kinh-toa-va-hen-phe-quan-keo-dai-hieu-qua',
    summary = 'Bài viết chuyên sâu về cấy chỉ vào huyệt đạo: phương pháp điều trị đau thần kinh tọa và hen phế quản kéo dài hiệu quả được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '36c8b27b-7e1b-ba97-75ea-e6e05f0c8785';

UPDATE articles
SET title = 'Bài thuốc Đông y Bát trân thang: Tác dụng bổ khí ích huyết cho người mệt mỏi suy nhược cơ thể',
    slug = 'bai-thuoc-dong-y-bat-tran-thang-tac-dung-bo-khi-ich-huyet-cho-nguoi-met-moi-suy-nhuoc-co-the',
    summary = 'Bài viết chuyên sâu về bài thuốc đông y bát trân thang: tác dụng bổ khí ích huyết cho người mệt mỏi suy nhược cơ thể được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '37741d0d-d4a4-0375-094a-5663ae16804e';

UPDATE articles
SET title = 'Bài thuốc Lục vị địa hoàng hoàn: Bổ can thận âm điều trị chứng bốc hỏa đau lưng mỏi gối',
    slug = 'bai-thuoc-luc-vi-dia-hoang-hoan-bo-can-than-am-dieu-tri-chung-boc-hoa-dau-lung-moi-goi',
    summary = 'Bài viết chuyên sâu về bài thuốc lục vị địa hoàng hoàn: bổ can thận âm điều trị chứng bốc hỏa đau lưng mỏi gối được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '3e40b550-29ad-5565-ed87-1ded1fbd39fb';

UPDATE articles
SET title = 'Điều trị liệt dây thần kinh số VII ngoại biên bằng Y học cổ truyền: Kết hợp châm cứu và thủy châm',
    slug = 'dieu-tri-liet-day-than-kinh-so-vii-ngoai-bien-bang-y-hoc-co-truyen-ket-hop-cham-cuu-va-thuy-cham',
    summary = 'Bài viết chuyên sâu về điều trị liệt dây thần kinh số vii ngoại biên bằng y học cổ truyền: kết hợp châm cứu và thủy châm được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '470a4fc3-c430-7c95-6579-74144000d9a0';

UPDATE articles
SET title = 'Bài thuốc cổ phương Độc hoạt ký sinh thang: Trị chứng viêm khớp phong thấp đau nhức các khớp',
    slug = 'bai-thuoc-co-phuong-doc-hoat-ky-sinh-thang-tri-chung-viem-khop-phong-thap-dau-nhuc-cac-khop',
    summary = 'Bài viết chuyên sâu về bài thuốc cổ phương độc hoạt ký sinh thang: trị chứng viêm khớp phong thấp đau nhức các khớp được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '56bb143c-db2e-62c8-228e-3abe722a772d';

UPDATE articles
SET title = 'Ngâm chân thảo dược nước ấm mỗi tối: Giúp giãn mạch hạ hỏa lưu thông khí huyết và ngủ ngon',
    slug = 'ngam-chan-thao-duoc-nuoc-am-moi-toi-giup-gian-mach-ha-hoa-luu-thong-khi-huyet-va-ngu-ngon',
    summary = 'Bài viết chuyên sâu về ngâm chân thảo dược nước ấm mỗi tối: giúp giãn mạch hạ hỏa lưu thông khí huyết và ngủ ngon được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '77e4261f-ca6a-acfc-15ab-554c583c0f00';

UPDATE articles
SET title = 'Dưỡng sinh khí công trường thọ: Các bài tập thở sâu điều hòa tạng phủ và giảm căng thẳng tâm trí',
    slug = 'duong-sinh-khi-cong-truong-tho-cac-bai-tap-tho-sau-dieu-hoa-tang-phu-va-giam-cang-thang-tam-tri',
    summary = 'Bài viết chuyên sâu về dưỡng sinh khí công trường thọ: các bài tập thở sâu điều hòa tạng phủ và giảm căng thẳng tâm trí được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = '97b76e0b-aebc-68a2-0b89-37b452f6af8d';

UPDATE articles
SET title = 'Điều trị mất ngủ mạn tính bằng thảo dược: Cây lạc tiên tâm sen táo nhân và trà thảo mộc',
    slug = 'dieu-tri-mat-ngu-man-tinh-bang-thao-duoc-cay-lac-tien-tam-sen-tao-nhan-va-tra-thao-moc',
    summary = 'Bài viết chuyên sâu về điều trị mất ngủ mạn tính bằng thảo dược: cây lạc tiên tâm sen táo nhân và trà thảo mộc được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = 'a1113c60-338d-6a51-17ba-f701849e7755';

UPDATE articles
SET title = 'Phương pháp nhĩ châm châm loa tai: Hỗ trợ giảm cân cai thuốc lá và điều hòa thần kinh thực vật',
    slug = 'phuong-phap-nhi-cham-cham-loa-tai-ho-tro-giam-can-cai-thuoc-la-va-dieu-hoa-than-kinh-thuc-vat',
    summary = 'Bài viết chuyên sâu về phương pháp nhĩ châm châm loa tai: hỗ trợ giảm cân cai thuốc lá và điều hòa thần kinh thực vật được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = 'b420d18d-fd1e-89c4-1a92-5ae848064775';

UPDATE articles
SET title = 'Hỗ trợ điều trị rối loạn tiền đình bằng bài thuốc Bán hạ bạch truật thiên ma thang: Hóa đờm trừ ẩm',
    slug = 'ho-tro-dieu-tri-roi-loan-tien-dinh-bang-bai-thuoc-ban-ha-bach-truat-thien-ma-thang-hoa-dom-tru-am',
    summary = 'Bài viết chuyên sâu về hỗ trợ điều trị rối loạn tiền đình bằng bài thuốc bán hạ bạch truật thiên ma thang: hóa đờm trừ ẩm được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = 'b48e2d5d-b975-973c-5eeb-17f95963c46b';

UPDATE articles
SET title = 'Phục hồi di chứng sau tai biến mạch máu não bằng châm cứu và xoa bóp dưỡng sinh vận động',
    slug = 'phuc-hoi-di-chung-sau-tai-bien-mach-mau-nao-bang-cham-cuu-va-xoa-bop-duong-sinh-van-dong',
    summary = 'Bài viết chuyên sâu về phục hồi di chứng sau tai biến mạch máu não bằng châm cứu và xoa bóp dưỡng sinh vận động được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = 'b9943721-85e0-401b-80b4-247fb4a01589';

UPDATE articles
SET title = 'Ứng dụng gừng tươi ngải cứu quế chi trong giảm đau bụng kinh và phong hàn cảm mạo',
    slug = 'ung-dung-gung-tuoi-ngai-cuu-que-chi-trong-giam-dau-bung-kinh-va-phong-han-cam-mao',
    summary = 'Bài viết chuyên sâu về ứng dụng gừng tươi ngải cứu quế chi trong giảm đau bụng kinh và phong hàn cảm mạo được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = 'be7e49b6-05a0-75eb-378d-6254a289001c';

UPDATE articles
SET title = 'Trà hoa cúc kỷ tử dưỡng can minh mục: Giải độc gan làm sáng mắt cho người làm việc máy tính',
    slug = 'tra-hoa-cuc-ky-tu-duong-can-minh-muc-giai-doc-gan-lam-sang-mat-cho-nguoi-lam-viec-may-tinh',
    summary = 'Bài viết chuyên sâu về trà hoa cúc kỷ tử dưỡng can minh mục: giải độc gan làm sáng mắt cho người làm việc máy tính được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = 'dcbefb05-dcb4-f466-5aab-fbb635348984';

UPDATE articles
SET title = 'Sử dụng thuốc thảo dược đúng cách: Tránh nguy cơ tương tác thuốc giữa Đông y và Tây y hiện đại',
    slug = 'su-dung-thuoc-thao-duoc-dung-cach-tranh-nguy-co-tuong-tac-thuoc-giua-dong-y-va-tay-y-hien-dai',
    summary = 'Bài viết chuyên sâu về sử dụng thuốc thảo dược đúng cách: tránh nguy cơ tương tác thuốc giữa đông y và tây y hiện đại được tham vấn y khoa bởi các chuyên gia Y học cổ truyền Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Y học cổ truyền'
WHERE id = 'ef67ffa6-4037-f9d7-345b-ea32e129a2a0';

UPDATE articles
SET title = 'Sâu răng và viêm tủy răng: Quy tắc hàn trám composite thẩm mỹ và điều trị tủy răng vô trùng',
    slug = 'sau-rang-va-viem-tuy-rang-quy-tac-han-tram-composite-tham-my-va-dieu-tri-tuy-rang-vo-trung',
    summary = 'Bài viết chuyên sâu về sâu răng và viêm tủy răng: quy tắc hàn trám composite thẩm mỹ và điều trị tủy răng vô trùng được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '24e73c9e-fb98-2a9d-6902-086017609a73';

UPDATE articles
SET title = 'Bệnh viêm quanh răng nha chu: Dấu hiệu chảy máu chân răng tụt lợi và kỹ thuật lấy cao răng định kỳ',
    slug = 'benh-viem-quanh-rang-nha-chu-dau-hieu-chay-mau-chan-rang-tut-loi-va-ky-thuat-lay-cao-rang-dinh-ky',
    summary = 'Bài viết chuyên sâu về bệnh viêm quanh răng nha chu: dấu hiệu chảy máu chân răng tụt lợi và kỹ thuật lấy cao răng định kỳ được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '2dbbb709-30ac-303a-69fe-c355c1be7ac8';

UPDATE articles
SET title = 'Nhổ răng khôn mọc lệch mọc ngầm: Kỹ thuật nhổ răng siêu âm Piezotome không đau êm dịu',
    slug = 'nho-rang-khon-moc-lech-moc-ngam-ky-thuat-nho-rang-sieu-am-piezotome-khong-dau-em-diu',
    summary = 'Bài viết chuyên sâu về nhổ răng khôn mọc lệch mọc ngầm: kỹ thuật nhổ răng siêu âm piezotome không đau êm dịu được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '414c380e-6385-fc36-8489-05b0422cab07';

UPDATE articles
SET title = 'Trồng răng Implant kỹ thuật số: Khôi phục chức năng ăn nhai trọn đời và tích hợp xương sinh học',
    slug = 'trong-rang-implant-ky-thuat-so-khoi-phuc-chuc-nang-an-nhai-tron-doi-va-tich-hop-xuong-sinh-hoc',
    summary = 'Bài viết chuyên sâu về trồng răng implant kỹ thuật số: khôi phục chức năng ăn nhai trọn đời và tích hợp xương sinh học được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '48859567-a350-2a2b-1c3d-4e64ee3827bf';

UPDATE articles
SET title = 'Niềng răng chỉnh nha thẩm mỹ: Lựa chọn mắc cài kim loại sứ hay khay niềng trong suốt Invisalign',
    slug = 'nieng-rang-chinh-nha-tham-my-lua-chon-mac-cai-kim-loai-su-hay-khay-nieng-trong-suot-invisalign',
    summary = 'Bài viết chuyên sâu về niềng răng chỉnh nha thẩm mỹ: lựa chọn mắc cài kim loại sứ hay khay niềng trong suốt invisalign được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '71e9f847-7ff1-e334-71f1-9cde7a5e929a';

UPDATE articles
SET title = 'Bọc răng sứ thẩm mỹ: Bảo tồn mô răng thật tối đa và chọn vật liệu toàn sứ cao cấp an toàn nướu',
    slug = 'boc-rang-su-tham-my-bao-ton-mo-rang-that-toi-da-va-chon-vat-lieu-toan-su-cao-cap-an-toan-nuou',
    summary = 'Bài viết chuyên sâu về bọc răng sứ thẩm mỹ: bảo tồn mô răng thật tối đa và chọn vật liệu toàn sứ cao cấp an toàn nướu được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '7925dabe-0a5d-f813-cd24-002d2aae0493';

UPDATE articles
SET title = 'Tẩy trắng răng công nghệ Laser Whitening: Cơ chế phân cắt sắc tố men răng an toàn không ê buốt',
    slug = 'tay-trang-rang-cong-nghe-laser-whitening-co-che-phan-cat-sac-to-men-rang-an-toan-khong-e-buot',
    summary = 'Bài viết chuyên sâu về tẩy trắng răng công nghệ laser whitening: cơ chế phân cắt sắc tố men răng an toàn không ê buốt được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '7b4b75ea-3667-c462-13e0-ad4223f54df7';

UPDATE articles
SET title = 'Mòn cổ chân răng và ê buốt răng nhạy cảm: Nguyên nhân chải răng sai cách và bôi vecni fluor',
    slug = 'mon-co-chan-rang-va-e-buot-rang-nhay-cam-nguyen-nhan-chai-rang-sai-cach-va-boi-vecni-fluor',
    summary = 'Bài viết chuyên sâu về mòn cổ chân răng và ê buốt răng nhạy cảm: nguyên nhân chải răng sai cách và bôi vecni fluor được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '8191532d-f0e1-7e6c-f5a3-fcb7429ec74f';

UPDATE articles
SET title = 'Rối loạn khớp thái dương hàm TMJ: Dấu hiệu lục cục khi há miệng, đau mỏi cơ nhai và máng nhai',
    slug = 'roi-loan-khop-thai-duong-ham-tmj-dau-hieu-luc-cuc-khi-ha-mieng-dau-moi-co-nhai-va-mang-nhai',
    summary = 'Bài viết chuyên sâu về rối loạn khớp thái dương hàm tmj: dấu hiệu lục cục khi há miệng, đau mỏi cơ nhai và máng nhai được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '86032f40-cf34-c7e5-8e9d-3ea52fc3a0a0';

UPDATE articles
SET title = 'Chấn thương gãy răng lung lay răng do va đập: Cách bảo quản răng gãy trong sữa tươi đi cấp cứu',
    slug = 'chan-thuong-gay-rang-lung-lay-rang-do-va-dap-cach-bao-quan-rang-gay-trong-sua-tuoi-di-cap-cuu',
    summary = 'Bài viết chuyên sâu về chấn thương gãy răng lung lay răng do va đập: cách bảo quản răng gãy trong sữa tươi đi cấp cứu được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '8893a7e4-9255-8b92-630f-88993e1c499f';

UPDATE articles
SET title = 'Áp xe cuống răng nhiễm trùng sưng má: Dẫn lưu ổ mủ kháng sinh và bảo tồn răng thật',
    slug = 'ap-xe-cuong-rang-nhiem-trung-sung-ma-dan-luu-o-mu-khang-sinh-va-bao-ton-rang-that',
    summary = 'Bài viết chuyên sâu về áp xe cuống răng nhiễm trùng sưng má: dẫn lưu ổ mủ kháng sinh và bảo tồn răng thật được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '8d338e5a-29fc-48bc-5f4f-d33becc598f7';

UPDATE articles
SET title = 'Cấy ghép xương nhân tạo trong cấy ghép Implant: Giải pháp khi xương hàm bị tiêu ngót lâu ngày',
    slug = 'cay-ghep-xuong-nhan-tao-trong-cay-ghep-implant-giai-phap-khi-xuong-ham-bi-tieu-ngot-lau-ngay',
    summary = 'Bài viết chuyên sâu về cấy ghép xương nhân tạo trong cấy ghép implant: giải pháp khi xương hàm bị tiêu ngót lâu ngày được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '8de4c150-ee2d-5a3b-8ef4-a9cb32cf65ec';

UPDATE articles
SET title = 'Bệnh lý niêm mạc miệng nhiệt miệng Apthous tái phát: Bổ sung vitamin nhóm B kẽm và bôi gel giảm đau',
    slug = 'benh-ly-niem-mac-mieng-nhiet-mieng-apthous-tai-phat-bo-sung-vitamin-nhom-b-kem-va-boi-gel-giam-dau',
    summary = 'Bài viết chuyên sâu về bệnh lý niêm mạc miệng nhiệt miệng apthous tái phát: bổ sung vitamin nhóm b kẽm và bôi gel giảm đau được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = '9821a9cd-545d-9bfc-84e3-892be0687d3b';

UPDATE articles
SET title = 'Bệnh bạch sản niêm mạc miệng: Tổn thương mảng trắng cần sinh thiết loại trừ tiền ung thư tế bào gai',
    slug = 'benh-bach-san-niem-mac-mieng-ton-thuong-mang-trang-can-sinh-thiet-loai-tru-tien-ung-thu-te-bao-gai',
    summary = 'Bài viết chuyên sâu về bệnh bạch sản niêm mạc miệng: tổn thương mảng trắng cần sinh thiết loại trừ tiền ung thư tế bào gai được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = 'a9467e3a-10ae-462e-e84b-a9dc12a495e7';

UPDATE articles
SET title = 'Chăm sóc răng miệng cho người niềng răng: Hướng dẫn bàn chải kẽ, chỉ nha khoa và máy tăm nước',
    slug = 'cham-soc-rang-mieng-cho-nguoi-nieng-rang-huong-dan-ban-chai-ke-chi-nha-khoa-va-may-tam-nuoc',
    summary = 'Bài viết chuyên sâu về chăm sóc răng miệng cho người niềng răng: hướng dẫn bàn chải kẽ, chỉ nha khoa và máy tăm nước được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = 'bc759a3c-f02a-8c0c-fb50-8e7683dcbb89';

UPDATE articles
SET title = 'Tật nghiến răng khi ngủ ban đêm: Nguyên nhân căng thẳng thần kinh và giải pháp máng chống nghiến',
    slug = 'tat-nghien-rang-khi-ngu-ban-dem-nguyen-nhan-cang-thang-than-kinh-va-giai-phap-mang-chong-nghien',
    summary = 'Bài viết chuyên sâu về tật nghiến răng khi ngủ ban đêm: nguyên nhân căng thẳng thần kinh và giải pháp máng chống nghiến được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = 'c05210d9-f638-706a-2b32-a7b83bfbda0c';

UPDATE articles
SET title = 'Hướng dẫn đánh răng đúng phương pháp Bass cải tiến: Vệ sinh đường viền nướu ngăn ngừa mảng bám',
    slug = 'huong-dan-danh-rang-dung-phuong-phap-bass-cai-tien-ve-sinh-duong-vien-nuou-ngan-ngua-mang-bam',
    summary = 'Bài viết chuyên sâu về hướng dẫn đánh răng đúng phương pháp bass cải tiến: vệ sinh đường viền nướu ngăn ngừa mảng bám được tham vấn y khoa bởi các chuyên gia Răng hàm mặt Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Răng hàm mặt'
WHERE id = 'd064e0eb-7fa2-36fe-762f-2f2b14e9dce2';

UPDATE articles
SET title = 'Tháp dinh dưỡng hợp lý cho người trưởng thành: Cân đối chất đạm chất béo và tinh bột lành mạnh',
    slug = 'thap-dinh-duong-hop-ly-cho-nguoi-truong-thanh-can-doi-chat-dam-chat-beo-va-tinh-bot-lanh-manh',
    summary = 'Bài viết chuyên sâu về tháp dinh dưỡng hợp lý cho người trưởng thành: cân đối chất đạm chất béo và tinh bột lành mạnh được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '2718d375-629d-5ffb-66b4-b88ac9496852';

UPDATE articles
SET title = 'Chế độ ăn cho người bệnh tăng huyết áp: Thực đơn ăn nhạt giảm natri tăng cường kali magie',
    slug = 'che-do-an-cho-nguoi-benh-tang-huyet-ap-thuc-don-an-nhat-giam-natri-tang-cuong-kali-magie',
    summary = 'Bài viết chuyên sâu về chế độ ăn cho người bệnh tăng huyết áp: thực đơn ăn nhạt giảm natri tăng cường kali magie được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '2e007d14-ab91-91ba-37b6-979201fd85c9';

UPDATE articles
SET title = 'Chế độ ăn kiểm soát đường huyết cho người đái tháo đường: Chỉ số đường huyết GI của thực phẩm',
    slug = 'che-do-an-kiem-soat-duong-huyet-cho-nguoi-dai-thao-duong-chi-so-duong-huyet-gi-cua-thuc-pham',
    summary = 'Bài viết chuyên sâu về chế độ ăn kiểm soát đường huyết cho người đái tháo đường: chỉ số đường huyết gi của thực phẩm được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '34344e52-63b6-4188-6485-30d6daa772f8';

UPDATE articles
SET title = 'Dinh dưỡng phòng ngừa và hỗ trợ điều trị gan nhiễm mỡ: Hạn chế đường Fructose và chất béo bão hòa',
    slug = 'dinh-duong-phong-ngua-va-ho-tro-dieu-tri-gan-nhiem-mo-han-che-duong-fructose-va-chat-beo-bao-hoa',
    summary = 'Bài viết chuyên sâu về dinh dưỡng phòng ngừa và hỗ trợ điều trị gan nhiễm mỡ: hạn chế đường fructose và chất béo bão hòa được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '355603a9-3fb2-01a6-ad27-d5d9e3337db4';

UPDATE articles
SET title = 'Chế độ ăn giảm acid uric máu cho người bệnh gút: Danh sách thực phẩm giàu purin cần kiêng khem',
    slug = 'che-do-an-giam-acid-uric-mau-cho-nguoi-benh-gut-danh-sach-thuc-pham-giau-purin-can-kieng-khem',
    summary = 'Bài viết chuyên sâu về chế độ ăn giảm acid uric máu cho người bệnh gút: danh sách thực phẩm giàu purin cần kiêng khem được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '45e826f2-ba5a-89e8-c3ee-c568fab02bef';

UPDATE articles
SET title = 'Dinh dưỡng hồi phục sau phẫu thuật lớn: Tầm quan trọng của đạm sinh học cao và vi chất kẽm vitamin C',
    slug = 'dinh-duong-hoi-phuc-sau-phau-thuat-lon-tam-quan-trong-cua-dam-sinh-hoc-cao-va-vi-chat-kem-vitamin-c',
    summary = 'Bài viết chuyên sâu về dinh dưỡng hồi phục sau phẫu thuật lớn: tầm quan trọng của đạm sinh học cao và vi chất kẽm vitamin c được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '632de521-e2b8-d544-e7d4-f579da056310';

UPDATE articles
SET title = 'Thiếu vi chất dinh dưỡng thầm lặng: Nhận biết dấu hiệu thiếu kẽm magie vitamin B12 vitamin D',
    slug = 'thieu-vi-chat-dinh-duong-tham-lang-nhan-biet-dau-hieu-thieu-kem-magie-vitamin-b12-vitamin-d',
    summary = 'Bài viết chuyên sâu về thiếu vi chất dinh dưỡng thầm lặng: nhận biết dấu hiệu thiếu kẽm magie vitamin b12 vitamin d được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '647fab15-ca11-acad-3995-6f331cd3e78d';

UPDATE articles
SET title = 'Chế độ ăn Địa Trung Hải: Lợi ích đã được chứng minh trong bảo vệ tim mạch và tăng tuổi thọ',
    slug = 'che-do-an-dia-trung-hai-loi-ich-da-duoc-chung-minh-trong-bao-ve-tim-mach-va-tang-tuoi-tho',
    summary = 'Bài viết chuyên sâu về chế độ ăn địa trung hải: lợi ích đã được chứng minh trong bảo vệ tim mạch và tăng tuổi thọ được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '73e55f8e-e0dc-df0a-c532-bf74b74c0842';

UPDATE articles
SET title = 'Chế độ nhịn ăn gián đoạn Intermittent Fasting: Lợi ích chuyển hóa và những đối tượng không nên áp dụng',
    slug = 'che-do-nhin-an-gian-doan-intermittent-fasting-loi-ich-chuyen-hoa-va-nhung-doi-tuong-khong-nen-ap-dung',
    summary = 'Bài viết chuyên sâu về chế độ nhịn ăn gián đoạn intermittent fasting: lợi ích chuyển hóa và những đối tượng không nên áp dụng được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '74070f9a-bce5-584b-50bc-81bb541f5124';

UPDATE articles
SET title = 'Dinh dưỡng cho phụ nữ mang thai 3 tháng đầu: Bí quyết giảm ốm nghén và bổ sung Axit Folic đầy đủ',
    slug = 'dinh-duong-cho-phu-nu-mang-thai-3-thang-dau-bi-quyet-giam-om-nghen-va-bo-sung-axit-folic-day-du',
    summary = 'Bài viết chuyên sâu về dinh dưỡng cho phụ nữ mang thai 3 tháng đầu: bí quyết giảm ốm nghén và bổ sung axit folic đầy đủ được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '87236b68-a49a-9e82-9743-130cb0216484';

UPDATE articles
SET title = 'Chế độ ăn dặm cho trẻ từ 6 tháng tuổi: Phương pháp ăn dặm kiểu Nhật và ăn dặm tự chỉ huy BLW',
    slug = 'che-do-an-dam-cho-tre-tu-6-thang-tuoi-phuong-phap-an-dam-kieu-nhat-va-an-dam-tu-chi-huy-blw',
    summary = 'Bài viết chuyên sâu về chế độ ăn dặm cho trẻ từ 6 tháng tuổi: phương pháp ăn dặm kiểu nhật và ăn dặm tự chỉ huy blw được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '93fc98fd-be3a-c024-3483-feebc03354dc';

UPDATE articles
SET title = 'Dinh dưỡng chống loãng xương cho phụ nữ mãn kinh: Bổ sung Canxi từ thực phẩm hàng ngày',
    slug = 'dinh-duong-chong-loang-xuong-cho-phu-nu-man-kinh-bo-sung-canxi-tu-thuc-pham-hang-ngay',
    summary = 'Bài viết chuyên sâu về dinh dưỡng chống loãng xương cho phụ nữ mãn kinh: bổ sung canxi từ thực phẩm hàng ngày được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = '9a0e38e5-5380-3008-4e0b-e88cdf5cd292';

UPDATE articles
SET title = 'Thừa cân béo phì ở trẻ học đường: Xây dựng thực đơn giảm calo mà vẫn đảm bảo phát triển chiều cao',
    slug = 'thua-can-beo-phi-o-tre-hoc-duong-xay-dung-thuc-don-giam-calo-ma-van-dam-bao-phat-trien-chieu-cao',
    summary = 'Bài viết chuyên sâu về thừa cân béo phì ở trẻ học đường: xây dựng thực đơn giảm calo mà vẫn đảm bảo phát triển chiều cao được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = 'a12b62f7-2ffd-9abb-75f9-8b57e96e8336';

UPDATE articles
SET title = 'Chế độ ăn cho người suy thận mạn giai đoạn chưa lọc máu: Hạn chế protein phosphat và kiểm soát kali',
    slug = 'che-do-an-cho-nguoi-suy-than-man-giai-doan-chua-loc-mau-han-che-protein-phosphat-va-kiem-soat-kali',
    summary = 'Bài viết chuyên sâu về chế độ ăn cho người suy thận mạn giai đoạn chưa lọc máu: hạn chế protein phosphat và kiểm soát kali được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = 'c3ccbe9e-bb04-b955-2b19-300bd1512752';

UPDATE articles
SET title = 'Dinh dưỡng cho người bệnh ung thư trong đợt hóa xạ trị: Xử trí chứng chán ăn khô miệng buồn nôn',
    slug = 'dinh-duong-cho-nguoi-benh-ung-thu-trong-dot-hoa-xa-tri-xu-tri-chung-chan-an-kho-mieng-buon-non',
    summary = 'Bài viết chuyên sâu về dinh dưỡng cho người bệnh ung thư trong đợt hóa xạ trị: xử trí chứng chán ăn khô miệng buồn nôn được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = 'c8eec5f0-bf4e-2acd-7416-3aa5032faed3';

UPDATE articles
SET title = 'Mất nước điện giải khi chơi thể thao gắng sức: Bổ sung nước khoáng và dung dịch bù ion đúng cách',
    slug = 'mat-nuoc-dien-giai-khi-choi-the-thao-gang-suc-bo-sung-nuoc-khoang-va-dung-dich-bu-ion-dung-cach',
    summary = 'Bài viết chuyên sâu về mất nước điện giải khi chơi thể thao gắng sức: bổ sung nước khoáng và dung dịch bù ion đúng cách được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = 'd341e409-c125-2445-6d07-5d12aa4ffae0';

UPDATE articles
SET title = 'Đọc và hiểu bảng thành phần dinh dưỡng nhãn thực phẩm: Tránh bẫy đường ẩn và chất béo chuyển hóa',
    slug = 'doc-va-hieu-bang-thanh-phan-dinh-duong-nhan-thuc-pham-tranh-bay-duong-an-va-chat-beo-chuyen-hoa',
    summary = 'Bài viết chuyên sâu về đọc và hiểu bảng thành phần dinh dưỡng nhãn thực phẩm: tránh bẫy đường ẩn và chất béo chuyển hóa được tham vấn y khoa bởi các chuyên gia Dinh dưỡng Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/dinh-duong-tang-huyet-ap.jpg',
    category = 'Dinh dưỡng'
WHERE id = 'f4e1598b-670e-5a05-cbe9-0703fa5abfeb';

UPDATE articles
SET title = 'Khám sức khỏe tổng quát định kỳ: Các gói xét nghiệm chẩn đoán hình ảnh thiết yếu theo từng độ tuổi',
    slug = 'kham-suc-khoe-tong-quat-dinh-ky-cac-goi-xet-nghiem-chan-doan-hinh-anh-thiet-yeu-theo-tung-do-tuoi',
    summary = 'Bài viết chuyên sâu về khám sức khỏe tổng quát định kỳ: các gói xét nghiệm chẩn đoán hình ảnh thiết yếu theo từng độ tuổi được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = '272d05c6-8ed2-6676-d19b-a5df2af0dc15';

UPDATE articles
SET title = 'Sốt kéo dài chưa rõ nguyên nhân FUO: Tiếp cận chẩn đoán nhiễm khuẩn tự miễn và bệnh ác tính',
    slug = 'sot-keo-dai-chua-ro-nguyen-nhan-fuo-tiep-can-chan-doan-nhiem-khuan-tu-mien-va-benh-ac-tinh',
    summary = 'Bài viết chuyên sâu về sốt kéo dài chưa rõ nguyên nhân fuo: tiếp cận chẩn đoán nhiễm khuẩn tự miễn và bệnh ác tính được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = '3ec0684b-0efc-b149-5968-d63a619f030c';

UPDATE articles
SET title = 'Hội chứng mệt mỏi mạn tính CFS: Phân biệt mệt mỏi thể chất suy nhược với trầm cảm lo âu',
    slug = 'hoi-chung-met-moi-man-tinh-cfs-phan-biet-met-moi-the-chat-suy-nhuoc-voi-tram-cam-lo-au',
    summary = 'Bài viết chuyên sâu về hội chứng mệt mỏi mạn tính cfs: phân biệt mệt mỏi thể chất suy nhược với trầm cảm lo âu được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = '4d7383d6-3695-a94e-0c45-190f6efd8f10';

UPDATE articles
SET title = 'Đa bệnh lý mạn tính ở người cao tuổi: Chiến lược phối hợp điều trị và phòng ngừa tương tác thuốc',
    slug = 'da-benh-ly-man-tinh-o-nguoi-cao-tuoi-chien-luoc-phoi-hop-dieu-tri-va-phong-ngua-tuong-tac-thuoc',
    summary = 'Bài viết chuyên sâu về đa bệnh lý mạn tính ở người cao tuổi: chiến lược phối hợp điều trị và phòng ngừa tương tác thuốc được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = '85343245-12b8-89a5-6865-a1a7153a1642';

UPDATE articles
SET title = 'Hội chứng chuyển hóa Metabolic Syndrome: Tiêu chuẩn chẩn đoán vòng eo mỡ máu đường huyết',
    slug = 'hoi-chung-chuyen-hoa-metabolic-syndrome-tieu-chuan-chan-doan-vong-eo-mo-mau-duong-huyet',
    summary = 'Bài viết chuyên sâu về hội chứng chuyển hóa metabolic syndrome: tiêu chuẩn chẩn đoán vòng eo mỡ máu đường huyết được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = '8ed37e62-8068-631f-1c65-db34b8a53f77';

UPDATE articles
SET title = 'Rối loạn điện giải hạ natri hạ kali máu: Nhận biết dấu hiệu lú lẫn yếu cơ và phác đồ bù an toàn',
    slug = 'roi-loan-dien-giai-ha-natri-ha-kali-mau-nhan-biet-dau-hieu-lu-lan-yeu-co-va-phac-do-bu-an-toan',
    summary = 'Bài viết chuyên sâu về rối loạn điện giải hạ natri hạ kali máu: nhận biết dấu hiệu lú lẫn yếu cơ và phác đồ bù an toàn được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = '8fffb84b-2719-0e8d-03e9-8bedaa192006';

UPDATE articles
SET title = 'Giảm cân sụt cân nhanh không rõ nguyên nhân: Dấu hiệu cảnh báo bệnh lý chuyển hóa và ung bướu',
    slug = 'giam-can-sut-can-nhanh-khong-ro-nguyen-nhan-dau-hieu-canh-bao-benh-ly-chuyen-hoa-va-ung-buou',
    summary = 'Bài viết chuyên sâu về giảm cân sụt cân nhanh không rõ nguyên nhân: dấu hiệu cảnh báo bệnh lý chuyển hóa và ung bướu được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = '9cf66cfd-197c-ff67-4606-a5a89c5c1362';

UPDATE articles
SET title = 'Tăng men gan AST ALT kéo dài: Các bước xét nghiệm tìm căn nguyên virus rượu bia thuốc mỡ máu',
    slug = 'tang-men-gan-ast-alt-keo-dai-cac-buoc-xet-nghiem-tim-can-nguyen-virus-ruou-bia-thuoc-mo-mau',
    summary = 'Bài viết chuyên sâu về tăng men gan ast alt kéo dài: các bước xét nghiệm tìm căn nguyên virus rượu bia thuốc mỡ máu được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = '9cfc5c3c-02d1-9a1e-64ae-af5a5e8d7581';

UPDATE articles
SET title = 'Đau bụng cấp tính: Phân biệt đau bụng nội khoa với các cấp cứu bụng ngoại khoa cần mổ',
    slug = 'dau-bung-cap-tinh-phan-biet-dau-bung-noi-khoa-voi-cac-cap-cuu-bung-ngoai-khoa-can-mo',
    summary = 'Bài viết chuyên sâu về đau bụng cấp tính: phân biệt đau bụng nội khoa với các cấp cứu bụng ngoại khoa cần mổ được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = 'a1ee11a7-0c1a-020a-5fd8-0523d915f1dd';

UPDATE articles
SET title = 'Khó thở khi gắng sức: Đánh giá phối hợp tim mạch hô hấp thiếu máu xác định nguyên nhân',
    slug = 'kho-tho-khi-gang-suc-danh-gia-phoi-hop-tim-mach-ho-hap-thieu-mau-xac-dinh-nguyen-nhan',
    summary = 'Bài viết chuyên sâu về khó thở khi gắng sức: đánh giá phối hợp tim mạch hô hấp thiếu máu xác định nguyên nhân được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = 'ae1cfd6c-5f00-938a-5eb1-2febc1eca8cf';

UPDATE articles
SET title = 'Chóng mặt hoa mắt choáng váng: Phân biệt hạ huyết áp thiếu máu rối loạn tiền đình và hạ đường',
    slug = 'chong-mat-hoa-mat-choang-vang-phan-biet-ha-huyet-ap-thieu-mau-roi-loan-tien-dinh-va-ha-duong',
    summary = 'Bài viết chuyên sâu về chóng mặt hoa mắt choáng váng: phân biệt hạ huyết áp thiếu máu rối loạn tiền đình và hạ đường được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = 'b1dc7e7b-0cd8-9763-441e-d36df83bf20a';

UPDATE articles
SET title = 'Sốt rét và sốt xuất huyết: Phân biệt đặc điểm dịch tễ cơn sốt rét run và xét nghiệm ký sinh trùng',
    slug = 'sot-ret-va-sot-xuat-huyet-phan-biet-dac-diem-dich-te-con-sot-ret-run-va-xet-nghiem-ky-sinh-trung',
    summary = 'Bài viết chuyên sâu về sốt rét và sốt xuất huyết: phân biệt đặc điểm dịch tễ cơn sốt rét run và xét nghiệm ký sinh trùng được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = 'b9691892-a87e-a6e2-e344-35f365f8e037';

UPDATE articles
SET title = 'Nhiễm khuẩn huyết và sốc nhiễm khuẩn: Nhận diện thang điểm qSOFA suy đa tạng hồi sức sớm',
    slug = 'nhiem-khuan-huyet-va-soc-nhiem-khuan-nhan-dien-thang-diem-qsofa-suy-da-tang-hoi-suc-som',
    summary = 'Bài viết chuyên sâu về nhiễm khuẩn huyết và sốc nhiễm khuẩn: nhận diện thang điểm qsofa suy đa tạng hồi sức sớm được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = 'bdeab65f-3cdb-9890-f035-d057ef7d7f44';

UPDATE articles
SET title = 'Đái tháo đường phối hợp tăng huyết áp mỡ máu: Mục tiêu điều trị toàn diện giảm biến cố mạch máu',
    slug = 'dai-thao-duong-phoi-hop-tang-huyet-ap-mo-mau-muc-tieu-dieu-tri-toan-dien-giam-bien-co-mach-mau',
    summary = 'Bài viết chuyên sâu về đái tháo đường phối hợp tăng huyết áp mỡ máu: mục tiêu điều trị toàn diện giảm biến cố mạch máu được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = 'e25d12b7-331f-f9a2-50a2-ff18b098a598';

UPDATE articles
SET title = 'Chăm sóc y tế toàn diện cho người bệnh sau xuất viện: Tái khám định kỳ và tuân thủ đơn thuốc',
    slug = 'cham-soc-y-te-toan-dien-cho-nguoi-benh-sau-xuat-vien-tai-kham-dinh-ky-va-tuan-thu-don-thuoc',
    summary = 'Bài viết chuyên sâu về chăm sóc y tế toàn diện cho người bệnh sau xuất viện: tái khám định kỳ và tuân thủ đơn thuốc được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = 'f83ac6ac-f652-b82e-1542-52fa7fc491ac';

UPDATE articles
SET title = 'Sử dụng thuốc giảm đau NSAID an toàn: Phòng ngừa biến chứng loét dạ dày xuất huyết và suy thận',
    slug = 'su-dung-thuoc-giam-dau-nsaid-an-toan-phong-ngua-bien-chung-loet-da-day-xuat-huyet-va-suy-than',
    summary = 'Bài viết chuyên sâu về sử dụng thuốc giảm đau nsaid an toàn: phòng ngừa biến chứng loét dạ dày xuất huyết và suy thận được tham vấn y khoa bởi các chuyên gia Nội tổng hợp Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg',
    category = 'Nội tổng hợp'
WHERE id = 'fe95d310-8548-2ab0-2a1c-da0e5e457588';

UPDATE articles
SET title = 'Phẫu thuật vi phẫu u não: Ứng dụng hệ thống định vị dẫn đường Navigation và kính vi phẫu',
    slug = 'phau-thuat-vi-phau-u-nao-ung-dung-he-thong-dinh-vi-dan-duong-navigation-va-kinh-vi-phau',
    summary = 'Bài viết chuyên sâu về phẫu thuật vi phẫu u não: ứng dụng hệ thống định vị dẫn đường navigation và kính vi phẫu được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '2ca0db2a-0a36-7328-46e1-f665531d4461';

UPDATE articles
SET title = 'Chấn thương sọ não máu tụ ngoài màng cứng: Dấu hiệu khoảng tỉnh và phẫu thuật mở sọ giải áp',
    slug = 'chan-thuong-so-nao-mau-tu-ngoai-mang-cung-dau-hieu-khoang-tinh-va-phau-thuat-mo-so-giai-ap',
    summary = 'Bài viết chuyên sâu về chấn thương sọ não máu tụ ngoài màng cứng: dấu hiệu khoảng tỉnh và phẫu thuật mở sọ giải áp được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '2f3edb9f-65a9-af5f-b11a-4c5ec51bcca8';

UPDATE articles
SET title = 'Phình động mạch não vỡ gây xuất huyết dưới nhện: Cơn đau đầu sét đánh và can thiệp nút coils',
    slug = 'phinh-dong-mach-nao-vo-gay-xuat-huyet-duoi-nhen-con-dau-dau-set-danh-va-can-thiep-nut-coils',
    summary = 'Bài viết chuyên sâu về phình động mạch não vỡ gây xuất huyết dưới nhện: cơn đau đầu sét đánh và can thiệp nút coils được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '30f4b8eb-8642-274f-6025-6a75ca807401';

UPDATE articles
SET title = 'Dị dạng mạch máu não AVM: Nguy cơ xuất huyết não ở người trẻ và phương pháp can thiệp phối hợp',
    slug = 'di-dang-mach-mau-nao-avm-nguy-co-xuat-huyet-nao-o-nguoi-tre-va-phuong-phap-can-thiep-phoi-hop',
    summary = 'Bài viết chuyên sâu về dị dạng mạch máu não avm: nguy cơ xuất huyết não ở người trẻ và phương pháp can thiệp phối hợp được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '37735e71-0eec-1046-e4ba-cd697ebf6b0a';

UPDATE articles
SET title = 'Phẫu thuật nội soi qua xoang bướm cắt u tuyến yên: Bảo tồn thị lực và tuyến nội tiết',
    slug = 'phau-thuat-noi-soi-qua-xoang-buom-cat-u-tuyen-yen-bao-ton-thi-luc-va-tuyen-noi-tiet',
    summary = 'Bài viết chuyên sâu về phẫu thuật nội soi qua xoang bướm cắt u tuyến yên: bảo tồn thị lực và tuyến nội tiết được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '3d4e7213-74da-367b-4ed9-04f292141de3';

UPDATE articles
SET title = 'Chấn thương cột sống gãy lún đốt sống: Kỹ thuật bơm xi măng sinh học Kyphoplasty tạo hình thân đốt',
    slug = 'chan-thuong-cot-song-gay-lun-dot-song-ky-thuat-bom-xi-mang-sinh-hoc-kyphoplasty-tao-hinh-than-dot',
    summary = 'Bài viết chuyên sâu về chấn thương cột sống gãy lún đốt sống: kỹ thuật bơm xi măng sinh học kyphoplasty tạo hình thân đốt được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '5221d571-4515-7d20-4072-346b64443a32';

UPDATE articles
SET title = 'Phẫu thuật cố định cột sống thắt lưng nẹp vít qua cuống: Giải phóng chèn ép rễ thần kinh',
    slug = 'phau-thuat-co-dinh-cot-song-that-lung-nep-vit-qua-cuong-giai-phong-chen-ep-re-than-kinh',
    summary = 'Bài viết chuyên sâu về phẫu thuật cố định cột sống thắt lưng nẹp vít qua cuống: giải phóng chèn ép rễ thần kinh được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '56907329-322e-d72a-7dff-5f2dd339aa21';

UPDATE articles
SET title = 'Vi phẫu giải ép dây thần kinh số V: Điều trị triệt để chứng đau dây thần kinh mặt co giật nửa mặt',
    slug = 'vi-phau-giai-ep-day-than-kinh-so-v-dieu-tri-triet-de-chung-dau-day-than-kinh-mat-co-giat-nua-mat',
    summary = 'Bài viết chuyên sâu về vi phẫu giải ép dây thần kinh số v: điều trị triệt để chứng đau dây thần kinh mặt co giật nửa mặt được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '5bab380c-8ad3-896a-e8c7-2e41607efaa1';

UPDATE articles
SET title = 'Dẫn lưu não thất ổ bụng VP Shunt điều trị bệnh não úng thủy: Kiểm soát áp lực nội sọ',
    slug = 'dan-luu-nao-that-o-bung-vp-shunt-dieu-tri-benh-nao-ung-thuy-kiem-soat-ap-luc-noi-so',
    summary = 'Bài viết chuyên sâu về dẫn lưu não thất ổ bụng vp shunt điều trị bệnh não úng thủy: kiểm soát áp lực nội sọ được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '80ee8a27-bd92-53c1-f954-4b3f10e88cf5';

UPDATE articles
SET title = 'Lao cột sống bệnh Pott: Dấu hiệu áp xe lạnh phá hủy thân đốt sống và phác đồ phẫu thuật phối hợp',
    slug = 'lao-cot-song-benh-pott-dau-hieu-ap-xe-lanh-pha-huy-than-dot-song-va-phac-do-phau-thuat-phoi-hop',
    summary = 'Bài viết chuyên sâu về lao cột sống bệnh pott: dấu hiệu áp xe lạnh phá hủy thân đốt sống và phác đồ phẫu thuật phối hợp được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '847e3c93-48ac-8c88-5617-a9f997c8578e';

UPDATE articles
SET title = 'Hẹp ống sống thắt lưng: Phẫu thuật mở cung sau giải ép rễ thần kinh cho người cao tuổi',
    slug = 'hep-ong-song-that-lung-phau-thuat-mo-cung-sau-giai-ep-re-than-kinh-cho-nguoi-cao-tuoi',
    summary = 'Bài viết chuyên sâu về hẹp ống sống thắt lưng: phẫu thuật mở cung sau giải ép rễ thần kinh cho người cao tuổi được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = '95e08ff1-985f-d53d-2c1d-301ba780f416';

UPDATE articles
SET title = 'U tủy sống chèn ép rễ thần kinh: Dấu hiệu tê liệt vận động từ dưới tổn thương và vi phẫu bóc u',
    slug = 'u-tuy-song-chen-ep-re-than-kinh-dau-hieu-te-liet-van-dong-tu-duoi-ton-thuong-va-vi-phau-boc-u',
    summary = 'Bài viết chuyên sâu về u tủy sống chèn ép rễ thần kinh: dấu hiệu tê liệt vận động từ dưới tổn thương và vi phẫu bóc u được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = 'ac0265fe-dd6c-b3dc-0f43-a6b87e8179d6';

UPDATE articles
SET title = 'Dị tật nứt đốt sống màng tủy Spina Bifida ở trẻ sơ sinh: Phẫu thuật đóng túi thoát vị sớm',
    slug = 'di-tat-nut-dot-song-mang-tuy-spina-bifida-o-tre-so-sinh-phau-thuat-dong-tui-thoat-vi-som',
    summary = 'Bài viết chuyên sâu về dị tật nứt đốt sống màng tủy spina bifida ở trẻ sơ sinh: phẫu thuật đóng túi thoát vị sớm được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = 'e4ef86ee-6c5a-eb61-fdc5-4300a8d3b013';

UPDATE articles
SET title = 'Theo dõi áp lực nội sọ liên tục ICP trong hồi sức cấp cứu ngoại thần kinh',
    slug = 'theo-doi-ap-luc-noi-so-lien-tuc-icp-trong-hoi-suc-cap-cuu-ngoai-than-kinh',
    summary = 'Bài viết chuyên sâu về theo dõi áp lực nội sọ liên tục icp trong hồi sức cấp cứu ngoại thần kinh được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = 'e701f881-36b3-32fe-4d85-27003e6ee2fd';

UPDATE articles
SET title = 'Tạo hình khuyết sọ sau mở sọ giải áp: Ứng dụng vật liệu lưới Titan hoặc vật liệu sinh học PEEK',
    slug = 'tao-hinh-khuyet-so-sau-mo-so-giai-ap-ung-dung-vat-lieu-luoi-titan-hoac-vat-lieu-sinh-hoc-peek',
    summary = 'Bài viết chuyên sâu về tạo hình khuyết sọ sau mở sọ giải áp: ứng dụng vật liệu lưới titan hoặc vật liệu sinh học peek được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = 'f205ccc5-5547-bd5c-2921-87b184364f04';

UPDATE articles
SET title = 'Phục hồi chức năng thần kinh sau phẫu thuật sọ não: Kích thích ý thức và phục hồi vận động',
    slug = 'phuc-hoi-chuc-nang-than-kinh-sau-phau-thuat-so-nao-kich-thich-y-thuc-va-phuc-hoi-van-dong',
    summary = 'Bài viết chuyên sâu về phục hồi chức năng thần kinh sau phẫu thuật sọ não: kích thích ý thức và phục hồi vận động được tham vấn y khoa bởi các chuyên gia Ngoại thần kinh Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/phong-ngua-dot-quy.jpg',
    category = 'Ngoại thần kinh'
WHERE id = 'f9fa826a-87da-b13e-9ced-d33229deaacb';

UPDATE articles
SET title = 'Đái tháo đường type 2: Kiểm soát chỉ số đường huyết đói và HbA1c mục tiêu dưới 7 phần trăm',
    slug = 'dai-thao-duong-type-2-kiem-soat-chi-so-duong-huyet-doi-va-hba1c-muc-tieu-duoi-7-phan-tram',
    summary = 'Bài viết chuyên sâu về đái tháo đường type 2: kiểm soát chỉ số đường huyết đói và hba1c mục tiêu dưới 7 phần trăm được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '40c1dbdf-a031-aa2c-61b0-7be793ce9369';

UPDATE articles
SET title = 'Đái tháo đường type 1: Cơ chế thiếu hụt insulin tuyệt đối và hướng dẫn tiêm insulin nhiều mũi',
    slug = 'dai-thao-duong-type-1-co-che-thieu-hut-insulin-tuyet-doi-va-huong-dan-tiem-insulin-nhieu-mui',
    summary = 'Bài viết chuyên sâu về đái tháo đường type 1: cơ chế thiếu hụt insulin tuyệt đối và hướng dẫn tiêm insulin nhiều mũi được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '49d67ff5-f244-7569-2028-d14d5fcb3e16';

UPDATE articles
SET title = 'Hạ đường huyết đột ngột: Dấu hiệu vã mồ hôi run tay bủn rủn và quy tắc 15-15 xử trí nhanh',
    slug = 'ha-duong-huyet-dot-ngot-dau-hieu-va-mo-hoi-run-tay-bun-run-va-quy-tac-15-15-xu-tri-nhanh',
    summary = 'Bài viết chuyên sâu về hạ đường huyết đột ngột: dấu hiệu vã mồ hôi run tay bủn rủn và quy tắc 15-15 xử trí nhanh được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '5610135b-ff8d-b7de-d272-e3c426fc03ed';

UPDATE articles
SET title = 'Suy giáp nguyên phát: Dấu hiệu mệt mỏi sợ lạnh tăng cân và điều chỉnh liều Levothyroxine',
    slug = 'suy-giap-nguyen-phat-dau-hieu-met-moi-so-lanh-tang-can-va-dieu-chinh-lieu-levothyroxine',
    summary = 'Bài viết chuyên sâu về suy giáp nguyên phát: dấu hiệu mệt mỏi sợ lạnh tăng cân và điều chỉnh liều levothyroxine được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '64af1804-23b4-3907-bc78-a04868794834';

UPDATE articles
SET title = 'Cường giáp Basedow: Dấu hiệu mắt lồi nhịp tim nhanh sụt cân và phác đồ thuốc kháng giáp',
    slug = 'cuong-giap-basedow-dau-hieu-mat-loi-nhip-tim-nhanh-sut-can-va-phac-do-thuoc-khang-giap',
    summary = 'Bài viết chuyên sâu về cường giáp basedow: dấu hiệu mắt lồi nhịp tim nhanh sụt cân và phác đồ thuốc kháng giáp được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '6571f7da-1d13-201a-53d8-441750442639';

UPDATE articles
SET title = 'Bướu nhân tuyến giáp lành tính: Phân độ TIRADS qua siêu âm và chỉ định đốt sóng cao tần RFA',
    slug = 'buou-nhan-tuyen-giap-lanh-tinh-phan-do-tirads-qua-sieu-am-va-chi-dinh-dot-song-cao-tan-rfa',
    summary = 'Bài viết chuyên sâu về bướu nhân tuyến giáp lành tính: phân độ tirads qua siêu âm và chỉ định đốt sóng cao tần rfa được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '6e6f8849-d216-8eba-4867-a69d7e851f9d';

UPDATE articles
SET title = 'Viêm tuyến giáp Hashimoto: Kháng thể tự miễn Anti-TPO và theo dõi chức năng giáp định kỳ',
    slug = 'viem-tuyen-giap-hashimoto-khang-the-tu-mien-anti-tpo-va-theo-doi-chuc-nang-giap-dinh-ky',
    summary = 'Bài viết chuyên sâu về viêm tuyến giáp hashimoto: kháng thể tự miễn anti-tpo và theo dõi chức năng giáp định kỳ được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '7ae05681-c9ce-e70e-b129-788aa622171f';

UPDATE articles
SET title = 'Hội chứng Cushing do lạm dụng Corticoid: Dấu hiệu mặt tròn như mặt trăng da mỏng rạn đỏ',
    slug = 'hoi-chung-cushing-do-lam-dung-corticoid-dau-hieu-mat-tron-nhu-mat-trang-da-mong-ran-do',
    summary = 'Bài viết chuyên sâu về hội chứng cushing do lạm dụng corticoid: dấu hiệu mặt tròn như mặt trăng da mỏng rạn đỏ được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '7e219881-9a28-3f7b-fbda-308098ffa1d3';

UPDATE articles
SET title = 'Suy tuyến thượng thận cấp: Cơn mệt lả tụt huyết áp trụy mạch sau ngưng thuốc đột ngột',
    slug = 'suy-tuyen-thuong-than-cap-con-met-la-tut-huyet-ap-truy-mach-sau-ngung-thuoc-dot-ngot',
    summary = 'Bài viết chuyên sâu về suy tuyến thượng thận cấp: cơn mệt lả tụt huyết áp trụy mạch sau ngưng thuốc đột ngột được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '9296f8f4-9c9e-f1fd-bf2f-3291aa3bef32';

UPDATE articles
SET title = 'Rối loạn chuyển hóa Calci và tuyến cận giáp: Cơn co thắt uốn bàn tay Tetany do hạ canxi máu',
    slug = 'roi-loan-chuyen-hoa-calci-va-tuyen-can-giap-con-co-that-uon-ban-tay-tetany-do-ha-canxi-mau',
    summary = 'Bài viết chuyên sâu về rối loạn chuyển hóa calci và tuyến cận giáp: cơn co thắt uốn bàn tay tetany do hạ canxi máu được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '9694ab9a-cc49-a568-e01f-ac93c0b3c663';

UPDATE articles
SET title = 'Bệnh u tuyến yên tăng tiết Prolactin: Dấu hiệu tiết sữa bất thường vô kinh và thuốc Dopamine',
    slug = 'benh-u-tuyen-yen-tang-tiet-prolactin-dau-hieu-tiet-sua-bat-thuong-vo-kinh-va-thuoc-dopamine',
    summary = 'Bài viết chuyên sâu về bệnh u tuyến yên tăng tiết prolactin: dấu hiệu tiết sữa bất thường vô kinh và thuốc dopamine được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = '96fe1997-37e7-01cc-3135-d97b305bece2';

UPDATE articles
SET title = 'Bệnh to đầu chi Acromegaly do tăng tiết GH: Thay đổi hình dạng bàn tay bàn chân khuôn mặt',
    slug = 'benh-to-dau-chi-acromegaly-do-tang-tiet-gh-thay-doi-hinh-dang-ban-tay-ban-chan-khuon-mat',
    summary = 'Bài viết chuyên sâu về bệnh to đầu chi acromegaly do tăng tiết gh: thay đổi hình dạng bàn tay bàn chân khuôn mặt được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = 'b011d5de-1012-1001-6a01-2c68847e72ab';

UPDATE articles
SET title = 'Đái tháo nhạt: Dấu hiệu đi tiểu rất nhiều lần trong ngày kèm khát nước mãnh liệt liên tục',
    slug = 'dai-thao-nhat-dau-hieu-di-tieu-rat-nhieu-lan-trong-ngay-kem-khat-nuoc-manh-liet-lien-tuc',
    summary = 'Bài viết chuyên sâu về đái tháo nhạt: dấu hiệu đi tiểu rất nhiều lần trong ngày kèm khát nước mãnh liệt liên tục được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = 'b7a92f37-730e-5572-d271-c31c1a6c1f4d';

UPDATE articles
SET title = 'Béo phì bệnh lý và hội chứng chuyển hóa: Phác đồ giảm cân khoa học kết hợp thuốc GLP-1',
    slug = 'beo-phi-benh-ly-va-hoi-chung-chuyen-hoa-phac-do-giam-can-khoa-hoc-ket-hop-thuoc-glp-1',
    summary = 'Bài viết chuyên sâu về béo phì bệnh lý và hội chứng chuyển hóa: phác đồ giảm cân khoa học kết hợp thuốc glp-1 được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = 'c420ee39-ea2e-d214-831f-460e9c8f9abf';

UPDATE articles
SET title = 'Chăm sóc bàn chân người bệnh đái tháo đường: Phòng ngừa loét bàn chân và hoại tử cắt cụt chi',
    slug = 'cham-soc-ban-chan-nguoi-benh-dai-thao-duong-phong-ngua-loet-ban-chan-va-hoai-tu-cat-cut-chi',
    summary = 'Bài viết chuyên sâu về chăm sóc bàn chân người bệnh đái tháo đường: phòng ngừa loét bàn chân và hoại tử cắt cụt chi được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = 'c6b51200-d543-178e-0ce3-3d7751c8be30';

UPDATE articles
SET title = 'Biến chứng thần kinh tự chủ do đái tháo đường: Rối loạn nhu động dạ dày và hạ huyết áp tư thế',
    slug = 'bien-chung-than-kinh-tu-chu-do-dai-thao-duong-roi-loan-nhu-dong-da-day-va-ha-huyet-ap-tu-the',
    summary = 'Bài viết chuyên sâu về biến chứng thần kinh tự chủ do đái tháo đường: rối loạn nhu động dạ dày và hạ huyết áp tư thế được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = 'e29f06bd-8ac8-38b9-a60b-35896bea30bf';

UPDATE articles
SET title = 'Tăng acid uric máu không triệu chứng: Khi nào cần dùng thuốc hạ acid uric dự phòng cơn gút',
    slug = 'tang-acid-uric-mau-khong-trieu-chung-khi-nao-can-dung-thuoc-ha-acid-uric-du-phong-con-gut',
    summary = 'Bài viết chuyên sâu về tăng acid uric máu không triệu chứng: khi nào cần dùng thuốc hạ acid uric dự phòng cơn gút được tham vấn y khoa bởi các chuyên gia Nội tiết Bệnh viện HealthCare. Cung cấp kiến thức về cơ chế sinh bệnh, triệu chứng điển hình, phác đồ điều trị và biện pháp phòng ngừa chuẩn y tế.',
    cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg',
    category = 'Nội tiết'
WHERE id = 'e9e5b420-f1f6-7ec5-183d-9c7d325b7e84';