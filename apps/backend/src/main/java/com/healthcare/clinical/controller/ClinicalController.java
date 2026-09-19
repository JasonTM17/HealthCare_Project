package com.healthcare.clinical.controller;

import com.healthcare.clinical.dto.CreateMedicalRecordRequest;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.dto.PrescriptionResponse;
import com.healthcare.clinical.service.ClinicalService;
import com.healthcare.common.SafePageRequests;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.UUID;

@Tag(name = "Clinical Records & Prescriptions", description = "Hồ sơ bệnh án điện tử (EMR), kết quả cận lâm sàng và đơn thuốc")
@RestController
@RequestMapping("/api/v1/clinical")
public class ClinicalController {

    private static final Set<String> RECORD_SORT_PROPERTIES = Set.of("id", "createdAt");

    private final ClinicalService clinicalService;

    public ClinicalController(ClinicalService clinicalService) {
        this.clinicalService = clinicalService;
    }

    @Operation(summary = "Bác sĩ tạo bệnh án EMR và kê đơn thuốc", description = "Bác sĩ phụ trách hoàn tất ca khám, ghi nhận chẩn đoán ICD, lời dặn và kê đơn thuốc điện tử")
    @PostMapping("/records")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<MedicalRecordResponse> createRecord(
            @Valid @RequestBody CreateMedicalRecordRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(clinicalService.createMedicalRecord(request, userDetails));
    }

    @Operation(summary = "Xem chi tiết bệnh án EMR theo ID", description = "Truy xuất chi tiết bệnh án điện tử, chẩn đoán và kết luận khám bệnh của ca khám")
    @GetMapping("/records/{id}")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<MedicalRecordResponse> getRecord(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getMedicalRecord(id, userDetails));
    }

    @Operation(summary = "Xem lịch sử khám bệnh của bệnh nhân", description = "Danh sách phân trang toàn bộ các ca khám và bệnh án trong quá khứ của bệnh nhân")
    @GetMapping("/patients/{patientId}/records")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<Page<MedicalRecordResponse>> getPatientRecords(
            @PathVariable UUID patientId,
            @PageableDefault(size = 10) Pageable pageable,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPatientRecords(patientId,
            SafePageRequests.normalize(pageable, Sort.by(Sort.Direction.DESC, "createdAt"), RECORD_SORT_PROPERTIES),
            userDetails));
    }

    @Operation(summary = "Tra cứu đơn thuốc điện tử theo mã đơn", description = "Xem chi tiết danh mục thuốc, hàm lượng, liều dùng và hướng dẫn uống thuốc")
    @GetMapping("/prescriptions/{code}")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<PrescriptionResponse> getPrescription(
            @PathVariable String code,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPrescriptionByCode(code, userDetails));
    }
}
