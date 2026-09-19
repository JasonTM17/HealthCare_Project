package com.healthcare.careplan.controller;

import com.healthcare.careplan.dto.CarePlanContracts;
import com.healthcare.careplan.service.CarePlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Patient Care Plans", description = "Quản lý kế hoạch chăm sóc và lộ trình điều trị của người bệnh")
@RestController
@RequestMapping("/api/v1/doctor/care-plans")
@PreAuthorize("hasRole('DOCTOR')")
@SecurityRequirement(name = "bearerAuth")
public class DoctorCarePlanController {

    private final CarePlanService service;

    public DoctorCarePlanController(CarePlanService service) {
        this.service = service;
    }

    @Operation(summary = "Danh sách kế hoạch chăm sóc của bác sĩ", description = "Lấy danh sách các kế hoạch chăm sóc do bác sĩ phụ trách")
    @GetMapping
    public List<CarePlanContracts.Plan> list(@AuthenticationPrincipal UserDetails principal) {
        return service.doctorPlans(principal);
    }

    @Operation(summary = "Tạo kế hoạch chăm sóc mới", description = "Khởi tạo kế hoạch chăm sóc kèm các hạng mục theo dõi cho bệnh nhân")
    @PostMapping
    public ResponseEntity<CarePlanContracts.Plan> create(@Valid @RequestBody CarePlanContracts.CreateRequest request,
                                                          @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, principal));
    }

    @Operation(summary = "Cập nhật kế hoạch chăm sóc", description = "Chỉnh sửa mục tiêu hoặc trạng thái của kế hoạch chăm sóc")
    @PutMapping("/{planId}")
    public CarePlanContracts.Plan update(@PathVariable UUID planId,
                                         @Valid @RequestBody CarePlanContracts.UpdateRequest request,
                                         @AuthenticationPrincipal UserDetails principal) {
        return service.update(planId, request, principal);
    }

    @Operation(summary = "Xóa kế hoạch chăm sóc", description = "Xóa hoặc hủy kế hoạch chăm sóc đang theo dõi")
    @DeleteMapping("/{planId}")
    public ResponseEntity<Void> delete(@PathVariable UUID planId,
                                       @AuthenticationPrincipal UserDetails principal) {
        service.delete(planId, principal);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Đánh dấu hoàn thành hạng mục", description = "Bác sĩ xác nhận người bệnh đã hoàn thành hạng mục chăm sóc")
    @PostMapping("/items/{itemId}/complete")
    public CarePlanContracts.Item completeItem(@PathVariable UUID itemId,
                                               @AuthenticationPrincipal UserDetails principal) {
        return service.doctorComplete(itemId, principal);
    }

    @Operation(summary = "Hủy hạng mục chăm sóc", description = "Hủy bỏ một hạng mục chăm sóc không còn cần thiết")
    @PostMapping("/items/{itemId}/cancel")
    public CarePlanContracts.Item cancelItem(@PathVariable UUID itemId,
                                             @AuthenticationPrincipal UserDetails principal) {
        return service.doctorCancel(itemId, principal);
    }
}
