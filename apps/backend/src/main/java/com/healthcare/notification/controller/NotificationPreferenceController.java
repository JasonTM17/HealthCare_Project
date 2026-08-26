package com.healthcare.notification.controller;

import com.healthcare.notification.dto.NotificationPreferencePatchRequest;
import com.healthcare.notification.dto.NotificationPreferenceResponse;
import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.service.NotificationPreferenceService;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users/me/notification-preferences")
@PreAuthorize("hasRole('PATIENT')")
public class NotificationPreferenceController {
    private final NotificationPreferenceService service;
    private final UserRepository users;

    public NotificationPreferenceController(NotificationPreferenceService service, UserRepository users) {
        this.service = service;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<List<NotificationPreferenceResponse>> list(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.list(resolveUserId(principal)));
    }

    @PutMapping("/{category}/{channel}")
    public ResponseEntity<NotificationPreferenceResponse> patch(
        @AuthenticationPrincipal UserDetails principal,
        @PathVariable NotificationCategory category,
        @PathVariable NotificationChannel channel,
        @Valid @RequestBody NotificationPreferencePatchRequest request) {
        return ResponseEntity.ok(service.patch(resolveUserId(principal), category, channel, request));
    }

    private UUID resolveUserId(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal typed) return typed.getUserId();
        return users.findByEmail(principal.getUsername()).orElseThrow().getId();
    }
}
