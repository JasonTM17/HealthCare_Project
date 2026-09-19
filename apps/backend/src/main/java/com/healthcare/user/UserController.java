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
import org.springframework.http.HttpStatus;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Tag(name = "User Profile & Preferences", description = "Hồ sơ cá nhân, tùy chọn tài khoản và phân quyền người dùng")
@RestController
@RequestMapping("/api/v1/users")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserRepository userRepository;
    private final UserPreferencesService preferencesService;

    public UserController(UserRepository userRepository, UserPreferencesService preferencesService) {
        this.userRepository = userRepository;
        this.preferencesService = preferencesService;
    }

    @Operation(summary = "Lấy thông tin tài khoản người dùng hiện tại", description = "Truy xuất họ tên, email, trạng thái xác thực và danh sách vai trò (PATIENT/DOCTOR/ADMIN)")
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findWithRolesByEmail(userDetails.getUsername())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại hoặc đã bị vô hiệu hóa"));

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

    @Operation(summary = "Lấy tùy chọn người dùng (giao diện, ngôn ngữ, thông báo)", description = "Lấy cấu hình tùy biến của tài khoản người dùng hiện tại")
    @GetMapping("/me/preferences")
    public ResponseEntity<UserPreferencesResponse> getPreferences(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(preferencesService.get(currentUser(userDetails).getId()));
    }

    @Operation(summary = "Cập nhật một phần tùy chọn người dùng (PATCH)", description = "Cập nhật các trường cấu hình được chỉ định")
    @PatchMapping("/me/preferences")
    public ResponseEntity<UserPreferencesResponse> patchPreferences(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UserPreferencesPatchRequest request) {
        return ResponseEntity.ok(preferencesService.patch(currentUser(userDetails).getId(), request));
    }

    @Operation(summary = "Cập nhật toàn bộ tùy chọn người dùng (PUT)", description = "Lưu và đồng bộ cấu hình giao diện, ngôn ngữ và thông báo")
    @PutMapping("/me/preferences")
    public ResponseEntity<UserPreferencesResponse> putPreferences(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UserPreferencesPatchRequest request) {
        return ResponseEntity.ok(preferencesService.patch(currentUser(userDetails).getId(), request));
    }

    @Operation(summary = "Kiểm tra quyền truy cập Administrator", description = "Xác thực quyền quản trị viên cấp cao của phiên đăng nhập")
    @GetMapping("/admin/access")
    public ResponseEntity<Void> checkAdministratorAccess() {
        return ResponseEntity.noContent().build();
    }

    private User currentUser(UserDetails userDetails) {
        if (userDetails instanceof HealthcareUserPrincipal principal) {
            return userRepository.findById(principal.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại hoặc đã bị vô hiệu hóa"));
        }
        return userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại hoặc đã bị vô hiệu hóa"));
    }
}
