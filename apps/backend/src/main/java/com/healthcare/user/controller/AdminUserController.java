package com.healthcare.user.controller;

import com.healthcare.common.SafePageRequests;
import com.healthcare.user.AdminUserService;
import com.healthcare.user.dto.AdminUserResponse;
import com.healthcare.user.dto.AdminUserRolesRequest;
import com.healthcare.user.dto.AdminUserStatusRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.UUID;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private static final Set<String> USER_SORT_PROPERTIES =
        Set.of("id", "email", "displayName", "status", "createdAt", "updatedAt");

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @Operation(
        summary = "Danh sách tài khoản người dùng",
        description = "Liệt kê mọi tài khoản (bệnh nhân, bác sĩ, quản trị) kèm vai trò, trạng thái, "
            + "ngày tạo và hồ sơ liên kết. Hỗ trợ lọc theo vai trò/trạng thái và tìm theo email hoặc tên."
    )
    @GetMapping
    public Page<AdminUserResponse> list(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20) Pageable pageable) {
        return adminUserService.list(role, status, q,
            SafePageRequests.normalize(pageable, Sort.by(Sort.Direction.DESC, "createdAt"), USER_SORT_PROPERTIES));
    }

    @Operation(
        summary = "Bật/tắt tài khoản",
        description = "DISABLED chặn mọi kênh xác thực (đăng nhập, refresh token, phiên trình duyệt, OTP) "
            + "và thu hồi phiên đang hoạt động ngay lập tức; ACTIVE mở lại. Không thể tự khóa chính mình "
            + "hoặc khóa quản trị viên cuối cùng. Mọi thay đổi được ghi nhật ký kiểm toán."
    )
    @PatchMapping("/{id}/status")
    public AdminUserResponse updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody AdminUserStatusRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return adminUserService.updateStatus(id, request.status(), userDetails);
    }

    @Operation(
        summary = "Chỉnh sửa vai trò tài khoản",
        description = "Thay thế toàn bộ tập vai trò (PATIENT/DOCTOR/ADMIN). Tối thiểu một vai trò; không thể "
            + "sửa vai trò của chính mình hoặc thu hồi ADMIN của quản trị viên cuối cùng. Thay đổi có hiệu lực "
            + "ở request kế tiếp. Mọi thay đổi được ghi nhật ký kiểm toán."
    )
    @PatchMapping("/{id}/roles")
    public AdminUserResponse updateRoles(
            @PathVariable UUID id,
            @Valid @RequestBody AdminUserRolesRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return adminUserService.updateRoles(id, request.roles(), userDetails);
    }
}
