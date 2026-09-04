-- V63__update_patient_avatar_asset.sql
-- Assign dedicated realistic male patient avatar for demo patient Nguyễn Văn An (patient@healthcare.com)
-- Replaces previous placeholder hospital team photo with individual patient portrait asset

UPDATE patient_profiles
SET avatar_url = '/media/patient-male-avatar.jpg'
WHERE user_id IN (SELECT id FROM users WHERE email = 'patient@healthcare.com')
   OR email = 'patient@healthcare.com';
