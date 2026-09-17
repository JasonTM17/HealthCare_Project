# Patient role journey audit (2026-09-16)

Scope: apps/frontend/app/patient/** plus rendered shared components and backend endpoints/migrations.

## Method log

- Listed patient page.tsx files with find.
- Extracted direct API-related calls from patient pages with grep.

## Patient pages and direct frontend API calls

```text
/d/HealthCare_Project/apps/frontend/app/patient/appointments/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/appointments/[id]/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/care-plan/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/chat/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/community/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/consultations/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/consultations/[id]/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/dashboard/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/diagnostic-results/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/documents/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/health-questions/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/medical-records/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/notifications/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/preferences/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/prescriptions/page.tsx
/d/HealthCare_Project/apps/frontend/app/patient/profile/page.tsx
```

API call grep results:

```text
D:/HealthCare_Project/apps/frontend/app/patient\consultations\page.tsx:11:  fetchPatientAppointments,
D:/HealthCare_Project/apps/frontend/app/patient\consultations\page.tsx:12:  fetchPatientConsultations,
D:/HealthCare_Project/apps/frontend/app/patient\consultations\page.tsx:83:        return fetchPatientConsultations();
D:/HealthCare_Project/apps/frontend/app/patient\consultations\page.tsx:107:        return fetchPatientAppointments(0, 50);
D:/HealthCare_Project/apps/frontend/app/patient\consultations\[id]\page.tsx:17:  fetchConsultationResponseBody,
D:/HealthCare_Project/apps/frontend/app/patient\consultations\[id]\page.tsx:18:  fetchConsultationUploadResponse,
D:/HealthCare_Project/apps/frontend/app/patient\consultations\[id]\page.tsx:110:    const { response, text: responseText } = await fetchConsultationResponseBody(path, { ...init, headers });
D:/HealthCare_Project/apps/frontend/app/patient\consultations\[id]\page.tsx:276:        fetchStatus: (attachmentId, signal) => requestConsultationJson<ConsultationAttachment>(
D:/HealthCare_Project/apps/frontend/app/patient\consultations\[id]\page.tsx:430:        const uploadResponse = await fetchConsultationUploadResponse(intent.uploadUrl, { method: "PUT", body: file, signal,
D:/HealthCare_Project/apps/frontend/app/patient\care-plan\page.tsx:6:import { ApiError, completePatientCarePlanItem, fetchPatientCarePlans, hasRole } from "../../../lib/api-client";
D:/HealthCare_Project/apps/frontend/app/patient\care-plan\page.tsx:47:    void Promise.resolve().then(() => { if (cancelled) return undefined; setLoading(true); setError(null); return fetchPatientCarePlans(); })
D:/HealthCare_Project/apps/frontend/app/patient\community\page.tsx:7:  fetchArticles,
D:/HealthCare_Project/apps/frontend/app/patient\community\page.tsx:8:  fetchSpecialties,
D:/HealthCare_Project/apps/frontend/app/patient\community\page.tsx:34:        fetchArticles(0, 50),
D:/HealthCare_Project/apps/frontend/app/patient\community\page.tsx:35:        fetchSpecialties(),
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:8:import { fetchDoctorSlots } from "../../../lib/api";
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:13:  fetchBankTransferPayment,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:14:  fetchPatientProfile,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:15:  fetchPatientAppointments,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:16:  fetchNotifications,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:17:  fetchPatientDiagnosticResults,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:18:  fetchPatientCarePlans,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:19:  fetchPatientMedicalRecords,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:20:  fetchPatientPrescriptions,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:21:  fetchPatientOverview,
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:233:  const response = await fetch(qrUrl, {
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:760:      loadOrReuse(retrySnapshot?.profile, () => fetchPatientProfile()),
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:761:      loadOrReuse(retrySnapshot?.appointments, () => fetchPatientAppointments()),
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:762:      loadOrReuse(retrySnapshot?.records, () => fetchPatientMedicalRecords()),
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:763:      loadOrReuse(retrySnapshot?.prescriptions, () => fetchPatientPrescriptions()),
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:764:      loadOrReuse(retrySnapshot?.diagnostics, () => fetchPatientDiagnosticResults()),
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:766:        fetchNotifications().catch(() => ({
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:777:      loadOrReuse(retrySnapshot?.overview, () => fetchPatientOverview()),
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:778:      loadOrReuse(retrySnapshot?.carePlans, () => fetchPatientCarePlans()),
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:868:      const details = await fetchBankTransferPayment(appointment.id);
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:932:      const latest = await fetchBankTransferPayment(current.appointmentId);
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:973:        const latest = await fetchBankTransferPayment(appointmentIdToRefresh);
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:1115:      fetchNotifications().then((res) => {
D:/HealthCare_Project/apps/frontend/app/patient\dashboard\page.tsx:1264:      setSlots({ status: "success", data: await fetchDoctorSlots(selectedAppointment.doctorId, selectedAppointment.branchId, rescheduleDate) });
D:/HealthCare_Project/apps/frontend/app/patient\documents\page.tsx:9:  fetchPatientDocuments,
D:/HealthCare_Project/apps/frontend/app/patient\documents\page.tsx:10:  fetchPatientMedicalRecords,
D:/HealthCare_Project/apps/frontend/app/patient\documents\page.tsx:11:  fetchPatientPrescriptions,
D:/HealthCare_Project/apps/frontend/app/patient\documents\page.tsx:12:  fetchPatientProfile,
D:/HealthCare_Project/apps/frontend/app/patient\documents\page.tsx:159:      const patient = await fetchPatientProfile();
D:/HealthCare_Project/apps/frontend/app/patient\documents\page.tsx:164:        fetchPatientDocuments(patient.id),
D:/HealthCare_Project/apps/frontend/app/patient\documents\page.tsx:165:        fetchPatientMedicalRecords(),
D:/HealthCare_Project/apps/frontend/app/patient\documents\page.tsx:166:        fetchPatientPrescriptions(),
D:/HealthCare_Project/apps/frontend/app/patient\health-questions\page.tsx:8:import { ApiError, createPatientHealthQuestion, fetchPatientHealthQuestions, hasRole } from "../../../lib/api-client";
D:/HealthCare_Project/apps/frontend/app/patient\health-questions\page.tsx:45:        return fetchPatientHealthQuestions();
D:/HealthCare_Project/apps/frontend/app/patient\preferences\page.tsx:11:  fetchNotificationPreferences,
D:/HealthCare_Project/apps/frontend/app/patient\preferences\page.tsx:252:      const rows = await fetchNotificationPreferences({ signal: controller.signal });
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:23:  fetchAiConversation,
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:24:  fetchAiConversationMessages,
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:25:  fetchAiConversations,
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:28:  fetchPatientAiCreditStatus,
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:280:      const data = await fetchPatientAiCreditStatus();
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:366:      // Legacy Promise.all([fetchAiConversation(conversationId), fetchAiConversationMessages(...)]) remains the server-authoritative read path.
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:368:        fetchAiConversation(conversationId, { signal: controller.signal }),
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:369:        fetchAiConversationMessages(conversationId, null, MESSAGE_LIMIT, { signal: controller.signal }),
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:402:      const nextConversations = await fetchAiConversations();
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:525:  // has been fetched and matches its consent version.  A missing policy is a
D:/HealthCare_Project/apps/frontend/app/patient\chat\page.tsx:664:      const page = await fetchAiConversationMessages(conversationId, cursor, MESSAGE_LIMIT);
D:/HealthCare_Project/apps/frontend/app/patient\profile\page.tsx:8:  fetchPatientProfile,
D:/HealthCare_Project/apps/frontend/app/patient\profile\page.tsx:121:        const data = await fetchPatientProfile();
```

## Frontend API helper to backend mapping

Evidence from `apps/frontend/lib/api-client.ts` and backend controller mapping grep:

| Frontend helper / page call | Method + frontend path | Backend mapping evidence | Status |
|---|---|---|---|
| `fetchPatientOverview` | GET `/patient/overview` (`apps/frontend/lib/api-client.ts:1365`) | `PatientPortalController.java:31` + `:51 @GetMapping("/overview")` | OK |
| `fetchPatientConsultations` | GET `/patient/consultations` (`api-client.ts:1369`) | `PatientConsultationController.java:17`, `:37 @GetMapping` | OK |
| consultation detail/messages/attachments | GET/POST `/patient/consultations/{id}...` (`api-client.ts:1373-1444`) | `PatientConsultationController.java:42-105` | OK |
| `fetchPatientCarePlans` | GET `/patient/care-plans` (`api-client.ts:1457`) | `PatientCarePlanController.java:14`, `:20 @GetMapping` | OK |
| `completePatientCarePlanItem` | POST `/patient/care-plans/items/{id}/complete` (`api-client.ts:1461`) | `PatientCarePlanController.java:23 @PostMapping("/items/{itemId}/complete")` | OK |
| `fetchPatientHealthQuestions` | GET `/patient/health-questions` (`api-client.ts:1595`) | `PatientHealthQuestionController.java:16`, `:25 @GetMapping` | OK |
| `createPatientHealthQuestion` | POST `/patient/health-questions` (`api-client.ts:1599`) | `PatientHealthQuestionController.java:16`, `:21 @PostMapping` | OK; DTO shape checked below |
| `fetchNotificationPreferences` | GET `/users/me/notification-preferences` (`api-client.ts:1928`) | `NotificationPreferenceController.java:21`, `:32 @GetMapping` | OK |
| `fetchPatientAppointments` | GET `/patient/appointments?page&size` (`api-client.ts:1967`) | `PatientPortalController.java:70 @GetMapping("/appointments")` | OK |
| `fetchBankTransferPayment` / submit | GET/POST `/patient/appointments/{appointmentId}/payment[/submit]` (`api-client.ts:1976-1993`) | `PatientPaymentController.java:22`, `:32 @GetMapping`, `:39 @PostMapping("/submit")` | OK; ownership checked below |
| `fetchPatientProfile` | GET `/patient/profile` (`api-client.ts:2072`) | `PatientPortalController.java:57 @GetMapping("/profile")` | OK |
| `updatePatientProfile` | PUT `/patient/profile` (`api-client.ts:2089`) | `PatientPortalController.java:63 @PutMapping("/profile")` | OK; DTO shape checked below |
| AI chat | GET/POST `/ai/conversations...` (`api-client.ts:2291-2329`) | `AiConversationController.java:35`, `:54-95` | OK |
| `fetchPatientMedicalRecords` | GET `/patient/medical-records` (`api-client.ts:2927`) | `PatientPortalController.java:77 @GetMapping("/medical-records")` | OK |
| `fetchPatientPrescriptions` | GET `/patient/prescriptions` (`api-client.ts:2931`) | `PatientPortalController.java:83 @GetMapping("/prescriptions")` | OK |
| `fetchPatientDocuments` | GET `/patients/{patientId}/documents` (`api-client.ts:2940`) | `DocumentController.java:34`, `:45 @GetMapping` | OK route exists; ownership P0 below |
| `generatePatientDocument` | POST `/patients/{patientId}/documents` (`api-client.ts:2946`) | `DocumentController.java:34`, `:55 @PostMapping` | OK route exists; ownership/audit broken below |
| `fetchPatientDiagnosticResults` | GET `/patient/diagnostic-results` (`api-client.ts:2956`) | `PatientPortalController.java:89 @GetMapping("/diagnostic-results")` | OK |
| `fetchNotifications` | GET `/notifications?page&size&sort` (`api-client.ts:2960`) | `NotificationController.java:23`, `:33 @GetMapping` | OK |
| `fetchPatientAiCreditStatus` | GET `/patient/ai-credits/status` (`api-client.ts:3217`) | `PatientAiCreditController.java:20`, `:32 @GetMapping("/status")` | OK |
| `fetchDoctorSlots` | GET `/appointments/doctors/{doctorId}/slots?date&branchId` (`apps/frontend/lib/api.ts:72-80`) | `AppointmentController.java:38`, `:54 @GetMapping("/doctors/{doctorId}/slots")` | OK |

## Request shape checks

| Endpoint | Frontend shape evidence | Backend shape evidence | Status |
|---|---|---|---|
| PUT `/patient/profile` | `UpdatePatientProfilePayload` sends `fullName`, `dateOfBirth`, `gender`, `address`, `emergencyContactName`, `emergencyContactPhone`, `avatarUrl`, `medicalHistory`, `allergies`, `bloodType` (`apps/frontend/lib/api-client.ts:2076-2093`) | `UpdatePatientProfileRequest` expects same names/types (`apps/backend/src/main/java/com/healthcare/appointment/dto/UpdatePatientProfileRequest.java:10-23`) | OK |
| POST `/patient/health-questions` | frontend sends `topicSlug`, `question`, `publicAlias` (`api-client.ts:1599-1607`) | backend `CreateRequest` expects `topicSlug`, `question`, `publicAlias` (`HealthQuestionContracts.java:10-21`) | OK |
| POST `/patient/health-questions/{id}/reports` | frontend sends `reasonCode` (`api-client.ts:1610-1617`) | backend `ReportRequest` expects `reasonCode` (`HealthQuestionContracts.java:25`) | OK |
| POST `/patient/appointments/{id}/payment/submit` | frontend sends `{ transactionReference }` and `Idempotency-Key` (`api-client.ts:1982-1992`) | backend requires `transactionReference` and `@RequestHeader("Idempotency-Key")` (`PatientPaymentController.java:39-44`, `SubmitBankTransferRequest.java:6-11`) | OK |
| POST `/patients/{patientId}/documents` | frontend sends `{ sourceType, sourceRecordId }` (`api-client.ts:2935-2953`) | backend `GenerateDocumentRequest` expects `sourceType`, `sourceRecordId` (`GenerateDocumentRequest.java:7-10`) | OK |
| POST `/patient/consultations` | frontend sends `appointmentId`, `subject`, `consentAccepted`, `consentVersion` (`api-client.ts:1405-1413`) | backend `CreateRequest` expects same fields (`ConsultationContracts.java:17-21`) | OK |
| POST consultation message/read/attachment intent | frontend sends `{ body }`, `{ throughMessageId }`, `{ messageId, mimeType, sizeBytes, sha256Hash }` (`api-client.ts:1416-1433`, `:1447-1450`) | backend expects `body`, `throughMessageId` (with `lastReadMessageId` alias), and attachment fields (`ConsultationContracts.java:23`, `:30-38`, `:53-57`) | OK |
| POST `/appointments/{bookingCode}/reschedule` | frontend sends `appointmentDate`, `startTime`, optional `branchId` (`api-client.ts:2108-2121`; dashboard `page.tsx:1276-1280`) | backend expects `appointmentDate`, `startTime`, optional `branchId`, `phone` (`RescheduleAppointmentRequest.java:10-16`) | OK for authenticated patient |
| GET `/appointments/doctors/{doctorId}/slots` | frontend query `date`, `branchId` (`apps/frontend/lib/api.ts:72-80`) | backend expects `date`, optional `branchId` (`AppointmentController.java:53-61`) | OK |
| PUT `/users/me/notification-preferences/{category}/{channel}` | frontend sends `enabled`, `quietHoursStart`, `quietHoursEnd`, `timezone`, `clearQuietHours` (`apps/frontend/app/patient/preferences/page.tsx:381-386`) | backend DTO expects same names (`NotificationPreferencePatchRequest.java:8-12`) | OK |

## Confirmed findings

### P0-1: Patient document generation/list/download currently writes audit actions rejected by DB CHECK constraints

- Frontend documents journey calls list/generate/download: `apps/frontend/app/patient/documents/page.tsx:163-166`, `:221`, `:241`; helpers target `/patients/{patientId}/documents` and `/download` at `apps/frontend/lib/api-client.ts:2940-2953`, `:3061-3078`.
- Backend service records document audit rows with target `DOCUMENT` and actions `GENERATE`, `READ`, `DOWNLOAD`, `REVOKE`: `apps/backend/src/main/java/com/healthcare/document/service/DocumentService.java:51-53`, `:119-120`, `:182-184`, `:199-200`, `:271-276`, `:315-320`, `:344-349`.
- Migration V75 expands `target_type` to include `DOCUMENT` (`apps/backend/src/main/resources/db/migration/V75__allow_document_target_in_clinical_access_audit.sql:6-10`) but no migration expands `action`; V52 still restricts `action IN ('READ', 'DOWNLOAD')` (`apps/backend/src/main/resources/db/migration/V52__clinical_access_audit.sql:18-19`).
- Therefore document list/download audit `READ`/`DOWNLOAD` can pass, but generate/revoke audit rows using `GENERATE`/`REVOKE` violate the DB constraint. `generateDocument` is exposed to patients and will fail after object/document work when audit inserts action `GENERATE`.
- Patient impact: “Create PDF demo” can return 500/409-style failure and may leave failed/partial document rows/object-cleanup work instead of a downloadable PDF. Revocation is doctor/admin-only, but its audit action is also incompatible.

### P1-1: The patient appointment journey has no cancellation affordance, despite backend support for legal patient cancellation

- Backend supports cancellation and restricts it to `PENDING_CONFIRMATION` or `CONFIRMED`: `apps/backend/src/main/java/com/healthcare/appointment/service/BookingService.java:643-661`. It rejects completed/cancelled/no-show/in-progress with `BAD_REQUEST` (`:653-658`).
- DB appointment status enum/check allows `PENDING_CONFIRMATION`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`: `apps/backend/src/main/java/com/healthcare/appointment/entity/AppointmentStatus.java:2-10`; `apps/backend/src/main/resources/db/migration/V4__appointments.sql:20-29`.
- Patient dashboard uses `PortalAppointments` and passes only payment/reschedule callbacks (`apps/frontend/app/patient/dashboard/page.tsx:1572-1579`). `PortalAppointments` renders patient actions only for status `CONFIRMED`, and only “Đổi lịch” plus payment (`apps/frontend/components/PortalAppointments.tsx:117-133`). Grep found no patient `cancelAppointment` helper or `/cancel` call (`apps/frontend/lib/api-client.ts` only has doctor care-plan cancel at `:1488-1489`).
- Patient impact: a patient cannot self-cancel a cancellable `PENDING_CONFIRMATION` or `CONFIRMED` appointment from the authenticated patient portal; they must use another flow/support. The UI does not offer illegal cancellation for COMPLETED/CANCELLED, but it also omits legal cancellation entirely.

### P1-2: “Lịch hẹn đã xác thực” copy is misleading because the backend returns all patient/claimed appointments, not only confirmed appointments

- UI section copy says `LỊCH HẸN ĐÃ XÁC THỰC` and `Lịch hẹn của tôi` (`apps/frontend/app/patient/dashboard/page.tsx:1563-1572`).
- Backend patient portal query is not status-filtered: service calls `findPortalAppointmentsForPatientOrClaim` (`AppointmentPortalService.java:73-80`), and repository query returns appointments where patient id matches or an account claim exists, with no status predicate (`AppointmentRepository.java:61-73`).
- Patient impact: pending, cancelled, no-show, checked-in, in-progress, completed rows can appear under a heading that says verified/confirmed, causing confusion about whether a pending/cancelled booking is active.

### P2-1: Profile page claims insurance verification support that is not backed by the profile data model or endpoint

- Patient profile copy says administrative data is used for “xác minh bảo hiểm y tế” (`apps/frontend/app/patient/profile/page.tsx:377-380`).
- Profile update shape contains no insurance/BHYT fields (`apps/frontend/lib/api-client.ts:2076-2093`; backend DTO `UpdatePatientProfileRequest.java:10-23`). Backend grep found appointment-level `has_insurance` and appointment email copy, but no patient profile insurance verification field/endpoint.
- Patient impact: patients may believe the profile page verifies BHYT coverage, but the form cannot collect or verify insurance data.
