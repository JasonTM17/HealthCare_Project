package com.healthcare.user;

import com.healthcare.user.dto.UserProfileResponse;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Users", description = "User management APIs")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
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
            roles
        ));
    }
}
