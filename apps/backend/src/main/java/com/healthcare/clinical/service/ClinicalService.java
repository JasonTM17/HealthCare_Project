package com.healthcare.clinical.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.clinical.dto.CreateMedicalRecordRequest;
import com.healthcare.clinical.dto.CreateDiagnosticResultRequest;
import com.healthcare.clinical.dto.DiagnosticResultResponse;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.dto.PrescriptionItemDto;
import com.healthcare.clinical.dto.PrescriptionResponse;
import com.healthcare.clinical.entity.DiagnosticResult;
import com.healthcare.clinical.entity.MedicalRecord;
import com.healthcare.clinical.entity.Prescription;
import com.healthcare.clinical.entity.PrescriptionItem;
import com.healthcare.clinical.repository.DiagnosticResultRepository;
import com.healthcare.clinical.repository.MedicalRecordRepository;
import com.healthcare.clinical.repository.PrescriptionRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.storage.entity.StoredFile;
import com.healthcare.storage.entity.StoredFilePurpose;
import com.healthcare.storage.repository.StoredFileRepository;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class ClinicalService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final DiagnosticResultRepository diagnosticResultRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final StoredFileRepository storedFileRepository;
    private final NotificationService notificationService;

    public ClinicalService(
            MedicalRecordRepository medicalRecordRepository,
            PrescriptionRepository prescriptionRepository,
            DiagnosticResultRepository diagnosticResultRepository,
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            AppointmentRepository appointmentRepository,
            UserRepository userRepository,
            StoredFileRepository storedFileRepository,
            NotificationService notificationService) {
        this.medicalRecordRepository = medicalRecordRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.diagnosticResultRepository = diagnosticResultRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.storedFileRepository = storedFileRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public MedicalRecordResponse createMedicalRecord(
            CreateMedicalRecordRequest request,
            UserDetails principal) {
        requireAuthenticated(principal);

        PatientProfile patient = patientProfileRepository.findById(request.patientId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + request.patientId()));
        Doctor doctor = doctorRepository.findById(request.doctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with ID: " + request.doctorId()));

        if (!hasRole(principal, "DOCTOR")) {
            throw new AccessDeniedException("Only a doctor can create a medical record");
        }
        Doctor linkedDoctor = requireLinkedDoctor(principal);
        if (!linkedDoctor.getId().equals(doctor.getId())) {
            throw new AccessDeniedException("The authenticated doctor is not assigned to this record");
        }
        if (request.appointmentId() == null) {
            throw new BusinessException(400, "A doctor must complete an appointment before creating a record");
        }

        Appointment appointment = null;
        if (request.appointmentId() != null) {
            appointment = appointmentRepository.findByIdWithDetailsForUpdate(request.appointmentId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Appointment not found with ID: " + request.appointmentId()));

            if (!appointment.getPatient().getId().equals(patient.getId())
                    || !appointment.getDoctor().getId().equals(doctor.getId())) {
                throw new AccessDeniedException("Appointment, patient, and doctor do not belong together");
            }
            if (medicalRecordRepository.findByAppointmentId(appointment.getId()).isPresent()) {
                throw new BusinessException(409, "A medical record already exists for this appointment");
            }
            if (appointment.getStatus() != AppointmentStatus.IN_PROGRESS) {
                throw new BusinessException(409, "Appointment must be in progress before it can be completed");
            }
        }

        MedicalRecord record = new MedicalRecord();
        record.setAppointment(appointment);
        record.setPatient(patient);
        record.setDoctor(doctor);
        record.setIcd10Code(request.icd10Code());
        record.setIcd10Name(request.icd10Name());
        record.setDiagnosis(request.diagnosis());
        record.setSymptomsSummary(request.symptomsSummary());
        record.setBloodPressureSystolic(request.bloodPressureSystolic());
        record.setBloodPressureDiastolic(request.bloodPressureDiastolic());
        record.setHeartRate(request.heartRate());
        record.setTemperature(request.temperature());
        record.setWeightKg(request.weightKg());
        record.setHeightCm(request.heightCm());
        record.setTreatmentPlan(request.treatmentPlan());
        record.setDoctorNotes(request.doctorNotes());
        record.setFollowUpDate(request.followUpDate());

        if (request.prescriptionItems() != null && !request.prescriptionItems().isEmpty()) {
            Prescription prescription = new Prescription();
            prescription.setMedicalRecord(record);
            prescription.setPatient(patient);
            prescription.setDoctor(doctor);
            prescription.setPrescriptionCode(generatePrescriptionCode());
            prescription.setDiagnosisSummary(request.diagnosis());
            prescription.setGeneralAdvice(request.prescriptionAdvice());
            prescription.setStatus("ACTIVE");

            for (PrescriptionItemDto itemDto : request.prescriptionItems()) {
                PrescriptionItem item = new PrescriptionItem();
                item.setMedicationName(itemDto.medicationName());
                item.setActiveIngredient(itemDto.activeIngredient());
                item.setDosage(itemDto.dosage());
                item.setUnit(itemDto.unit() != null ? itemDto.unit() : "Viên");
                item.setFrequency(itemDto.frequency());
                item.setDurationDays(itemDto.durationDays());
                item.setTotalQuantity(itemDto.totalQuantity());
                item.setUsageNote(itemDto.usageNote());
                prescription.addItem(item);
            }
            record.getPrescriptions().add(prescription);
        }

        if (appointment != null) {
            appointment.setStatus(AppointmentStatus.COMPLETED);
        }
        return mapToResponse(medicalRecordRepository.save(record));
    }

    @Transactional(readOnly = true)
    public MedicalRecordResponse getMedicalRecord(UUID id, UserDetails principal) {
        MedicalRecord record = medicalRecordRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found with ID: " + id));
        authorizeRecord(record, principal);
        return mapToResponse(record);
    }

    @Transactional(readOnly = true)
    public Page<MedicalRecordResponse> getPatientRecords(
            UUID patientId,
            Pageable pageable,
            UserDetails principal) {
        requireAuthenticated(principal);
        if (hasRole(principal, "ADMIN")) {
            return medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientId, pageable)
                    .map(this::mapToResponse);
        }
        if (hasRole(principal, "PATIENT")) {
            PatientProfile linkedPatient = requireLinkedPatient(principal);
            if (!linkedPatient.getId().equals(patientId)) {
                throw new AccessDeniedException("The authenticated patient cannot access this history");
            }
            return medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientId, pageable)
                    .map(this::mapToResponse);
        }
        if (hasRole(principal, "DOCTOR")) {
            Doctor linkedDoctor = requireLinkedDoctor(principal);
            ensureDoctorCanAccessPatient(patientId, linkedDoctor.getId());
            return medicalRecordRepository
                    .findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, linkedDoctor.getId(), pageable)
                    .map(this::mapToResponse);
        }
        throw new AccessDeniedException("Clinical history access denied");
    }

    @Transactional(readOnly = true)
    public PrescriptionResponse getPrescriptionByCode(String code, UserDetails principal) {
        Prescription prescription = prescriptionRepository.findByPrescriptionCodeWithItems(code.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Prescription not found with code: " + code));
        authorizePrescription(prescription, principal);
        return mapToPrescriptionResponse(prescription);
    }

    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getPatientPortalRecords(UserDetails principal) {
        PatientProfile patient = requireLinkedPatient(principal);
        return medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patient.getId()).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResponse> getPatientPortalPrescriptions(UserDetails principal) {
        PatientProfile patient = requireLinkedPatient(principal);
        return prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(patient.getId()).stream()
                .map(this::mapToPrescriptionResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DiagnosticResultResponse> getPatientPortalDiagnostics(UserDetails principal) {
        PatientProfile patient = requireLinkedPatient(principal);
        return diagnosticResultRepository.findByPatientIdOrderByTestDateDesc(patient.getId()).stream()
                .map(this::mapToDiagnosticResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getDoctorPatientRecords(UUID patientId, UserDetails principal) {
        Doctor doctor = requireLinkedDoctor(principal);
        ensureDoctorCanAccessPatient(patientId, doctor.getId());
        return medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctor.getId())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DiagnosticResultResponse> getDoctorPatientDiagnostics(UUID patientId, UserDetails principal) {
        Doctor doctor = requireLinkedDoctor(principal);
        ensureDoctorCanAccessPatient(patientId, doctor.getId());
        return diagnosticResultRepository
                .findByPatientIdAndDoctorIdOrderByTestDateDesc(patientId, doctor.getId())
                .stream()
                .map(this::mapToDiagnosticResponse)
                .toList();
    }

    @Transactional
    public DiagnosticResultResponse createDiagnosticResult(
            UUID patientId,
            CreateDiagnosticResultRequest request,
            UserDetails principal) {
        Doctor doctor = requireLinkedDoctor(principal);
        ensureDoctorCanAccessPatient(patientId, doctor.getId());
        PatientProfile patient = patientProfileRepository.findById(patientId)
            .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + patientId));

        StoredFile storedFile = null;
        if (request.fileId() != null) {
            storedFile = storedFileRepository.findById(request.fileId())
                .orElseThrow(() -> new ResourceNotFoundException("Stored file not found with ID: " + request.fileId()));
            if (storedFile.getPurpose() != StoredFilePurpose.DIAGNOSTIC_RESULT) {
                throw new BusinessException(400, "The attached file must use DIAGNOSTIC_RESULT purpose");
            }
            if (storedFile.getPatient() == null || !storedFile.getPatient().getId().equals(patientId)) {
                throw new AccessDeniedException("The attached file does not belong to this patient");
            }
            if (diagnosticResultRepository.existsByStoredFileId(storedFile.getId())) {
                throw new BusinessException(409, "The attached file is already linked to a diagnostic result");
            }
        }

        DiagnosticResult diagnostic = new DiagnosticResult();
        diagnostic.setPatient(patient);
        diagnostic.setDoctor(doctor);
        diagnostic.setTestName(request.testName().trim());
        diagnostic.setResult(request.result() == null ? null : request.result().trim());
        diagnostic.setStoredFile(storedFile);
        diagnostic.setTestDate(request.testDate() == null ? java.time.OffsetDateTime.now() : request.testDate());
        DiagnosticResult saved = diagnosticResultRepository.saveAndFlush(diagnostic);

        if (patient.getUserId() != null) {
            notificationService.create(
                patient.getUserId(),
                EventType.DIAGNOSTIC_RESULT_AVAILABLE,
                "Có kết quả chẩn đoán mới",
                "Kết quả " + saved.getTestName() + " đã sẵn sàng trong hồ sơ của bạn.",
                saved.getId()
            );
        }
        return mapToDiagnosticResponse(saved);
    }

    private void authorizeRecord(MedicalRecord record, UserDetails principal) {
        requireAuthenticated(principal);
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        if (hasRole(principal, "PATIENT")) {
            if (!requireLinkedPatient(principal).getId().equals(record.getPatient().getId())) {
                throw new AccessDeniedException("The authenticated patient cannot access this record");
            }
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            if (!requireLinkedDoctor(principal).getId().equals(record.getDoctor().getId())) {
                throw new AccessDeniedException("The authenticated doctor cannot access this record");
            }
            return;
        }
        throw new AccessDeniedException("Clinical record access denied");
    }

    private void authorizePrescription(Prescription prescription, UserDetails principal) {
        requireAuthenticated(principal);
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        if (hasRole(principal, "PATIENT")) {
            if (!requireLinkedPatient(principal).getId().equals(prescription.getPatient().getId())) {
                throw new AccessDeniedException("The authenticated patient cannot access this prescription");
            }
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            if (!requireLinkedDoctor(principal).getId().equals(prescription.getDoctor().getId())) {
                throw new AccessDeniedException("The authenticated doctor cannot access this prescription");
            }
            return;
        }
        throw new AccessDeniedException("Prescription access denied");
    }

    private void ensureDoctorCanAccessPatient(UUID patientId, UUID doctorId) {
        boolean hasRecord = medicalRecordRepository.existsByPatientIdAndDoctorId(patientId, doctorId);
        boolean hasAssignedVisit = appointmentRepository.existsByPatientIdAndDoctorIdAndStatusIn(
            patientId,
            doctorId,
            EnumSet.of(
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.COMPLETED
            )
        );
        if (!hasRecord && !hasAssignedVisit) {
            throw new AccessDeniedException("The doctor has no clinical relationship with this patient");
        }
    }

    private PatientProfile requireLinkedPatient(UserDetails principal) {
        return patientProfileRepository.findByUserId(resolveUserId(principal))
                .orElseThrow(() -> new AccessDeniedException("No patient profile is linked to this account"));
    }

    private Doctor requireLinkedDoctor(UserDetails principal) {
        return doctorRepository.findByUserId(resolveUserId(principal))
                .orElseThrow(() -> new AccessDeniedException("No doctor profile is linked to this account"));
    }

    private UUID resolveUserId(UserDetails principal) {
        requireAuthenticated(principal);
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return healthcarePrincipal.getUserId();
        }
        return userRepository.findByEmail(principal.getUsername())
                .map(User::getId)
                .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
    }

    private void requireAuthenticated(UserDetails principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication required");
        }
    }

    private boolean hasRole(UserDetails principal, String role) {
        return principal != null && principal.getAuthorities().stream()
                .anyMatch(authority -> ("ROLE_" + role).equals(authority.getAuthority()));
    }

    private String generatePrescriptionCode() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        int randomPart = ThreadLocalRandom.current().nextInt(1000, 10000);
        return "RX-" + datePart + "-" + randomPart;
    }

    private MedicalRecordResponse mapToResponse(MedicalRecord record) {
        List<PrescriptionResponse> prescriptions = record.getPrescriptions() == null
                ? Collections.emptyList()
                : record.getPrescriptions().stream().map(this::mapToPrescriptionResponse).toList();

        return new MedicalRecordResponse(
                record.getId(),
                record.getAppointment() != null ? record.getAppointment().getId() : null,
                record.getAppointment() != null ? record.getAppointment().getBookingCode() : null,
                record.getPatient().getId(),
                record.getPatient().getFullName(),
                record.getPatient().getPhone(),
                record.getDoctor().getId(),
                record.getDoctor().getFullName(),
                null,
                record.getIcd10Code(),
                record.getIcd10Name(),
                record.getDiagnosis(),
                record.getSymptomsSummary(),
                record.getBloodPressureSystolic(),
                record.getBloodPressureDiastolic(),
                record.getHeartRate(),
                record.getTemperature(),
                record.getWeightKg(),
                record.getHeightCm(),
                record.getTreatmentPlan(),
                record.getDoctorNotes(),
                record.getFollowUpDate(),
                prescriptions,
                record.getCreatedAt()
        );
    }

    private PrescriptionResponse mapToPrescriptionResponse(Prescription prescription) {
        List<PrescriptionItemDto> items = prescription.getItems() == null
                ? Collections.emptyList()
                : prescription.getItems().stream().map(item -> new PrescriptionItemDto(
                        item.getMedicationName(),
                        item.getActiveIngredient(),
                        item.getDosage(),
                        item.getUnit(),
                        item.getFrequency(),
                        item.getDurationDays(),
                        item.getTotalQuantity(),
                        item.getUsageNote()
                )).toList();

        return new PrescriptionResponse(
                prescription.getId(),
                prescription.getPrescriptionCode(),
                prescription.getPatient().getId(),
                prescription.getPatient().getFullName(),
                prescription.getDoctor().getId(),
                prescription.getDoctor().getFullName(),
                prescription.getDiagnosisSummary(),
                prescription.getGeneralAdvice(),
                prescription.getStatus(),
                items,
                prescription.getCreatedAt()
        );
    }

    private DiagnosticResultResponse mapToDiagnosticResponse(DiagnosticResult diagnostic) {
        StoredFile storedFile = diagnostic.getStoredFile();
        return new DiagnosticResultResponse(
                diagnostic.getId(),
                diagnostic.getPatient().getId(),
                diagnostic.getPatient().getFullName(),
                diagnostic.getDoctor() != null ? diagnostic.getDoctor().getId() : null,
                diagnostic.getDoctor() != null ? diagnostic.getDoctor().getFullName() : null,
                diagnostic.getTestName(),
                diagnostic.getResult(),
                storedFile == null ? null : storedFile.getId(),
                storedFile == null
                    ? diagnostic.getFileUrl()
                    : "/api/v1/files/" + storedFile.getObjectKey(),
                diagnostic.getTestDate()
        );
    }
}
