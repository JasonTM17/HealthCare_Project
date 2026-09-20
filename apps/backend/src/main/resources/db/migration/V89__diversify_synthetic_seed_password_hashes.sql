-- V89__diversify_synthetic_seed_password_hashes.sql
-- The V87 synthetic users were seeded with one identical BCrypt digest: every
-- demo account shared a single salt, so one password opened all of them and
-- the digests were indistinguishable in the database. This migration gives
-- each account its own digest of the same documented demo password
-- (HealthCare@2026, matching V58), without touching the applied V87 script
-- (editing an applied migration would break Flyway checksum validation on
-- every deployed environment).
--
-- Idempotent: a row is updated only while it still carries the shared digest.
-- Fresh databases already receive distinct digests from V87's updated content,
-- so this migration is a no-op for them.

UPDATE users
   SET password_hash = '$2b$10$rkV4fLWbrKpbUTmGFsXMser3XigyWtH2gLkWyuGaO25V5fysYVT/6'
 WHERE id = '80000000-0000-0000-0001-000000000001'
   AND email = 'patient_enterprise_1@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$QddRQzfAKc2RApP1W8SuN.tU7cb.cOB/tm0R0.n.BbIFfUSBTI7de'
 WHERE id = '80000000-0000-0000-0001-000000000002'
   AND email = 'patient_enterprise_2@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$teJCaqzQ7Co4Rfrhe/8lu.LHTwDXpTA9VlZZrzXcSzNRs8aqPJ4ZW'
 WHERE id = '80000000-0000-0000-0001-000000000003'
   AND email = 'patient_enterprise_3@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$nfpPixsuCc.OmsNbRqAbzOLRTAnQna6dMrj4oXbmi8pmvbcFDYFpy'
 WHERE id = '80000000-0000-0000-0001-000000000004'
   AND email = 'patient_enterprise_4@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$av4hhI5wCCm.P5jImQ7U.O2rUVG6Gt9kkmEB6X8VT409/oU1sB4Im'
 WHERE id = '80000000-0000-0000-0001-000000000005'
   AND email = 'patient_enterprise_5@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$kFydIJ.6IrTxlNQVB8dryeqGHK2zvVWHldv0MGymo5opTKwGyR5Xa'
 WHERE id = '80000000-0000-0000-0001-000000000006'
   AND email = 'patient_enterprise_6@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$b9ZgE8JNuMrPrqOqpLVGGOA36eaPFm27JHCMcYyPkYQPDS9zU..n6'
 WHERE id = '80000000-0000-0000-0001-000000000007'
   AND email = 'patient_enterprise_7@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$4rXtFC3.NfHb/ovp8O0J7.tb6tsv6mkkeu/FREAhQGPzmHIp77P1u'
 WHERE id = '80000000-0000-0000-0001-000000000008'
   AND email = 'patient_enterprise_8@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$EB7v4Z4ZZLEEe0v1KSJJC.dXCVKEqor.59Iocls/fhbRLK0otVEEO'
 WHERE id = '80000000-0000-0000-0001-000000000009'
   AND email = 'patient_enterprise_9@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$0jFhCERsAopQA.NAArF.UexTB5FYu/YnhqcBic0Gb0iAyJXTIpZOe'
 WHERE id = '80000000-0000-0000-0001-00000000000a'
   AND email = 'patient_enterprise_10@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$4R.RcIo1f5vwOY2KkfVofulGpwTHMmYKRPr1JRQTM.tM0MiJlPxtO'
 WHERE id = '80000000-0000-0000-0001-00000000000b'
   AND email = 'patient_enterprise_11@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$g8FHRFeLZq6mp2sY2/UJ4uDXYfEZX7G4PZcDpnQ5fIOVzaH9vAmaq'
 WHERE id = '80000000-0000-0000-0001-00000000000c'
   AND email = 'patient_enterprise_12@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$2QKjijdek/lKEo2v.JtRUOt0MszeH92YeQ9uRve.xJCPLQ/Szxqla'
 WHERE id = '80000000-0000-0000-0001-00000000000d'
   AND email = 'patient_enterprise_13@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$6b2DfpYKcVRbaagm5.dnT.O6dAYqJOip49KHx0NYfZ1D0YcDNSLyK'
 WHERE id = '80000000-0000-0000-0001-00000000000e'
   AND email = 'patient_enterprise_14@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';

UPDATE users
   SET password_hash = '$2b$10$WxaY2dvETqzFgihWSPe2m.J2Ko7SR75An74Zbx6nrQbKpG2piXoX2'
 WHERE id = '80000000-0000-0000-0001-00000000000f'
   AND email = 'patient_enterprise_15@healthcare.id.vn'
   AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye';
