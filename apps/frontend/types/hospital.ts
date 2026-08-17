export interface Specialty {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
}

export interface Doctor {
  id: string;
  fullName: string;
  slug: string;
  bio: string;
  photoUrl?: string;
  title?: string;
  specialtyName?: string;
  experienceYears?: number;
  branchId?: string;
}

export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  workingHours?: string;
  emergencyHotline?: string;
}

export interface HealthPackage {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  featured?: boolean;
  checklist?: string[];
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  publishedAt: string;
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

export interface PortalAppointment {
  id: string;
  bookingCode: string;
  doctorId: string;
  doctorName: string;
  patientId?: string;
  patientName?: string;
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

export interface PatientPortalAppointment extends PortalAppointment {
  patientId?: never;
  patientName?: never;
}

export interface DoctorPortalAppointment extends PortalAppointment {
  patientId: string;
  patientName: string;
}

export type AiTriageCitation = string | Record<string, unknown>;

export type AiTriageProvenance = string | Record<string, unknown>;

export interface AiTriageResult {
  recommendedSpecialty: string;
  urgencyLevel: "EMERGENCY" | "HIGH" | "NORMAL";
  advice: string;
  suggestedQuestions: string[];
  disclaimer?: string;
  citations?: AiTriageCitation[];
  provenance?: AiTriageProvenance;
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
