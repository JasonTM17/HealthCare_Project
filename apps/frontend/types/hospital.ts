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
  sections?: ArticleSection[];
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
  email?: string;
  reasonForVisit?: string;
}

export interface HoldSlotResult {
  bookingCode: string;
  holdExpiresAt: string;
  otpExpiresAt: string;
  message: string;
  otpRequired: boolean;
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
