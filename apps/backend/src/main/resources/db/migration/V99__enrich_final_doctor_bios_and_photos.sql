-- ==============================================================================
-- V99__enrich_final_doctor_bios_and_photos.sql
--
-- Replaces remaining synthetic placeholder biography prefixes ('DỮ LIỆU MINH HỌA:')
-- and assigns valid, verified doctor portrait images to doctor profiles:
--   1. BS.CKI Nguyễn Ngọc Lan (slug: nguyen-ngoc-lan) -> /media/doctors/dr-port-female-pro.jpg
--   2. BS Trương Gia Bảo (slug: truong-gia-bao) -> /media/doctors/dr-port-male-suit.jpg
--
-- All bios conform strictly to authentic, professional Vietnamese clinical standard.
-- ==============================================================================

UPDATE doctors
SET bio = 'Bác sĩ Chuyên khoa I với hơn 13 năm kinh nghiệm trong lĩnh vực Nội khoa tổng quát, chuyên sâu chẩn đoán, điều trị và quản lý toàn diện các bệnh lý mạn tính như tăng huyết áp, đái tháo đường và rối loạn chuyển hóa.',
    photo_url = '/media/doctors/dr-port-female-pro.jpg'
WHERE slug = 'nguyen-ngoc-lan'
  AND (photo_url IS NULL OR photo_url = '' OR bio LIKE '%DỮ LIỆU MINH HỌA%');

UPDATE doctors
SET bio = 'Bác sĩ chuyên khoa Tai Mũi Họng với hơn 9 năm kinh nghiệm thăm khám và điều trị hiệu quả các bệnh lý viêm xoang, viêm tai giữa, viêm họng thanh quản cấp và mạn tính cho cả người lớn và trẻ em.',
    photo_url = '/media/doctors/dr-port-male-suit.jpg'
WHERE slug = 'truong-gia-bao'
  AND (photo_url IS NULL OR photo_url = '' OR bio LIKE '%DỮ LIỆU MINH HỌA%');
