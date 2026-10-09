package com.healthcare.user;

import com.healthcare.user.dto.AdminAccountResponse;
import com.healthcare.user.dto.AdminUserResponse;
import com.healthcare.user.service.AdminAccountService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Compatibility facade: inventory and PATCH share the professional governance writer. */
@Service
public class AdminUserService {
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_DISABLED = "DISABLED";
    private final AdminAccountService accounts;

    public AdminUserService(AdminAccountService accounts) { this.accounts = accounts; }

    public Page<AdminUserResponse> list(String role, String status, String q, Pageable pageable) {
        List<String> sorts = pageable.getSort().stream()
            .map(order -> order.getProperty() + "," + order.getDirection().name().toLowerCase(java.util.Locale.ROOT)).toList();
        return accounts.list(q, role, status, null, null, null, null, pageable.getPageNumber(), pageable.getPageSize(),
            sorts.isEmpty() ? null : sorts, "desc").map(AdminUserService::response);
    }

    public AdminUserResponse updateStatus(UUID id, String status, UserDetails principal) {
        return response(accounts.patchStatus(id, status));
    }

    public AdminUserResponse updateRoles(UUID id, List<String> roles, UserDetails principal) {
        return response(accounts.patchRoles(id, roles));
    }

    private static AdminUserResponse response(AdminAccountResponse account) {
        return new AdminUserResponse(account.id(), account.email(), account.displayName(), account.status(), account.roles(),
            account.emailVerified(), account.demo(), account.phone(), account.patientProfileId(), account.doctorProfileId(),
            account.createdAt(), account.updatedAt());
    }
}
