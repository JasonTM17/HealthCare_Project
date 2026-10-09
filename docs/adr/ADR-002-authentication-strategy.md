# ADR-002: Authentication Strategy

## Status

Accepted for the application-owned identity and session boundary. Production
readiness requires deployment evidence in addition to this decision.

## Context and decision

Patients, doctors, and administrators share an identity system but have
different clinical and operational authority. Use application-owned
email/password authentication, BCrypt password hashing, JWT access tokens,
refresh rotation, and database-backed roles. Browser transport uses the
same-origin BFF and HttpOnly session cookies; direct bearer access remains a
separate API-client boundary.

The owners are [AuthService](../../apps/backend/src/main/java/com/healthcare/auth/AuthService.java),
[BrowserSessionService](../../apps/backend/src/main/java/com/healthcare/auth/service/BrowserSessionService.java),
and the [frontend BFF](../../apps/frontend/lib/server/healthcare-bff.ts).
JWT lifetime, secret, and claim validation belong to
[JwtProperties](../../apps/backend/src/main/java/com/healthcare/security/JwtProperties.java)
and [JwtTokenProvider](../../apps/backend/src/main/java/com/healthcare/security/JwtTokenProvider.java),
not duplicated policy values in this ADR.

## Account governance rationale

Legacy account status/role `PATCH` requests and professional lifecycle writers
share the same governance service. Legacy bodies remain supported, while their
actor checks, last eligible administrator protection, credential epoch and
session revocation cannot bypass the shared boundary. Account-success audit
records participate in the mutation transaction; a failed audit insert rolls
back account and credential state. Independent clinical read audits retain
their existing transaction policy.

Administrative convenience must not remove the ability to recover access.
Preserve the acting administrator's access and the final active, verified,
non-demo administrator, including when changes race. Shared demo identities
are not eligible recovery administrators and must not be mutated through
account management.

A permission or identity change is a security boundary even if the account
later returns to its previous status or roles. `securityVersion` is the
monotonic credential epoch that prevents old access from reviving after an
unlock or re-promotion. Pair it with refresh, browser-session, and OTP
revocation; relying on the current role alone would allow stale credentials
to become valid again. PostgreSQL governance and ordered user locks protect
this decision across concurrent administrators, with the actor revalidated
after locking rather than trusted from an earlier request snapshot.

[AccountGovernance](../../apps/backend/src/main/java/com/healthcare/user/service/AccountGovernance.java)
owns mutation ordering and credential invalidation;
[JwtAuthenticationFilter](../../apps/backend/src/main/java/com/healthcare/security/JwtAuthenticationFilter.java)
owns the fresh database identity/epoch check. Legacy tokens without an epoch
are interpreted as epoch zero for compatibility, not as an exemption from
revocation. See [account integration coverage](../../apps/backend/src/test/java/com/healthcare/user/AdminAccountIntegrationTest.java)
and [governance race coverage](../../apps/backend/src/test/java/com/healthcare/user/AdminAccountGovernanceConcurrencyTest.java).

## Verification and clinical identity

Creating an account or requesting its verification message is not proof of
email ownership. New administrative creations remain unverified until the
established verification workflow succeeds. `REQUESTED_UNCONFIRMED` means a
mail request, not confirmed delivery; SMTP/outbox evidence must establish the
latter. The owners are [AdminAccountService](../../apps/backend/src/main/java/com/healthcare/user/service/AdminAccountService.java)
and [AuthOtpService](../../apps/backend/src/main/java/com/healthcare/auth/AuthOtpService.java).

A doctor login must refer to a real, eligible doctor profile; account editing
must not fabricate clinical identity. Resolve profile prerequisites and
name authority in doctor management. Removing the doctor role requires an
explicit unlink decision, and replacing a link must preserve a valid profile.
[AccountDoctorLinker](../../apps/backend/src/main/java/com/healthcare/user/service/AccountDoctorLinker.java)
owns these checks alongside [AdminDoctorService](../../apps/backend/src/main/java/com/healthcare/hospital/service/AdminDoctorService.java).

Account information must describe observed facts. Created/updated timestamps
are not last-login evidence, and verification is not inferred from creation
or invitation. [AdminAccountResponse](../../apps/backend/src/main/java/com/healthcare/user/dto/AdminAccountResponse.java)
owns the explicit safe response fields; password hashes, tokens, and provider
subjects must never be exposed through inventory APIs or logs.

Schema and compatible rollback decisions are in
[deployment guidance](../deployment.md#cms-and-account-compatibility).
