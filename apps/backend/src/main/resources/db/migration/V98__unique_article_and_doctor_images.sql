-- ==============================================================================
-- V98__unique_article_and_doctor_images.sql
--
-- The seeded catalog reused a small pool of cover images (52 articles shared
-- 18 files; 22 doctor profiles shared 10 portraits), so list and detail pages
-- repeated the same photo. This migration remaps every duplicated seed cover and
-- demo-doctor portrait to its own locally stored image (Unsplash License, files
-- committed under public/media and documented in public/media/ATTRIBUTIONS.md).
--
-- Each UPDATE is pinned to the slug AND the seed-era asset value, so a cover an
-- operator changed through the admin screens before this migration runs is
-- never overwritten (an adversarial review flagged the slug-only predicate).
-- On a database where the migration already applied, the old-value predicate
-- would simply be a no-op on re-execution.
-- ==============================================================================
UPDATE articles SET cover_image_url = '/media/articles/cv-cardio-steth-heart.jpg'
    WHERE slug = 'benh-tim-mach-pho-bien-tam-soat-dinh-ky' AND cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-cardio-diet-heart.jpg'
    WHERE slug = 'che-do-an-dash-giam-muoi-loi-ich-kiem-soat-huyet-ap-va-bao-ve-thanh-mach' AND cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-cardio-heart-model.jpg'
    WHERE slug = 'dau-hieu-canh-bao-benh-tim-mach' AND cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-cardio-bp-device.jpg'
    WHERE slug = 'tam-soat-phat-hien-som-tang-huyet-ap-va-dai-thao-duong-tai-y-te-co-so-quan-ly-benh-khong-lay-nhiem' AND cover_image_url = '/media/articles/5-dau-hieu-tim-mach.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-nurse-child.jpg'
    WHERE slug = 'bu-dich-tieu-chay-cap-tre-em-1788788709766' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-medical-desk.jpg'
    WHERE slug = 'canh-bao-viem-tieu-phe-quan-nhu-nhi-1788788676856' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-calm.jpg'
    WHERE slug = 'dau-da-day-lien-quan-stress-hieu-dung-de-dieu-tri' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-surgery-team.jpg'
    WHERE slug = 'dieu-tri-nhoi-mau-co-tim-1788788709766' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-food-veggies.jpg'
    WHERE slug = 'kiem-soat-hoi-chung-chuyen-hoa-1788788709766' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-endoscopy.jpg'
    WHERE slug = 'noi-soi-tieu-hoa-khong-dau-1788788709766' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-patient-hand.jpg'
    WHERE slug = 'phac-do-suy-tim-esc-2026-1788788676856' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-meds-orange.jpg'
    WHERE slug = 'phac-do-tiet-tru-hp-2026-1788788676856' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-headache-woman.jpg'
    WHERE slug = 'quan-ly-dau-dau-migraine-1788788709766' AND cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-physio-knee.jpg'
    WHERE slug = 'thoai-hoa-cot-song-that-lung-phong-ngua' AND cover_image_url = '/media/articles/co-xuong-khop.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-physio.jpg'
    WHERE slug = 'viem-khop-goi-thoai-hoa-va-tap-luyen-dung' AND cover_image_url = '/media/articles/co-xuong-khop.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-cardio-running.jpg'
    WHERE slug = 'bac-cau-mach-vanh-it-xam-lan-1788788747899' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-neuro-mri-scans.jpg'
    WHERE slug = 'dau-dau-set-danh-va-xuat-huyet-duoi-nhen-1788788747899' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-hospital-hall.jpg'
    WHERE slug = 'dieu-tri-ruot-kich-thich-ibs-1788788796123' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-lab-tubes.jpg'
    WHERE slug = 'kiem-soat-da-yeu-to-tim-mach-tieud-duong-1788788747899' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-lab-blood-samples.jpg'
    WHERE slug = 'kiem-soat-than-man-tieud-duong-1788788796123' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-skincare.jpg'
    WHERE slug = 'mesotherapy-vi-diem-cung-cap-ha-vitamin-va-peptide-nuoi-duong-lan-da-cang-bong-min-mang' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-neuro-mri-room.jpg'
    WHERE slug = 'sa-sut-tri-tue-mach-mau-1788788796123' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-cardio-bp-cuff.jpg'
    WHERE slug = 'tien-bo-roi-loan-nhip-tim-1788788796123' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-vaccine-arm.jpg'
    WHERE slug = 'viem-mang-nao-mu-tre-em-1788788747899' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-vaccine-gloves.jpg'
    WHERE slug = 'xu-tri-co-giat-sot-cao-tre-nho-1788788796123' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-hospital-beds.jpg'
    WHERE slug = 'xu-tri-xuat-huyet-tieu-hoa-tren-1788788747899' AND cover_image_url = '/media/articles/da-lieu.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-meds-spill.jpg'
    WHERE slug = 'suy-gian-tinh-mach-chi-duo-huong-dan' AND cover_image_url = '/media/articles/dau-hieu-tim-mach.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-salad.jpg'
    WHERE slug = 'benh-tri-dau-hieu-va-dieu-tri-dung-cach' AND cover_image_url = '/media/articles/dinh-duong-lanh-manh.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-cooking.jpg'
    WHERE slug = 'dinh-duong-hop-ly-nguoi-tang-huyet-ap' AND cover_image_url = '/media/articles/dinh-duong-lanh-manh.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-pregnant.jpg'
    WHERE slug = 'dai-thao-duong-thai-ky-nghiem-phap-dung-nap-75g-glucose-va-phac-do-dieu-hoa-duong-huyet' AND cover_image_url = '/media/articles/san-phu-khoa.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-meds-blister.jpg'
    WHERE slug = 'dinh-duong-thai-ky-theo-tung-tam-ca-nguyet-bo-sung-axit-folic-sat-canxi-va-dha-hop-ly' AND cover_image_url = '/media/articles/san-phu-khoa.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-lab-dna.jpg'
    WHERE slug = 'kiem-soat-tieu-duong-thai-ky-1788788676856' AND cover_image_url = '/media/articles/san-phu-khoa.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-pregnant-ultrasound.jpg'
    WHERE slug = 'sieu-am-thai-4d-hinh-thai-hoc-tuan-12-tuan-22-tuan-32-tam-soat-di-tat-cau-truc-thai-nhi' AND cover_image_url = '/media/articles/san-phu-khoa.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-meds-bottle.jpg'
    WHERE slug = 'viem-hong-cap-virus-hay-khu-can-khang-sinh' AND cover_image_url = '/media/articles/tai-mui-hong.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-meds-hand.jpg'
    WHERE slug = 'viem-xoang-man-tinh-dau-hieu-va-dieu-tri' AND cover_image_url = '/media/articles/tai-mui-hong.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-lab-microscope.jpg'
    WHERE slug = 'dai-thao-duong-type-2-nhan-biet-va-song-khoe' AND cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-vaccine-syringe.jpg'
    WHERE slug = 'tam-soat-va-phong-ngua-tieu-duong-type-2' AND cover_image_url = '/media/articles/tam-soat-tieu-duong.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-telemed-tablet.jpg'
    WHERE slug = 'can-thiep-noi-mach-dot-quy-cap-1788788676856' AND cover_image_url = '/media/articles/than-kinh-dot-quy.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-brain-stroke.jpg'
    WHERE slug = 'dot-quy-nao-cap-nhan-dien-dau-hieu-fast-va-quy-tac-45-gio-vang-tieu-soi-huyet' AND cover_image_url = '/media/articles/than-kinh-dot-quy.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-gym.jpg'
    WHERE slug = 'phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien' AND cover_image_url = '/media/articles/than-kinh-dot-quy.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-meditation.jpg'
    WHERE slug = 'roi-loan-tien-dinh-choang-vang-xay-tron' AND cover_image_url = '/media/articles/than-kinh-dot-quy.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-xray-knee.jpg'
    WHERE slug = 'dau-that-lung-nguyen-nhan-va-dieu-tri' AND cover_image_url = '/media/articles/thoai-hoa-cot-song.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-skin-cream2.jpg'
    WHERE slug = 'cham-soc-tre-sot-phat-ban-va-viem-tieu-phe-quan' AND cover_image_url = '/media/articles/tre-bieng-an.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-doc-female-tele.jpg'
    WHERE slug = 'tre-bieng-an-hieu-dung-de-cham-dung' AND cover_image_url = '/media/articles/tre-bieng-an.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-doc-patient.jpg'
    WHERE slug = 'test-hoi-tho-c13-chan-doan-vi-khuan-helicobacter-pylori-khong-xam-lan' AND cover_image_url = '/media/articles/viem-loet-da-day.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-hospital-reception.jpg'
    WHERE slug = 'viem-da-day-gerd-che-do-an-uong' AND cover_image_url = '/media/articles/viem-loet-da-day.jpg';
UPDATE articles SET cover_image_url = '/media/articles/cv-doctor-writing.jpg'
    WHERE slug = 'viem-loet-da-day-hp-va-nhung-dieu-can-biet' AND cover_image_url = '/media/articles/viem-loet-da-day.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-doc-male-arms.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000001' AND photo_url = '/media/doctors/doctor-1.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-doc-female-coat.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000002-10000000-0000-0000-0000-000000000001' AND photo_url = '/media/doctors/doctor-1.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-doc-stetho.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000002-10000000-0000-0000-0000-000000000003' AND photo_url = '/media/doctors/doctor-10.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-port-male3.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000005' AND photo_url = '/media/doctors/doctor-11.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-doc-blue.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000003' AND photo_url = '/media/doctors/doctor-2.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-doc-mask.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000007' AND photo_url = '/media/doctors/doctor-2.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-doc-whiteboard.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000002-10000000-0000-0000-0000-000000000006' AND photo_url = '/media/doctors/doctor-2.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-doc-female2.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000002-10000000-0000-0000-0000-000000000002' AND photo_url = '/media/doctors/doctor-4.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-doc-woman.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000004' AND photo_url = '/media/doctors/doctor-4.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-port-male-suit.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000006' AND photo_url = '/media/doctors/doctor-4.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-port-female-pro.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000002-10000000-0000-0000-0000-000000000004' AND photo_url = '/media/doctors/doctor-4.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-port-female.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000002' AND photo_url = '/media/doctors/doctor-7.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-port-male.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000008' AND photo_url = '/media/doctors/doctor-7.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-port-female-smile.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000002-10000000-0000-0000-0000-000000000005' AND photo_url = '/media/doctors/doctor-6.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-port-male2.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000002-10000000-0000-0000-0000-000000000008' AND photo_url = '/media/doctors/doctor-6.jpg';
UPDATE doctors SET photo_url = '/media/doctors/dr-port-female2.jpg'
    WHERE slug = 'demo-bs-20000000-0000-0000-0000-000000000002-10000000-0000-0000-0000-000000000007' AND photo_url = '/media/doctors/doctor-9.jpg';
