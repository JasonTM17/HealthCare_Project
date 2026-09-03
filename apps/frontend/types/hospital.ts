export interface DoctorSummary {
  id: string;
  fullName: string;
  slug: string;
  photoUrl?: string | null;
  specialtyName?: string | null;
  branchId?: string | null;
}

export interface Specialty {
  id: string;
  name: string;
  slug: string;
  description: string;
  active?: boolean;
  icon?: string;
  commonSymptoms?: string[];
  preparationSteps?: string[];
  carePathway?: string | null;
  relatedDoctors?: DoctorSummary[];
}

export interface Doctor {
  id: string;
  fullName: string;
  slug: string;
  bio: string;
  photoUrl?: string;
  active?: boolean;
  title?: string;
  specialtyName?: string;
  experienceYears?: number;
  branchId?: string;
  branchIds?: string[];
  branchNames?: string[];
  specialtySlugs?: string[];
  achievements?: string | null;
}

export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone?: string | null;
  workingHours?: string;
  emergencyHotline?: string;
  mapUrl?: string | null;
  amenities?: string[];
  doctors?: DoctorSummary[];
  active?: boolean;
}

export interface HealthPackage {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  active?: boolean;
  featured?: boolean;
  checklist?: string[];
  targetAudience?: string | null;
  durationDays?: number | null;
  preparationSteps?: string[];
}

export interface MedicalService {
  id: string;
  name: string;
  slug: string;
  description: string;
  active?: boolean;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  active?: boolean;
}

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";

export interface JobPosition {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  employmentTypeLabel: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  deadline?: string | null;
  featured: boolean;
}

export interface JobApplicationPayload {
  fullName: string;
  email: string;
  phone: string;
  yearsExperience?: number | null;
  coverLetter: string;
  resumeUrl?: string;
  privacyConsent: boolean;
}

export interface JobApplicationReceipt {
  applicationCode: string;
  jobTitle: string;
  submittedAt: string;
  message: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body?: string;
  publishedAt: string;
  active?: boolean;
  category?: string | null;
  authorName?: string | null;
  readingMinutes?: number | null;
  relatedSpecialtySlug?: string | null;
  contentKind?: "GENERAL" | "DISEASE_GUIDE";
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  tags?: unknown;
  scheduledPublishAt?: string | null;
  sections?: ArticleSection[];
  contentLanguage?: string | null;
  audience?: string | null;
  topicTags?: unknown;
  keyTakeaways?: unknown;
  warningSigns?: unknown;
  preventionTips?: unknown;
  whenToSeekCare?: string | null;
  sourceReferences?: unknown;
  clinicalMetadata?: unknown;
  clinicalDisclaimer?: string | null;
  featured?: boolean;
  updatedAt?: string | null;
  version?: number | null;
}

export interface ArticleSection {
  heading: string;
  body: string;
}

export interface TimeSlot {
  branchId: string;
  startTime: string; // e.g. "08:00:00"
  endTime: string;   // e.g. "08:30:00"
  available: boolean;
  statusNote: string;
}

export interface HoldSlotPayload {
  doctorId: string;
  specialtyId?: string;
  branchId: string;
  packageId?: string;
  appointmentDate: string; // "YYYY-MM-DD"
  startTime: string;       // "HH:mm:ss"
  fullName: string;
  phone: string;
  email: string;
  reasonForVisit?: string;
  hasInsurance?: boolean;
  privacyConsent: boolean;
}

export interface HoldSlotResult {
  bookingCode: string;
  holdExpiresAt: string;
  otpExpiresAt: string;
  message: string;
  otpRequired: boolean;
  otpDeliveryStatus?: "QUEUED" | "SENT" | "FAILED" | "EXPIRED";
}

export interface ConfirmAppointmentPayload {
  bookingCode: string;
  otpCode: string;
  notes?: string;
}

export interface AppointmentDetails {
  id: string;
  bookingCode: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  doctorId: string;
  doctorName: string;
  doctorTitle?: string;
  specialtyName?: string;
  branchName?: string;
  branchAddress?: string;
  packageName?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  reasonForVisit?: string;
  hasInsurance: boolean;
  privacyConsentAt?: string | null;
  privacyConsentVersion?: string | null;
  createdAt: string;
}

interface PortalAppointmentBase {
  id: string;
  bookingCode: string;
  specialtyName?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  packageName?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  reasonForVisit?: string;
  createdAt: string;
}

/** Exact JSON shape returned by GET /patient/appointments. */
export interface PatientPortalAppointment extends PortalAppointmentBase {
  doctorId: string;
  doctorName: string;
  paymentStatus: string;
}

/** Exact JSON shape returned by GET /doctor/appointments. */
export interface DoctorPortalAppointment extends PortalAppointmentBase {
  patientId: string;
  patientName: string;
}

export type PaymentStatus = "UNPAID" | "PENDING_VERIFICATION" | "PAID" | "REJECTED" | "REFUND_PENDING" | "REFUNDED";

export interface BankTransferPayment {
  id: string;
  appointmentId: string;
  bookingCode: string;
  patientName: string;
  doctorName: string;
  packageName?: string | null;
  appointmentDate: string;
  amount: number;
  currency: "VND";
  status: PaymentStatus;
  bankName: string;
  bankAccount: string;
  accountHolder: string;
  qrCodeUrl: string;
  transferContent: string;
  transactionReference?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  refundReference?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PortalAppointment = PatientPortalAppointment | DoctorPortalAppointment;

export interface AiTriageCitation {
  source_type: "specialty" | "doctor" | "service" | "package" | "article" | "faq";
  source_id: string;
  title: string;
}

export type AiTriageProvenance = string | Record<string, unknown>;

export interface AiTriageResult {
  recommendedSpecialty: string;
  recommendedSpecialtyId?: string;
  specialtyResolution?: "RESOLVED" | "UNRESOLVED";
  urgencyLevel: "EMERGENCY" | "HIGH" | "NORMAL";
  advice: string;
  suggestedQuestions: string[];
  disclaimer?: string;
  citations?: AiTriageCitation[];
  provenance?: AiTriageProvenance;
}

export interface SemanticSearchResult {
  source_type: "specialty" | "doctor" | "service" | "package" | "article" | "faq";
  source_id: string;
  title: string;
  content: string;
  score: number;
  citation: AiTriageCitation;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  query: string;
  specialty: string;
  provenance: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  /** Older local sessions may omit this while the auth migration rolls out. */
  emailVerified?: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface UserProfile extends AuthUser {
  status: string;
}

export interface UserPreferences {
  emailNotifications: boolean;
  appointmentReminders: boolean;
  marketingEmails: boolean;
  locale: string;
  timezone: string;
  updatedAt?: string | null;
}

export type NotificationCategory =
  | "SECURITY"
  | "APPOINTMENT"
  | "PAYMENT"
  | "CLINICAL_UPDATE"
  | "CONSULTATION"
  | "CARE_PLAN"
  | "MARKETING";

export type NotificationChannel = "EMAIL" | "IN_APP";

export interface NotificationPreference {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone: string;
}

export interface NotificationPreferencePatchPayload {
  enabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string | null;
  /** Explicitly clears a previously saved quiet-hours pair. */
  clearQuietHours?: boolean;
}

export type PatientGender = "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";

export interface PatientProfile {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: PatientGender | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  avatarUrl?: string | null;
  medicalHistory?: string | null;
  allergies?: string | null;
  bloodType?: string | null;
  updatedAt?: string | null;
}

export interface StoredFile {
  id: string;
  objectName: string;
  patientId?: string | null;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  purpose: "GENERAL" | "DIAGNOSTIC_RESULT" | "MEDICAL_RECORD";
  downloadUrl: string;
  createdAt: string;
}

export interface PrescriptionItem {
  medicationName: string;
  activeIngredient?: string | null;
  dosage: string;
  unit?: string | null;
  frequency: string;
  durationDays: number;
  totalQuantity: number;
  usageNote?: string | null;
}

export interface Prescription {
  id: string;
  prescriptionCode: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  diagnosisSummary?: string | null;
  generalAdvice?: string | null;
  status: string;
  items: PrescriptionItem[];
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  appointmentId?: string | null;
  bookingCode?: string | null;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  doctorTitle?: string | null;
  icd10Code?: string | null;
  icd10Name?: string | null;
  diagnosis?: string | null;
  symptomsSummary?: string | null;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  heartRate?: number | null;
  temperature?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  treatmentPlan?: string | null;
  doctorNotes?: string | null;
  followUpDate?: string | null;
  prescriptions: Prescription[];
  createdAt: string;
}

export interface DiagnosticResult {
  id: string;
  patientId: string;
  patientName: string;
  doctorId?: string | null;
  doctorName?: string | null;
  testName: string;
  result: string;
  fileId?: string | null;
  fileUrl?: string | null;
  testDate: string;
}

export interface Notification {
  id: string;
  eventType: string;
  title: string;
  message: string;
  referenceId?: string | null;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  doctorName: string;
  branchId: string;
  branchName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
}

export interface DoctorScheduleException {
  id: string;
  doctorId: string;
  doctorName: string;
  branchId: string;
  branchName: string;
  exceptionDate: string;
  type: "CUSTOM_HOURS" | "BLOCKED" | "LEAVE";
  customStartTime?: string | null;
  customEndTime?: string | null;
  reason?: string | null;
}

export type AiChatProvenance = "local_provider" | "remote_provider" | "local_fallback";

/** Immutable mode selected when a patient creates a conversation. */
export type ChatMode = "HOSPITAL_SUPPORT" | "SYMPTOM_TRIAGE" | "HEALTH_EDUCATION";

/** Deterministic safety outcome returned by the backend policy layer. */
export type ChatSafetyAction =
  | "ANSWER"
  | "REFUSE"
  | "EMERGENCY"
  | "HUMAN_HANDOFF"
  | "INSUFFICIENT_EVIDENCE";

export type FeedbackRating = "HELPFUL" | "NOT_HELPFUL";
export type TriageUrgency = "EMERGENCY" | "HIGH" | "NORMAL";
export type AiSourceStatus = "CURRENT" | "STALE" | "UNAVAILABLE";
export type AiContentType = "SPECIALTY" | "ARTICLE" | "FAQ";
export type AiContentReviewState = "DRAFT" | "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REVOKED" | "EXPIRED";
export type AiContentDecision = "APPROVE" | "REQUEST_CHANGES" | "REVOKE";

export interface AiContentReviewSummary {
  sourceType: AiContentType;
  sourceId: string;
  title: string;
  state: AiContentReviewState;
  revision: number;
  contentHash: string;
  eligibilityRevision?: number;
  approvalRound?: number | null;
  expiresAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
}

export interface PatientOverview {
  latestAppointment?: {
    appointmentDate: string;
    startTime: string;
    status: string;
    paymentStatus: string;
  } | null;
  appointmentCount: number;
  diagnosticResultCount: number;
  prescriptionCount: number;
  hasNewDiagnosticResult: boolean;
  hasNewPrescription: boolean;
  unreadNotificationCount: number;
  unreadConsultationCount: number;
  openCarePlanTaskCount: number;
}

export interface ConsultationSummary {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName?: string | null;
  subject: string;
  status: string;
  openUntil: string;
  updatedAt: string;
  unreadCount: number;
}

export interface ConsultationMessage {
  id: string;
  authorUserId: string;
  authorRole: "PATIENT" | "DOCTOR" | "ADMIN" | "SYSTEM";
  body: string;
  status: "SENT" | "READ";
  createdAt: string;
  attachments: ConsultationAttachment[];
}

export interface ConsultationMessagePage {
  items: ConsultationMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ConsultationAttachment {
  id: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: "PENDING" | "CLEAN" | "REJECTED";
  downloadUrl?: string | null;
  uploadStatus?: "REQUESTED" | "UPLOADING" | "PENDING" | "CLEAN" | "REJECTED" | "EXPIRED" | string;
  uploadUrl?: string | null;
  uploadExpiresAt?: string | null;
}

export interface ConsultationDetail {
  consultation: ConsultationSummary;
  messages: ConsultationMessage[];
}

export interface ConsultationHandoffDoctor {
  doctorId: string;
  fullName: string;
  specialtySlug?: string | null;
  branchSlug?: string | null;
}

export interface ConsultationAdminQueueItem {
  threadId: string;
  status: string;
  firstResponseDueAt?: string | null;
  firstRespondedAt?: string | null;
  consultationOpenUntil: string;
  updatedAt: string;
  specialtySlug?: string | null;
  assignmentRole?: string | null;
  assignmentPermission?: string | null;
  assignedAt?: string | null;
}

export interface HealthQuestionSummary {
  id: string;
  topicSlug: string;
  question: string;
  publicAlias: string;
  status: string;
  createdAt: string;
  answer?: string | null;
  answerStatus?: string | null;
}

export interface HealthQuestionReport {
  id: string;
  questionId: string;
  reasonCode: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED" | string;
  createdAt: string;
  handledAt?: string | null;
  resolutionCode?: string | null;
}

export interface CarePlanItem {
  id: string;
  sequenceNumber: number;
  goal: string;
  reminder?: string | null;
  status: "OPEN" | "DONE" | "CANCELLED" | string;
  dueAt?: string | null;
  completedAt?: string | null;
}

export interface CarePlan {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName?: string | null;
  title: string;
  status: "OPEN" | "DONE" | "CANCELLED" | string;
  startsAt?: string | null;
  endsAt?: string | null;
  items: CarePlanItem[];
}

export interface AiContentRevision {
  sourceType: AiContentType;
  sourceId: string;
  revision: number;
  contentHash: string;
  state: AiContentReviewState;
  snapshot: Record<string, unknown>;
  diff?: Record<string, unknown> | null;
  approvalId?: string | null;
  expiresAt?: string | null;
}

export interface AiChatPolicy {
  policyVersion: string;
  retentionDays: number;
  consentText: string;
  limitationText?: string | null;
  remoteProviderEnabled?: boolean;
}

export interface AiTriageSummary {
  urgencyLevel: TriageUrgency;
  recommendedSpecialty?: string | null;
}

export interface AiChatFeedback {
  rating: FeedbackRating;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Closed CTA union; href is always server-authorized and relative/tel:115. */
export type SuggestedAction =
  | { kind: "VIEW_SOURCE"; label: string; href: string }
  | { kind: "START_BOOKING"; label: string; href: string }
  | { kind: "CALL_EMERGENCY"; label: string; href: "tel:115" };

export interface AiChatCitation {
  source_type: "branch" | "specialty" | "doctor" | "service" | "package" | "article" | "faq";
  source_id: string;
  title: string;
  source_status?: AiSourceStatus;
}

export interface AiConversation {
  id: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED";
  /** Older API fixtures may omit mode; the server defaults it to HOSPITAL_SUPPORT. */
  mode?: ChatMode;
  consentVersion?: string | null;
  consentedAt?: string | null;
  consentRequired?: boolean;
  inFlight: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  expiresAt: string;
}

export interface AiChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  status: "PENDING" | "COMPLETED" | "FAILED";
  content: string;
  sequence: number;
  disclaimer?: string | null;
  provenance?: AiChatProvenance | null;
  citations: AiChatCitation[];
  safetyAction?: ChatSafetyAction;
  triage?: AiTriageSummary | null;
  suggestedActions?: SuggestedAction[];
  feedback?: AiChatFeedback | FeedbackRating | null;
  sourceStatus?: AiSourceStatus;
  createdAt: string;
  completedAt?: string | null;
}

export interface AiChatMessagePage {
  content: AiChatMessage[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface AiChatExchange {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
  replayed: boolean;
}
