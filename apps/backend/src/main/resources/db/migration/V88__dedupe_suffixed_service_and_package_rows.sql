-- V88__dedupe_suffixed_service_and_package_rows.sql
-- Catalog hygiene: the live catalog carries rows cloned from one base
-- service/package with cosmetic "· Cấp độ N" / "(Hạng N)" suffixes (applied
-- directly to the environment outside versioned migrations). Patients saw ten
-- near-identical cards for a single real service. Deactivate every suffixed
-- duplicate while an active canonical row keeps the base name; both UPDATEs
-- are idempotent and touch nothing else. Fresh databases (which never had the
-- suffixed rows) are unaffected.

UPDATE services AS s
   SET active = FALSE
 WHERE s.active
   AND s.name ~ ' · Cấp độ [0-9]+$'
   AND EXISTS (
       SELECT 1
         FROM services AS c
        WHERE c.active
          AND c.id <> s.id
          AND c.name = regexp_replace(s.name, ' · Cấp độ [0-9]+$', '')
   );

UPDATE packages AS p
   SET active = FALSE
 WHERE p.active
   AND p.name ~ ' \(Hạng [0-9]+\)$'
   AND EXISTS (
       SELECT 1
         FROM packages AS c
        WHERE c.active
          AND c.id <> p.id
          AND c.name = regexp_replace(p.name, ' \(Hạng [0-9]+\)$', '')
   );
