-- Local-dev repair: packages referenced by V87
SET search_path = public;

INSERT INTO packages (id, name, slug, description, price, active)
SELECT 'eaa5b00f-0290-3672-945d-9ac715b07b3c', 'Gói kiểm tra Cơ xương khớp & Phòng chống Loãng xương (Hạng 6)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-6' AND id <> 'eaa5b00f-0290-3672-945d-9ac715b07b3c') THEN 'goi-6-imp' ELSE 'goi-6' END, 'Đo mật độ xương DEXA, xét nghiệm Calci ion, Acid Uric máu và chụp X-quang khớp gối hoặc cột sống thắt lưng.', 3200000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = 'eaa5b00f-0290-3672-945d-9ac715b07b3c');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '179579a2-744b-571e-7887-a371a50aa4f8', 'Gói kiểm tra Cơ xương khớp & Phòng chống Loãng xương (Hạng 3)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-32' AND id <> '179579a2-744b-571e-7887-a371a50aa4f8') THEN 'goi-32-imp' ELSE 'goi-32' END, 'Đo mật độ xương DEXA, xét nghiệm Calci ion, Acid Uric máu và chụp X-quang khớp gối hoặc cột sống thắt lưng.', 2600000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '179579a2-744b-571e-7887-a371a50aa4f8');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '16931bc9-6b86-3cc4-de8e-53670e99ce41', 'Gói khám sức khỏe tổng quát Định kỳ Chuẩn (Hạng 6)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-54' AND id <> '16931bc9-6b86-3cc4-de8e-53670e99ce41') THEN 'goi-54-imp' ELSE 'goi-54' END, 'Rà soát toàn diện 25 chỉ số sinh hóa, huyết học, X-quang phổi và siêu âm ổ bụng tổng quát cho người trưởng thành.', 2850000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '16931bc9-6b86-3cc4-de8e-53670e99ce41');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '7a70d6c6-82fb-e926-f76e-a824384abd12', 'Gói tầm soát Đột quỵ Não & Bệnh lý Mạch máu Chuyên sâu (Hạng 3)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-33' AND id <> '7a70d6c6-82fb-e926-f76e-a824384abd12') THEN 'goi-33-imp' ELSE 'goi-33' END, 'Chụp cộng hưởng từ sọ não và mạch máu não MRA 1.5 Tesla, siêu âm Doppler động mạch cảnh và điện tâm đồ.', 5200000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '7a70d6c6-82fb-e926-f76e-a824384abd12');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '81ffe666-2065-f436-5a81-eb44eb6333fc', 'Gói tầm soát Đột quỵ Não & Bệnh lý Mạch máu Chuyên sâu (Hạng 8)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-79' AND id <> '81ffe666-2065-f436-5a81-eb44eb6333fc') THEN 'goi-79-imp' ELSE 'goi-79' END, 'Chụp cộng hưởng từ sọ não và mạch máu não MRA 1.5 Tesla, siêu âm Doppler động mạch cảnh và điện tâm đồ.', 6200000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '81ffe666-2065-f436-5a81-eb44eb6333fc');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '946ce7df-65e3-1a39-68ee-043db4ca6b3f', 'Gói tầm soát Tim mạch và Huyết áp Nâng cao', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-10' AND id <> '946ce7df-65e3-1a39-68ee-043db4ca6b3f') THEN 'goi-10-imp' ELSE 'goi-10' END, 'Đánh giá nguy cơ xơ vữa động mạch, đo điện tâm đồ gắng sức, siêu âm tim Doppler và định lượng men tim chuyên sâu.', 3200000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '946ce7df-65e3-1a39-68ee-043db4ca6b3f');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '4c5024ec-29cb-e9d3-bce9-7805c9ef34fc', 'Gói tầm soát Đột quỵ Não & Bệnh lý Mạch máu Chuyên sâu (Hạng 7)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-7' AND id <> '4c5024ec-29cb-e9d3-bce9-7805c9ef34fc') THEN 'goi-7-imp' ELSE 'goi-7' END, 'Chụp cộng hưởng từ sọ não và mạch máu não MRA 1.5 Tesla, siêu âm Doppler động mạch cảnh và điện tâm đồ.', 6000000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '4c5024ec-29cb-e9d3-bce9-7805c9ef34fc');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT 'dbfb4e7f-da3d-57d3-3573-c26528482839', 'Gói khám Sức khỏe VIP Doanh nhân Toàn diện (Hạng 9)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-9' AND id <> 'dbfb4e7f-da3d-57d3-3573-c26528482839') THEN 'goi-9-imp' ELSE 'goi-9' END, 'Khám toàn bộ các chuyên khoa với Giáo sư/Tiến sĩ, chụp MRI não, nội soi tiêu hóa trọn gói và dịch vụ phòng chờ VIP.', 10500000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = 'dbfb4e7f-da3d-57d3-3573-c26528482839');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '77823225-a569-2ce2-b913-4c6d71adfac8', 'Gói chăm sóc Sức khỏe Phụ nữ Toàn diện', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-11' AND id <> '77823225-a569-2ce2-b913-4c6d71adfac8') THEN 'goi-11-imp' ELSE 'goi-11' END, 'Khám phụ khoa, siêu âm tuyến vú, siêu âm tử cung phần phụ và xét nghiệm sàng lọc tế bào cổ tử cung ThinPrep.', 2650000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '77823225-a569-2ce2-b913-4c6d71adfac8');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '44efce0e-6734-a401-7714-50c710221fe2', 'Gói khám Tiền hôn nhân cho Cặp đôi (Hạng 8)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-8' AND id <> '44efce0e-6734-a401-7714-50c710221fe2') THEN 'goi-8-imp' ELSE 'goi-8' END, 'Kiểm tra sức khỏe sinh sản, xét nghiệm bệnh truyền nhiễm, nhóm máu Rh và sàng lọc gen bệnh tan máu Thalassemia.', 5000000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '44efce0e-6734-a401-7714-50c710221fe2');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT 'a7fc3862-6ed1-b5f8-8803-02ddee4f6379', 'Gói tầm soát Đái tháo đường & Hội chứng Chuyển hóa (Hạng 8)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-77' AND id <> 'a7fc3862-6ed1-b5f8-8803-02ddee4f6379') THEN 'goi-77-imp' ELSE 'goi-77' END, 'Đo đường huyết lúc đói, HbA1c, bộ mỡ máu 4 thành phần, microalbumin niệu và soi đáy mắt phát hiện biến chứng sớm.', 3350000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = 'a7fc3862-6ed1-b5f8-8803-02ddee4f6379');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT 'f0f63287-50dd-36b4-b29d-07fbcf7a9f0a', 'Gói khám Tiền hôn nhân cho Cặp đôi (Hạng 3)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-34' AND id <> 'f0f63287-50dd-36b4-b29d-07fbcf7a9f0a') THEN 'goi-34-imp' ELSE 'goi-34' END, 'Kiểm tra sức khỏe sinh sản, xét nghiệm bệnh truyền nhiễm, nhóm máu Rh và sàng lọc gen bệnh tan máu Thalassemia.', 4000000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = 'f0f63287-50dd-36b4-b29d-07fbcf7a9f0a');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT 'a94904c5-e237-4f3e-fa94-fb3e030df87b', 'Gói kiểm tra Sức khỏe Trẻ em & Phát triển Thể chất', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-12' AND id <> 'a94904c5-e237-4f3e-fa94-fb3e030df87b') THEN 'goi-12-imp' ELSE 'goi-12' END, 'Đánh giá dinh dưỡng, vi chất, siêu âm bụng tổng quát, kiểm tra thị lực, tai mũi họng và tư vấn tiêm chủng cho bé.', 1450000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = 'a94904c5-e237-4f3e-fa94-fb3e030df87b');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '3bacd204-83af-68a6-9781-a12472ee71bf', 'Gói tầm soát Đái tháo đường & Hội chứng Chuyển hóa (Hạng 5)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-5' AND id <> '3bacd204-83af-68a6-9781-a12472ee71bf') THEN 'goi-5-imp' ELSE 'goi-5' END, 'Đo đường huyết lúc đói, HbA1c, bộ mỡ máu 4 thành phần, microalbumin niệu và soi đáy mắt phát hiện biến chứng sớm.', 2750000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '3bacd204-83af-68a6-9781-a12472ee71bf');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '097bdfc5-d514-1245-b3fe-72e04d871339', 'Gói tầm soát Đái tháo đường & Hội chứng Chuyển hóa (Hạng 3)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-31' AND id <> '097bdfc5-d514-1245-b3fe-72e04d871339') THEN 'goi-31-imp' ELSE 'goi-31' END, 'Đo đường huyết lúc đói, HbA1c, bộ mỡ máu 4 thành phần, microalbumin niệu và soi đáy mắt phát hiện biến chứng sớm.', 2350000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '097bdfc5-d514-1245-b3fe-72e04d871339');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '5d19a424-51c3-148f-b00a-14528aa09300', 'Gói khám Sức khỏe VIP Doanh nhân Toàn diện (Hạng 3)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-35' AND id <> '5d19a424-51c3-148f-b00a-14528aa09300') THEN 'goi-35-imp' ELSE 'goi-35' END, 'Khám toàn bộ các chuyên khoa với Giáo sư/Tiến sĩ, chụp MRI não, nội soi tiêu hóa trọn gói và dịch vụ phòng chờ VIP.', 9300000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '5d19a424-51c3-148f-b00a-14528aa09300');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '938260f7-85fb-43d2-b9f6-b14c46a39e16', 'Gói kiểm tra Sức khỏe Trẻ em & Phát triển Thể chất (Hạng 4)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-4' AND id <> '938260f7-85fb-43d2-b9f6-b14c46a39e16') THEN 'goi-4-imp' ELSE 'goi-4' END, 'Đánh giá dinh dưỡng, vi chất, siêu âm bụng tổng quát, kiểm tra thị lực, tai mũi họng và tư vấn tiêm chủng cho bé.', 2050000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '938260f7-85fb-43d2-b9f6-b14c46a39e16');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '8d47632e-e4d1-82a5-30f6-2d88fad7f176', 'Gói khám sức khỏe tổng quát Định kỳ Chuẩn (Hạng 4)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-36' AND id <> '8d47632e-e4d1-82a5-30f6-2d88fad7f176') THEN 'goi-36-imp' ELSE 'goi-36' END, 'Rà soát toàn diện 25 chỉ số sinh hóa, huyết học, X-quang phổi và siêu âm ổ bụng tổng quát cho người trưởng thành.', 2450000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '8d47632e-e4d1-82a5-30f6-2d88fad7f176');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT '3359a223-3b09-6aa1-7415-c6be16271649', 'Gói kiểm tra Cơ xương khớp & Phòng chống Loãng xương (Hạng 8)', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-78' AND id <> '3359a223-3b09-6aa1-7415-c6be16271649') THEN 'goi-78-imp' ELSE 'goi-78' END, 'Đo mật độ xương DEXA, xét nghiệm Calci ion, Acid Uric máu và chụp X-quang khớp gối hoặc cột sống thắt lưng.', 3600000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = '3359a223-3b09-6aa1-7415-c6be16271649');
INSERT INTO packages (id, name, slug, description, price, active)
SELECT 'ed23f337-3ee2-8c5b-51a7-a5fb511cd00b', 'Gói khám sức khỏe tổng quát Định kỳ Chuẩn', CASE WHEN EXISTS (SELECT 1 FROM packages WHERE slug='goi-1' AND id <> 'ed23f337-3ee2-8c5b-51a7-a5fb511cd00b') THEN 'goi-1-imp' ELSE 'goi-1' END, 'Rà soát toàn diện 25 chỉ số sinh hóa, huyết học, X-quang phổi và siêu âm ổ bụng tổng quát cho người trưởng thành.', 1850000.0, true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = 'ed23f337-3ee2-8c5b-51a7-a5fb511cd00b');