-- V125__restore_admin_mutable_authority.sql
-- Ensure system administrators have non-demo authority so they can manage user accounts.
UPDATE users SET is_demo = FALSE
WHERE email IN ('admin@healthcare.com', 'admin@healthcare.local');
