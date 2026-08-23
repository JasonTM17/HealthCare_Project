package com.healthcare.payment.repository;

import com.healthcare.payment.entity.BankTransferPayment;
import com.healthcare.payment.entity.PaymentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface BankTransferPaymentRepository extends JpaRepository<BankTransferPayment, UUID> {

    Optional<BankTransferPayment> findByAppointmentId(UUID appointmentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from BankTransferPayment p join fetch p.appointment a join fetch a.patient join fetch a.doctor left join fetch a.medicalPackage where p.appointment.id = :appointmentId")
    Optional<BankTransferPayment> findByAppointmentIdForUpdate(@Param("appointmentId") UUID appointmentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from BankTransferPayment p join fetch p.appointment a join fetch a.patient join fetch a.doctor left join fetch a.medicalPackage where p.id = :id")
    Optional<BankTransferPayment> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from BankTransferPayment p join fetch p.appointment a join fetch a.patient join fetch a.doctor left join fetch a.medicalPackage where p.transferContent = :transferContent")
    Optional<BankTransferPayment> findByTransferContentForUpdate(@Param("transferContent") String transferContent);

    @EntityGraph(attributePaths = {"appointment", "appointment.patient", "appointment.doctor", "appointment.medicalPackage"})
    @Query("select p from BankTransferPayment p")
    Page<BankTransferPayment> findAllWithAppointment(Pageable pageable);

    @EntityGraph(attributePaths = {"appointment", "appointment.patient", "appointment.doctor", "appointment.medicalPackage"})
    Page<BankTransferPayment> findByStatus(PaymentStatus status, Pageable pageable);
}
