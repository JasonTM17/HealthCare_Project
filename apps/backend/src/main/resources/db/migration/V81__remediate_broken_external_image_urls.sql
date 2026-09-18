-- V81__remediate_broken_external_image_urls.sql
-- Remediate 404 broken external URLs discovered during Wukong adversarial audit.

-- 1. Replace broken Unsplash article covers with reliable local clinical imagery
UPDATE articles
SET cover_image_url = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg'
WHERE cover_image_url LIKE '%photo-1512290900672-1f4a9b5fef22%';

-- 2. Replace broken doctor photos with reliable local clinical doctor portraits
UPDATE doctors
SET photo_url = '/media/doctors/doctor-1.jpg'
WHERE photo_url LIKE '%photo-1594824813571-638f026361a6%';
