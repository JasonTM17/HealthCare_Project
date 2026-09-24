package com.healthcare.payment.repository;

import com.healthcare.payment.entity.PaymentInvoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PaymentInvoiceRepository extends JpaRepository<PaymentInvoice, UUID> {

    Optional<PaymentInvoice> findByPaymentId(UUID paymentId);
}
