package com.healthcare.user;

import com.healthcare.user.dto.UserProfileResponse;
import com.healthcare.user.dto.UserPreferencesPatchRequest;
import com.healthcare.user.dto.UserPreferencesResponse;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Users", description = "User management APIs")
public class UserController {

    private final UserRepository userRepository;
    private final UserPreferencesService preferencesService;

    public UserController(UserRepository userRepository, UserPreferencesService preferencesService) {
        this.userRepository = userRepository;
        this.preferencesService = preferencesService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user profile", description = "Returns the authenticated user's profile information")
    public ResponseEntity<UserProfileResponse> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findWithRolesByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));

        List<String> roles = user.getRoles().stream()
            .map(role -> role.getCode())
            .toList();

        return ResponseEntity.ok(new UserProfileResponse(
            user.getId().toString(),
            user.getEmail(),
            user.getDisplayName(),
            user.getStatus(),
            roles,
            user.isEmailVerified()
        ));
    }

    @GetMapping("/me/preferences")
    @Operation(summary = "Get current user preferences", description = "Returns preferences owned by the authenticated user")
    public ResponseEntity<UserPreferencesResponse> getPreferences(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(preferencesService.get(currentUser(userDetails).getId()));
    }

    @PatchMapping("/me/preferences")
    @Operation(summary = "Patch current user preferences", description = "Updates only supplied preference fields")
    public ResponseEntity<UserPreferencesResponse> patchPreferences(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UserPreferencesPatchRequest request) {
        return ResponseEntity.ok(preferencesService.patch(currentUser(userDetails).getId(), request));
    }

    // The local FE worker uses PUT while the public contract is PATCH. Keep
    // both verbs owner-scoped while the clients converge.
    @PutMapping("/me/preferences")
    public ResponseEntity<UserPreferencesResponse> putPreferences(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UserPreferencesPatchRequest request) {
        return ResponseEntity.ok(preferencesService.patch(currentUser(userDetails).getId(), request));
    }

    @GetMapping("/admin/access")
    @Operation(summary = "Check administrator access", description = "Foundation authorization boundary for ADMIN role")
    public ResponseEntity<Void> checkAdministratorAccess() {
        return ResponseEntity.noContent().build();
    }

    private User currentUser(UserDetails userDetails) {
        if (userDetails instanceof HealthcareUserPrincipal principal) {
            return userRepository.findById(principal.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        }
        return userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
