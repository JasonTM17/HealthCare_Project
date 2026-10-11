-- Local demo only: the login page's quick-login "Bác sĩ" button signs in as
-- doctor@healthcare.com, so that persona must own the populated demo profile.
-- The compose seed binds that profile to doctor@healthcare.local; swap them so
-- both personas keep an ACTIVE doctors row (uq_doctors_user_id allows one each).
UPDATE doctors SET user_id = NULL
WHERE user_id IN (SELECT id FROM users WHERE email IN ('doctor@healthcare.com', 'doctor@healthcare.local'));

UPDATE doctors SET user_id = (SELECT id FROM users WHERE email = 'doctor@healthcare.com'), active = TRUE
WHERE slug = 'nguyen-minh-khoi'
  AND EXISTS (SELECT 1 FROM users WHERE email = 'doctor@healthcare.com');

UPDATE doctors SET user_id = (SELECT id FROM users WHERE email = 'doctor@healthcare.local'), active = TRUE
WHERE id = '30000000-0000-0000-0000-000000000005'
  AND EXISTS (SELECT 1 FROM users WHERE email = 'doctor@healthcare.local');
