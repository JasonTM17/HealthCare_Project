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
  startTime: string; // e.g. "08:00:00"
  endTime: string;   // e.g. "08:30:00"
  available: boolean;
  statusNote: string;
}

export interface HoldSlotPayload {
  doctorId: string;
  specialtyId?: string;
  branchId?: string;
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

export interface AiTriageResult {
  recommendedSpecialty: string;
  urgencyLevel: "EMERGENCY" | "HIGH" | "NORMAL";
  advice: string;
  suggestedQuestions: string[];
}
