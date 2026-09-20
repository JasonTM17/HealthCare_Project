-- Local-dev repair v2: prod-identical specialties referenced by V86/V87
SET search_path = public;

INSERT INTO specialties (id, name, slug, description, active)
SELECT 'f5ca7735-d556-148a-ed43-65ca94e41ae5', 'Chấn thương chỉnh hình', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'chan-thuong-chinh-hinh' AND id <> 'f5ca7735-d556-148a-ed43-65ca94e41ae5') THEN 'chan-thuong-chinh-hinh-imp' ELSE 'chan-thuong-chinh-hinh' END, 'Điều trị gãy xương, trật khớp, chấn thương.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'f5ca7735-d556-148a-ed43-65ca94e41ae5');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '9cb56149-95dd-a351-ca75-b9b2f559d83b', 'Tiết niệu', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'tiet-nieu' AND id <> '9cb56149-95dd-a351-ca75-b9b2f559d83b') THEN 'tiet-nieu-imp' ELSE 'tiet-nieu' END, 'Điều trị bệnh lý thận, tiết niệu, nam khoa.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '9cb56149-95dd-a351-ca75-b9b2f559d83b');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'd898a94d-f778-a09e-a99c-060ebbbfd35e', 'Tai mũi họng', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'tai-mui-hong' AND id <> 'd898a94d-f778-a09e-a99c-060ebbbfd35e') THEN 'tai-mui-hong-imp' ELSE 'tai-mui-hong' END, 'Điều trị viêm họng, viêm xoang, rối loạn tiền đình.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'd898a94d-f778-a09e-a99c-060ebbbfd35e');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '7f80619b-9ece-f8d3-add2-12c4e6de963d', 'Mắt', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'mat' AND id <> '7f80619b-9ece-f8d3-add2-12c4e6de963d') THEN 'mat-imp' ELSE 'mat' END, 'Khám và điều trị bệnh lý mắt, đo kính.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '7f80619b-9ece-f8d3-add2-12c4e6de963d');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'd45a7cb5-269a-f76f-0554-ad3da3906c51', 'Nội tiết', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'noi-tiet' AND id <> 'd45a7cb5-269a-f76f-0554-ad3da3906c51') THEN 'noi-tiet-imp' ELSE 'noi-tiet' END, 'Điều trị tiểu đường, tuyến giáp, rối loạn chuyển hóa.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'd45a7cb5-269a-f76f-0554-ad3da3906c51');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '131199e1-749b-4a18-0c68-9605d41cb0a6', 'Thính học', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'thinh-hoc' AND id <> '131199e1-749b-4a18-0c68-9605d41cb0a6') THEN 'thinh-hoc-imp' ELSE 'thinh-hoc' END, 'Đánh giá thính lực, rối loạn thính giác.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '131199e1-749b-4a18-0c68-9605d41cb0a6');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'a9a176a3-00b5-0ed1-fb77-af6b1d7bd8d2', 'Cơ xương khớp', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'co-xuong-khop' AND id <> 'a9a176a3-00b5-0ed1-fb77-af6b1d7bd8d2') THEN 'co-xuong-khop-imp' ELSE 'co-xuong-khop' END, 'Điều trị đau khớp, thoái hóa cột sống, loãng xương.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'a9a176a3-00b5-0ed1-fb77-af6b1d7bd8d2');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '63263a8f-985d-56bd-4a91-cbc635681fb3', 'Ngoại khoa', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'ngoai-khoa' AND id <> '63263a8f-985d-56bd-4a91-cbc635681fb3') THEN 'ngoai-khoa-imp' ELSE 'ngoai-khoa' END, 'Phẫu thuật và can thiệp ngoại khoa tổng quát.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '63263a8f-985d-56bd-4a91-cbc635681fb3');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'ad181ca3-d18b-0da9-3d51-23b6150ae1aa', 'Da liễu thẩm mỹ', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'da-lieu-tham-my' AND id <> 'ad181ca3-d18b-0da9-3d51-23b6150ae1aa') THEN 'da-lieu-tham-my-imp' ELSE 'da-lieu-tham-my' END, 'Thẩm mỹ da, laser, điều trị sẹo.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'ad181ca3-d18b-0da9-3d51-23b6150ae1aa');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '82eecc5d-313f-8691-08f2-8adf830d567a', 'Hô hấp', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'ho-hap' AND id <> '82eecc5d-313f-8691-08f2-8adf830d567a') THEN 'ho-hap-imp' ELSE 'ho-hap' END, 'Khám và điều trị phổi, khí quản, dị ứng đường hô hấp.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '82eecc5d-313f-8691-08f2-8adf830d567a');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'd7851b0f-8adf-f780-b818-eb7670ec1e92', 'Huyết học', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'huyet-hoc' AND id <> 'd7851b0f-8adf-f780-b818-eb7670ec1e92') THEN 'huyet-hoc-imp' ELSE 'huyet-hoc' END, 'Điều trị bệnh lý máu, thiếu máu, rối loạn đông máu.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'd7851b0f-8adf-f780-b818-eb7670ec1e92');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '68c49671-774e-a89c-c9c1-b67a88de6bff', 'Giải phẫu bệnh', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'giai-phau-benh' AND id <> '68c49671-774e-a89c-c9c1-b67a88de6bff') THEN 'giai-phau-benh-imp' ELSE 'giai-phau-benh' END, 'Chẩn đoán bệnh lý mô, xét nghiệm giải phẫu.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '68c49671-774e-a89c-c9c1-b67a88de6bff');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '7eb6b5c1-3f8d-48c9-c54e-e35be9524ebf', 'Tiêu hóa', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'tieu-hoa' AND id <> '7eb6b5c1-3f8d-48c9-c54e-e35be9524ebf') THEN 'tieu-hoa-imp' ELSE 'tieu-hoa' END, 'Khám và điều trị bệnh lý dạ dày, đại tràng, gan mật.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '7eb6b5c1-3f8d-48c9-c54e-e35be9524ebf');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '3cd99926-6c7d-dd5b-183f-882ae9a0e469', 'Thần kinh', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'than-kinh' AND id <> '3cd99926-6c7d-dd5b-183f-882ae9a0e469') THEN 'than-kinh-imp' ELSE 'than-kinh' END, 'Khám và điều trị đau đầu, rối loạn giấc ngủ, bệnh lý thần kinh.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '3cd99926-6c7d-dd5b-183f-882ae9a0e469');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '462aa421-a88f-7105-7022-163467a83c2e', 'Ngoại thần kinh', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'ngoai-than-kinh' AND id <> '462aa421-a88f-7105-7022-163467a83c2e') THEN 'ngoai-than-kinh-imp' ELSE 'ngoai-than-kinh' END, 'Phẫu thuật sọ não, cột sống, dây thần kinh.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '462aa421-a88f-7105-7022-163467a83c2e');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '1a0976d1-bede-f974-5422-b58a922f0183', 'Dinh dưỡng', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'dinh-duong' AND id <> '1a0976d1-bede-f974-5422-b58a922f0183') THEN 'dinh-duong-imp' ELSE 'dinh-duong' END, 'Tư vấn chế độ ăn, dinh dưỡng lâm sàng.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '1a0976d1-bede-f974-5422-b58a922f0183');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '6a20be4b-ef6d-4d2f-b25d-11c2772440fd', 'Sản phụ khoa', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'san-phu-khoa' AND id <> '6a20be4b-ef6d-4d2f-b25d-11c2772440fd') THEN 'san-phu-khoa-imp' ELSE 'san-phu-khoa' END, 'Khám thai, tầm soát ung thư phụ khoa, sinh sản.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '6a20be4b-ef6d-4d2f-b25d-11c2772440fd');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '1a969127-309d-a67b-6460-48a75535074d', 'Y học cổ truyền', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'y-hoc-co-truyen' AND id <> '1a969127-309d-a67b-6460-48a75535074d') THEN 'y-hoc-co-truyen-imp' ELSE 'y-hoc-co-truyen' END, 'Bồi bổ, châm cứu, điều trị thuốc nam.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '1a969127-309d-a67b-6460-48a75535074d');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'b3379f28-d281-e976-0690-a0238f3b2038', 'Y tế công cộng', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'y-te-cong-cong' AND id <> 'b3379f28-d281-e976-0690-a0238f3b2038') THEN 'y-te-cong-cong-imp' ELSE 'y-te-cong-cong' END, 'Phòng bệnh, tiêm chủng, sức khỏe cộng đồng.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'b3379f28-d281-e976-0690-a0238f3b2038');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '5c20abac-9079-f9db-2819-3cbf167603b5', 'Tim mạch', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'tim-mach' AND id <> '5c20abac-9079-f9db-2819-3cbf167603b5') THEN 'tim-mach-imp' ELSE 'tim-mach' END, 'Khám và điều trị bệnh lý tim, mạch máu, tăng huyết áp.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '5c20abac-9079-f9db-2819-3cbf167603b5');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b', 'Sơ cấp cứu', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'so-cap-cuu' AND id <> 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b') THEN 'so-cap-cuu-imp' ELSE 'so-cap-cuu' END, 'Xử trí cấp cứu, hồi sức tích cực.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2', 'Da liễu', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'da-lieu' AND id <> '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2') THEN 'da-lieu-imp' ELSE 'da-lieu' END, 'Điều trị bệnh lý da, tóc, móng và thẩm mỹ da.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'c9eb17b1-996b-ef18-1057-7f6c9a550da0', 'Nam khoa', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'nam-khoa' AND id <> 'c9eb17b1-996b-ef18-1057-7f6c9a550da0') THEN 'nam-khoa-imp' ELSE 'nam-khoa' END, 'Khám và điều trị bệnh lý nam giới.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'c9eb17b1-996b-ef18-1057-7f6c9a550da0');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '2eba03c7-5d06-d23a-e7cb-4f74926ff849', 'Phục hồi chức năng', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'phuc-hoi-chuc-nang' AND id <> '2eba03c7-5d06-d23a-e7cb-4f74926ff849') THEN 'phuc-hoi-chuc-nang-imp' ELSE 'phuc-hoi-chuc-nang' END, 'Vật lý trị liệu, phục hồi sau bệnh.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '2eba03c7-5d06-d23a-e7cb-4f74926ff849');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '993e92ff-b71f-ae7c-090f-52572e5e3f11', 'Ung bướu', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'ung-buou' AND id <> '993e92ff-b71f-ae7c-090f-52572e5e3f11') THEN 'ung-buou-imp' ELSE 'ung-buou' END, 'Theo dõi và điều trị ung bướu, ung thư.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '993e92ff-b71f-ae7c-090f-52572e5e3f11');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'b47e0424-db07-65b2-d1f4-fc4e290ae4d6', 'Nhi khoa', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'nhi-khoa' AND id <> 'b47e0424-db07-65b2-d1f4-fc4e290ae4d6') THEN 'nhi-khoa-imp' ELSE 'nhi-khoa' END, 'Khám và điều trị bệnh lý trẻ em.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'b47e0424-db07-65b2-d1f4-fc4e290ae4d6');
INSERT INTO specialties (id, name, slug, description, active)
SELECT 'be4bd45f-857d-6836-c2e0-00bd6d6ad36c', 'Nội mạch máu', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'noi-mach-mau' AND id <> 'be4bd45f-857d-6836-c2e0-00bd6d6ad36c') THEN 'noi-mach-mau-imp' ELSE 'noi-mach-mau' END, 'Can thiệp mạch máu, siêu âm Doppler.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = 'be4bd45f-857d-6836-c2e0-00bd6d6ad36c');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '2065b16f-10a5-3781-439c-62dba14e4b52', 'Răng hàm mặt', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'rang-ham-mat' AND id <> '2065b16f-10a5-3781-439c-62dba14e4b52') THEN 'rang-ham-mat-imp' ELSE 'rang-ham-mat' END, 'Khám và điều trị răng, hàm, mặt.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '2065b16f-10a5-3781-439c-62dba14e4b52');
INSERT INTO specialties (id, name, slug, description, active)
SELECT '847f0834-7126-6c7d-bf07-610a46400a82', 'Nội tổng hợp', CASE WHEN EXISTS (SELECT 1 FROM specialties WHERE slug = 'noi-tong-hop' AND id <> '847f0834-7126-6c7d-bf07-610a46400a82') THEN 'noi-tong-hop-imp' ELSE 'noi-tong-hop' END, 'Khám sàng lọc, quản lý bệnh mãn tính.', true
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE id = '847f0834-7126-6c7d-bf07-610a46400a82');
INSERT INTO doctors (id, full_name, slug, bio, active)
SELECT '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', 'BS.CKII Phạm Quốc Yến', CASE WHEN EXISTS (SELECT 1 FROM doctors WHERE slug = 'bs-333' AND id <> '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc') THEN 'bs-333-imp' ELSE 'bs-333' END, 'BS.CKII Phạm Quốc Yến có hơn 26 năm kinh nghiệm chuyên sâu trong lĩnh vực Cơ xương khớp. Tốt nghiệp Bác sĩ Chuyên khoa tại Đại học Y Dược TP.HCM và tu nghiệp nâng cao tại các bệnh viện tuyến đầu, bác sĩ luôn cẩn trọng, tận tâm và đồng hành sát sao cùng người bệnh trong quá trình thăm khám, chẩn đoán và điều trị.', true
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE id = '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc');