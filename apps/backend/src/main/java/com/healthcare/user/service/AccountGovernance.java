package com.healthcare.user.service;

import com.healthcare.auth.AuthOtpService;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.exception.ForbiddenException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;

/** One ordering boundary for account authority and doctor/user identity bindings. */
@Component
public class AccountGovernance {
    public static final long LOCK_KEY = 0x484341434354L;
    private final JdbcTemplate jdbc;
    private final UserSecurityLock users;
    private final RefreshTokenRepository tokens;
    private final BrowserSessionService sessions;
    private final AuthOtpService otp;

    public AccountGovernance(JdbcTemplate jdbc, UserSecurityLock users, RefreshTokenRepository tokens,
                             BrowserSessionService sessions, AuthOtpService otp) {
        this.jdbc = jdbc;
        this.users = users;
        this.tokens = tokens;
        this.sessions = sessions;
        this.otp = otp;
    }

    public void acquire() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Account governance requires a transaction");
        }
        jdbc.query("select pg_advisory_xact_lock(?)", rs -> { }, LOCK_KEY);
    }

    public HealthcareUserPrincipal identity() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
            || !(authentication.getPrincipal() instanceof HealthcareUserPrincipal principal)) {
            throw new ForbiddenException("Authenticated administrator required");
        }
        return principal;
    }

    /** Call after acquire(), before reading roles or changing any linked identity. */
    public Map<UUID, User> lockUsersAndAuthorize(Collection<UUID> affected) {
        // This identity is immutable even if its editable demo flag is corrupted.
        // Reject before owner -> patient locks can invert a fixture graph's shares.
        if (affected.contains(com.healthcare.demo.DashboardDemonstration.id("patientUser"))) {
            throw new ForbiddenException("Shared demo accounts cannot be changed");
        }
        HealthcareUserPrincipal principal = identity();
        TreeSet<UUID> ids = new TreeSet<>(affected);
        ids.add(principal.getUserId());
        Map<UUID, User> locked = new HashMap<>();
        for (UUID id : ids) {
            locked.put(id, users.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found")));
        }
        User actor = locked.get(principal.getUserId());
        if (!eligibleAdministrator(actor) || actor.getSecurityVersion() != principal.getSecurityVersion()) {
            throw new ForbiddenException("Administrator access changed; sign in again");
        }
        return locked;
    }

    public static boolean eligibleAdministrator(User user) {
        return "ACTIVE".equals(user.getStatus()) && user.isEmailVerified() && !user.isDemo()
            && user.getRoles().stream().anyMatch(role -> "ADMIN".equals(role.getCode()));
    }

    public static void requireMutable(User user) {
        if (user.isDemo()) throw new ForbiddenException("Shared demo accounts cannot be changed");
    }

    /** Caller holds this user's stable row lock. All changes commit or roll back together. */
    public void invalidateCredentials(User user, String reason) {
        user.setSecurityVersion(Math.addExact(user.getSecurityVersion(), 1));
        user.setUpdatedAt(java.time.OffsetDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS));
        tokens.revokeAllActiveByUserId(user.getId());
        sessions.revokeAllForUser(user.getId(), reason);
        otp.invalidateAll(user);
    }
}
