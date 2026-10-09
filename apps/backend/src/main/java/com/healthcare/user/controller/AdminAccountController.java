package com.healthcare.user.controller;

import com.healthcare.user.dto.*;
import com.healthcare.user.service.AdminAccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAccountController {
    private final AdminAccountService accounts;
    public AdminAccountController(AdminAccountService accounts) { this.accounts = accounts; }

    @GetMapping
    public ResponseEntity<Page<AdminAccountResponse>> list(
        @RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "") String role,
        @RequestParam(defaultValue = "") String status, @RequestParam(required = false) Boolean verified,
        @RequestParam(required = false) Boolean demo, @RequestParam(required = false) OffsetDateTime createdFrom,
        @RequestParam(required = false) OffsetDateTime createdTo, @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "createdAt") String sort,
        @RequestParam(defaultValue = "desc") String direction) {
        return noStore(accounts.list(q, role, status, verified, demo, createdFrom, createdTo, page, size, sort, direction));
    }
    @GetMapping("/{id}") public ResponseEntity<AdminAccountResponse> get(@PathVariable UUID id) { return noStore(accounts.get(id)); }
    @PostMapping public ResponseEntity<AdminAccountActionResponse> create(@Valid @RequestBody AdminAccountCreateRequest body, HttpServletRequest http) {
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).body(accounts.create(body, http));
    }
    @PutMapping("/{id}") public ResponseEntity<AdminAccountResponse> update(@PathVariable UUID id, @Valid @RequestBody AdminAccountUpdateRequest body, HttpServletRequest http) {
        return noStore(accounts.update(id, body, http));
    }
    @PostMapping("/{id}/{action:verification|password-reset|revoke-sessions}")
    public ResponseEntity<AdminAccountActionResponse> action(@PathVariable UUID id, @PathVariable String action,
        @Valid @RequestBody AdminAccountActionRequest body, HttpServletRequest http) { return noStore(accounts.action(id, action, body, http)); }
    private static <T> ResponseEntity<T> noStore(T value) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value); }
}
