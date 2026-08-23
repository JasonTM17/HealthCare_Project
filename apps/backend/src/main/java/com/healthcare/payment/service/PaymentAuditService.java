package com.healthcare.payment.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class PaymentAuditService {

    private final JdbcTemplate jdbcTemplate;

    public PaymentAuditService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void record(String actorEmail, String action, UUID paymentId, UUID appointmentId, String details) {
        jdbcTemplate.update(
            "insert into payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details) values (?, ?, ?, ?, ?, ?)",
            UUID.randomUUID(), actorEmail, action, paymentId, appointmentId, sanitize(details)
        );
    }

    private String sanitize(String value) {
        if (value == null) return null;
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.substring(0, Math.min(1000, normalized.length()));
    }
}
