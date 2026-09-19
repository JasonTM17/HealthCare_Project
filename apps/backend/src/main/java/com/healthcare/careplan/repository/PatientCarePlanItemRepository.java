package com.healthcare.careplan.repository;

import com.healthcare.careplan.entity.PatientCarePlanItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientCarePlanItemRepository extends JpaRepository<PatientCarePlanItem, UUID> {

    Optional<PatientCarePlanItem> findByIdAndDeletedAtIsNull(UUID id);

    List<PatientCarePlanItem> findByCarePlanIdAndDeletedAtIsNullOrderBySequenceNumberAsc(UUID carePlanId);

    List<PatientCarePlanItem> findByPatientProfileIdAndStatusAndDeletedAtIsNull(UUID patientProfileId, String status);

    List<PatientCarePlanItem> findByAppointmentIdAndDeletedAtIsNull(UUID appointmentId);
}
